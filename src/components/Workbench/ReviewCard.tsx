'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { ScoreRing } from '@/components/Workbench/ScoreRing';
import type { WorkbenchScoreBreakdown } from '@/core/workbenchScore';
import {
  REVIEW_FOCUS_LABEL,
  type ReviewFocusId,
  type ReviewGroupCounts,
  type ReviewPagerItem,
} from '@/core/workbenchReview';

type ReviewCardProps = {
  score: WorkbenchScoreBreakdown;
  counts: ReviewGroupCounts;
  focus: ReviewFocusId | null;
  /** Filter is on and matched nothing — the axis is fully dimmed. */
  emptyFocus?: boolean;
  onFocusChange: (focus: ReviewFocusId | null) => void;
  pagerItems: ReviewPagerItem[];
  pagerIndex: number;
  onPagerChange: (index: number) => void;
  onOpenOverview: () => void;
};

type FilterChip = {
  id: ReviewFocusId;
  count: number;
};

export const ReviewCard: React.FC<ReviewCardProps> = ({
  score,
  counts,
  focus,
  emptyFocus = false,
  onFocusChange,
  pagerItems,
  pagerIndex,
  onPagerChange,
  onOpenOverview,
}) => {
  const progress = counts.reviewTotal > 0
    ? Math.round((counts.reviewChecked / counts.reviewTotal) * 100)
    : 100;
  const reviewOn = focus === 'review';
  const reviewLocked = counts.reviewRemaining <= 0 && !reviewOn;
  const chips: FilterChip[] = [
    { id: 'structure', count: counts.structureRemaining },
    { id: 'suspect', count: counts.suspectRemaining },
    { id: 'screen', count: counts.screen },
    { id: 'credit', count: counts.credit },
    { id: 'sound', count: counts.sound },
  ];

  const pagerTotal = pagerItems.length;
  const pagerDisplay = pagerTotal === 0 ? 0 : Math.min(pagerIndex + 1, pagerTotal);

  return (
    <section className="wb-card v4-panel" data-testid="review-card" aria-label="复核总览">
      <div className="wb-score" title={`总分 ${score.total}。质量、契合度与处理后可到的分数在概览。`}>
        <ScoreRing score={score.total} />
        <span className="wb-sr">总分 {score.total}</span>
      </div>

      <div className="wb-vr hidden sm:block" aria-hidden="true" />

      <div className="wb-grp">
        <button
          type="button"
          className={`wb-prog wb-focus-ring${reviewOn ? ' is-on' : ''}${counts.reviewRemaining <= 0 ? ' is-zero' : ''}`}
          aria-pressed={reviewOn}
          disabled={reviewLocked}
          data-testid="focus-review"
          aria-label={`待核 ${counts.reviewRemaining}，已核对 ${counts.reviewChecked} / ${counts.reviewTotal}`}
          title={`待核 ${counts.reviewRemaining}（结构差异 ${counts.structureRemaining} + 类别待定 ${counts.suspectRemaining}）。已核对 ${counts.reviewChecked} / ${counts.reviewTotal}。`}
          onClick={() => onFocusChange(reviewOn ? null : 'review')}
        >
          <span style={{ width: `${progress}%` }} />
        </button>
        <div className="wb-filters" role="group" aria-label="分类筛选">
          {chips.map((chip) => {
            const on = focus === chip.id;
            const zero = chip.count <= 0;
            const locked = zero && !on;
            const label = REVIEW_FOCUS_LABEL[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                className={`wb-pill wb-focus-ring${on ? ' wb-sel' : ''}${zero ? ' is-zero' : ''}`}
                aria-pressed={on}
                disabled={locked}
                data-testid={`focus-${chip.id}`}
                data-count={chip.count}
                title={zero
                  ? `${label} · 无命中`
                  : chip.id === 'structure' || chip.id === 'suspect'
                    ? `${label} ${chip.count}，计入顶栏待核`
                    : `${label} ${chip.count}`}
                onClick={() => onFocusChange(on ? null : chip.id)}
              >
                <span className={`wb-pill__swatch wb-pill__swatch--${chip.id}`} aria-hidden="true" />
                {label}
                <i>{chip.count}</i>
              </button>
            );
          })}
        </div>
        {emptyFocus && focus ? (
          <p className="wb-empty-note" role="status" data-testid="focus-empty">
            {REVIEW_FOCUS_LABEL[focus]} · 无命中
          </p>
        ) : null}
      </div>

      <div className="wb-card__tools">
        <div className="wb-pager" aria-label="复核翻页">
          <button
            type="button"
            className="wb-focus-ring"
            aria-label="上一项"
            disabled={pagerTotal === 0}
            onClick={() => onPagerChange(pagerIndex <= 0 ? Math.max(0, pagerTotal - 1) : pagerIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {pagerDisplay} / {pagerTotal}
          </span>
          <button
            type="button"
            className="wb-focus-ring"
            aria-label="下一项"
            disabled={pagerTotal === 0}
            onClick={() => onPagerChange(pagerIndex >= pagerTotal - 1 ? 0 : pagerIndex + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="ui-action ui-action--info wb-focus-ring"
          aria-label="打开概览"
          title="概览"
          onClick={onOpenOverview}
          data-testid="open-overview"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          概览
        </button>
      </div>
    </section>
  );
};
