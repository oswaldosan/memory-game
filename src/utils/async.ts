/**
 * Like `Promise.all(items.map(fn))` but runs at most `limit` tasks at a time.
 * Results keep the input order.
 *
 * On failure no new tasks are started, but the returned promise only rejects once every
 * task already in flight has settled. Callers can therefore safely clean up side effects
 * (e.g. uploaded files) knowing nothing is still running.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  let firstError: { error: unknown } | null = null;

  const worker = async () => {
    while (!firstError && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        firstError ??= { error };
      }
    }
  };

  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
  await Promise.all(workers); // workers never reject; they record the first error instead
  if (firstError) throw (firstError as { error: unknown }).error;
  return results;
};
