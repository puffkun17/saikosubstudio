/** Shared policy for whole-track secondary offset detection (industrial align). */

export const OFFSET_DIAGNOSIS_POLICY = {
  minSampleCount: 20,
  maxLengthRatio: 1.35,
  histogramMaxLengthRatio: 1.75,
  histogramBinMs: 250,
  minGainOverZero: 0.2,
  maxSamples: 120,
  /** Per-sample deviation (ms) counted as “stable” around the median offset. */
  stableDeviationMs: 650,
  /** Minimum |offset| before auto-apply is considered. */
  minApplyAbsMs: 1200,
  /** Maximum |offset| eligible for auto-apply. */
  maxApplyAbsMs: 30_000,
  /** Fraction of samples within stableDeviationMs. */
  minConfidence: 0.72,
  /** Log gate for “疑似偏移” notices (same floor as minApplyAbsMs). */
  logAbsMs: 1200,
} as const;

export interface GlobalOffsetDiagnosis {
  offsetMs: number;
  confidence: number;
  sampleCount: number;
  medianDeviationMs: number;
  shouldApply: boolean;
  reason: string;
}

const medianNumber = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const lowerBound = (sorted: number[], target: number): number => {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const nearestSortedValue = (sorted: number[], target: number): number => {
  const idx = lowerBound(sorted, target);
  if (idx <= 0) return sorted[0];
  if (idx >= sorted.length) return sorted[sorted.length - 1];
  const prev = sorted[idx - 1];
  const next = sorted[idx];
  return Math.abs(target - prev) <= Math.abs(next - target) ? prev : next;
};

function estimateIndexRatioOffset(
  primaryStarts: number[],
  secondaryStarts: number[],
): GlobalOffsetDiagnosis {
  const minCount = Math.min(primaryStarts.length, secondaryStarts.length);
  const ratio = minCount > 0
    ? Math.max(primaryStarts.length, secondaryStarts.length) / minCount
    : Infinity;

  if (minCount < OFFSET_DIAGNOSIS_POLICY.minSampleCount) {
    return {
      offsetMs: 0,
      confidence: 0,
      sampleCount: minCount,
      medianDeviationMs: 0,
      shouldApply: false,
      reason: '样本不足',
    };
  }
  if (ratio > OFFSET_DIAGNOSIS_POLICY.maxLengthRatio) {
    return {
      offsetMs: 0,
      confidence: 0,
      sampleCount: minCount,
      medianDeviationMs: 0,
      shouldApply: false,
      reason: '行数差异较大',
    };
  }

  const sampleCount = Math.min(OFFSET_DIAGNOSIS_POLICY.maxSamples, minCount);
  const deltas: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const primaryIndex = Math.round((index / Math.max(1, sampleCount - 1)) * (primaryStarts.length - 1));
    const secondaryIndex = Math.round((index / Math.max(1, sampleCount - 1)) * (secondaryStarts.length - 1));
    const primaryStart = primaryStarts[primaryIndex];
    const secondaryStart = secondaryStarts[secondaryIndex];
    if (Number.isFinite(primaryStart) && Number.isFinite(secondaryStart)) {
      deltas.push(secondaryStart - primaryStart);
    }
  }

  if (deltas.length < OFFSET_DIAGNOSIS_POLICY.minSampleCount) {
    return {
      offsetMs: 0,
      confidence: 0,
      sampleCount: deltas.length,
      medianDeviationMs: 0,
      shouldApply: false,
      reason: '有效样本不足',
    };
  }

  const offsetMs = Math.round(medianNumber(deltas));
  const deviations = deltas.map((delta) => Math.abs(delta - offsetMs));
  const medianDeviationMs = Math.round(medianNumber(deviations));
  const stableCount = deviations.filter(
    (value) => value <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs,
  ).length;
  const confidence = Math.round((stableCount / deltas.length) * 100) / 100;
  const absOffset = Math.abs(offsetMs);
  const shouldApply = absOffset >= OFFSET_DIAGNOSIS_POLICY.minApplyAbsMs
    && absOffset <= OFFSET_DIAGNOSIS_POLICY.maxApplyAbsMs
    && medianDeviationMs <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs
    && confidence >= OFFSET_DIAGNOSIS_POLICY.minConfidence;

  return {
    offsetMs,
    confidence,
    sampleCount: deltas.length,
    medianDeviationMs,
    shouldApply,
    reason: shouldApply ? '稳定整体偏移' : '偏移不稳定或超出自动范围',
  };
}

/**
 * Time-windowed delta histogram fallback when extra cues at head/tail skew index-ratio alignment.
 */
