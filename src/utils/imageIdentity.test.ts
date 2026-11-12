import { describe, expect, it, vi } from 'vitest';
import {
  contentAddressedName,
  contentKeyFromMetadata,
  dedupeByContentKey,
  fetchContentKeys,
  findDuplicateIndices,
  md5Base64,
  parseStorageObjectUrl,
  screenByContent,
  sha256Hex,
  storageIdentity,
  storageMetadataUrl,
} from './imageIdentity';

const enc = (s: string) => new TextEncoder().encode(s);

const STORAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/essential-topic-356606.firebasestorage.app/o/games%2Fficohsagaming%2Fcards%2F2.png?alt=media&token=e1d5b448';

describe('md5Base64', () => {
  it.each([
    ['', '1B2M2Y8AsgTpgAmY7PhCfg=='],
    ['abc', 'kAFQmDzST7DWlj99KOF/cg=='],
    ['The quick brown fox jumps over the lazy dog', 'nhB9nTcrtoJr2B01QqQZ1g=='],
  ])('hashes %j like Firebase Storage md5Hash', (input, expected) => {
    expect(md5Base64(enc(input))).toBe(expected);
  });

  it('handles inputs spanning several 64-byte blocks', () => {
    // md5("a" * 1000) = cabe45dcc9ae5b66ba86600cca6b8ba8
    expect(md5Base64(enc('a'.repeat(1000)))).toBe('yr5F3MmuW2a6hmAMymuLqA==');
  });
});

