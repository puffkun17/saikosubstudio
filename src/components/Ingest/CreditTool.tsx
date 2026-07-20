'use client';

import React from 'react';
import { BadgeCheck, PenLine } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';

/** Fixed credit block — always visible, placed before export filename. */
export const CreditTool: React.FC = () => {
  const {
    detectedAttributions,
    creatorCredit,
    appendCreatorCredit,
    setCreatorCredit,
    setAppendCreatorCredit,
  } = useStudioStore(useShallow((state) => ({
    detectedAttributions: state.detectedAttributions,
    creatorCredit: state.creatorCredit,
    appendCreatorCredit: state.appendCreatorCredit,
    setCreatorCredit: state.setCreatorCredit,
    setAppendCreatorCredit: state.setAppendCreatorCredit,
  })));

  return (
    <section className="rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <PenLine className="h-3.5 w-3.5 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-[var(--v4-text)]">署名</h4>
        <span className="text-xs font-medium text-[var(--v4-text-muted)]">
          {detectedAttributions.length > 0 ? `${detectedAttributions.length} 条来源` : '可选'}
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--v4-text-muted)]">
            <BadgeCheck className="h-3.5 w-3.5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
            来源署名
          </div>
          {detectedAttributions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {detectedAttributions.map((item) => (
                <span
                  key={`${item.role}-${item.value}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--v4-accent)]/18 bg-[var(--v4-accent-soft)] px-2.5 py-1 text-xs text-[var(--v4-accent-strong)]"
                  title={`${item.label}: ${item.value}`}
                >
                  <span className="shrink-0 text-[var(--v4-accent-strong)]">{item.label}</span>
                  <span className="truncate text-[var(--v4-text-muted)]">{item.value}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--v4-text-muted)]">
              未在当前字幕中发现明确署名行。
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label className="text-xs font-medium text-[var(--v4-text-muted)]" htmlFor="creator-credit">
            片尾制作署名
          </label>
          <input
            id="creator-credit"
            type="text"
            value={creatorCredit}
            onChange={(event) => setCreatorCredit(event.target.value)}
            placeholder="例如：Nexus Studio"
            className="rd-field mt-1.5 h-10 w-full rounded-lg px-3 text-sm text-[var(--v4-text)] outline-none transition placeholder:text-[var(--v4-text-faint)]"
          />
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-[var(--v4-text-muted)]">
            <input
              type="checkbox"
              checked={appendCreatorCredit}
              onChange={(event) => setAppendCreatorCredit(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--v4-accent)]"
            />
            <span>导出时在最后一条字幕后追加片尾署名</span>
          </label>
        </div>
      </div>
    </section>
  );
};
