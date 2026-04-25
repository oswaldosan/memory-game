import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { GameRegistryEntry, GameThemeOverride } from './gameUtils';

export interface RemoteGameInput {
  id: string;
  title: string;
  theme?: GameThemeOverride;
  logoFile?: File | null;
  cardFiles: File[];
}

export type ProgressPhase =
  | { phase: 'card'; index: number; total: number }
  | { phase: 'logo' }
  | { phase: 'firestore' }
  | { phase: 'done' };

export type ProgressFn = (p: ProgressPhase) => void;

const safeName = (name: string, idx: number) => {
  const ext = (name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${idx}.${ext}`;
};

export const loadRemoteGames = async (): Promise<GameRegistryEntry[]> => {
  try {
    const snap = await getDocs(collection(db, 'games'));
    const games: GameRegistryEntry[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<GameRegistryEntry>;
      if (data && data.id && data.title && Array.isArray(data.cards)) {
        games.push({
          id: data.id,
          title: data.title,
          logo: data.logo || '/images/logo.png',
          cards: data.cards as string[],
          theme: data.theme,
        });
      }
    });
    return games;
  } catch (err) {
    console.warn('[firestore] No se pudieron cargar juegos remotos:', err);
    return [];
  }
};

export const createRemoteGame = async (
  input: RemoteGameInput,
  uid: string,
  onProgress?: ProgressFn
): Promise<GameRegistryEntry> => {
  const { id, title, theme, logoFile, cardFiles } = input;
  const basePath = `games/${id}`;

  const cardUrls: string[] = [];
  for (let i = 0; i < cardFiles.length; i++) {
    onProgress?.({ phase: 'card', index: i + 1, total: cardFiles.length });
    const f = cardFiles[i];
    const r = ref(storage, `${basePath}/cards/${safeName(f.name, i + 1)}`);
    await uploadBytes(r, f, { contentType: f.type });
    cardUrls.push(await getDownloadURL(r));
  }

  let logoUrl: string | undefined;
  if (logoFile) {
    onProgress?.({ phase: 'logo' });
    const r = ref(storage, `${basePath}/logo.${(logoFile.name.split('.').pop() || 'png').toLowerCase()}`);
    await uploadBytes(r, logoFile, { contentType: logoFile.type });
    logoUrl = await getDownloadURL(r);
  }

  const entry: GameRegistryEntry = {
    id,
    title,
    logo: logoUrl || '/images/logo.png',
    cards: cardUrls,
    theme,
  };

  onProgress?.({ phase: 'firestore' });
  await setDoc(doc(db, 'games', id), {
    ...entry,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });

  onProgress?.({ phase: 'done' });
  return entry;
};

export const getRemoteGame = async (id: string): Promise<GameRegistryEntry | null> => {
  const snap = await getDoc(doc(db, 'games', id));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<GameRegistryEntry>;
  if (!data.id || !data.title || !Array.isArray(data.cards)) return null;
  return {
    id: data.id,
    title: data.title,
    logo: data.logo || '/images/logo.png',
    cards: data.cards as string[],
    theme: data.theme,
  };
};

export interface RemoteGameUpdate {
  id: string;
  title: string;
  theme?: GameThemeOverride;
  logoFile?: File | null;
  keepCards: string[];
  newCardFiles: File[];
}

export const updateRemoteGame = async (
  input: RemoteGameUpdate,
  uid: string,
  onProgress?: ProgressFn
): Promise<GameRegistryEntry> => {
  const { id, title, theme, logoFile, keepCards, newCardFiles } = input;
  const basePath = `games/${id}`;
  const stamp = Date.now();

  const newUrls: string[] = [];
  for (let i = 0; i < newCardFiles.length; i++) {
    onProgress?.({ phase: 'card', index: i + 1, total: newCardFiles.length });
    const f = newCardFiles[i];
    const r = ref(storage, `${basePath}/cards/${stamp}-${safeName(f.name, i + 1)}`);
    await uploadBytes(r, f, { contentType: f.type });
    newUrls.push(await getDownloadURL(r));
  }

  const cards = [...keepCards, ...newUrls];

  let logoUrl: string | undefined;
  if (logoFile) {
    onProgress?.({ phase: 'logo' });
    const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase();
    const r = ref(storage, `${basePath}/logo-${stamp}.${ext}`);
    await uploadBytes(r, logoFile, { contentType: logoFile.type });
    logoUrl = await getDownloadURL(r);
  }

  onProgress?.({ phase: 'firestore' });
  const payload: { [k: string]: unknown } = {
    title,
    cards,
    theme: theme ?? null,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
  if (logoUrl) payload.logo = logoUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'games', id), payload as any);

  onProgress?.({ phase: 'done' });
  const updated = await getRemoteGame(id);
  if (!updated) throw new Error('No se pudo leer el juego actualizado');
  return updated;
};

export const deleteRemoteGame = async (id: string): Promise<void> => {
  const folderRef = ref(storage, `games/${id}`);

  const removeRecursive = async (folder: typeof folderRef): Promise<void> => {
    const list = await listAll(folder);
    await Promise.all(list.items.map((item) => deleteObject(item).catch(() => undefined)));
    for (const sub of list.prefixes) {
      await removeRecursive(sub);
    }
  };

  try {
    await removeRecursive(folderRef);
  } catch (err) {
    console.warn('[deleteRemoteGame] limpieza Storage parcial', err);
  }
  await deleteDoc(doc(db, 'games', id));
};
