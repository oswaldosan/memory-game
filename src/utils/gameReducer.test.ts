import { describe, expect, it } from 'vitest';
import type { Card } from '../types';
import { gameReducer, initialGameState, type GameReducerState } from './gameReducer';

const deck = (): Card[] => [
  { id: 'a1', pairId: 'a', image: 'a.png', matched: false, flipped: false },
  { id: 'b1', pairId: 'b', image: 'b.png', matched: false, flipped: false },
  { id: 'a2', pairId: 'a', image: 'a.png', matched: false, flipped: false },
  { id: 'b2', pairId: 'b', image: 'b.png', matched: false, flipped: false },
];

const started = (maxMoves = 10): GameReducerState =>
  gameReducer(initialGameState, { type: 'START', cards: deck(), maxMoves });

const flip = (s: GameReducerState, id: string, now = 1000) =>
  gameReducer(s, { type: 'FLIP', id, now });

describe('gameReducer', () => {
  it('starts a fresh game with zeroed counters', () => {
    const s = started();
    expect(s.status).toBe('playing');
    expect(s.moves).toBe(0);
    expect(s.matchedPairs).toBe(0);
    expect(s.totalPairs).toBe(2);
    expect(s.startedAt).toBeNull();
  });

  it('starts the timer on the first flip only', () => {
    let s = flip(started(), 'a1', 1000);
    expect(s.startedAt).toBe(1000);
    s = flip(s, 'b1', 5000);
    expect(s.startedAt).toBe(1000);
  });

  it('counts a move only when the second card is flipped', () => {
    let s = flip(started(), 'a1');
    expect(s.moves).toBe(0);
    s = flip(s, 'b1');
    expect(s.moves).toBe(1);
  });

  it('ignores clicking the same card twice', () => {
    let s = flip(started(), 'a1');
    const again = flip(s, 'a1');
    expect(again).toBe(s);
    s = again;
    expect(s.moves).toBe(0);
  });

  it('marks a match immediately and does not lock the board', () => {
    let s = flip(started(), 'a1');
    s = flip(s, 'a2');
    expect(s.matchedPairs).toBe(1);
    expect(s.cards.filter((c) => c.matched).map((c) => c.id).sort()).toEqual(['a1', 'a2']);
    expect(s.flippedIds).toEqual([]);
    expect(s.locked).toBe(false);
  });

  it('locks the board on a mismatch and rejects a third flip', () => {
    let s = flip(started(), 'a1');
    s = flip(s, 'b1');
    expect(s.locked).toBe(true);
    const third = flip(s, 'a2');
    expect(third).toBe(s);
    expect(third.cards.find((c) => c.id === 'a2')?.flipped).toBe(false);
  });

  it('flips mismatched cards back and unlocks on RESOLVE_MISMATCH', () => {
    let s = flip(started(), 'a1');
    s = flip(s, 'b1');
    s = gameReducer(s, { type: 'RESOLVE_MISMATCH' });
    expect(s.locked).toBe(false);
    expect(s.flippedIds).toEqual([]);
    expect(s.cards.every((c) => !c.flipped)).toBe(true);
    expect(s.moves).toBe(1);
  });

  it('ignores a stale RESOLVE_MISMATCH when nothing is locked', () => {
    const s = started();
    expect(gameReducer(s, { type: 'RESOLVE_MISMATCH' })).toBe(s);
  });

  it('wins when the last pair is found and stops the clock', () => {
    let s = flip(started(), 'a1', 1000);
    s = flip(s, 'a2', 2000);
    s = flip(s, 'b1', 3000);
    s = flip(s, 'b2', 4000);
    expect(s.status).toBe('won');
    expect(s.matchedPairs).toBe(2);
    expect(s.endedAt).toBe(4000);
  });

  it('counts a win on the very last allowed move instead of a loss', () => {
    let s = started(2);
    s = flip(s, 'a1');
    s = flip(s, 'a2');
    s = flip(s, 'b1');
    s = flip(s, 'b2');
    expect(s.moves).toBe(2);
    expect(s.status).toBe('won');
  });

  it('loses when the move limit is reached without finishing', () => {
    let s = started(2);
    s = flip(s, 'a1', 500);
    s = flip(s, 'b1', 600);
    s = gameReducer(s, { type: 'RESOLVE_MISMATCH' });
    expect(s.status).toBe('playing');
    s = flip(s, 'a1', 1000);
    s = flip(s, 'b1', 2000);
    expect(s.status).toBe('lost');
    expect(s.endedAt).toBe(2000);
    expect(flip(s, 'a2')).toBe(s);
  });

  it('ignores flips on unknown or already matched cards', () => {
    let s = flip(started(), 'a1');
    s = flip(s, 'a2');
    expect(flip(s, 'a1')).toBe(s);
    expect(flip(s, 'zzz')).toBe(s);
  });

  it('resets every counter on START', () => {
    let s = flip(started(), 'a1');
    s = flip(s, 'b1');
    s = gameReducer(s, { type: 'START', cards: deck(), maxMoves: 10 });
    expect(s.moves).toBe(0);
    expect(s.matchedPairs).toBe(0);
    expect(s.locked).toBe(false);
    expect(s.flippedIds).toEqual([]);
    expect(s.startedAt).toBeNull();
    expect(s.endedAt).toBeNull();
  });

  it('never allows a move budget lower than the number of pairs', () => {
    expect(started(1).maxMoves).toBe(2);
  });

  it('goes to an error state for an empty deck instead of an instant win', () => {
    const s = gameReducer(initialGameState, { type: 'START', cards: [], maxMoves: 10 });
    expect(s.status).toBe('error');
  });

  it('exposes LOAD and FAIL transitions', () => {
    const loading = gameReducer(started(), { type: 'LOAD' });
    expect(loading.status).toBe('loading');
    const failed = gameReducer(loading, { type: 'FAIL', message: 'boom' });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('boom');
  });
});
