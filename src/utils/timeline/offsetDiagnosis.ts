/** Shared policy for whole-track secondary offset detection (industrial align). */

export const OFFSET_DIAGNOSIS_POLICY = {
  minSampleCount: 20,
  maxLengthRatio: 1.35,
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

/**
 * Estimate a stable global start-time offset (secondary − primary) from cue starts.
 */
export function estimateGlobalOffsetFromStarts(
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
    if (!Number.isNaN(primaryStart) && !Number.isNaN(secondaryStart)) {
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
