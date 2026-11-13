import { describe, expect, it } from 'vitest';
import { filterDeletable, objectIdentity, planUniqueUploads } from './uploadPlan';

describe('planUniqueUploads', () => {
  it('uploads each content-addressed path once and maps every card to its job', () => {
    const plan = planUniqueUploads(['games/x/cards/aaa.webp', 'games/x/cards/bbb.webp', 'games/x/cards/aaa.webp']);
    expect(plan.jobs).toEqual([
      { path: 'games/x/cards/aaa.webp', firstIndex: 0 },
      { path: 'games/x/cards/bbb.webp', firstIndex: 1 },
    ]);
    expect(plan.jobIndexFor).toEqual([0, 1, 0]);
  });

  it('handles an empty batch', () => {
    expect(planUniqueUploads([])).toEqual({ jobs: [], jobIndexFor: [] });
  });
});

describe('objectIdentity', () => {
  it('combines bucket and full path exactly', () => {
    expect(objectIdentity({ bucket: 'b1', fullPath: 'games/x/cards/a.png' })).toBe('b1/games/x/cards/a.png');
  });
});

describe('filterDeletable', () => {
  const ref = (bucket: string, fullPath: string) => ({ bucket, fullPath });

  it('never returns a protected object', () => {
    const refs = [ref('b1', 'games/x/cards/a.png'), ref('b1', 'games/x/cards/b.png')];
    const out = filterDeletable(refs, new Set(['b1/games/x/cards/a.png']));
    expect(out).toEqual([ref('b1', 'games/x/cards/b.png')]);
  });

  it('uses exact bucket + path equality (no suffix or cross-bucket matches)', () => {
    const refs = [ref('b2', 'games/x/cards/a.png'), ref('b1', 'x/cards/a.png')];
    expect(filterDeletable(refs, new Set(['b1/games/x/cards/a.png']))).toEqual(refs);
  });
});
