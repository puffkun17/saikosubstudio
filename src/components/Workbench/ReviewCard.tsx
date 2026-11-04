'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const AUX_CHILDREN: Array<{ id: 'screen' | 'credit' | 'sound'; color: string; shape: 'round' | 'square' }> = [
  { id: 'screen', color: 'var(--wb-cat-screen)', shape: 'round' },
  { id: 'credit', color: 'var(--wb-cat-credit)', shape: 'square' },
  { id: 'sound', color: 'var(--wb-cat-sound)', shape: 'square' },
];

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
  const [auxOpen, setAuxOpen] = useState(false);
  const auxRef = useRef<HTMLDivElement>(null);
  const auxChild = focus === 'screen' || focus === 'credit' || focus === 'sound' ? focus : null;
  const progress = counts.reviewTotal > 0
    ? Math.round((counts.reviewChecked / counts.reviewTotal) * 100)
    : 100;

  const auxLabel = useMemo(() => {
    if (auxChild) return `附加字幕 · ${REVIEW_FOCUS_LABEL[auxChild]}`;
    return `附加字幕 ${counts.auxiliaryTotal}`;
  }, [auxChild, counts.auxiliaryTotal]);

  useEffect(() => {
    if (!auxOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!auxRef.current?.contains(event.target as Node)) setAuxOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [auxOpen]);

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
          className={`wb-prog wb-focus-ring${focus === 'review' ? ' is-on' : ''}`}
          aria-pressed={focus === 'review'}
          aria-label={`复核进度 ${counts.reviewChecked} / ${counts.reviewTotal}`}
          title={`已核对 ${counts.reviewChecked} / ${counts.reviewTotal}。点按只看待复核。`}
          onClick={() => onFocusChange(focus === 'review' ? null : 'review')}
        >
          <span style={{ width: `${progress}%` }} />
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`wb-pill wb-focus-ring ${focus === 'structure' ? 'wb-sel' : ''}`}
            onClick={() => onFocusChange(focus === 'structure' ? null : 'structure')}
            aria-pressed={focus === 'structure'}
          >
            结构差异 <i>{counts.structure}</i>
          </button>
          <button
            type="button"
            className={`wb-pill wb-focus-ring ${focus === 'suspect' ? 'wb-sel' : ''}`}
            onClick={() => onFocusChange(focus === 'suspect' ? null : 'suspect')}
            aria-pressed={focus === 'suspect'}
            data-testid="focus-suspect"
          >
            类别待定 <i>{counts.suspect}</i>
          </button>
        </div>
        {emptyFocus && focus ? (
          <p className="wb-empty-note" role="status" data-testid="focus-empty">
            {REVIEW_FOCUS_LABEL[focus]} · 无命中
          </p>
        ) : null}
      </div>

      <div className="relative" ref={auxRef}>
        <button
          type="button"
          className={`wb-aux wb-focus-ring ${auxChild ? 'wb-sel' : ''}`}
          aria-expanded={auxOpen}
          aria-haspopup="menu"
          onClick={() => setAuxOpen((v) => !v)}
          data-testid="aux-group-chip"
        >
          <span className="wb-aux__dot" aria-hidden="true" />
          {auxLabel}
          <span aria-hidden="true">{auxOpen ? '▲' : '▶'}</span>
        </button>
        {auxOpen && (
          <div className="wb-aux__menu" role="menu" data-testid="aux-group-menu">
            {AUX_CHILDREN.map((child) => {
              const count = counts[child.id];
              return (
                <button
                  key={child.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={auxChild === child.id}
                  className={`wb-aux__item wb-focus-ring ${auxChild === child.id ? 'wb-sel' : ''}`}
                  title={count <= 0 ? `${REVIEW_FOCUS_LABEL[child.id]} · 无命中` : undefined}
                  onClick={() => {
                    onFocusChange(child.id);
                    setAuxOpen(false);
                  }}
                >
                  <span
                    className={`swatch ${child.shape === 'round' ? 'round' : ''}`}
                    style={{ background: child.color }}
                    aria-hidden="true"
                  />
                  {REVIEW_FOCUS_LABEL[child.id]}
                  <span className="cnt">{count}</span>
                </button>
              );
            })}
          </div>
        )}
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
