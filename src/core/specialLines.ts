import { classifyLineKind, type SubRow } from '../utils/subtitleCore';

/** Special-line kinds the preview can jump between (spec: slideshow preview). */
export type SpecialKind = 'long' | 'lyrics' | 'sign' | 'sdh';

export const SPECIAL_LABEL: Record<SpecialKind, string> = {
  lyrics: '歌词',
  sdh: 'SDH',
  long: '长对话',
  sign: '标题告示',
};

const LONG_ZH_CHARS = 22;

export function specialKindOf(row: Pick<SubRow, 'text' | 'type' | 'cueKind' | 'auxiliary'>): SpecialKind | null {
  // Same classifier as every other count (core/lineKinds): 署名 > 歌词 > 音效 > 标题告示 > 旁白 > 对白.
  const kind = classifyLineKind(row);
  if (kind === 'lyrics') return 'lyrics';
  if (kind === 'screen') return 'sign';
  if (kind === 'sound') return 'sdh';
  if (kind !== 'dialogue') return null;
  const first = (row.text || '').replace(/\\N/gi, '\n').split('\n')[0] || '';
  if (first.replace(/\{[^}]*\}/g, '').length > LONG_ZH_CHARS) return 'long';
  return null;
}

/** Next row index (after `from`) of the given kind, wrapping to the start; -1 when none. */
export function nextSpecialIndex(rows: Pick<SubRow, 'text' | 'type' | 'cueKind' | 'auxiliary'>[], from: number, kind: SpecialKind): number {
  const n = rows.length;
  for (let step = 1; step <= n; step += 1) {
    const i = (from + step) % n;
    if (specialKindOf(rows[i]) === kind) return i;
  }
  return -1;
}

export function countSpecial(rows: Pick<SubRow, 'text' | 'type' | 'cueKind' | 'auxiliary'>[]): Record<SpecialKind, number> {
  const out: Record<SpecialKind, number> = { long: 0, lyrics: 0, sign: 0, sdh: 0 };
  for (const r of rows) {
    const k = specialKindOf(r);
    if (k) out[k] += 1;
  }
  return out;
}

/** Slideshow: which still to show for a row (stills advance evenly through the episode). */
export const slideIndexFor = (rowIndex: number, rowCount: number, stillCount: number): number =>
  stillCount <= 1 || rowCount <= 1 ? 0 : Math.min(stillCount - 1, Math.floor((rowIndex / rowCount) * stillCount));

/** All row indices per kind, in order (drives chips, pager and timeline ticks). */
export function specialIndices(rows: Pick<SubRow, 'text' | 'type' | 'cueKind' | 'auxiliary'>[]): Record<SpecialKind, number[]> {
  const out: Record<SpecialKind, number[]> = { long: [], lyrics: [], sign: [], sdh: [] };
  rows.forEach((r, i) => {
    const k = specialKindOf(r);
    if (k) out[k].push(i);
  });
  return out;
}

/**
 * Pager position for `current` inside `indices`: 1-based ordinal of the occurrence at or
 * before `current` (0 when `current` precedes the first one).
 */
export function pagerOrdinal(indices: number[], current: number): number {
  let ord = 0;
  for (let i = 0; i < indices.length && indices[i] <= current; i += 1) ord = i + 1;
  return ord;
}

/** Step within a category: dir +1 → next occurrence after current, -1 → previous; wraps. */
export function stepSpecial(indices: number[], current: number, dir: 1 | -1): number {
  if (!indices.length) return -1;
  if (dir === 1) return indices.find((i) => i > current) ?? indices[0];
  for (let k = indices.length - 1; k >= 0; k -= 1) if (indices[k] < current) return indices[k];
  return indices[indices.length - 1];
}
