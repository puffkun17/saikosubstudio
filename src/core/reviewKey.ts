/**
 * Key for per-task 已复核 state. Never derived from the export filename (renaming must not wipe
 * the checks): the task id when there is one, else a fingerprint of the merged timeline.
 */
export function reviewTaskKey(selectedTaskId: string | null | undefined, rows: { ts: string }[] | null | undefined): string {
  if (selectedTaskId) return selectedTaskId;
  if (!rows || rows.length === 0) return '_default';
  return `timeline:${rows.length}:${rows[0].ts}:${rows[rows.length - 1].ts}`;
}

/** Live 待复核 numbers from the review queue items and the checked ids. */
export function reviewProgress(itemIds: string[], checkedIds: string[] | undefined): { total: number; checked: number; remaining: number } {
  const checked = new Set(checkedIds ?? []);
  const done = itemIds.reduce((n, id) => n + (checked.has(id) ? 1 : 0), 0);
  return { total: itemIds.length, checked: done, remaining: Math.max(0, itemIds.length - done) };
}
