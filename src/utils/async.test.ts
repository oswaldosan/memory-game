import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './async';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapWithConcurrency', () => {
  it('preserves input order in the results', async () => {
    const out = await mapWithConcurrency([30, 10, 20], 2, async (n) => {
      await new Promise((r) => setTimeout(r, n / 10));
      return n * 2;
    });
    expect(out).toEqual([60, 20, 40]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
    });
    expect(peak).toBe(3);
  });

  it('rejects when a task fails', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('fail');
        return n;
      })
    ).rejects.toThrow('fail');
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 3, async (n: number) => n)).toEqual([]);
  });

  it('waits for in-flight tasks to settle before rejecting', async () => {
    const finished: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3], 3, async (n) => {
        if (n === 1) throw new Error('fail fast');
        await new Promise((r) => setTimeout(r, 20));
        finished.push(n);
        return n;
      })
    ).rejects.toThrow('fail fast');
    expect(finished.sort()).toEqual([2, 3]);
  });

  it('does not start new tasks after a failure', async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3, 4], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error('stop');
        return n;
      })
    ).rejects.toThrow('stop');
    expect(started).toEqual([1, 2]);
  });
});
