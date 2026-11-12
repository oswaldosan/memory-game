/** Formats accepted by the admin uploader. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
] as const;

/** MIME types plus extensions, so OS pickers that don't know a MIME type still show the files. */
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_IMAGE_TYPES, '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'].join(',');

/** Hard ceiling for a single source file before compression. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Longest edge after downscaling. Cards render at ~115×161 CSS px, so this is plenty even on 3x screens. */
const MAX_EDGE_PX = 800;
const OUTPUT_QUALITY = 0.85;

/** Formats we must not re-encode: vectors stay sharp and GIFs would lose animation. */
const PASSTHROUGH_TYPES = new Set(['image/svg+xml', 'image/gif']);

const TYPE_BY_EXTENSION: Record<string, (typeof ACCEPTED_IMAGE_TYPES)[number]> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

/**
 * Returns the supported MIME type for a file, or `null` if unsupported.
 * Some browsers/OSes report an empty `file.type` (e.g. AVIF on older Safari, files from
 * certain pickers), so we fall back to the extension. HEIC is intentionally not supported:
 * most browsers cannot decode or display it.
 */
export const resolveImageType = (file: File): string | null => {
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return file.type;
  if (file.type && file.type !== 'application/octet-stream') return null;
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return TYPE_BY_EXTENSION[ext] ?? null;
};

export const isAcceptedImage = (file: File): boolean => resolveImageType(file) !== null;

/** Re-wraps a file with a proper MIME type when the browser left it empty. */
export const withResolvedType = (file: File): File => {
  const type = resolveImageType(file);
  return type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const replaceExtension = (name: string, ext: string) => {
  const base = name.replace(/\.[^.]+$/, '') || 'imagen';
  return `${base}.${ext}`;
};

/** True if any pixel is not fully opaque (sampled on the already-downscaled canvas). */
const hasTransparency = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } catch {
    return true; // can't inspect → assume alpha and keep the safest path
  }
};

/**
 * Downscales large photos client-side before uploading (phone photos are often 3–10 MB).
 * - Encodes to WebP where supported (Chrome/Firefox/Edge).
 * - Safari cannot encode WebP (canvas silently returns PNG): opaque images fall back to JPEG,
 *   images with transparency keep the original file so alpha is never lost.
 * - Any failure, or a result that isn't smaller, returns the original file.
 */
export const prepareImageForUpload = async (input: File): Promise<File> => {
  const file = withResolvedType(input);
  if (PASSTHROUGH_TYPES.has(file.type) || typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', OUTPUT_QUALITY);
    let ext = 'webp';
    // Browsers without a WebP encoder return PNG (or null) instead: only accept real WebP.
    if (!blob || blob.type !== 'image/webp') {
      if (hasTransparency(ctx, width, height)) return file;
      blob = await canvasToBlob(canvas, 'image/jpeg', OUTPUT_QUALITY);
      ext = 'jpg';
      if (!blob || blob.type !== 'image/jpeg') return file;
    }
    if (blob.size >= file.size) return file;
    return new File([blob], replaceExtension(file.name, ext), { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
};
