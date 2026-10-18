'use client';

import React, { useState } from 'react';
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

  if (isSuspect) {
    return (
      <div className="wb-inline" data-testid="inline-review-suspect" onClick={(e) => e.stopPropagation()}>
        <div className="wb-inline__body" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="wb-inline__k">⚠ 类别待定</span>
            <p className="wb-inline__r">
              系统不太确定这行是对白还是附加内容。请选择类别；分类会影响「智能 / 清洁」模式是否隐去它。
              {item.reason ? `（${item.reason}）` : ''}
            </p>
          </div>
          <div className="wb-cats" role="radiogroup" aria-label="选择字幕类别">
            {SUSPECT_CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                type="button"
                role="radio"
                aria-checked={picked === opt.kind}
                className={`wb-cat wb-focus-ring ${picked === opt.kind ? 'wb-sel' : ''} ${opt.kind === guessed && picked !== opt.kind ? 'guess' : ''}`}
                onClick={() => setPicked(opt.kind)}
              >
                {opt.label}
                {opt.kind === guessed ? <small>系统预测</small> : null}
              </button>
            ))}
          </div>
          <div className="wb-inline__btns" style={{ marginLeft: 0, marginTop: 4 }}>
            <button
              type="button"
              className="wb-btn pri wb-focus-ring"
              onClick={() => onConfirmCategory(picked)}
            >
              <span>确认「{SUSPECT_CATEGORY_OPTIONS.find((o) => o.kind === picked)?.label}」</span>
            </button>
            {onEdit ? (
              <button type="button" className="wb-btn wb-focus-ring" onClick={onEdit}>修改</button>
            ) : null}
            <button type="button" className="wb-btn gh wb-focus-ring" onClick={onIgnore}>忽略</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wb-inline" data-testid="inline-review-structure" onClick={(e) => e.stopPropagation()}>
      <div className="wb-inline__body">
        <span className="wb-inline__k">⚠ 结构差异 · {kindLabel}</span>
        <p className="wb-inline__r">{item.reason}</p>
        <div className="wb-inline__btns">
          <button type="button" className="wb-btn pri wb-focus-ring" onClick={onMarkReviewed}>
            <span>已核对</span>
          </button>
          {onEdit ? (
            <button type="button" className="wb-btn wb-focus-ring" onClick={onEdit}>修改</button>
          ) : null}
          <button type="button" className="wb-btn gh wb-focus-ring" onClick={onIgnore} title="保留现状并标为已核对">
            保留
          </button>
        </div>
      </div>
    </div>
  );
};
