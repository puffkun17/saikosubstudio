/**
 * Aggregated ~40-bucket marker rail for the workbench list.
 * Buckets tint by hit count (0 / 1 / 2–3 / 4+); no per-line hairline ticks.
 */
export const MARKER_RAIL_BUCKET_COUNT = 40;

export type MarkerRailFocus =
  | 'review'
  | 'structure'
  | 'suspect'
  | 'screen'
  | 'credit'
  | 'sound'
  | 'all';

export type MarkerRailHit = {
  /** 0-based array index into the subtitle list */
  arrayIndex: number;
  /** 1-based line number for display */
  lineNumber: number;
};

export type MarkerRailBucket = {
  index: number;
  startLine: number;
  endLine: number;
  startArrayIndex: number;
  endArrayIndex: number;
  count: number;
  /** First hit in this bucket (for jump-to) */
  firstHitArrayIndex: number | null;
  level: 0 | 1 | 2 | 3;
};

export type MarkerRailModel = {
  bucketCount: number;
  totalLines: number;
  buckets: MarkerRailBucket[];
  focus: MarkerRailFocus;
};

const levelForCount = (count: number): 0 | 1 | 2 | 3 => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
};

/**
 * Build ~40 equal-line buckets and count hits that fall into each.
 * Hits outside [0, totalLines) are ignored.
 */
export function buildMarkerRail(input: {
  totalLines: number;
  hits: MarkerRailHit[];
  focus?: MarkerRailFocus;
  bucketCount?: number;
}): MarkerRailModel {
  const bucketCount = Math.max(1, input.bucketCount ?? MARKER_RAIL_BUCKET_COUNT);
  const totalLines = Math.max(0, input.totalLines);
  const focus = input.focus ?? 'all';

  if (totalLines === 0) {
    return {
      bucketCount,
      totalLines: 0,
      focus,
      buckets: Array.from({ length: bucketCount }, (_, index) => ({
        index,
        startLine: 0,
        endLine: 0,
        startArrayIndex: 0,
        endArrayIndex: 0,
        count: 0,
        firstHitArrayIndex: null,
        level: 0,
      })),
    };
  }

  const linesPerBucket = totalLines / bucketCount;
  const buckets: MarkerRailBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const startArrayIndex = Math.floor(index * linesPerBucket);
    const endArrayIndex = Math.min(
      totalLines - 1,
      index === bucketCount - 1
        ? totalLines - 1
        : Math.floor((index + 1) * linesPerBucket) - 1,
    );
    return {
      index,
      startLine: startArrayIndex + 1,
      endLine: endArrayIndex + 1,
      startArrayIndex,
      endArrayIndex,
      count: 0,
      firstHitArrayIndex: null,
      level: 0 as const,
    };
  });

  const sortedHits = [...input.hits].sort((a, b) => a.arrayIndex - b.arrayIndex);
  for (const hit of sortedHits) {
    if (hit.arrayIndex < 0 || hit.arrayIndex >= totalLines) continue;
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor(hit.arrayIndex / linesPerBucket),
    );
    const bucket = buckets[bucketIndex];
    bucket.count += 1;
    if (bucket.firstHitArrayIndex == null) bucket.firstHitArrayIndex = hit.arrayIndex;
  }

  for (const bucket of buckets) {
    bucket.level = levelForCount(bucket.count);
  }

  return { bucketCount, totalLines, focus, buckets };
}

/** Visible-range box as fractional [start, end] along the rail (0–1). */
export function visibleRangeFraction(input: {
  totalLines: number;
  firstVisibleArrayIndex: number;
  lastVisibleArrayIndex: number;
}): { start: number; end: number } {
  const { totalLines } = input;
  if (totalLines <= 0) return { start: 0, end: 1 };
  const first = Math.max(0, Math.min(totalLines - 1, input.firstVisibleArrayIndex));
  const last = Math.max(first, Math.min(totalLines - 1, input.lastVisibleArrayIndex));
  return {
    start: first / totalLines,
    end: (last + 1) / totalLines,
  };
}

export function markerRailTooltip(
  bucket: MarkerRailBucket,
  focusLabel: string,
): string {
  if (bucket.count <= 0) {
    return `第 ${bucket.startLine}–${bucket.endLine} 行 · 无标记`;
  }
  return `第 ${bucket.startLine}–${bucket.endLine} 行 · ${bucket.count} 处${focusLabel} · 点击跳到第一处`;
}
