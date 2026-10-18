'use client';

import React, { useMemo } from 'react';
import {
  buildMarkerRail,
  markerRailTooltip,
  visibleRangeFraction,
  type MarkerRailHit,
} from '@/core/markerRail';
import type { ReviewFocusId } from '@/core/workbenchReview';
import { REVIEW_FOCUS_LABEL } from '@/core/workbenchReview';

const FOCUS_COLOR: Record<ReviewFocusId | 'all', string> = {
  review: 'var(--wb-cat-review)',
  structure: 'var(--wb-cat-structure)',
  suspect: 'var(--wb-cat-review)',
  screen: 'var(--wb-cat-screen)',
  credit: 'var(--wb-cat-credit)',
  sound: 'var(--wb-cat-sound)',
  all: 'var(--wb-cat-review)',
};

type MarkerRailProps = {
  totalLines: number;
  hits: MarkerRailHit[];
  focus: ReviewFocusId | null;
  firstVisibleArrayIndex: number;
  lastVisibleArrayIndex: number;
  onJump: (arrayIndex: number) => void;
};

export const MarkerRail: React.FC<MarkerRailProps> = ({
  totalLines,
  hits,
  focus,
  firstVisibleArrayIndex,
  lastVisibleArrayIndex,
  onJump,
}) => {
  const model = useMemo(
    () => buildMarkerRail({ totalLines, hits, focus: focus ?? 'review' }),
    [totalLines, hits, focus],
  );
  const range = visibleRangeFraction({
    totalLines,
    firstVisibleArrayIndex,
    lastVisibleArrayIndex,
  });
  const color = FOCUS_COLOR[focus ?? 'review'];
  const label = focus ? REVIEW_FOCUS_LABEL[focus] : REVIEW_FOCUS_LABEL.review;

  if (totalLines <= 0) return null;

  return (
    <div className="wb-rail" role="navigation" aria-label="字幕标记分布">
      <div
        className="wb-rail__viewport"
        style={{ top: `${range.start * 100}%`, height: `${Math.max(4, (range.end - range.start) * 100)}%` }}
      />
      {model.buckets.map((bucket) => (
        <button
          key={bucket.index}
          type="button"
          className={`wb-rail__bk l${bucket.level} wb-focus-ring`}
          style={{ ['--c' as string]: color } as React.CSSProperties}
          title={markerRailTooltip(bucket, label)}
          aria-label={markerRailTooltip(bucket, label)}
          disabled={bucket.count <= 0 || bucket.firstHitArrayIndex == null}
          onClick={() => {
            if (bucket.firstHitArrayIndex != null) onJump(bucket.firstHitArrayIndex);
          }}
        />
      ))}
    </div>
  );
};
