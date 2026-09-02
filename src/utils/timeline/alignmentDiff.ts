import type { AlignmentProvenance, SubRow } from '../subtitleCore';
import { parseSubtitleRange } from './timecode';

export type AlignmentDiffKind = 'expanded-dialogue' | 'coverage-merge' | 'single-track' | 'shifted-match';

export interface AlignmentDiffEntry {
  id: string;
  kind: AlignmentDiffKind;
  rowIndexes: number[];
  ts: string;
  startMs: number;
  endMs: number;
  primaryText: string;
  secondaryText: string;
  label: string;
  detail: string;
  isBoundaryCandidate: boolean;
  provenance: AlignmentProvenance[];
}

export interface AlignmentDiffSummary {
  directPairCount: number;
  expandedDialogueCount: number;
  /** Timespan coverage 1:N / N:1 — separate from dash packed-dialogue expansion for review UX. */
  coverageMergeCount: number;
  singleTrackCount: number;
  shiftedMatchCount: number;
  entries: AlignmentDiffEntry[];
}

/** Provenance confidence is 0–1 (offset diagnosis). Below this → low-confidence review copy. */
export const SHIFTED_REVIEW_CONFIDENCE_THRESHOLD = 0.75;

/** Auxiliary classification confidence is 0–100. Soft survivors below this enter 其他存疑. */
export const AUXILIARY_REVIEW_CONFIDENCE_THRESHOLD = 60;

export type MergeReviewCategory =
  | 'coverage-merge'
  | 'expanded-dialogue'
  | 'single-track'
  | 'shifted-match'
  | 'other-suspect';

export type MergeReviewFilter = MergeReviewCategory | 'all';

export interface MergeReviewItem {
  id: string;
  category: MergeReviewCategory;
  rowIndexes: number[];
  startMs: number;
  endMs: number;
  ts: string;
  text: string;
  reason: string;
  /** review = needs eyes; watch = labeled but lower urgency */
  severity: 'review' | 'watch';
  isBoundaryCandidate?: boolean;
  confidence?: number;
  provenance?: AlignmentProvenance[];
}

export interface MergeReviewQueue {
  total: number;
  counts: Record<MergeReviewCategory, number>;
  items: MergeReviewItem[];
}

interface TimelineRow {
  row: SubRow;
  startMs: number;
  endMs: number;
  primaryText: string;
  secondaryText: string;
}

const SINGLE_TRACK_GROUP_GAP_MS = 20_000;
const SINGLE_TRACK_GROUP_SPAN_MS = 75_000;
const BOUNDARY_WINDOW_MS = 90_000;
const SHIFTED_GROUP_GAP_MS = 20_000;

const EMPTY_COUNTS = (): Record<MergeReviewCategory, number> => ({
  'coverage-merge': 0,
  'expanded-dialogue': 0,
  'single-track': 0,
  'shifted-match': 0,
  'other-suspect': 0,
});

