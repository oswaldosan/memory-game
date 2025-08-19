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
  cardBackColor?: string;
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
}

export interface GameRegistry {
  games: GameRegistryEntry[];
}

export const loadGameRegistry = async (): Promise<GameRegistry> => {
  const response = await fetch('/games/index.json');
  return response.json();
};

export const getGameIdFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  return params.get('game') || 'initial';
};

export const resolveGameAssets = async (
  explicitGameId?: string
): Promise<{ images: string[]; logoUrl: string; gameId: string; title: string; theme?: GameThemeOverride }> => {
  const registry = await loadGameRegistry();
  const gameId = explicitGameId || getGameIdFromUrl();
  const entry = registry.games.find(g => g.id === gameId) || registry.games[0];
  return { images: entry.cards, logoUrl: entry.logo, gameId: entry.id, title: entry.title, theme: entry.theme };
};