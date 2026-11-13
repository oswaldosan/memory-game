import type { Card } from '../types';
import gameConfig from '../gameConfig.json';
import { dedupeImagesByContent } from './imageIdentity';

/** Logo used when a game has none configured. */
export const DEFAULT_LOGO = '/images/logo.png';

export type RandomFn = () => number;

/** Unbiased Fisher–Yates shuffle. Returns a new array; the input is never mutated. */
export const shuffleArray = <T>(array: readonly T[], rng: RandomFn = Math.random): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/** Normalizes the image list: trims, drops empty entries and duplicates (a duplicated URL would create an ambiguous 4-card "pair"). */
export const normalizeImages = (images: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of images) {
    const img = typeof raw === 'string' ? raw.trim() : '';
    if (!img || seen.has(img)) continue;
    seen.add(img);
    out.push(img);
  }
  return out;
};

/** Builds a shuffled deck with exactly two cards per (unique) image. There is no cap on pairs. */
export const createGameCards = (images: readonly string[], rng: RandomFn = Math.random): Card[] => {
  const cards: Card[] = normalizeImages(images).flatMap((image, index) => {
    const pairId = String(index);
    return [
      { id: `${pairId}-a`, pairId, image, matched: false, flipped: false },
      { id: `${pairId}-b`, pairId, image, matched: false, flipped: false },
    ];
  });
  return shuffleArray(cards, rng);
};

const MAX_BOARD_COLUMNS = 8;
/** Cards are portrait (115×161), so a "square" board needs more columns than rows. */
const CARD_ASPECT = 115 / 161;
const EMPTY_SLOT_PENALTY = 0.5;

/**
 * Picks a column count that keeps the board close to square while avoiding
 * half-empty last rows. Works for any deck size.
 */
export const getBoardColumns = (cardCount: number): number => {
  if (cardCount <= 2) return Math.max(1, cardCount);
  const ideal = Math.sqrt(cardCount / CARD_ASPECT);
  let best = 2;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let cols = 2; cols <= MAX_BOARD_COLUMNS; cols++) {
    const emptySlots = Math.ceil(cardCount / cols) * cols - cardCount;
    const score = Math.abs(cols - ideal) + emptySlots * EMPTY_SLOT_PENALTY;
    if (score < bestScore) {
      best = cols;
      bestScore = score;
    }
  }
  return best;
};

export const MOVES_PER_PAIR: number = gameConfig.gameSettings.board.movesPerPair;

/**
 * Move budget for a game. Scales with the number of pairs (4 pairs → 20 moves),
 * unless a valid per-game override is configured. Never less than the number of pairs,
 * otherwise the game would be unwinnable.
 */
export const getMaxMovesForPairs = (pairs: number, override?: number | null): number => {
  const safePairs = Math.max(0, Math.floor(pairs));
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.max(safePairs, Math.floor(override));
  }
  return safePairs * MOVES_PER_PAIR;
};

/** Returns a copy of `list` with the item at `from` moved to `to`. Out-of-range moves are no-ops. */
export const moveItem = <T>(list: readonly T[], from: number, to: number): T[] => {
  const copy = [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) {
    return copy;
  }
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Turns a free-form title into a valid game id (`a-z`, `0-9`, `-`, max 41 chars). */
export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 41)
    .replace(/-+$/g, '');

export interface GameThemeOverride {
  layout?: {
    backgroundType?: 'solid' | 'gradient';
    backgroundColor?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientDirection?: string;
  };
  /** Color del texto principal (stats, labels) sobre el fondo de la app */
  appTextColor?: string;
  /** Texto del modal de fin de juego */
  modalTextColor?: string;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  buttons?: {
    baseStart?: string;
    baseEnd?: string;
    textColor?: string;
    primaryStart?: string;
    primaryEnd?: string;
    primaryTextColor?: string;
  };
  controlsBg?: string;
  gameBoardBg?: string;
  modal?: {
    backgroundType?: 'solid' | 'gradient';
    backgroundColor?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientDirection?: string;
  };
}

export interface GameRegistryEntry {
  id: string;
  title: string;
  logo: string;
  cards: string[];
  theme?: GameThemeOverride;
  /** Límite de movimientos opcional. Si no se define, se calcula según la cantidad de parejas. */
  maxMoves?: number | null;
  /** Si es true, se fusionan cartas/logo desde /games/ficohsa.assets.json (generado por scripts/sync-ficohsa-assets.mjs). */
  useFicohsaAssetBundle?: boolean;
}

