import {
  collection,
  deleteDoc,
  deleteField,
  type DocumentData,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable,
  type StorageReference,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { mapWithConcurrency } from './async';
import { DEFAULT_LOGO, type GameRegistryEntry, type GameThemeOverride } from './gameUtils';
import { prepareImageForUpload } from './imageProcessing';

/**
 * Card images are uploaded to Firebase Storage and only their download URLs are stored
 * in the Firestore document, so the 1 MiB document limit is never a concern
 * (a URL is ~200 bytes → thousands of cards fit).
 */

/** An ordered card slot: either an already-uploaded URL or a new local file. */
export type CardSource = { kind: 'remote'; url: string } | { kind: 'local'; file: File };

export interface RemoteGameInput {
  id: string;
  title: string;
  theme?: GameThemeOverride;
  logoFile?: File | null;
  cards: CardSource[];
  /** `null` = automatic (scales with pairs). */
  maxMoves: number | null;
  /** Edit only: restore the default logo (ignored when `logoFile` is set). */
  resetLogo?: boolean;
}

export class GameIdTakenError extends Error {
  constructor(id: string) {
    super(`Ya existe un juego con el identificador "${id}".`);
    this.name = 'GameIdTakenError';
  }
}

export type ProgressPhase =
  | { phase: 'preparing'; done: number; total: number }
  | { phase: 'uploading'; percent: number; done: number; total: number }
  | { phase: 'saving' }
  | { phase: 'done' };

export type ProgressFn = (p: ProgressPhase) => void;

const UPLOAD_CONCURRENCY = 3;

const extOf = (file: File) =>
  (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';

const uniqueName = (file: File, prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;

const parseEntry = (data: Partial<GameRegistryEntry> | undefined): GameRegistryEntry | null => {
  if (!data || !data.id || !data.title || !Array.isArray(data.cards)) return null;
  return {
    id: data.id,
    title: data.title,
    logo: data.logo || DEFAULT_LOGO,
    cards: data.cards.filter((c): c is string => typeof c === 'string' && c.length > 0),
    theme: data.theme ?? undefined,
    maxMoves: typeof data.maxMoves === 'number' ? data.maxMoves : null,
  };
};

/** Lists games from Firestore. Throws on network/permission errors (use in admin UI). */
export const listRemoteGames = async (): Promise<GameRegistryEntry[]> => {
  const snap = await getDocs(collection(db, 'games'));
  const games: GameRegistryEntry[] = [];
  snap.forEach((d) => {
    const entry = parseEntry(d.data() as Partial<GameRegistryEntry>);
    if (entry) games.push(entry);
  });
  return games.sort((a, b) => a.title.localeCompare(b.title, 'es'));
};

/** Same as `listRemoteGames` but never throws (players still get the static games). */
export const loadRemoteGames = async (): Promise<GameRegistryEntry[]> => {
  try {
    return await listRemoteGames();
  } catch (err) {
    console.warn('[firestore] No se pudieron cargar juegos remotos:', err);
    return [];
  }
};

export const getRemoteGame = async (id: string): Promise<GameRegistryEntry | null> => {
  const snap = await getDoc(doc(db, 'games', id));
  if (!snap.exists()) return null;
  return parseEntry(snap.data() as Partial<GameRegistryEntry>);
};

export const remoteGameExists = async (id: string): Promise<boolean> =>
  (await getDoc(doc(db, 'games', id))).exists();

interface UploadJob {
  file: File;
  path: string;
}

/** Uploads files with bounded concurrency and reports aggregated byte progress. */
const uploadAll = async (
  jobs: UploadJob[],
  onProgress: ProgressFn | undefined,
  uploaded: StorageReference[]
): Promise<string[]> => {
  const totalBytes = jobs.reduce((sum, j) => sum + j.file.size, 0) || 1;
  const transferred = new Array<number>(jobs.length).fill(0);
  let done = 0;
  const report = () =>
    onProgress?.({
      phase: 'uploading',
      percent: Math.min(100, Math.round((transferred.reduce((a, b) => a + b, 0) / totalBytes) * 100)),
      done,
      total: jobs.length,
    });

  report();
  return mapWithConcurrency(jobs, UPLOAD_CONCURRENCY, async (job, i) => {
    const r = ref(storage, job.path);
    const task = uploadBytesResumable(r, job.file, {
      contentType: job.file.type || undefined,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    task.on('state_changed', (s) => {
      transferred[i] = s.bytesTransferred;
      report();
    });
    await task;
    uploaded.push(r);
    transferred[i] = job.file.size;
    done++;
    report();
    return getDownloadURL(r);
  });
};

/** Compresses local images (in order) before upload. */
const prepareAll = async (files: File[], onProgress?: ProgressFn): Promise<File[]> => {
  let done = 0;
  onProgress?.({ phase: 'preparing', done, total: files.length });
  return mapWithConcurrency(files, 2, async (f) => {
    const out = await prepareImageForUpload(f);
    done++;
    onProgress?.({ phase: 'preparing', done, total: files.length });
    return out;
  });
};

const bestEffortDelete = async (refs: StorageReference[]) => {
  await Promise.all(refs.map((r) => deleteObject(r).catch(() => undefined)));
};

/**
 * Uploads the local files referenced by `cards` (+ optional logo) and returns
 * the final ordered URL list. On failure, already-uploaded files are cleaned up.
 */
const uploadGameAssets = async (
  id: string,
  cards: CardSource[],
  logoFile: File | null | undefined,
  onProgress?: ProgressFn
): Promise<{ cardUrls: string[]; logoUrl?: string; uploaded: StorageReference[] }> => {
  const basePath = `games/${id}`;
  const localFiles = cards.flatMap((c) => (c.kind === 'local' ? [c.file] : []));
  const toPrepare = logoFile ? [...localFiles, logoFile] : localFiles;
  const prepared = await prepareAll(toPrepare, onProgress);

  const jobs: UploadJob[] = prepared.map((file, i) => {
    const isLogo = logoFile && i === prepared.length - 1;
    return {
      file,
      path: isLogo ? `${basePath}/${uniqueName(file, 'logo')}` : `${basePath}/cards/${uniqueName(file, 'card')}`,
    };
  });

  const uploaded: StorageReference[] = [];
  let urls: string[];
  try {
    urls = await uploadAll(jobs, onProgress, uploaded);
  } catch (err) {
    await bestEffortDelete(uploaded);
    throw err;
  }

  const logoUrl = logoFile ? urls.pop() : undefined;
  let next = 0;
  const cardUrls = cards.map((c) => (c.kind === 'remote' ? c.url : urls[next++]));
  return { cardUrls, logoUrl, uploaded };
};

export const createRemoteGame = async (
  input: RemoteGameInput,
  uid: string,
  onProgress?: ProgressFn
): Promise<GameRegistryEntry> => {
  const { id, title, theme, logoFile, cards, maxMoves } = input;

  // Fast pre-check so we don't upload anything for an id that is clearly taken.
  // The transaction below is what actually guarantees we never overwrite a game.
  if (await remoteGameExists(id)) throw new GameIdTakenError(id);

  const { cardUrls, logoUrl, uploaded } = await uploadGameAssets(id, cards, logoFile, onProgress);

  const entry: GameRegistryEntry = {
    id,
    title,
    logo: logoUrl || DEFAULT_LOGO,
    cards: cardUrls,
    // Firestore rejects `undefined` values, so optional fields are only spread in when set.
    ...(theme ? { theme } : {}),
    ...(maxMoves ? { maxMoves } : {}),
  };

  onProgress?.({ phase: 'saving' });
  try {
    const docRef = doc(db, 'games', id);
    await runTransaction(db, async (tx) => {
      if ((await tx.get(docRef)).exists()) throw new GameIdTakenError(id);
      tx.set(docRef, { ...entry, createdBy: uid, createdAt: serverTimestamp() });
    });
  } catch (err) {
    await bestEffortDelete(uploaded);
    throw err;
  }

  onProgress?.({ phase: 'done' });
  return entry;
};

/** Only deletes objects that live under this game's own Storage folder. */
const storageRefForOwnedUrl = (url: string, id: string): StorageReference | null => {
  try {
    const r = ref(storage, url);
    return r.fullPath.startsWith(`games/${id}/`) ? r : null;
  } catch {
    return null;
  }
};

export const updateRemoteGame = async (
  input: RemoteGameInput,
  uid: string,
  onProgress?: ProgressFn
): Promise<GameRegistryEntry> => {
  const { id, title, theme, logoFile, cards, maxMoves, resetLogo } = input;
  const previous = await getRemoteGame(id);
  if (!previous) throw new Error('El juego ya no existe. Recarga la página.');

  const { cardUrls, logoUrl, uploaded } = await uploadGameAssets(id, cards, logoFile, onProgress);

  onProgress?.({ phase: 'saving' });
  const payload: DocumentData = {
    title,
    cards: cardUrls,
    maxMoves: maxMoves ?? deleteField(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
  // `undefined` means "no theme and none was set": leave the field alone.
  if (theme !== undefined) payload.theme = theme;
  if (logoUrl) payload.logo = logoUrl;
  else if (resetLogo) payload.logo = DEFAULT_LOGO;

  try {
    await updateDoc(doc(db, 'games', id), payload);
  } catch (err) {
    await bestEffortDelete(uploaded);
    throw err;
  }

  // Re-read after writing: if another admin saved in the meantime, their references must be kept.
  const current = await getRemoteGame(id).catch(() => null);

  // Clean up images that are no longer referenced (removed cards, replaced/reset logo).
  // Only runs when we could confirm the latest document; otherwise we'd risk deleting live files.
  if (current) {
    const finalLogo = logoUrl ?? (resetLogo ? DEFAULT_LOGO : previous.logo);
    const stillUsed = new Set([...cardUrls, finalLogo, ...current.cards, current.logo]);
    const orphaned = [...previous.cards, previous.logo]
      .filter((url) => !stillUsed.has(url))
      .map((url) => storageRefForOwnedUrl(url, id))
      .filter((r): r is StorageReference => r !== null);
    await bestEffortDelete(orphaned);
  }

  onProgress?.({ phase: 'done' });
  return current ?? { ...previous, title, cards: cardUrls, theme, maxMoves };
};

export const deleteRemoteGame = async (id: string): Promise<void> => {
  const folderRef = ref(storage, `games/${id}`);

  const removeRecursive = async (folder: StorageReference): Promise<void> => {
    const list = await listAll(folder);
    await Promise.all(list.items.map((item) => deleteObject(item).catch(() => undefined)));
    for (const sub of list.prefixes) {
      await removeRecursive(sub);
    }
  };

  // Delete the document first: if Storage cleanup fails the game is already gone for players.
  await deleteDoc(doc(db, 'games', id));
  try {
    await removeRecursive(folderRef);
  } catch (err) {
    console.warn('[deleteRemoteGame] limpieza Storage parcial', err);
  }
};
