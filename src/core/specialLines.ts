import type { SubRow } from '../utils/subtitleCore';

/** Special-line kinds the preview can jump between (spec: slideshow preview). */
export type SpecialKind = 'long' | 'lyrics' | 'sign' | 'sdh';

export const SPECIAL_LABEL: Record<SpecialKind, string> = {
  long: '长对白',
  lyrics: '歌词',
  sign: '画面字',
  sdh: '声音描述',
};

const LONG_ZH_CHARS = 22;

export function specialKindOf(row: Pick<SubRow, 'text' | 'type' | 'cueKind' | 'auxiliary'>): SpecialKind | null {
  if (row.type === 'lyrics' || row.cueKind === 'lyrics') return 'lyrics';
  const cat = row.auxiliary?.category;
  if (row.cueKind === 'screen_text' || cat === 'screen_text') return 'sign';
  if (row.cueKind === 'sound_caption' || cat === 'ambient_sdh' || cat === 'semantic_sdh' || cat === 'music') return 'sdh';
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
