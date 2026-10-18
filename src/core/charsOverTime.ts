/**
 * Characters-over-time distribution for the 概览 drawer bar chart.
 * Buckets subtitle character counts by start time across the timeline span.
 */
import type { SubRow } from '../utils/subtitleCore';
import { parseSubtitleRange } from '../utils/timeline/timecode';

export type CharTimeBucket = {
  index: number;
  startMs: number;
  endMs: number;
  chars: number;
};

export type CharTimeDistribution = {
  bucketCount: number;
  totalChars: number;
  spanMs: number;
  startMs: number;
  endMs: number;
  maxChars: number;
  buckets: CharTimeBucket[];
};

const countChars = (text: string): number => {
  // Count visible characters; treat \N / newlines as separators (not counted).
  return text.replace(/\\N/gi, '').replace(/\n/g, '').replace(/\s+/g, '').length;
};

export function buildCharsOverTime(
  rows: SubRow[],
  options?: { bucketCount?: number; spanEndMs?: number },
): CharTimeDistribution {
  const bucketCount = Math.max(1, options?.bucketCount ?? 48);
  if (!rows.length) {
    return {
      bucketCount,
      totalChars: 0,
      spanMs: 0,
      startMs: 0,
      endMs: 0,
      maxChars: 0,
      buckets: Array.from({ length: bucketCount }, (_, index) => ({
        index,
        startMs: 0,
        endMs: 0,
        chars: 0,
      })),
    };
  }

  const ranges = rows.map((row) => ({
    row,
    ...parseSubtitleRange(row.ts),
    chars: countChars(row.text),
  }));

  const startMs = Math.min(...ranges.map((r) => r.startMs));
  const naturalEnd = Math.max(...ranges.map((r) => r.endMs));
  const endMs = Math.max(naturalEnd, options?.spanEndMs ?? 0, startMs + 1);
  const spanMs = endMs - startMs;
  const bucketMs = spanMs / bucketCount;

  const buckets: CharTimeBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    startMs: startMs + index * bucketMs,
    endMs: startMs + (index + 1) * bucketMs,
    chars: 0,
  }));

  let totalChars = 0;
  for (const range of ranges) {
    totalChars += range.chars;
    if (range.chars <= 0) continue;
    const idx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((range.startMs - startMs) / bucketMs)),
    );
    buckets[idx].chars += range.chars;
  }

  const maxChars = buckets.reduce((max, b) => Math.max(max, b.chars), 0);

  return {
    bucketCount,
    totalChars,
    spanMs,
    startMs,
    endMs,
    maxChars,
    buckets,
  };
}

export type SubtitleVitals = {
  totalChars: number;
  totalLines: number;
  avgCharsPerLine: number;
  linesPerMinute: number;
  spanMs: number;
};

export function computeSubtitleVitals(rows: SubRow[]): SubtitleVitals {
  const dist = buildCharsOverTime(rows);
  const totalLines = rows.length;
  const totalChars = dist.totalChars;
  const spanMs = dist.spanMs;
  const minutes = spanMs > 0 ? spanMs / 60_000 : 0;
  return {
    totalChars,
    totalLines,
    avgCharsPerLine: totalLines > 0 ? Math.round((totalChars / totalLines) * 10) / 10 : 0,
    linesPerMinute: minutes > 0 ? Math.round((totalLines / minutes) * 10) / 10 : 0,
    spanMs,
  };
}
