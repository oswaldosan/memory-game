import type { Card, GameStatus } from '../types';

/**
 * Pure state machine for a memory game round.
 *
 * All counters are derived inside a single reducer transition, so fast clicks
 * can never double-count moves, flip more than two cards, or race a timeout.
 */
export interface GameReducerState {
  status: GameStatus;
  cards: Card[];
  /** Face-up cards that are not matched yet (0–2). */
  flippedIds: string[];
  /** True while a mismatched pair is shown, until RESOLVE_MISMATCH. */
  locked: boolean;
  moves: number;
  maxMoves: number;
  matchedPairs: number;
  totalPairs: number;
  /** Epoch ms of the first flip; the timer runs from here. */
  startedAt: number | null;
  /** Epoch ms when the game was won or lost; the timer stops here. */
  endedAt: number | null;
  error: string | null;
}

export type GameAction =
  | { type: 'LOAD' }
  | { type: 'FAIL'; message: string }
  | { type: 'START'; cards: Card[]; maxMoves: number }
  | { type: 'FLIP'; id: string; now: number }
  | { type: 'RESOLVE_MISMATCH' };

export const initialGameState: GameReducerState = {
  status: 'loading',
  cards: [],
  flippedIds: [],
  locked: false,
  moves: 0,
  maxMoves: 0,
  matchedPairs: 0,
  totalPairs: 0,
  startedAt: null,
  endedAt: null,
  error: null,
};

const flipCard = (state: GameReducerState, id: string, now: number): GameReducerState => {
  if (state.status !== 'playing' || state.locked || state.flippedIds.length >= 2) return state;

  const card = state.cards.find((c) => c.id === id);
  if (!card || card.matched || card.flipped) return state;

  const startedAt = state.startedAt ?? now;
  const cards = state.cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
  const flippedIds = [...state.flippedIds, id];

  if (flippedIds.length < 2) {
    return { ...state, cards, flippedIds, startedAt };
  }

  const moves = state.moves + 1;
  const [firstId, secondId] = flippedIds;
  const first = cards.find((c) => c.id === firstId)!;
  const second = cards.find((c) => c.id === secondId)!;

  if (first.pairId === second.pairId) {
    const matchedPairs = state.matchedPairs + 1;
    const won = matchedPairs >= state.totalPairs;
    const lost = !won && moves >= state.maxMoves;
    return {
      ...state,
      cards: cards.map((c) => (c.id === firstId || c.id === secondId ? { ...c, matched: true } : c)),
      flippedIds: [],
      moves,
      matchedPairs,
      startedAt,
      status: won ? 'won' : lost ? 'lost' : 'playing',
      endedAt: won || lost ? now : null,
    };
  }

  const lost = moves >= state.maxMoves;
  return {
    ...state,
    cards,
    flippedIds,
    locked: true,
    moves,
    startedAt,
    status: lost ? 'lost' : 'playing',
    endedAt: lost ? now : null,
  };
};

export const gameReducer = (state: GameReducerState, action: GameAction): GameReducerState => {
  switch (action.type) {
    case 'LOAD':
      return { ...initialGameState, status: 'loading' };

    case 'FAIL':
      return { ...initialGameState, status: 'error', error: action.message };

    case 'START': {
      const totalPairs = new Set(action.cards.map((c) => c.pairId)).size;
      if (totalPairs === 0) {
        return { ...initialGameState, status: 'error', error: 'Este juego no tiene imágenes configuradas.' };
      }
      return {
        ...initialGameState,
        status: 'playing',
        cards: action.cards,
        totalPairs,
        maxMoves: Math.max(totalPairs, action.maxMoves),
      };
    }

    case 'FLIP':
      return flipCard(state, action.id, action.now);

    case 'RESOLVE_MISMATCH': {
      if (!state.locked) return state;
      const toHide = new Set(state.flippedIds);
      return {
        ...state,
        cards: state.cards.map((c) => (toHide.has(c.id) ? { ...c, flipped: false } : c)),
        flippedIds: [],
        locked: false,
      };
    }

    default:
      return state;
  }
};
