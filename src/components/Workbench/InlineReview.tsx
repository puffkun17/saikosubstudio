'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { MergeReviewItem } from '@/utils/timeline/alignmentDiff';
import type { LineKind, SubRow } from '@/utils/subtitleCore';
import {
  STRUCTURE_KIND_LABEL,
  SUSPECT_CATEGORY_OPTIONS,
  guessSuspectCategory,
} from '@/core/workbenchReview';

type InlineReviewProps = {
  item: MergeReviewItem;
  row: SubRow;
  checked: boolean;
  onMarkReviewed: () => void;
  onConfirmCategory: (kind: Exclude<LineKind, 'credit'>) => void;
  onIgnore: () => void;
  onEdit?: () => void;
};

export const InlineReview: React.FC<InlineReviewProps> = ({
  item,
  row,
  checked,
  onMarkReviewed,
  onConfirmCategory,
  onIgnore,
  onEdit,
}) => {
  const isSuspect = item.category === 'other-suspect';
  const guessed = guessSuspectCategory(row);
  const [picked, setPicked] = useState<Exclude<LineKind, 'credit'>>(guessed);

  if (checked) return null;

  const kindLabel = STRUCTURE_KIND_LABEL[item.category] || item.category;
  const pickedLabel = SUSPECT_CATEGORY_OPTIONS.find((o) => o.kind === picked)?.label ?? '';

  return (
    <div
      className="wb-inline"
      data-testid={isSuspect ? 'inline-review-suspect' : 'inline-review-structure'}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wb-inline__sheet">
        <div className="wb-inline__copy">
          {isSuspect ? (
            <>
              <span className="wb-inline__k"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />类别待定</span>
              <p className="wb-inline__r">
                系统不太确定这行是对白还是附加内容。请选择类别；分类会影响「智能 / 清洁」模式是否隐去它。
                {item.reason ? `（${item.reason}）` : ''}
              </p>
            </>
          ) : (
            <>
              <span className="wb-inline__k"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />结构差异 · {kindLabel}</span>
              <p className="wb-inline__r">{item.reason}</p>
            </>
          )}
        </div>
        <ReviewActions
          primary={isSuspect ? `确认「${pickedLabel}」` : '已核对'}
          primaryTitle={isSuspect ? `确认类别为${pickedLabel}并标为已核对` : '标为已核对'}
          onPrimary={isSuspect ? () => onConfirmCategory(picked) : onMarkReviewed}
          onEdit={onEdit}
          onSkip={onIgnore}
        />
        {isSuspect ? (
          <div className="wb-cats" role="radiogroup" aria-label="选择字幕类别">
            {SUSPECT_CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                type="button"
                role="radio"
                aria-checked={picked === opt.kind}
                className={`wb-cat wb-focus-ring ${picked === opt.kind ? 'wb-sel' : ''}`}
                onClick={() => setPicked(opt.kind)}
              >
                {opt.label}
                {opt.kind === guessed ? <small>系统预测</small> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * 两条复核流共用同一槽：主按钮（已核对 / 确认「类别」）→ 修改 → 保留。
 * 次动作都是「保留现状并标为已核对」，不再用「忽略」。
 */
const ReviewActions = ({
  primary,
  primaryTitle,
  onPrimary,
  onEdit,
  onSkip,
}: {
  primary: string;
  primaryTitle: string;
  onPrimary: () => void;
  onEdit?: () => void;
  onSkip: () => void;
}) => (
  <div className="wb-inline__actions" role="group" aria-label="复核操作" data-inline-actions>
    <button type="button" className="ui-action ui-action--secondary" title={primaryTitle} onClick={onPrimary}>
      {primary}
    </button>
    {onEdit ? (
      <button type="button" className="ui-action ui-action--secondary" onClick={onEdit}>修改</button>
    ) : null}
    <button type="button" className="ui-action ui-action--quiet" title="保留现状并标为已核对" onClick={onSkip}>
      保留
    </button>
  </div>
);
