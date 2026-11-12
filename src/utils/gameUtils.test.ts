import { describe, expect, it } from 'vitest';
import {
  applyAssetBundle,
  createGameCards,
  formatDuration,
  getBoardColumns,
  getMaxMovesForPairs,
  moveItem,
  shuffleArray,
  slugify,
} from './gameUtils';

/** Deterministic PRNG (mulberry32) so shuffles are reproducible in tests. */
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('shuffleArray', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...input];
    const out = shuffleArray(input, seeded(1));
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
  });

  it('produces every permutation of 3 items with roughly uniform frequency', () => {
    const rng = seeded(42);
    const counts = new Map<string, number>();
    const runs = 6000;
    for (let i = 0; i < runs; i++) {
      const key = shuffleArray(['a', 'b', 'c'], rng).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(runs / 6 * 0.85);
      expect(n).toBeLessThan(runs / 6 * 1.15);
    }
  });
});

describe('createGameCards', () => {
  it('creates exactly two cards per image with no cap on the number of pairs', () => {
    const images = Array.from({ length: 15 }, (_, i) => `/img/${i}.png`);
    const cards = createGameCards(images, seeded(3));
    expect(cards).toHaveLength(30);
    for (const img of images) {
      expect(cards.filter((c) => c.image === img)).toHaveLength(2);
    }
  });

  it('gives every card a unique id and pairs share a pairId', () => {
    const cards = createGameCards(['a', 'b', 'c', 'd', 'e'], seeded(7));
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    const byPair = new Map<string, number>();
    cards.forEach((c) => byPair.set(c.pairId, (byPair.get(c.pairId) ?? 0) + 1));
    expect([...byPair.values()].every((n) => n === 2)).toBe(true);
  });

  it('starts every card face down and unmatched', () => {
    const cards = createGameCards(['a', 'b'], seeded(9));
    expect(cards.every((c) => !c.flipped && !c.matched)).toBe(true);
  });

  it('ignores duplicate and empty image entries so pairs stay unambiguous', () => {
    const cards = createGameCards(['a', 'a', '', '  ', 'b'], seeded(11));
    expect(cards).toHaveLength(4);
  });
});

describe('getBoardColumns', () => {
  it.each([
    [4, 2],
    [8, 4],
    [12, 4],
    [16, 4],
    [20, 5],
    [24, 6],
  ])('lays out %i cards in %i columns', (count, cols) => {
    expect(getBoardColumns(count)).toBe(cols);
  });

  it('never exceeds 8 columns for large decks', () => {
    expect(getBoardColumns(80)).toBeLessThanOrEqual(8);
  });

  it('handles tiny decks', () => {
    expect(getBoardColumns(0)).toBe(1);
    expect(getBoardColumns(2)).toBe(2);
  });
});

describe('getMaxMovesForPairs', () => {
  it('keeps the classic 20 moves for 4 pairs', () => {
    expect(getMaxMovesForPairs(4)).toBe(20);
  });

  it('scales with the number of pairs', () => {
    expect(getMaxMovesForPairs(10)).toBe(50);
  });

  it('respects a valid explicit override but never allows fewer moves than pairs', () => {
    expect(getMaxMovesForPairs(6, 15)).toBe(15);
    expect(getMaxMovesForPairs(6, 3)).toBe(6);
  });

  it('ignores invalid overrides', () => {
    expect(getMaxMovesForPairs(4, 0)).toBe(20);
    expect(getMaxMovesForPairs(4, Number.NaN)).toBe(20);
  });
});

describe('moveItem', () => {
  it('moves an item to a new index without mutating', () => {
    const input = ['a', 'b', 'c', 'd'];
    expect(moveItem(input, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(input, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the same order for out-of-range moves', () => {
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
});

describe('slugify', () => {
  it('builds a valid slug from a free-form title', () => {
    expect(slugify('Memoria Navideña 2025!')).toBe('memoria-navidena-2025');
    expect(slugify('  --Hola   Mundo--  ')).toBe('hola-mundo');
  });

  it('caps the length at 41 characters', () => {
    expect(slugify('a'.repeat(80)).length).toBeLessThanOrEqual(41);
  });
});

describe('formatDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('applyAssetBundle', () => {
  const entry = { id: 'ficohsa', title: 'Ficohsa', logo: '/old.png', cards: [] as string[], useFicohsaAssetBundle: true };

  it('fills cards and logo from the synced bundle so listings show the real pair count', () => {
    const merged = applyAssetBundle(entry, { cards: ['/1.png', '/2.png', '/3.png', '/4.png'], logo: '/logo.png' });
    expect(merged.cards).toHaveLength(4);
    expect(merged.logo).toBe('/logo.png');
  });

  it('keeps the entry when the bundle is missing or empty', () => {
    expect(applyAssetBundle(entry, null)).toEqual(entry);
    expect(applyAssetBundle({ ...entry, cards: ['/x.png'] }, { cards: [] }).cards).toEqual(['/x.png']);
  });

  it('ignores entries that do not use the bundle', () => {
    const other = { id: 'game2', title: 'G2', logo: '/l.png', cards: ['/a.png'] };
    expect(applyAssetBundle(other, { cards: ['/1.png'] })).toBe(other);
  });
});
