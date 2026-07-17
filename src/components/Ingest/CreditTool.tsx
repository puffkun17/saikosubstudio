'use client';

import React from 'react';
import { BadgeCheck, ChevronDown, PenLine } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';

export const CreditTool: React.FC = () => {
  const {
    detectedAttributions,
    creatorCredit,
    appendCreatorCredit,
    setCreatorCredit,
    setAppendCreatorCredit,
  } = useStudioStore();

  return (
    <details className="group border-t border-white/[0.06] pt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md py-0.5 text-left [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <PenLine className="h-3.5 w-3.5 shrink-0 text-[var(--v4-accent-strong)]" />
          <span className="text-xs font-semibold text-neutral-200">署名</span>
          <span className="truncate text-xs text-neutral-500">
            {detectedAttributions.length > 0 ? `${detectedAttributions.length} 条` : '可选'}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500 transition-colors group-hover:text-neutral-300">
          <span className="group-open:hidden">展开</span>
          <span className="hidden group-open:inline">收起</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-3 grid gap-4 border-t border-white/[0.05] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] lg:gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <BadgeCheck className="h-3.5 w-3.5 text-[#8fa3d1]" />
            来源署名
          </div>
          {detectedAttributions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {detectedAttributions.map((item) => (
                <span
                  key={`${item.role}-${item.value}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#8fa3d1]/18 bg-[#8fa3d1]/[0.045] px-2.5 py-1 text-xs text-[#d2d9e9]"
                  title={`${item.label}: ${item.value}`}
                >
                  <span className="shrink-0 text-[#8fa3d1]">{item.label}</span>
                  <span className="truncate text-neutral-200">{item.value}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">未在当前字幕中发现明确署名行。ASS 文件的脚本信息通常更容易识别。</p>
          )}
        </div>

        <div className="min-w-0">
          <label className="text-xs font-medium text-neutral-400" htmlFor="creator-credit">片尾制作署名</label>
          <input
            id="creator-credit"
            type="text"
            value={creatorCredit}
            onChange={(event) => setCreatorCredit(event.target.value)}
            placeholder="例如：Nexus Studio"
            className="mt-2 h-10 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-[#8fa3d1]/55 focus:bg-[#8fa3d1]/[0.035]"
          />
          <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-neutral-400">
            <input
              type="checkbox"
              checked={appendCreatorCredit}
              onChange={(event) => setAppendCreatorCredit(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[#8fa3d1]"
            />
            <span>导出时在最后一条字幕后追加片尾署名</span>
          </label>
        </div>
      </div>
    </details>
  );
};
