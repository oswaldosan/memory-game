import { Card } from '../types';

export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const shuffleCards = (cards: Card[]): Card[] => {
  return shuffleArray(cards);
};

export const createGameCards = (images: string[]): Card[] => {
  // Create pairs manually instead of using flatMap
  const pairs: Card[] = [];
  
  images.forEach((image: string, index: number) => {
    pairs.push({
      id: `${index}-a`,
      image,
      matched: false,
      flipped: false
    });
    pairs.push({
      id: `${index}-b`,
      image,
      matched: false,
      flipped: false
    });
  });
  
  return shuffleCards(pairs);
};

export const getGameConfig = async (): Promise<any> => {
  const response = await fetch('/gameConfig.json');
  return response.json();
};

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
  /** Si es true, se fusionan cartas/logo desde /games/ficohsa.assets.json (generado por scripts/sync-ficohsa-assets.mjs). */
  useFicohsaAssetBundle?: boolean;
}

export interface GameRegistry {
  games: GameRegistryEntry[];
}

export const loadGameRegistry = async (): Promise<GameRegistry> => {
  const staticPromise = fetch('/games/index.json')
    .then((r) => r.json() as Promise<GameRegistry>)
    .catch(() => ({ games: [] as GameRegistryEntry[] }));

  const remotePromise = import('./gamesRemote')
    .then((m) => m.loadRemoteGames())
    .catch(() => [] as GameRegistryEntry[]);

  const [staticReg, remote] = await Promise.all([staticPromise, remotePromise]);
  const ids = new Set((staticReg.games || []).map((g) => g.id));
  const merged = [...(staticReg.games || []), ...remote.filter((g) => !ids.has(g.id))];
  return { games: merged };
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

export const resolveGameAssets = async (
  explicitGameId?: string
): Promise<{ images: string[]; logoUrl: string; gameId: string; title: string; theme?: GameThemeOverride }> => {
  const registry = await loadGameRegistry();
  const gameId = explicitGameId || getGameIdFromUrl();
  const entry = registry.games.find(g => g.id === gameId) || registry.games[0];

  let images = entry.cards;
  let logoUrl = entry.logo;

  if (entry.useFicohsaAssetBundle || entry.id === 'ficohsa') {
    const bundle = await loadFicohsaAssetBundle();
    if (bundle) {
      if (bundle.cards.length > 0) {
        images = bundle.cards;
      }
      if (bundle.logo) {
        logoUrl = bundle.logo;
      }
    }
  }

  return { images, logoUrl, gameId: entry.id, title: entry.title, theme: entry.theme };
};