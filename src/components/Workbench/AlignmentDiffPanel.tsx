'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileSearch2, GitCompareArrows, LocateFixed, MoveHorizontal, Rows3, SplitSquareVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { analyzeAlignmentDiff, type AlignmentDiffKind } from '@/utils/timeline/alignmentDiff';
import { formatMsClock } from '@/utils/timeline/timecode';
import { useStudioStore } from '@/store/useStudioStore';

type DiffFilter = 'all' | AlignmentDiffKind;

const FILTERS: Array<{ id: DiffFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'shifted-match', label: '平移配对' },
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
    <section className="overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <GitCompareArrows className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--v4-text)]">对齐差异</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--v4-text-faint)]">
              <span>直接配对 {summary.directPairCount}</span>
              <span className={summary.shiftedMatchCount > 0 ? 'text-[var(--v4-text-muted)]' : ''}>平移 {summary.shiftedMatchCount}</span>
              <span className={summary.expandedDialogueCount > 0 ? 'text-[var(--v4-accent-strong)]' : ''}>对话组 {summary.expandedDialogueCount}</span>
              <span className={summary.singleTrackCount > 0 ? 'text-[var(--v4-warning)]' : ''}>仅一轨 {summary.singleTrackCount}</span>
            </div>
          </div>
        </div>

        {hasReviewItems ? (
          <button
            type="button"
            onClick={() => setIsOpen(value => !value)}
            className="v4-focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2 text-xs font-medium text-[var(--v4-text-muted)] transition hover:border-[var(--v4-accent)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-accent-strong)]"
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {isOpen ? '收起检查' : '查看差异'}
          </button>
        ) : (
          <span className="text-xs text-[var(--v4-text-muted)]">未发现需复核的对齐差异</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && hasReviewItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="border-t border-[var(--v4-line)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
              <p className="text-xs leading-5 text-[var(--v4-text-faint)]">
                此处标出结构差异与整体平移配对；不会自动删除或改写任一字幕轨。
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-1" role="tablist" aria-label="对齐差异筛选">
                {FILTERS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${filter === item.id ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-faint)] hover:text-[var(--v4-text-muted)]'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[min(34vh,360px)] overflow-y-auto border-t border-[var(--v4-line)]">
              <div className="hidden grid-cols-[94px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-5 py-2.5 text-xs font-medium text-[var(--v4-text-faint)] md:grid md:px-6">
                <span>时间</span>
                <span>主轨</span>
                <span>第二语言</span>
                <span className="text-right">操作</span>
              </div>

              {filteredEntries.map(entry => {
                const isExpanded = entry.kind === 'expanded-dialogue';
                const isShifted = entry.kind === 'shifted-match';
                const hasSource = entry.provenance.length > 0;
                const isSourceOpen = sourceEntryId === entry.id;
                const badgeClass = isShifted
                  ? 'bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'
                  : isExpanded
                    ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                    : 'bg-[var(--v4-warning)]/10 text-[var(--v4-warning)]';
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-2 border-b border-[var(--v4-line)] px-5 py-3 last:border-b-0 md:grid-cols-[94px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-6"
                  >
                    <div className="flex items-center gap-2 text-xs text-[var(--v4-text-faint)] md:block">
                      <span className="font-mono tabular-nums text-[var(--v4-text-muted)]">{formatMsClock(entry.startMs)}</span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium md:mt-1.5 ${badgeClass}`}>
                        {isShifted ? <MoveHorizontal className="h-2.5 w-2.5" /> : isExpanded ? <SplitSquareVertical className="h-2.5 w-2.5" /> : <Rows3 className="h-2.5 w-2.5" />}
                        {entry.label}
                      </span>
                    </div>
                    <div className="min-w-0 text-xs leading-5 text-[var(--v4-text-muted)]">
                      <span className="mr-2 text-xs font-medium uppercase tracking-[0.1em] text-[var(--v4-accent-strong)]/70 md:hidden">主轨</span>
                      {entry.primaryText || <span className="text-[var(--v4-text-faint)]">--</span>}
                    </div>
                    <div className="min-w-0 text-xs leading-5 text-[var(--v4-text-faint)]">
                      <span className="mr-2 text-xs font-medium uppercase tracking-[0.1em] text-[var(--v4-text-faint)] md:hidden">第二语言</span>
                      {entry.secondaryText || <span className="text-[var(--v4-text-faint)]">--</span>}
                      <p className="mt-1 text-xs leading-4 text-[var(--v4-text-faint)]">{entry.detail}</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1">
                        {hasSource && (
                          <button
                            type="button"
                            onClick={() => setSourceEntryId(current => current === entry.id ? null : entry.id)}
                            className={`v4-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${isSourceOpen ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-faint)] hover:bg-[var(--v4-panel-muted)] hover:text-[var(--v4-text)]'}`}
                            aria-expanded={isSourceOpen}
                          >
                            <FileSearch2 className="h-3 w-3" />
                            来源
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLocate(entry.rowIndexes[0])}
                          className="v4-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--v4-text-faint)] transition hover:bg-[var(--v4-panel-muted)] hover:text-[var(--v4-text)]"
                          title={`定位到第 ${entry.rowIndexes[0]} 行`}
                        >
                          <LocateFixed className="h-3 w-3" />
                          定位
                        </button>
                      </div>
                    </div>
                    {isSourceOpen && (
                      <div className="border-t border-[var(--v4-line)] pt-3 md:col-span-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--v4-text-faint)]">
                          <span>原始字幕来源</span>
                          {entry.provenance[0]?.timingSource && (
                            <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-1.5 py-0.5 text-[var(--v4-accent-strong)]">
                              时序取自{entry.provenance[0].timingSource === 'primary' ? '主轨' : '第二语言'}
                            </span>
                          )}
                          {entry.rowIndexes.length > 1 && <span>已聚合 {entry.rowIndexes.length} 行</span>}
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {entry.provenance.slice(0, 6).map((source, sourceIndex) => (
                            <div key={`${entry.id}-${sourceIndex}`} className="rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2.5 text-xs leading-5">
                              {source.primary && (
                                <div>
                                  <div className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--v4-accent-strong)]/70">主轨 #{source.primary.cueIndex}</div>
                                  <div className="mt-1 whitespace-pre-wrap text-[var(--v4-text-muted)]">{source.primary.text}</div>
                                </div>
                              )}
                              {source.secondary && (
                                <div className={source.primary ? 'mt-2 border-t border-[var(--v4-line)] pt-2' : ''}>
                                  <div className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--v4-text-faint)]">第二语言 #{source.secondary.cueIndex}</div>
                                  <div className="mt-1 whitespace-pre-wrap text-[var(--v4-text-faint)]">{source.secondary.text}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {entry.provenance.length > 6 && <p className="mt-2 text-xs text-[var(--v4-text-faint)]">其余来源已折叠；可通过定位查看对应时间轴。</p>}
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
