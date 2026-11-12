import type { CardSource } from './gamesRemote';
import { MAX_SOURCE_BYTES, formatBytes, isAcceptedImage } from './imageProcessing';

/** A card image slot in the admin editor. `key` is stable across reorders. */
export type CardItem =
  | { key: string; kind: 'remote'; url: string }
  | { key: string; kind: 'local'; file: File; previewUrl: string };

export interface RejectedFile {
  name: string;
  reason: string;
}

let keySeq = 0;
export const nextItemKey = () => `item-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

const fileFingerprint = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/**
 * Splits picked/dropped files into accepted and rejected (wrong type, too large,
 * or already in the list). Never limits how many images can be added.
 */
export const screenFiles = (
  existing: readonly CardItem[],
  files: readonly File[]
): { accepted: File[]; rejected: RejectedFile[] } => {
  const seen = new Set(existing.flatMap((i) => (i.kind === 'local' ? [fileFingerprint(i.file)] : [])));
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (!isAcceptedImage(file)) {
      rejected.push({ name: file.name, reason: 'formato no soportado' });
    } else if (file.size > MAX_SOURCE_BYTES) {
      rejected.push({ name: file.name, reason: `supera ${formatBytes(MAX_SOURCE_BYTES)}` });
    } else if (seen.has(fileFingerprint(file))) {
      rejected.push({ name: file.name, reason: 'ya está en la lista' });
    } else {
      seen.add(fileFingerprint(file));
      accepted.push(file);
    }
  }
  return { accepted, rejected };
};

export const remoteItems = (urls: readonly string[]): CardItem[] =>
  urls.map((url) => ({ key: nextItemKey(), kind: 'remote', url }));

export const toCardSources = (items: readonly CardItem[]): CardSource[] =>
  items.map((i) => (i.kind === 'remote' ? { kind: 'remote', url: i.url } : { kind: 'local', file: i.file }));

export const itemSrc = (item: CardItem) => (item.kind === 'remote' ? item.url : item.previewUrl);

export const revokeLocalPreviews = (items: readonly CardItem[]) => {
  for (const i of items) if (i.kind === 'local') URL.revokeObjectURL(i.previewUrl);
};
