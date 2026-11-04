/**
 * Act 2 scrubber measure.
 * The pointer shows one reading and cycles modes. Totals stay on the track end.
 * Special rows are ticks, not extra lines on the pointer.
 */
import { isStructureReviewItem } from './workbenchScore';
import { classifyLineKind, type SubRow } from '../utils/subtitleCore';
import { buildMergeReviewQueue } from '../utils/timeline/alignmentDiff';
import { formatMsClock, parseSubtitleRange } from '../utils/timeline/timecode';

export type MeasureMode = 'position' | 'remain' | 'hit';

export type DialTickKind =
  | 'review'
  | 'structure'
  | 'suspect'
  | 'screen'
  | 'credit'
  | 'sound'
  | 'lyrics';

export type DialTick = {
  /** 0-based row index */
  rowIndex: number;
  startMs: number;
  kind: DialTickKind;
  /** Short hover label. One tick per row, kinds joined. */
  label: string;
};

const TICK_LABEL: Record<DialTickKind, string> = {
  review: '待核',
  structure: '结构差异',
  suspect: '类别待定',
  screen: '标题告示',
  credit: '人员署名',
  sound: 'SDH',
  lyrics: '歌词',
};

/** Higher rank wins the tick color when one row carries several marks. */
const TICK_RANK: DialTickKind[] = ['review', 'suspect', 'structure', 'sound', 'screen', 'credit', 'lyrics'];

export function cycleMeasureMode(mode: MeasureMode, filterActive: boolean): MeasureMode {
  if (mode === 'position') return 'remain';
  if (mode === 'remain') return filterActive ? 'hit' : 'position';
  return 'position';
}

/** Hit mode exists only while a filter is on. */
export function activeMeasureMode(mode: MeasureMode, filterActive: boolean): MeasureMode {
  if (mode === 'hit' && !filterActive) return 'position';
  return mode;
}

export function measurePercent(timeMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  const raw = Math.round((Math.max(0, timeMs) / durationMs) * 100);
  return Math.max(0, Math.min(100, raw));
}

export function formatMeasureLine(input: {
  mode: MeasureMode;
  filterActive: boolean;
  row: number;
  total: number;
  timeMs: number;
  durationMs: number;
  hitIndex: number;
  hitCount: number;
  hitTimeMs: number;
}): string {
  const mode = activeMeasureMode(input.mode, input.filterActive);
  if (mode === 'remain') return `${measurePercent(input.timeMs, input.durationMs)}%`;
  if (mode === 'hit') {
    return `${input.hitIndex} / ${input.hitCount} · ${formatMsClock(input.hitTimeMs)}`;
  }
  return `${input.row} / ${input.total} · ${formatMsClock(input.timeMs)}`;
}

/** Weak end anchor: totals live on the track, not on the pointer. */
export function formatDialAnchor(totalRows: number, durationMs: number): string {
  return `${Math.max(0, totalRows)} · ${formatMsClock(Math.max(0, durationMs))}`;
}

export function nearestHitOrdinal(
  hits: Array<{ rowIndex: number; startMs: number }>,
  timeMs: number,
  currentRow: number,
): { index: number; count: number; timeMs: number } {
  const sorted = [...hits].sort((a, b) => a.startMs - b.startMs || a.rowIndex - b.rowIndex);
  const count = sorted.length;
  if (count === 0) return { index: 0, count: 0, timeMs };
  const onRow = sorted.findIndex((hit) => hit.rowIndex === currentRow);
  if (onRow >= 0) return { index: onRow + 1, count, timeMs: sorted[onRow].startMs };
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < sorted.length; i += 1) {
    const dist = Math.abs(sorted[i].startMs - timeMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return { index: best + 1, count, timeMs: sorted[best].startMs };
}

const arrayIndexForLine = (rows: SubRow[], line: number): number => {
  const found = rows.findIndex((row) => row.index === line);
  return found >= 0 ? found : Math.max(0, line - 1);
};

/**
 * One tick per special row. Reuses the review queue and line-kind classifier.
 * Unresolved review items read as 待核; resolved structure/suspect keep their category.
 */
export function buildDialTicks(rows: SubRow[], checkedIds?: string[]): DialTick[] {
  if (!rows.length) return [];
  const checked = new Set(checkedIds ?? []);
  const queue = buildMergeReviewQueue(rows);
  const byRow = new Map<number, { startMs: number; kinds: Set<DialTickKind> }>();

  const add = (arrayIndex: number, startMs: number, kind: DialTickKind) => {
    if (arrayIndex < 0 || arrayIndex >= rows.length) return;
    const current = byRow.get(arrayIndex);
    if (current) {
      current.kinds.add(kind);
      if (startMs < current.startMs) current.startMs = startMs;
      return;
    }
    byRow.set(arrayIndex, { startMs, kinds: new Set([kind]) });
  };

  rows.forEach((row, arrayIndex) => {
    const kind = classifyLineKind(row);
    if (kind !== 'screen' && kind !== 'credit' && kind !== 'sound' && kind !== 'lyrics') return;
    add(arrayIndex, parseSubtitleRange(row.ts).startMs, kind);
  });

  for (const item of queue.items) {
    const line = item.rowIndexes[0];
    if (line == null) continue;
    const arrayIndex = arrayIndexForLine(rows, line);
    const structure = isStructureReviewItem(item);
    if (!checked.has(item.id)) add(arrayIndex, item.startMs, 'review');
    add(arrayIndex, item.startMs, structure ? 'structure' : 'suspect');
  }

  const ticks: DialTick[] = [];
  for (const [rowIndex, entry] of byRow) {
    const ordered = TICK_RANK.filter((kind) => entry.kinds.has(kind));
    if (ordered.length === 0) continue;
    ticks.push({
      rowIndex,
      startMs: entry.startMs,
      kind: ordered[0],
      label: ordered.map((kind) => TICK_LABEL[kind]).join(' · '),
    });
  }
  ticks.sort((a, b) => a.startMs - b.startMs || a.rowIndex - b.rowIndex);
  return ticks;
}
