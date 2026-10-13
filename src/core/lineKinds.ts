/**
 * One classifier for every "special line" count (Act 2 chips, 辅助字幕 card, review dialog,
 * preview chips) and one policy function for what 智能 / 清洁 hide (card, preview, export).
 * Unit: merged timeline lines, before any auxiliary policy is applied.
 * Priority (exclusive): 署名 > 歌词 > 音效 > 标题告示 > 旁白 > 对白.
 */
import { classifyLineKind, isHiddenByPolicy, type AuxiliarySubtitleMode, type LineKind, type SubRow } from '../utils/subtitleCore';

export { classifyLineKind, isHiddenByPolicy, type LineKind };
export const LINE_KIND_ORDER: LineKind[] = ['credit', 'lyrics', 'sound', 'screen', 'narration', 'dialogue'];
type RowLike = Pick<SubRow, 'text'> & Partial<Pick<SubRow, 'type' | 'cueKind' | 'auxiliary'>>;

export type LineKindCounts = Record<LineKind, number> & { auxiliary: number; total: number };

export function countLineKinds(rows: RowLike[]): LineKindCounts {
  const counts = { credit: 0, lyrics: 0, sound: 0, screen: 0, narration: 0, dialogue: 0, auxiliary: 0, total: rows.length };
  for (const row of rows) counts[classifyLineKind(row)] += 1;
  counts.auxiliary = rows.length - counts.dialogue;
  return counts;
}

/** Same filter for preview, export and the card's "隐去 N 条". Re-numbers the kept lines 1…n. */
export function applyLinePolicy<T extends RowLike>(rows: T[], mode: AuxiliarySubtitleMode): T[] {
  return rows.filter((row) => !isHiddenByPolicy(row, mode)).map((row, i) => ({ ...row, index: i + 1 }));
}

export const countHiddenByPolicy = (rows: RowLike[], mode: AuxiliarySubtitleMode): number =>
  rows.reduce((n, row) => n + (isHiddenByPolicy(row, mode) ? 1 : 0), 0);

/** 1-based line number of a row (row.index when present). */
export const lineNumberOf = (row: { index?: number }, arrayIndex: number): number =>
  typeof row.index === 'number' && row.index > 0 ? row.index : arrayIndex + 1;

/** Array position for a 1-based line number (for jumps); -1 when absent. */
export const arrayIndexOfLine = (rows: { index?: number }[], line: number): number => {
  const hit = rows.findIndex((row, i) => lineNumberOf(row, i) === line);
  return hit;
};
