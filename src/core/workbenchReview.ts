/**
 * Workbench B7 review focus / paging helpers.
 * Primary group 「待复核」= merge review queue (structure + other-suspect).
 * Secondary group 「附加字幕」= screen / credit / sound (SDH) line kinds.
 */
import { rowStableKey } from './identity';
import { classifyLineKind, type LineKind, type SubRow } from '../utils/subtitleCore';
import {
  buildMergeReviewQueue,
  type MergeReviewItem,
  type MergeReviewQueue,
} from '../utils/timeline/alignmentDiff';
import { isStructureReviewItem } from './workbenchScore';
import type { MarkerRailFocus, MarkerRailHit } from './markerRail';

export type ReviewFocusId =
  | 'review'
  | 'structure'
  | 'suspect'
  | 'screen'
  | 'credit'
  | 'sound';

export type ReviewPagerItem = {
  id: string;
  /** Primary jump target (0-based array index) */
  arrayIndex: number;
  /** All 0-based array indexes belonging to this item */
  arrayIndexes: number[];
  /** 1-based line numbers */
  lineNumbers: number[];
  kind: ReviewFocusId;
  reviewItem?: MergeReviewItem;
};

export type ReviewGroupCounts = {
  reviewTotal: number;
  reviewChecked: number;
  reviewRemaining: number;
  structure: number;
  structureRemaining: number;
  suspect: number;
  suspectRemaining: number;
  screen: number;
  credit: number;
  sound: number;
  auxiliaryTotal: number;
};

export const REVIEW_FOCUS_LABEL: Record<ReviewFocusId, string> = {
  review: '待复核',
  structure: '结构差异',
  suspect: '类别待定',
  screen: '标题告示',
  credit: '人员署名',
  sound: 'SDH',
};

export const STRUCTURE_KIND_LABEL: Record<string, string> = {
  'coverage-merge': '时间覆盖合并',
  'expanded-dialogue': '已展开对话',
  'single-track': '单侧字轨',
  'shifted-match': '整体平移',
  'other-suspect': '类别待定',
};

/** Category chips for 类别待定 — line kinds except credits. */
export const SUSPECT_CATEGORY_OPTIONS: Array<{ kind: Exclude<LineKind, 'credit'>; label: string }> = [
  { kind: 'dialogue', label: '对白' },
  { kind: 'narration', label: '旁白' },
  { kind: 'sound', label: '音效' },
  { kind: 'screen', label: '标题告示' },
  { kind: 'lyrics', label: '歌词' },
];

const rowArrayIndex = (rows: SubRow[], lineNumber: number): number => {
  const found = rows.findIndex((row) => row.index === lineNumber);
  return found >= 0 ? found : Math.max(0, lineNumber - 1);
};

export function computeReviewGroupCounts(
  rows: SubRow[],
  checkedIds: string[] | undefined,
  queue?: MergeReviewQueue,
): ReviewGroupCounts {
  const q = queue ?? buildMergeReviewQueue(rows);
  const checked = new Set(checkedIds ?? []);
  let structure = 0;
  let structureRemaining = 0;
  let suspect = 0;
  let suspectRemaining = 0;
  let reviewChecked = 0;

  for (const item of q.items) {
    const done = checked.has(item.id);
    if (done) reviewChecked += 1;
    if (isStructureReviewItem(item)) {
      structure += 1;
      if (!done) structureRemaining += 1;
    } else {
      suspect += 1;
      if (!done) suspectRemaining += 1;
    }
  }

  let screen = 0;
  let credit = 0;
  let sound = 0;
  for (const row of rows) {
    const kind = classifyLineKind(row);
    if (kind === 'screen') screen += 1;
    else if (kind === 'credit') credit += 1;
    else if (kind === 'sound') sound += 1;
  }

  return {
    reviewTotal: q.total,
    reviewChecked,
    reviewRemaining: Math.max(0, q.total - reviewChecked),
    structure,
    structureRemaining,
    suspect,
    suspectRemaining,
    screen,
    credit,
    sound,
    auxiliaryTotal: screen + credit + sound,
  };
}

