'use client';

import React, { useState } from 'react';
import { BadgeCheck, ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore, type CreditDeclaration } from '@/store/useStudioStore';

const DECLARATION_OPTIONS: Array<{ value: CreditDeclaration; label: string; hint: string }> = [
  { value: 'none', label: '未声明', hint: '不写入制作声明' },
  { value: 'original', label: '原创', hint: '声明为原创字幕' },
  { value: 'ai-assisted', label: 'AI 辅助', hint: '声明含 AI 提示/生成辅助' },
  { value: 'translated', label: '翻译整理', hint: '声明为翻译或二次整理' },
];

/** 属性信息：默认展开；含制作声明、署名与可选的字幕后署名。 */
export const CreditTool: React.FC = () => {
  const {
    detectedAttributions,
    creatorCredit,
    appendCreatorCredit,
    creditDeclaration,
    creditPlacement,
    isOfficialSubtitle,
    setCreatorCredit,
    setAppendCreatorCredit,
    setCreditDeclaration,
    setCreditPlacement,
  } = useStudioStore(useShallow((state) => ({
    detectedAttributions: state.detectedAttributions,
    creatorCredit: state.creatorCredit,
    appendCreatorCredit: state.appendCreatorCredit,
    creditDeclaration: state.creditDeclaration,
    creditPlacement: state.creditPlacement,
    isOfficialSubtitle: state.isOfficialSubtitle,
    setCreatorCredit: state.setCreatorCredit,
    setAppendCreatorCredit: state.setAppendCreatorCredit,
    setCreditDeclaration: state.setCreditDeclaration,
    setCreditPlacement: state.setCreditPlacement,
  })));

  const [expanded, setExpanded] = useState(true);
  const summaryBits = [
    creditDeclaration !== 'none'
      ? DECLARATION_OPTIONS.find((item) => item.value === creditDeclaration)?.label
      : null,
    appendCreatorCredit ? '字幕后署名' : null,
    detectedAttributions.length > 0 ? `${detectedAttributions.length} 条来源` : null,
    isOfficialSubtitle ? '官方' : null,
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        className="v4-focus-ring flex w-full items-center gap-1.5 rounded-md text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <h4 className="text-base font-semibold text-[var(--v4-text)]">属性信息</h4>
        <span className="text-xs font-medium text-[var(--v4-text-muted)]">可选</span>
        {summaryBits.length > 0 && !expanded ? (
          <span className="ml-1 min-w-0 truncate text-xs font-medium text-[var(--v4-text-faint)]">
            · {summaryBits.join(' · ')}
          </span>
        ) : null}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-[var(--v4-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="grid gap-3 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--v4-text-muted)]">制作声明</div>
            <div className="ui-choice-group mt-2" role="radiogroup" aria-label="制作声明">
              {DECLARATION_OPTIONS.map((option) => {
                const active = creditDeclaration === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={option.hint}
                    onClick={() => setCreditDeclaration(option.value)}
                    className={`ui-choice ${active ? 'ui-choice--on' : ''}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--v4-text-faint)]">
              {isOfficialSubtitle ? '已标记官方字幕 · ' : ''}
              导出 ASS 时写入 Script Info（Original Script / Comment）
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--v4-text-muted)]">
              <BadgeCheck className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />
              署名【可选】
            </div>
            {detectedAttributions.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {detectedAttributions.map((item) => (
                  <span
                    key={`${item.role}-${item.value}`}
                    className="ui-meta max-w-full"
                    title={`${item.label}: ${item.value}`}
                  >
                    <span className="text-[var(--v4-accent-strong)]">{item.label}</span>
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
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-[var(--v4-text-muted)]">
              <input
                type="checkbox"
                checked={appendCreatorCredit}
                onChange={(event) => setAppendCreatorCredit(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--v4-accent)]"
              />
              <span>字幕后署名</span>
            </label>

            {appendCreatorCredit ? (
              <div className="mt-2 grid gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] px-2.5 py-2.5">
                <input
                  id="creator-credit"
                  type="text"
                  value={creatorCredit}
                  onChange={(event) => setCreatorCredit(event.target.value)}
                  placeholder="例如：Nexus Studio"
                  className="rd-field h-10 w-full rounded-lg px-3 text-sm text-[var(--v4-text)] outline-none transition placeholder:text-[var(--v4-text-faint)]"
                />
                <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="字幕后署名位置">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--v4-text-muted)]">
                    <input
                      type="radio"
                      name="credit-placement"
                      checked={creditPlacement === 'after-last'}
                      onChange={() => setCreditPlacement('after-last')}
                      className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                    />
                    紧跟最终字幕
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--v4-text-muted)]">
                    <input
                      type="radio"
                      name="credit-placement"
                      checked={creditPlacement === 'before-end'}
                      onChange={() => setCreditPlacement('before-end')}
                      className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                    />
                    播放结束前
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