export interface GameRegistry {
  games: GameRegistryEntry[];
}

export const loadGameRegistry = async (): Promise<GameRegistry> => {
  const staticPromise = fetch('/games/index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<GameRegistry>;
    })
    .catch(() => ({ games: [] as GameRegistryEntry[] }));

  const remotePromise = import('./gamesRemote')
    .then((m) => m.loadRemoteGames())
    .catch(() => [] as GameRegistryEntry[]);

  const [staticReg, remote] = await Promise.all([staticPromise, remotePromise]);
  const staticGames = staticReg.games || [];
  // Bundle-backed entries (Ficohsa) list `cards: []` in index.json; resolve them here so every
  // consumer (menu, admin, game) sees the same real card list.
  const bundle = staticGames.some(usesAssetBundle) ? await loadFicohsaAssetBundle() : null;
  const resolvedStatic = staticGames.map((g) => applyAssetBundle(g, bundle));
  const ids = new Set(resolvedStatic.map((g) => g.id));
  return { games: [...resolvedStatic, ...remote.filter((g) => !ids.has(g.id))] };
};

export const getGameIdFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  return params.get('game') || 'initial';
};

/** When navigating by route (e.g. `/ficohsa`), pass `routeGameId`. Otherwise `?game=` applies. */
export const resolveEffectiveGameId = (routeGameId?: string): string => {
  if (routeGameId) {
    return routeGameId;
  }
  return getGameIdFromUrl();
};

export interface FicohsaAssetBundle {
  cards: string[];
  logo?: string;
}

let ficohsaBundleCache: FicohsaAssetBundle | null | undefined;

export const loadFicohsaAssetBundle = async (): Promise<FicohsaAssetBundle | null> => {
  if (ficohsaBundleCache !== undefined) {
    return ficohsaBundleCache;
  }
  try {
    const res = await fetch('/games/ficohsa.assets.json', { cache: 'no-store' });
    if (!res.ok) {
      ficohsaBundleCache = null;
      return null;
    }
    const data = (await res.json()) as FicohsaAssetBundle;
    if (!Array.isArray(data.cards)) {
      ficohsaBundleCache = null;
      return null;
    }
    ficohsaBundleCache = data;
    return data;
  } catch {
    ficohsaBundleCache = null;
    return null;
  }
};

/** Solo útil en tests o hot-reload del bundle en dev */
export const clearFicohsaAssetBundleCache = (): void => {
  ficohsaBundleCache = undefined;
};

export interface ResolvedGameAssets {
  images: string[];
  logoUrl: string;
  gameId: string;
  title: string;
  theme?: GameThemeOverride;
  maxMoves?: number | null;
}

export const usesAssetBundle = (entry: GameRegistryEntry): boolean =>
  !!entry.useFicohsaAssetBundle || entry.id === 'ficohsa';

/** Merges the synced asset bundle (cards/logo) into a bundle-backed registry entry. Pure. */
export const applyAssetBundle = (
  entry: GameRegistryEntry,
  bundle: FicohsaAssetBundle | null
): GameRegistryEntry => {
  if (!bundle || !usesAssetBundle(entry)) return entry;
  return {
    ...entry,
    cards: bundle.cards.length > 0 ? bundle.cards : entry.cards,
    logo: bundle.logo || entry.logo,
  };
};

export const resolveGameAssets = async (explicitGameId?: string): Promise<ResolvedGameAssets> => {
  const registry = await loadGameRegistry();
  const gameId = explicitGameId || getGameIdFromUrl();
  const entry = registry.games.find((g) => g.id === gameId);
  if (!entry) {
    // Previously this silently fell back to the first game, which showed the wrong game for typos.
    throw new Error(
      registry.games.length === 0 ? 'No hay juegos disponibles.' : `No existe un juego con el identificador "${gameId}".`
    );
  }

  // `loadGameRegistry` has already merged the asset bundle into bundle-backed entries.
  // Content dedupe: the same picture uploaded twice (different URLs) must form ONE pair,
  // otherwise matching two identical-looking cards counts as a mismatch. Best effort and
  // time-boxed; falls back to URL dedupe if Storage metadata can't be read.
  const images = await dedupeImagesByContent(normalizeImages(entry.cards));
  return {
    images,
    logoUrl: entry.logo,
    gameId: entry.id,
    title: entry.title,
    theme: entry.theme,
    maxMoves: entry.maxMoves,
  };
};

/** Formats a duration as `m:ss` (or `h:mm:ss` past one hour). */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};
