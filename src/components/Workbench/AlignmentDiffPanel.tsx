'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileSearch2, GitCompareArrows, LocateFixed, Rows3, SplitSquareVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { analyzeAlignmentDiff, type AlignmentDiffKind } from '@/utils/timeline/alignmentDiff';
import { formatMsClock } from '@/utils/timeline/timecode';
import { useStudioStore } from '@/store/useStudioStore';

type DiffFilter = 'all' | AlignmentDiffKind;

const FILTERS: Array<{ id: DiffFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'expanded-dialogue', label: '对话组' },
  { id: 'single-track', label: '仅一轨' },
];

export const AlignmentDiffPanel: React.FC<{ rows: SubRow[] }> = ({ rows }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<DiffFilter>('all');
  const [sourceEntryId, setSourceEntryId] = useState<string | null>(null);
  const { setPreviewIndex, setJumpLineVal } = useStudioStore();
  const summary = useMemo(() => analyzeAlignmentDiff(rows), [rows]);

  const filteredEntries = summary.entries.filter(entry => filter === 'all' || entry.kind === filter);
  const hasReviewItems = summary.entries.length > 0;

  const handleLocate = (rowIndex: number) => {
    setPreviewIndex(rowIndex - 1);
    setJumpLineVal(String(rowIndex));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.065] bg-[#080808]/68">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <GitCompareArrows className="h-4 w-4 shrink-0 text-[#9ddacb]" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-neutral-100">对齐差异</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-neutral-500">
              <span>直接配对 {summary.directPairCount}</span>
              <span className={summary.expandedDialogueCount > 0 ? 'text-[#cdece5]' : ''}>对话组 {summary.expandedDialogueCount}</span>
              <span className={summary.singleTrackCount > 0 ? 'text-[#d9c7bd]' : ''}>仅一轨 {summary.singleTrackCount}</span>
            </div>
          </div>
        </div>

        {hasReviewItems ? (
          <button
            type="button"
            onClick={() => setIsOpen(value => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.075] bg-white/[0.025] px-3 py-2 text-[12px] font-medium text-neutral-200 transition hover:border-[#9ddacb]/28 hover:bg-[#9ddacb]/[0.055] hover:text-[#d8f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ddacb]/70"
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {isOpen ? '收起检查' : '查看差异'}
          </button>
        ) : (
          <span className="text-[12px] text-[#cdece5]">未发现需复核的对齐差异</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && hasReviewItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="border-t border-white/[0.055]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
              <p className="text-[12px] leading-5 text-neutral-500">
                此处仅标出结构差异；不会自动删除或改写任一字幕轨。
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/15 p-1" role="tablist" aria-label="对齐差异筛选">
                {FILTERS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${filter === item.id ? 'bg-white/[0.09] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[min(34vh,360px)] overflow-y-auto border-t border-white/[0.045]">
              <div className="hidden grid-cols-[94px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-white/[0.05] bg-white/[0.012] px-5 py-2.5 text-[11px] font-medium text-neutral-500 md:grid md:px-6">
                <span>时间</span>
                <span>主轨</span>
                <span>第二语言</span>
                <span className="text-right">操作</span>
              </div>

              {filteredEntries.map(entry => {
                const isExpanded = entry.kind === 'expanded-dialogue';
                const hasSource = entry.provenance.length > 0;
                const isSourceOpen = sourceEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-2 border-b border-white/[0.045] px-5 py-3 last:border-b-0 md:grid-cols-[94px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-6"
                  >
                    <div className="flex items-center gap-2 text-[12px] text-neutral-500 md:block">
                      <span className="font-mono tabular-nums text-neutral-400">{formatMsClock(entry.startMs)}</span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium md:mt-1.5 ${isExpanded ? 'bg-[#9ddacb]/[0.08] text-[#cdece5]' : 'bg-[#c0a89a]/[0.09] text-[#dfc9bc]'}`}>
                        {isExpanded ? <SplitSquareVertical className="h-2.5 w-2.5" /> : <Rows3 className="h-2.5 w-2.5" />}
                        {entry.label}
                      </span>
                    </div>
                    <div className="min-w-0 text-[13px] leading-5 text-neutral-200">
                      <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#9ddacb]/70 md:hidden">主轨</span>
                      {entry.primaryText || <span className="text-neutral-600">--</span>}
                    </div>
                    <div className="min-w-0 text-[13px] leading-5 text-neutral-400">
                      <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-600 md:hidden">第二语言</span>
                      {entry.secondaryText || <span className="text-neutral-600">--</span>}
                      <p className="mt-1 text-[11px] leading-4 text-neutral-600">{entry.detail}</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1">
                        {hasSource && (
                          <button
                            type="button"
                            onClick={() => setSourceEntryId(current => current === entry.id ? null : entry.id)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ddacb]/70 ${isSourceOpen ? 'bg-[#9ddacb]/[0.08] text-[#d8f3ed]' : 'text-neutral-400 hover:bg-white/[0.06] hover:text-[#d8f3ed]'}`}
                            aria-expanded={isSourceOpen}
                          >
                            <FileSearch2 className="h-3 w-3" />
                            来源
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLocate(entry.rowIndexes[0])}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:bg-white/[0.06] hover:text-[#d8f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ddacb]/70"
                          title={`定位到第 ${entry.rowIndexes[0]} 行`}
                        >
                          <LocateFixed className="h-3 w-3" />
                          定位
                        </button>
                      </div>
                    </div>
                    {isSourceOpen && (
                      <div className="border-t border-white/[0.05] pt-3 md:col-span-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                          <span>原始字幕来源</span>
                          {entry.provenance[0]?.timingSource && (
                            <span className="rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-0.5 text-[#cdece5]">
                              时序取自{entry.provenance[0].timingSource === 'primary' ? '主轨' : '第二语言'}
                            </span>
                          )}
                          {entry.rowIndexes.length > 1 && <span>已聚合 {entry.rowIndexes.length} 行</span>}
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {entry.provenance.slice(0, 6).map((source, sourceIndex) => (
                            <div key={`${entry.id}-${sourceIndex}`} className="rounded-lg border border-white/[0.055] bg-black/20 px-3 py-2.5 text-[12px] leading-5">
                              {source.primary && (
                                <div>
                                  <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#9ddacb]/70">主轨 #{source.primary.cueIndex}</div>
                                  <div className="mt-1 whitespace-pre-wrap text-neutral-300">{source.primary.text}</div>
                                </div>
                              )}
                              {source.secondary && (
                                <div className={source.primary ? 'mt-2 border-t border-white/[0.05] pt-2' : ''}>
                                  <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-600">第二语言 #{source.secondary.cueIndex}</div>
                                  <div className="mt-1 whitespace-pre-wrap text-neutral-400">{source.secondary.text}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {entry.provenance.length > 6 && <p className="mt-2 text-[11px] text-neutral-600">其余来源已折叠；可通过定位查看对应时间轴。</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
