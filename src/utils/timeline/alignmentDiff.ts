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
  singleTrackCount: number;
  shiftedMatchCount: number;
  entries: AlignmentDiffEntry[];
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
      expandedDialogueCount += 1;
      entries.push({
        id: `expanded-${row.index}`,
        kind: row.alignment === 'coverage-merge' ? 'coverage-merge' : 'expanded-dialogue',
        rowIndexes: [row.index],
        ts: row.ts,
        startMs: item.startMs,
        endMs: item.endMs,
        primaryText,
        secondaryText,
        label: row.alignment === 'coverage-merge' ? '时间覆盖合并' : '已展开的对话组',
        detail: row.alignment === 'coverage-merge'
          ? '一侧时间轴覆盖对侧多句，已按较细时间轴拆成多行（主句文本整段复用）。'
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
    singleTrackCount,
    shiftedMatchCount,
    entries,
  };
}
