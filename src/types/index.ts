export interface Card {
  /** Unique per card in a deck (e.g. `3-a`, `3-b`). */
  id: string;
  /** Shared by the two cards of a pair. Matching compares this, never the image URL. */
  pairId: string;
  image: string;
  matched: boolean;
  flipped: boolean;
}

export type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'lost';