export function buildPagerItems(
  rows: SubRow[],
  focus: ReviewFocusId,
  queue?: MergeReviewQueue,
  options?: { onlyUnresolved?: boolean; checkedIds?: string[] },
): ReviewPagerItem[] {
  const q = queue ?? buildMergeReviewQueue(rows);
  const checked = new Set(options?.checkedIds ?? []);
  const onlyUnresolved = options?.onlyUnresolved ?? false;

  if (focus === 'review' || focus === 'structure' || focus === 'suspect') {
    const items = q.items.filter((item) => {
      if (focus === 'structure') return isStructureReviewItem(item);
      if (focus === 'suspect') return item.category === 'other-suspect';
      return true;
    });
    return items
      .filter((item) => !(onlyUnresolved && checked.has(item.id)))
      .map((item) => {
        const lineNumbers = item.rowIndexes;
        const arrayIndexes = lineNumbers.map((n) => rowArrayIndex(rows, n));
        return {
          id: item.id,
          arrayIndex: arrayIndexes[0] ?? 0,
          arrayIndexes,
          lineNumbers,
          kind: focus === 'review'
            ? (isStructureReviewItem(item) ? 'structure' : 'suspect')
            : focus,
          reviewItem: item,
        };
      });
  }

  const kindMap: Record<'screen' | 'credit' | 'sound', LineKind> = {
    screen: 'screen',
    credit: 'credit',
    sound: 'sound',
  };
  const target = kindMap[focus];
  const out: ReviewPagerItem[] = [];
  rows.forEach((row, arrayIndex) => {
    if (classifyLineKind(row) !== target) return;
    out.push({
      id: `${focus}-${rowStableKey(row)}`,
      arrayIndex,
      arrayIndexes: [arrayIndex],
      lineNumbers: [row.index],
      kind: focus,
    });
  });
  return out;
}

/** Row indexes (0-based) that should stay bright under the current focus; others dim. */
export function focusedArrayIndexes(
  rows: SubRow[],
  focus: ReviewFocusId | null,
  queue?: MergeReviewQueue,
): Set<number> | null {
  if (!focus) return null;
  const items = buildPagerItems(rows, focus, queue);
  const set = new Set<number>();
  for (const item of items) {
    for (const idx of item.arrayIndexes) set.add(idx);
  }
  return set;
}

export function focusToRailFocus(focus: ReviewFocusId | null): MarkerRailFocus {
  if (!focus) return 'all';
  return focus;
}

export function buildRailHitsForFocus(
  rows: SubRow[],
  focus: ReviewFocusId | null,
  queue?: MergeReviewQueue,
  checkedIds?: string[],
): MarkerRailHit[] {
  const effective: ReviewFocusId = focus ?? 'review';
  // Default rail shows unresolved review items when no aux child is selected
  const onlyUnresolved = effective === 'review' || effective === 'structure' || effective === 'suspect';
  const items = buildPagerItems(rows, effective, queue, {
    onlyUnresolved,
    checkedIds,
  });
  const hits: MarkerRailHit[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    for (let i = 0; i < item.arrayIndexes.length; i += 1) {
      const arrayIndex = item.arrayIndexes[i];
      if (seen.has(arrayIndex)) continue;
      seen.add(arrayIndex);
      hits.push({
        arrayIndex,
        lineNumber: item.lineNumbers[i] ?? arrayIndex + 1,
      });
    }
  }
  return hits;
}

/**
 * After confirming a category on a 类别待定 row, patch cueKind / type / auxiliary
 * so classifyLineKind returns the chosen kind.
 */
export function applyLineKindOverride(
  row: SubRow,
  kind: Exclude<LineKind, 'credit'>,
): SubRow {
  const auxFor = (
    category: 'ambient_sdh' | 'semantic_sdh' | 'screen_text' | 'music' | 'speech_context' | 'unknown',
    action: 'hide_by_default' | 'keep_auxiliary' | 'keep_visible' = 'keep_visible',
  ) => ({
    category,
    confidence: 100,
    action,
    reasons: ['manual_review'] as string[],
    suspicion: undefined,
  });

  switch (kind) {
    case 'dialogue':
      return {
        ...row,
        type: row.type === 'merged' ? 'merged' : 'dialogue',
        cueKind: 'dialogue',
        auxiliary: auxFor('unknown', 'keep_visible'),
      };
    case 'narration':
      return {
        ...row,
        type: row.type === 'merged' ? 'merged' : 'note',
        cueKind: 'narration',
        auxiliary: auxFor('speech_context', 'keep_auxiliary'),
      };
    case 'sound':
      return {
        ...row,
        type: row.type === 'merged' ? 'merged' : 'note',
        cueKind: 'sound_caption',
        auxiliary: auxFor('semantic_sdh', 'keep_auxiliary'),
      };
    case 'screen':
      return {
        ...row,
        type: row.type === 'merged' ? 'merged' : 'note',
        cueKind: 'screen_text',
        auxiliary: auxFor('screen_text', 'keep_auxiliary'),
      };
    case 'lyrics':
      return {
        ...row,
        type: 'lyrics',
        cueKind: 'lyrics',
        auxiliary: auxFor('music', 'keep_visible'),
      };
    default:
      return row;
  }
}

export function guessSuspectCategory(row: SubRow): Exclude<LineKind, 'credit'> {
  const kind = classifyLineKind(row);
  if (kind === 'credit') return 'narration';
  return kind;
}
