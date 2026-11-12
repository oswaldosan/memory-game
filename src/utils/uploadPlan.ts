/**
 * Pure helpers that keep content-addressed uploads safe.
 *
 * With content-addressed paths (`cards/{sha256}.{ext}`), a "new" upload can target an object
 * that the saved game already references. These helpers make sure such objects are uploaded
 * at most once per batch and are never deleted by a rollback or cleanup.
 */

/** Minimal shape of a Storage reference (avoids importing Firebase in pure code/tests). */
export interface ObjectRefLike {
  bucket: string;
  fullPath: string;
}

/** Exact identity of a Storage object: `bucket/fullPath`. Matches `storageIdentity(url)`. */
export const objectIdentity = (r: ObjectRefLike): string => `${r.bucket}/${r.fullPath}`;

/**
 * Dedupes target paths so identical content in one batch is uploaded once (no concurrent
 * writes to the same object). `jobIndexFor[i]` is the job that serves input `i`.
 */
export const planUniqueUploads = (
  paths: readonly string[]
): { jobs: { path: string; firstIndex: number }[]; jobIndexFor: number[] } => {
  const byPath = new Map<string, number>();
  const jobs: { path: string; firstIndex: number }[] = [];
  const jobIndexFor = paths.map((path, i) => {
    let job = byPath.get(path);
    if (job === undefined) {
      job = jobs.length;
      byPath.set(path, job);
      jobs.push({ path, firstIndex: i });
    }
    return job;
  });
  return { jobs, jobIndexFor };
};

/** Drops every reference whose exact identity is protected (still referenced somewhere). */
export const filterDeletable = <T extends ObjectRefLike>(refs: readonly T[], protectedIds: ReadonlySet<string>): T[] =>
  refs.filter((r) => !protectedIds.has(objectIdentity(r)));
