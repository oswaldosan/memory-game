/**
 * Content identity for card images.
 *
 * Two different URLs can point to the same picture (e.g. the same file uploaded twice).
 * If that happens the game builds two "pairs" with the same picture, and matching two
 * visually identical cards from different pairs counts as a mismatch.
 *
 * Identity key = MD5 of the ORIGINAL file bytes, base64-encoded (the same format Firebase
 * Storage reports as `md5Hash`). New uploads also store it as `customMetadata.sourceMd5`, so
 * the key survives client-side resizing.
 *
 * Why metadata and not the image bytes: the Storage bucket serves `alt=media` downloads
 * without CORS headers, so the browser cannot read image bytes. The JSON metadata endpoint
 * (`/v0/b/{bucket}/o/{path}`) does send `Access-Control-Allow-Origin: *` and includes `md5Hash`.
 */

export type ContentKey = string;

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/**
 * MD5 digest, base64-encoded (matches Firebase Storage `md5Hash`).
 * WebCrypto has no MD5, and this is only used as a content fingerprint, not for security.
 */
export const md5Base64 = (input: Uint8Array): string => {
  const len = input.length;
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(input);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, (len * 8) >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(len / 0x20000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let off = 0; off < paddedLen; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + M[g]) >>> 0;
      B = (B + ((sum << S[i]) | (sum >>> (32 - S[i])))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((w, i) => outView.setUint32(i * 4, w, true));
  return toBase64(out);
};

/** SHA-256 hex digest via WebCrypto, or `null` where it's unavailable (insecure context). */
export const sha256Hex = async (input: Uint8Array): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest('SHA-256', input);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
};

export interface FileHashes {
  md5: string;
  sha256: string | null;
}

/** Hashes a file's original bytes (before any resizing). */
export const hashFile = async (file: Blob): Promise<FileHashes> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { md5: md5Base64(bytes), sha256: await sha256Hex(bytes) };
};

export const contentKeyFromMd5 = (md5: string): ContentKey => `md5:${md5}`;

// ---------------------------------------------------------------------------
// Firebase Storage metadata
// ---------------------------------------------------------------------------

const STORAGE_HOST = 'firebasestorage.googleapis.com';

export const parseStorageObjectUrl = (url: string): { bucket: string; path: string } | null => {
  try {
    const u = new URL(url);
    if (u.hostname !== STORAGE_HOST) return null;
    const m = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
};

/** JSON metadata endpoint for a Storage download URL (served with CORS). */
export const storageMetadataUrl = (url: string): string | null => {
  const parsed = parseStorageObjectUrl(url);
  if (!parsed) return null;
  return `https://${STORAGE_HOST}/v0/b/${parsed.bucket}/o/${encodeURIComponent(parsed.path)}`;
};

/** Stable identity of an image URL: Storage object path (ignores token/query), else the URL. */
export const storageIdentity = (url: string): string => {
  const parsed = parseStorageObjectUrl(url);
  return parsed ? `${parsed.bucket}/${parsed.path}` : url;
};

const base64ToHex = (b64: string): string =>
  Array.from(atob(b64), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

/** Content-addressed object name: identical original bytes → identical Storage path. */
export const contentAddressedName = (hashes: FileHashes, ext: string): string =>
  `${hashes.sha256 ?? `md5-${base64ToHex(hashes.md5)}`}.${ext}`;

interface StorageMetadata {
  md5Hash?: string;
  customMetadata?: { sourceMd5?: string };
}

export const contentKeyFromMetadata = (meta: StorageMetadata | null | undefined): ContentKey | null => {
  const md5 = meta?.customMetadata?.sourceMd5 || meta?.md5Hash;
  return md5 ? contentKeyFromMd5(md5) : null;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Looks up content keys for Storage URLs in parallel. Never throws and never blocks longer
 * than `timeoutMs`: URLs that fail (offline, rules, timeout) are just absent from the map,
 * and callers fall back to URL identity for them.
 */
export const fetchContentKeys = async (
  urls: readonly string[],
  { fetchImpl = fetch, timeoutMs = 2500 }: { fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<Map<string, ContentKey>> => {
  const keys = new Map<string, ContentKey>();
  const unique = [...new Set(urls)];
  const controller = typeof AbortController === 'function' ? new AbortController() : null;

  const lookups = unique.map(async (url) => {
    const metaUrl = storageMetadataUrl(url);
    if (!metaUrl) return;
    try {
      const res = await fetchImpl(metaUrl, { signal: controller?.signal, credentials: 'omit' });
      if (!res.ok) return;
      const key = contentKeyFromMetadata((await res.json()) as StorageMetadata);
      if (key) keys.set(url, key);
    } catch {
      // Best effort: ignore.
    }
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve();
    }, timeoutMs);
  });
  await Promise.race([Promise.all(lookups), timeout]);
  clearTimeout(timer);
  // Copy so late resolutions after a timeout can't mutate what the caller already used.
  return new Map(keys);
};

// ---------------------------------------------------------------------------
// Pure dedupe helpers
// ---------------------------------------------------------------------------

/** Removes images whose content key (or URL, when unknown) was already seen. Keeps order. */
export const dedupeByContentKey = (images: readonly string[], keys: ReadonlyMap<string, ContentKey>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of images) {
    const id = keys.get(url) ?? `url:${url}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(url);
  }
  return out;
};

/** Indices whose key repeats an earlier one. `null` keys are never duplicates. */
export const findDuplicateIndices = (
  keys: readonly (ContentKey | null | undefined)[]
): { index: number; duplicateOf: number }[] => {
  const first = new Map<string, number>();
  const dups: { index: number; duplicateOf: number }[] = [];
  keys.forEach((key, index) => {
    if (!key) return;
    const prev = first.get(key);
    if (prev === undefined) first.set(key, index);
    else dups.push({ index, duplicateOf: prev });
  });
  return dups;
};

/**
 * Screens newly selected files against the cards already in the form (`existingKeys`, in
 * display order) and against each other. Files without a key are accepted.
 */
export const screenByContent = (
  candidates: readonly { name: string; key: ContentKey | null }[],
  existingKeys: readonly (ContentKey | null | undefined)[]
): { acceptedIndices: number[]; rejected: { name: string; reason: string }[] } => {
  const existing = new Map<string, number>();
  existingKeys.forEach((k, i) => {
    if (k && !existing.has(k)) existing.set(k, i);
  });
  const selected = new Set<string>();
  const acceptedIndices: number[] = [];
  const rejected: { name: string; reason: string }[] = [];

  candidates.forEach((c, i) => {
    if (c.key && existing.has(c.key)) {
      rejected.push({
        name: c.name,
        reason: `Imagen duplicada: ya está en el juego como carta ${existing.get(c.key)! + 1}`,
      });
    } else if (c.key && selected.has(c.key)) {
      rejected.push({ name: c.name, reason: 'Imagen duplicada: repite otra imagen de esta selección' });
    } else {
      if (c.key) selected.add(c.key);
      acceptedIndices.push(i);
    }
  });
  return { acceptedIndices, rejected };
};

/** Resolves image list content-wise for the game: content dedupe with URL fallback. */
export const dedupeImagesByContent = async (images: readonly string[]): Promise<string[]> => {
  if (!images.some((u) => parseStorageObjectUrl(u))) return [...images];
  const keys = await fetchContentKeys(images);
  return dedupeByContentKey(images, keys);
};
