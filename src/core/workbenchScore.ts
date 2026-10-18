/**
 * Workbench B7 score ring — computed only from real alignment / source-match signals.
 *
 * 质量 = 100 − 2×未解决 severity「review」− 1×未解决「watch」− 长空窗扣分（0 / 12 / 22）
 * 契合度 = (直接配对 + 已核对的结构差异项) ÷ (直接配对 + 结构差异项) × 100
 * 总分 = round((质量 + 契合度) / 2)
 * 处理完可到 = 假设全部待复核项都已核对后的总分
 */
import {
  analyzeAlignmentDiff,
  buildMergeReviewQueue,
  type MergeReviewItem,
} from '../utils/timeline/alignmentDiff';
import type { SubRow } from '../utils/subtitleCore';
import { parseSubtitleRange } from '../utils/timeline/timecode';

export type WorkbenchScoreBreakdown = {
  quality: number;
  fit: number;
  total: number;
  potential: number;
  unresolvedReview: number;
  unresolvedWatch: number;
  longGapPenalty: number;
  directPairCount: number;
  structureEntryCount: number;
  confirmedStructureCount: number;
  formulaZh: {
    quality: string;
    fit: string;
    total: string;
    potential: string;
  };
};

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Long-gap penalty mirrors sourceMatch.ts (0 / 12 / 22). */
export function computeLongGapPenalty(
  rows: SubRow[],
  videoDurationMs?: number,
): number {
  if (!rows.length) return 0;
  const ranges = rows
    .map((row) => parseSubtitleRange(row.ts))
    .filter((r) => r.endMs > r.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  if (ranges.length < 2) return 0;

  const subtitleStartMs = ranges[0].startMs;
  const subtitleEndMs = ranges[ranges.length - 1].endMs;
  const basisDuration = Math.max(videoDurationMs || 0, subtitleEndMs - subtitleStartMs, 1);

  let longestGapMs = 0;
  for (let i = 1; i < ranges.length; i += 1) {
    const gap = ranges[i].startMs - ranges[i - 1].endMs;
    if (gap > longestGapMs) longestGapMs = gap;
  }

  const longGapThreshold = Math.max(90_000, basisDuration * 0.08);
  if (longestGapMs <= longGapThreshold) return 0;
  return longestGapMs > basisDuration * 0.16 ? 22 : 12;
}

export function isStructureReviewItem(item: MergeReviewItem): boolean {
  return item.category !== 'other-suspect';
}

export function computeWorkbenchScore(input: {
  rows: SubRow[];
  checkedIds?: string[];
  videoDurationMs?: number;
}): WorkbenchScoreBreakdown {
  const { rows, checkedIds = [], videoDurationMs } = input;
  const checked = new Set(checkedIds);
  const queue = buildMergeReviewQueue(rows);
  const alignment = analyzeAlignmentDiff(rows);
  const longGapPenalty = computeLongGapPenalty(rows, videoDurationMs);

  let unresolvedReview = 0;
  let unresolvedWatch = 0;
  let confirmedStructureCount = 0;
  const structureItems = queue.items.filter(isStructureReviewItem);

  for (const item of queue.items) {
    if (checked.has(item.id)) {
      if (isStructureReviewItem(item)) confirmedStructureCount += 1;
      continue;
    }
    if (item.severity === 'watch') unresolvedWatch += 1;
    else unresolvedReview += 1;
  }

  const qualityRaw = 100 - 2 * unresolvedReview - 1 * unresolvedWatch - longGapPenalty;
  const quality = clampScore(qualityRaw);

  const directPairCount = alignment.directPairCount;
  const structureEntryCount = structureItems.length;
  const fitDenom = directPairCount + structureEntryCount;
  const fitRaw = fitDenom > 0
    ? ((directPairCount + confirmedStructureCount) / fitDenom) * 100
    : 100;
  const fit = clampScore(fitRaw);
  const total = clampScore((quality + fit) / 2);

  // Potential: all queue items checked (structure confirmed = all structure entries)
  const potentialQuality = clampScore(100 - longGapPenalty);
  const potentialFit = clampScore(
    fitDenom > 0
      ? ((directPairCount + structureEntryCount) / fitDenom) * 100
      : 100,
  );
  const potential = clampScore((potentialQuality + potentialFit) / 2);

  return {
    quality,
    fit,
    total,
    potential,
    unresolvedReview,
    unresolvedWatch,
    longGapPenalty,
    directPairCount,
    structureEntryCount,
    confirmedStructureCount,
    formulaZh: {
      quality: `质量分 = 100 − 2×未解决「需复核」${unresolvedReview} − 1×未解决「留意」${unresolvedWatch} − 长空窗扣分 ${longGapPenalty} = ${quality}`,
      fit: `契合度 = (直接配对 ${directPairCount} + 已核对结构差异 ${confirmedStructureCount}) ÷ (直接配对 ${directPairCount} + 结构差异 ${structureEntryCount}) = ${fit}`,
      total: `总分 = round((质量 ${quality} + 契合度 ${fit}) ÷ 2) = ${total}`,
      potential: `全部复核完成后，质量按长空窗扣分重算为 ${potentialQuality}，契合度按结构差异全核对为 ${potentialFit}，总分可到 ${potential}`,
    },
  };
}