const isCjkText = (text: string) => /[一-龥\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(text);

const getRowSides = (row: SubRow) => {
  const lines = row.text.replace(/\\N/gi, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { primaryText: lines[0], secondaryText: lines.slice(1).join(' ') };
  }

  const text = lines[0] || '';
  return isCjkText(text)
    ? { primaryText: text, secondaryText: '' }
    : { primaryText: '', secondaryText: text };
};

const isStandaloneDialogue = (row: SubRow, secondaryText: string) => Boolean(
  row.text.trim()
  && !secondaryText
  && row.type !== 'note'
  && row.type !== 'commentary'
  && row.type !== 'lyrics'
  && row.type !== 'credit'
  && row.cueKind !== 'screen_text'
  && row.cueKind !== 'narration',
);

const toTimelineRow = (row: SubRow): TimelineRow => ({
  row,
  ...parseSubtitleRange(row.ts),
  ...getRowSides(row),
});

const previewText = (primaryText: string, secondaryText: string, fallback = '') => {
  const text = (primaryText || secondaryText || fallback).replace(/\s+/g, ' ').trim();
  return text || '--';
};

const makeSingleTrackEntry = (group: TimelineRow[], firstStartMs: number, lastEndMs: number): AlignmentDiffEntry => {
  const first = group[0];
  const last = group[group.length - 1];
  const isPrimary = Boolean(first.primaryText);
  const isBoundaryCandidate = first.startMs - firstStartMs <= BOUNDARY_WINDOW_MS
    || lastEndMs - last.endMs <= BOUNDARY_WINDOW_MS;
  const count = group.length;
  const preview = isPrimary ? first.primaryText : first.secondaryText;
  const rangeLabel = count > 1 ? `连续 ${count} 行` : '1 行';

  return {
    id: `single-${first.row.index}-${last.row.index}`,
    kind: 'single-track',
    rowIndexes: group.map(item => item.row.index),
    ts: `${first.row.ts} ~ ${last.row.ts}`,
    startMs: first.startMs,
    endMs: last.endMs,
    primaryText: isPrimary ? preview : '',
    secondaryText: isPrimary ? '' : preview,
    label: isBoundaryCandidate ? `片头/片尾单轨 · ${rangeLabel}` : `单侧字轨 · ${rangeLabel}`,
    detail: isBoundaryCandidate
      ? '可能是版本附加内容、片头片尾信息或未配对台词对白，未自动删除。'
      : `连续 ${count} 行未配对，未自动改写。`,
    isBoundaryCandidate,
    provenance: group.flatMap(item => item.row.provenance ? [item.row.provenance] : []),
  };
};

const makeShiftedMatchEntry = (group: TimelineRow[]): AlignmentDiffEntry => {
  const first = group[0];
  const last = group[group.length - 1];
  const offsetMs = first.row.provenance?.offsetMs;
  const confidence = first.row.provenance?.confidence;
  const count = group.length;
  const rangeLabel = count > 1 ? `连续 ${count} 行` : '1 行';
  const offsetLabel = typeof offsetMs === 'number'
    ? `${offsetMs >= 0 ? '+' : ''}${offsetMs}ms`
    : '未知偏移';
  const confidenceLabel = typeof confidence === 'number'
    ? `置信 ${Math.round(confidence * 100)}%`
    : '';

  return {
    id: `shifted-${first.row.index}-${last.row.index}`,
    kind: 'shifted-match',
    rowIndexes: group.map(item => item.row.index),
    ts: `${first.row.ts} ~ ${last.row.ts}`,
    startMs: first.startMs,
    endMs: last.endMs,
    primaryText: first.primaryText,
    secondaryText: first.secondaryText,
    label: `整体平移配对 · ${rangeLabel}`,
    detail: [
      `已按检测偏移 ${offsetLabel} 完成配对`,
      confidenceLabel,
      '建议抽查片头片尾是否仍对齐。',
    ].filter(Boolean).join(' · '),
    isBoundaryCandidate: true,
    provenance: group.flatMap(item => item.row.provenance ? [item.row.provenance] : []),
  };
};

/** 只展示可复核差异 */
export function analyzeAlignmentDiff(rows: SubRow[]): AlignmentDiffSummary {
  const timelineRows = rows
    .map(toTimelineRow)
    .filter(item => item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const firstStartMs = timelineRows[0]?.startMs ?? 0;
  const lastEndMs = timelineRows[timelineRows.length - 1]?.endMs ?? 0;
  const entries: AlignmentDiffEntry[] = [];
  let directPairCount = 0;
  let expandedDialogueCount = 0;
  let coverageMergeCount = 0;
  let singleTrackCount = 0;
  let shiftedMatchCount = 0;
  let singleTrackGroup: TimelineRow[] = [];
  let shiftedGroup: TimelineRow[] = [];

  const flushSingleTrackGroup = () => {
    if (singleTrackGroup.length > 0) {
      entries.push(makeSingleTrackEntry(singleTrackGroup, firstStartMs, lastEndMs));
      singleTrackGroup = [];
    }
  };

  const flushShiftedGroup = () => {
    if (shiftedGroup.length > 0) {
      entries.push(makeShiftedMatchEntry(shiftedGroup));
      shiftedGroup = [];
    }
  };

  for (const item of timelineRows) {
    const { row, primaryText, secondaryText } = item;

    if (row.alignment === 'shifted-match') {
      flushSingleTrackGroup();
      shiftedMatchCount += 1;
      const prior = shiftedGroup[shiftedGroup.length - 1];
      const sameOffset = !prior
        || prior.row.provenance?.offsetMs === row.provenance?.offsetMs;
      const isConsecutive = !prior || item.startMs - prior.endMs <= SHIFTED_GROUP_GAP_MS;
      if (sameOffset && isConsecutive) {
        shiftedGroup.push(item);
      } else {
        flushShiftedGroup();
        shiftedGroup.push(item);
      }
      continue;
    }

    flushShiftedGroup();

    const isDirectPair = row.type === 'merged'
      && secondaryText
      && row.alignment !== 'expanded-dialogue'
      && row.alignment !== 'coverage-merge';

    if (isDirectPair) {
      directPairCount += 1;
      continue;
    }

    if (row.alignment === 'expanded-dialogue' || row.alignment === 'coverage-merge') {
      flushSingleTrackGroup();
      const isCoverage = row.alignment === 'coverage-merge';
      if (isCoverage) coverageMergeCount += 1;
      else expandedDialogueCount += 1;
      entries.push({
        id: `${isCoverage ? 'coverage' : 'expanded'}-${row.index}`,
        kind: isCoverage ? 'coverage-merge' : 'expanded-dialogue',
        rowIndexes: [row.index],
        ts: row.ts,
        startMs: item.startMs,
        endMs: item.endMs,
        primaryText,
        secondaryText,
        label: isCoverage ? '时间覆盖合并' : '已展开的对话组',
        detail: isCoverage
          ? '一侧时间轴覆盖对侧多句，已按较细时间轴拆成多行（主句文本整段复用）。建议核对覆盖是否过宽。'
          : '压缩的角色间对白已按另一轨的连续时间轴拆为两句。',
        isBoundaryCandidate: false,
        provenance: row.provenance ? [row.provenance] : [],
      });
      continue;
    }

    if (isStandaloneDialogue(row, secondaryText)) {
      singleTrackCount += 1;
      const prior = singleTrackGroup[singleTrackGroup.length - 1];
      const usesSameTrack = !prior
        || Boolean(prior.primaryText) === Boolean(primaryText);
      const isConsecutive = !prior
        || (item.startMs - prior.endMs <= SINGLE_TRACK_GROUP_GAP_MS
          && item.startMs - singleTrackGroup[0].startMs <= SINGLE_TRACK_GROUP_SPAN_MS);

      if (usesSameTrack && isConsecutive) {
        singleTrackGroup.push(item);
      } else {
        flushSingleTrackGroup();
        singleTrackGroup.push(item);
      }
      continue;
    }

    flushSingleTrackGroup();
  }

  flushShiftedGroup();
  flushSingleTrackGroup();
  return {
    directPairCount,
    expandedDialogueCount,
    coverageMergeCount,
    singleTrackCount,
    shiftedMatchCount,
    entries,
  };
}

const entryToReviewItem = (entry: AlignmentDiffEntry): MergeReviewItem => {
  const confidence = entry.provenance.find(item => typeof item.confidence === 'number')?.confidence;
  let reason = entry.detail;
  let severity: MergeReviewItem['severity'] = 'review';

  if (entry.kind === 'coverage-merge') {
    reason = '时间覆盖合并，建议核对覆盖是否过宽';
    severity = 'review';
  } else if (entry.kind === 'expanded-dialogue') {
    reason = '已展开对话组，建议确认拆句是否自然';
    severity = 'review';
  } else if (entry.kind === 'single-track') {
    if (entry.isBoundaryCandidate) {
      reason = '片头/片尾单轨，可能是附加内容或未配对对白';
      severity = 'watch';
    } else {
      reason = '片中单轨未配对，建议人工核对';
      severity = 'review';
    }
  } else if (entry.kind === 'shifted-match') {
    const low = typeof confidence === 'number' && confidence < SHIFTED_REVIEW_CONFIDENCE_THRESHOLD;
    reason = low
      ? `平移配对置信偏低（${Math.round((confidence ?? 0) * 100)}%），建议重点抽查`
      : '整体平移配对，建议抽查片头片尾是否仍对齐';
    severity = low ? 'review' : 'watch';
  }

  return {
    id: `review-${entry.id}`,
    category: entry.kind,
    rowIndexes: entry.rowIndexes,
    startMs: entry.startMs,
    endMs: entry.endMs,
    ts: entry.ts,
    text: previewText(entry.primaryText, entry.secondaryText),
    reason,
    severity,
    isBoundaryCandidate: entry.isBoundaryCandidate,
    confidence,
    provenance: entry.provenance,
  };
};

const isOtherSuspectRow = (row: SubRow): boolean => {
  const aux = row.auxiliary;
  if (!aux) return false;
  if (aux.suspicion?.kind === 'needs_review') return true;
  if (typeof aux.confidence === 'number' && aux.confidence < AUXILIARY_REVIEW_CONFIDENCE_THRESHOLD) {
    // Survived into timeline with soft classification — flag for eyes.
    return true;
  }
  return false;
};

const otherSuspectReason = (row: SubRow): string => {
  const aux = row.auxiliary;
  if (aux?.suspicion?.detail) return aux.suspicion.detail;
  if (aux?.suspicion?.reasons?.length) return `存疑：${aux.suspicion.reasons.join('、')}`;
  if (typeof aux?.confidence === 'number') {
    return `辅助分类置信偏低（${Math.round(aux.confidence)}），建议复核`;
  }
  return '辅助内容存疑，建议复核';
};

/**
 * Post-merge human-assist queue. Reuses analyzeAlignmentDiff grouping;
 * does not change merge algorithm. Adds soft auxiliary suspects when fields exist.
 */
export function buildMergeReviewQueue(rows: SubRow[]): MergeReviewQueue {
  const summary = analyzeAlignmentDiff(rows);
  const coveredIndexes = new Set<number>();
  const items: MergeReviewItem[] = [];

  for (const entry of summary.entries) {
    const item = entryToReviewItem(entry);
    items.push(item);
    for (const index of item.rowIndexes) coveredIndexes.add(index);
  }

  for (const row of rows) {
    if (coveredIndexes.has(row.index)) continue;
    if (!isOtherSuspectRow(row)) continue;
    const { startMs, endMs } = parseSubtitleRange(row.ts);
    if (!(endMs > startMs)) continue;
    const sides = getRowSides(row);
    items.push({
      id: `review-suspect-${row.index}`,
      category: 'other-suspect',
      rowIndexes: [row.index],
      startMs,
      endMs,
      ts: row.ts,
      text: previewText(sides.primaryText, sides.secondaryText, row.text),
      reason: otherSuspectReason(row),
      severity: 'review',
      confidence: typeof row.auxiliary?.confidence === 'number'
        ? row.auxiliary.confidence / 100
        : undefined,
      provenance: row.provenance ? [row.provenance] : undefined,
    });
  }

  items.sort((a, b) => a.startMs - b.startMs || a.rowIndexes[0] - b.rowIndexes[0]);

  const counts = EMPTY_COUNTS();
  for (const item of items) counts[item.category] += 1;

  return {
    total: items.length,
    counts,
    items,
  };
}

export function filterMergeReviewQueue(
  queue: MergeReviewQueue,
  filter: MergeReviewFilter,
): MergeReviewItem[] {
  if (filter === 'all') return queue.items;
  return queue.items.filter(item => item.category === filter);
}