describe('sha256Hex', () => {
  it('hashes with WebCrypto', async () => {
    expect(await sha256Hex(enc('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('parseStorageObjectUrl / storageMetadataUrl', () => {
  it('extracts bucket and decoded object path from a download URL', () => {
    expect(parseStorageObjectUrl(STORAGE_URL)).toEqual({
      bucket: 'essential-topic-356606.firebasestorage.app',
      path: 'games/ficohsagaming/cards/2.png',
    });
  });

  it('returns null for non-Storage URLs', () => {
    expect(parseStorageObjectUrl('/images/ficohsa/1.png')).toBeNull();
    expect(parseStorageObjectUrl('https://example.com/a.png')).toBeNull();
    expect(parseStorageObjectUrl('not a url')).toBeNull();
  });

  it('builds the CORS-enabled metadata endpoint (no alt=media, no token)', () => {
    expect(storageMetadataUrl(STORAGE_URL)).toBe(
      'https://firebasestorage.googleapis.com/v0/b/essential-topic-356606.firebasestorage.app/o/games%2Fficohsagaming%2Fcards%2F2.png'
    );
    expect(storageMetadataUrl('/images/a.png')).toBeNull();
  });
});

describe('contentKeyFromMetadata', () => {
  it('prefers the source hash recorded at upload time (survives resizing)', () => {
    expect(contentKeyFromMetadata({ md5Hash: 'stored', customMetadata: { sourceMd5: 'orig' } })).toBe('md5:orig');
  });

  it('falls back to the stored object md5', () => {
    expect(contentKeyFromMetadata({ md5Hash: 'stored' })).toBe('md5:stored');
  });

  it('returns null when metadata has no hash', () => {
    expect(contentKeyFromMetadata({})).toBeNull();
    expect(contentKeyFromMetadata(null)).toBeNull();
  });
});

describe('dedupeByContentKey', () => {
  it('collapses different URLs with identical content, keeping first-seen order', () => {
    const keys = new Map([
      ['u1', 'md5:A'],
      ['u2', 'md5:B'],
      ['u3', 'md5:A'],
      ['u4', 'md5:B'],
    ]);
    expect(dedupeByContentKey(['u1', 'u2', 'u3', 'u4'], keys)).toEqual(['u1', 'u2']);
  });

  it('falls back to URL identity for images without a key', () => {
    const keys = new Map([['u1', 'md5:A']]);
    expect(dedupeByContentKey(['u1', 'u2', 'u2', 'u3'], keys)).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('findDuplicateIndices', () => {
  it('lists every index that repeats an earlier item, with the original index', () => {
    expect(findDuplicateIndices(['A', 'B', 'A', null, 'B', 'C', null])).toEqual([
      { index: 2, duplicateOf: 0 },
      { index: 4, duplicateOf: 1 },
    ]);
  });
});

describe('screenByContent', () => {
  it('rejects a new file whose content is already a saved card, naming the card number', () => {
    const r = screenByContent(
      [
        { name: 'nuevo.png', key: 'md5:A' },
        { name: 'otro.png', key: 'md5:Z' },
      ],
      ['md5:X', 'md5:A']
    );
    expect(r.acceptedIndices).toEqual([1]);
    expect(r.rejected).toEqual([{ name: 'nuevo.png', reason: 'Imagen duplicada: ya está en el juego como carta 2' }]);
  });

  it('rejects repeats within the same selection', () => {
    const r = screenByContent(
      [
        { name: 'a.png', key: 'md5:A' },
        { name: 'a-copia.png', key: 'md5:A' },
      ],
      []
    );
    expect(r.acceptedIndices).toEqual([0]);
    expect(r.rejected[0].name).toBe('a-copia.png');
    expect(r.rejected[0].reason).toMatch(/duplicada/);
  });

  it('accepts files whose hash could not be computed', () => {
    const r = screenByContent([{ name: 'x.png', key: null }], ['md5:A']);
    expect(r.acceptedIndices).toEqual([0]);
  });
});

describe('fetchContentKeys', () => {
  const okFetch = (byPath: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const path = decodeURIComponent(url.split('/o/')[1] ?? '');
      if (!(path in byPath)) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(byPath[path]), { status: 200 });
    });

  it('resolves keys from Storage metadata in parallel', async () => {
    const other = STORAGE_URL.replace('2.png', '9.png');
    const fetchImpl = okFetch({
      'games/ficohsagaming/cards/2.png': { md5Hash: 'A' },
      'games/ficohsagaming/cards/9.png': { md5Hash: 'A' },
    });
    const keys = await fetchContentKeys([STORAGE_URL, other, '/static.png'], { fetchImpl });
    expect(keys.get(STORAGE_URL)).toBe('md5:A');
    expect(keys.get(other)).toBe('md5:A');
    expect(keys.has('/static.png')).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('never throws: failed or slow lookups are simply missing', async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const keys = await fetchContentKeys([STORAGE_URL], { fetchImpl, timeoutMs: 20 });
    expect(keys.size).toBe(0);

    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await fetchContentKeys([STORAGE_URL], { fetchImpl: failing })).size).toBe(0);

    const notOk = vi.fn(async () => new Response('{}', { status: 403 }));
    expect((await fetchContentKeys([STORAGE_URL], { fetchImpl: notOk })).size).toBe(0);
  });
});

describe('contentAddressedName', () => {
  it('names objects by SHA-256 so identical content maps to the same Storage path', () => {
    expect(contentAddressedName({ md5: 'kAFQmDzST7DWlj99KOF/cg==', sha256: 'abc123' }, 'webp')).toBe('abc123.webp');
  });

  it('falls back to a path-safe MD5 hex when SHA-256 is unavailable', () => {
    expect(contentAddressedName({ md5: 'kAFQmDzST7DWlj99KOF/cg==', sha256: null }, 'png')).toBe(
      'md5-900150983cd24fb0d6963f7d28e17f72.png'
    );
  });
});

describe('storageIdentity', () => {
  it('identifies Storage URLs by object path (tokens may differ)', () => {
    expect(storageIdentity(STORAGE_URL)).toBe(storageIdentity(STORAGE_URL.replace('e1d5b448', 'ffff')));
    expect(storageIdentity('/images/a.png')).toBe('/images/a.png');
  });
});