function estimateHistogramOffset(
  primaryStarts: number[],
  secondaryStarts: number[],
): GlobalOffsetDiagnosis | null {
  const pSorted = primaryStarts.filter(Number.isFinite).sort((a, b) => a - b);
  const sSorted = secondaryStarts.filter(Number.isFinite).sort((a, b) => a - b);
  const minCount = Math.min(pSorted.length, sSorted.length);
  if (minCount < OFFSET_DIAGNOSIS_POLICY.minSampleCount) return null;
  const ratio = Math.max(pSorted.length, sSorted.length) / minCount;
  if (ratio > OFFSET_DIAGNOSIS_POLICY.histogramMaxLengthRatio) return null;

  const sampleCount = Math.min(OFFSET_DIAGNOSIS_POLICY.maxSamples, pSorted.length);
  const sampled: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const pIdx = Math.round((index / Math.max(1, sampleCount - 1)) * (pSorted.length - 1));
    sampled.push(pSorted[pIdx]);
  }

  const binMs = OFFSET_DIAGNOSIS_POLICY.histogramBinMs;
  const maxAbs = OFFSET_DIAGNOSIS_POLICY.maxApplyAbsMs;
  const histogram = new Map<number, number>();

  for (const p of sampled) {
    const lo = lowerBound(sSorted, p - maxAbs);
    const perSampleVotes = new Map<number, number>();
    for (let j = lo; j < sSorted.length; j += 1) {
      const s = sSorted[j];
      if (s > p + maxAbs) break;
      const bin = Math.round((s - p) / binMs);
      perSampleVotes.set(bin, Math.max(perSampleVotes.get(bin) ?? 0, 1));
      perSampleVotes.set(bin - 1, Math.max(perSampleVotes.get(bin - 1) ?? 0, 0.5));
      perSampleVotes.set(bin + 1, Math.max(perSampleVotes.get(bin + 1) ?? 0, 0.5));
    }
    for (const [bin, weight] of perSampleVotes) {
      histogram.set(bin, (histogram.get(bin) ?? 0) + weight);
    }
  }

  let bestBin: number | null = null;
  let bestWeight = 0;
  for (const [bin, weight] of histogram) {
    if (Math.abs(bin * binMs) < OFFSET_DIAGNOSIS_POLICY.minApplyAbsMs - binMs) continue;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestBin = bin;
    }
  }
  if (bestBin === null) return null;

  const candidateCenter = bestBin * binMs;
  const inliers: number[] = [];
  for (const p of sampled) {
    const nearestS = nearestSortedValue(sSorted, p + candidateCenter);
    const delta = nearestS - p;
    if (Math.abs(delta - candidateCenter) <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs * 2) {
      inliers.push(delta);
    }
  }
  if (inliers.length < OFFSET_DIAGNOSIS_POLICY.minSampleCount) return null;

  const offsetMs = Math.round(medianNumber(inliers));
  const residuals = sampled.map((p) => {
    const nearestS = nearestSortedValue(sSorted, p + offsetMs);
    return Math.abs((nearestS - p) - offsetMs);
  });
  const medianDeviationMs = Math.round(medianNumber(residuals));
  const stableCount = residuals.filter(
    (value) => value <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs,
  ).length;
  const confidence = Math.round((stableCount / sampled.length) * 100) / 100;

  let zeroStableCount = 0;
  for (const p of sampled) {
    const nearestS = nearestSortedValue(sSorted, p);
    if (Math.abs(nearestS - p) <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs) {
      zeroStableCount += 1;
    }
  }
  const zeroConfidence = zeroStableCount / sampled.length;
  const absOffset = Math.abs(offsetMs);
  const shouldApply = absOffset >= OFFSET_DIAGNOSIS_POLICY.minApplyAbsMs
    && absOffset <= OFFSET_DIAGNOSIS_POLICY.maxApplyAbsMs
    && medianDeviationMs <= OFFSET_DIAGNOSIS_POLICY.stableDeviationMs
    && confidence >= OFFSET_DIAGNOSIS_POLICY.minConfidence
    && confidence >= zeroConfidence + OFFSET_DIAGNOSIS_POLICY.minGainOverZero;

  if (!shouldApply) return null;
  return {
    offsetMs,
    confidence,
    sampleCount: sampled.length,
    medianDeviationMs,
    shouldApply: true,
    reason: '稳定整体偏移（时间窗对齐）',
  };
}

/**
 * Estimate a stable global start-time offset (secondary − primary) from cue starts.
 */
export function estimateGlobalOffsetFromStarts(
  primaryStarts: number[],
  secondaryStarts: number[],
): GlobalOffsetDiagnosis {
  const fast = estimateIndexRatioOffset(primaryStarts, secondaryStarts);
  if (fast.shouldApply) return fast;
  return estimateHistogramOffset(primaryStarts, secondaryStarts) ?? fast;
}
