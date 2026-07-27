'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { AlignmentDiffPanel } from '@/components/Workbench/AlignmentDiffPanel';
import { SourceMatchPanel, type InspectionMarkFilter } from '@/components/Workbench/SourceMatchPanel';
import { InspectionMarkGlyph, MARK_FILTERS, MARK_LABEL } from '@/components/Workbench/inspectionMarks';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { useWorkflowChrome } from '@/components/Global/WorkflowChrome';
import { ChevronDown, GitCompareArrows, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeAlignmentDiff } from '@/utils/timeline/alignmentDiff';
import { createSourceMatchReport } from '@/utils/timeline/sourceMatch';
import { formatMsClock } from '@/utils/timeline/timecode';
import { InfoHint } from '@/components/ui/InfoHint';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

export const WorkbenchStep: React.FC = () => {
  const {
    processedSubs,
    customFilename,
    setWorkflowStep,
    setProcessedSubs,
    selectedTaskId,
    isSettingsOpen,
    setIsSettingsOpen,
    tmdbData,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customFilename: state.customFilename,
    setWorkflowStep: state.setWorkflowStep,
    setProcessedSubs: state.setProcessedSubs,
    selectedTaskId: state.selectedTaskId,
    isSettingsOpen: state.isSettingsOpen,
    setIsSettingsOpen: state.setIsSettingsOpen,
    tmdbData: state.tmdbData,
  })));
  const { setInfoBar, setEdgeNext } = useWorkflowChrome();

  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const backModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(showBackConfirm, backModalRef, () => setShowBackConfirm(false));
  const [sourceDurationMs, setSourceDurationMs] = useState<number | undefined>(undefined);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [markFilter, setMarkFilter] = useState<InspectionMarkFilter>('all');

  const alignmentSummary = useMemo(
    () => (processedSubs ? analyzeAlignmentDiff(processedSubs) : null),
    [processedSubs],
  );
  const profileStats = useMemo(
    () => (processedSubs ? createSourceMatchReport(processedSubs, sourceDurationMs).stats : null),
    [processedSubs, sourceDurationMs],
  );
  const structureCount = alignmentSummary?.entries.length ?? 0;
  const screenCount = processedSubs?.filter(row => (
    (row.cueKind === 'screen_text' || row.auxiliary?.category === 'screen_text')
    && row.cueKind !== 'credit'
    && row.type !== 'credit'
  )).length ?? 0;
  const lyricsCount = processedSubs?.filter(row => (
    row.type === 'lyrics'
    || row.cueKind === 'lyrics'
  )).length ?? 0;
  const creditCount = processedSubs?.filter(row => (
    row.type === 'credit'
    || row.cueKind === 'credit'
  )).length ?? 0;
  const soundCount = processedSubs?.filter(row => (
    row.type !== 'lyrics'
    && row.cueKind !== 'lyrics'
    && row.type !== 'credit'
    && row.cueKind !== 'credit'
    && (
      row.cueKind === 'sound_caption'
      || row.auxiliary?.category === 'ambient_sdh'
      || row.auxiliary?.category === 'music'
    )
  )).length ?? 0;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showBackConfirm) return; // REL-2：确认框由 useUiModalFocus 处理
      if (isSettingsOpen) setIsSettingsOpen(false);
      else if (isDetailOpen) setIsDetailOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDetailOpen, isSettingsOpen, setIsSettingsOpen, showBackConfirm]);

  useEffect(() => {
    setInfoBar({
      title: '字幕调校',
      localChips: [
        `${processedSubs?.length || 0} 行`,
        customFilename || '未命名字幕',
        tmdbData ? undefined : '未匹配',
      ].filter((item): item is string => Boolean(item)),
      onBack: () => {
        if (processedSubs && processedSubs.length > 0) {
          setShowBackConfirm(true);
        } else {
          setWorkflowStep(1);
        }
      },
      actions: (
        <>
          <button
            type="button"
            className={isSettingsOpen ? 'ui-action' : 'ui-action ui-action--secondary'}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="调整字幕样式"
            aria-pressed={isSettingsOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            字幕样式
          </button>
          <ExportDropdown variant="ghost" />
        </>
      ),
    });
    return () => setInfoBar(null);
  }, [processedSubs, customFilename, isSettingsOpen, tmdbData, setInfoBar, setIsSettingsOpen, setWorkflowStep]);

  useEffect(() => {
    const hasTimeline = Boolean(processedSubs && processedSubs.length > 0);
    setEdgeNext({
      label: '打开预览',
      disabled: !hasTimeline,
      ready: hasTimeline,
      disabledReason: '还没有可预览的字幕时间轴，请先完成合轴或分配。',
      onClick: () => setWorkflowStep(3),
    });
    return () => setEdgeNext(null);
  }, [processedSubs, setEdgeNext, setWorkflowStep]);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--v4-canvas)]">
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 p-4 min-h-0 min-w-0 overflow-hidden flex flex-col items-center z-10">
          <div className="max-w-[1480px] w-full flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            {processedSubs && processedSubs.length > 0 && (
              <section className="v4-panel flex-shrink-0 overflow-hidden">
                <div className="flex flex-col gap-2.5 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2">
                      <GitCompareArrows className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-[var(--v4-text)]">字幕信息概览</h2>
                      {structureCount > 0 ? (
                        <span
                          className="inline-flex min-w-6 items-center justify-center rounded-md bg-[var(--v4-danger)]/12 px-1.5 py-0.5 text-sm font-semibold tabular-nums text-[var(--v4-danger)]"
                          title={`${structureCount} 处结构差异请复核`}
                        >
                          {structureCount}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--v4-text-faint)]">无结构差异</span>
                      )}
                    </div>

                    {profileStats && (
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--v4-text-muted)]">
                        <span>
                          文本量{' '}
                          <strong className="font-semibold tabular-nums text-[var(--v4-text)]">
                            {formatCount(profileStats.characterCount)}
                          </strong>
                        </span>
                        <span className="text-[var(--v4-line-strong)]">·</span>
                        <span>
                          跨度{' '}
                          <strong className="font-semibold tabular-nums text-[var(--v4-text)]">
                            {formatMsClock(profileStats.spanMs)}
                          </strong>
                        </span>
                        <span className="text-[var(--v4-line-strong)]">·</span>
                        <span className="inline-flex items-center gap-1">
                          密度
                          <InfoHint label="字幕密度说明">
                            每分钟字幕行数。声音描述、歌词和画面文字也会影响该指标。
                          </InfoHint>
                          <strong className="font-semibold tabular-nums text-[var(--v4-accent-strong)]">
                            {profileStats.densityPerMinute}
                          </strong>
                        </span>
                        {(screenCount > 0 || soundCount > 0 || lyricsCount > 0 || creditCount > 0) && (
                          <>
                            <span className="text-[var(--v4-line-strong)]">·</span>
                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--v4-text-faint)]">
                              {screenCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <InspectionMarkGlyph kind="screen" size={7} />
                                  {MARK_LABEL.screen} {screenCount}
                                </span>
                              )}
                              {soundCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <InspectionMarkGlyph kind="sound" size={7} />
                                  {MARK_LABEL.sound} {soundCount}
                                </span>
                              )}
                              {lyricsCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <InspectionMarkGlyph kind="lyrics" size={7} />
                                  {MARK_LABEL.lyrics} {lyricsCount}
                                </span>
                              )}
                              {creditCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <InspectionMarkGlyph kind="credit" size={7} />
                                  {MARK_LABEL.credit} {creditCount}
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    <div className="ui-choice-group" role="tablist" aria-label="时间轴标记筛选">
                      {MARK_FILTERS.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-selected={markFilter === item.id}
                          onClick={() => setMarkFilter(item.id)}
                          className={`ui-choice inline-flex items-center gap-1.5 ${markFilter === item.id ? 'ui-choice--on' : ''}`}
                        >
                          {item.kind ? <InspectionMarkGlyph kind={item.kind} size={8} /> : null}
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="v4-focus-ring inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--v4-text-muted)] hover:text-[var(--v4-text)]"
                      onClick={() => setIsDetailOpen(value => !value)}
                      aria-expanded={isDetailOpen}
                    >
                      {isDetailOpen ? '返回概览' : '查看详细内容'}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isDetailOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[var(--v4-line)] p-3 md:p-4">
                  <SourceMatchPanel
                    rows={processedSubs}
                    onTimelineDurationChange={setSourceDurationMs}
                    markFilter={markFilter}
                  />
                  {isDetailOpen && <AlignmentDiffPanel rows={processedSubs} />}
                </div>
              </section>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <SequenceList key={selectedTaskId || customFilename} timelineDurationMs={sourceDurationMs} />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSettingsOpen && (
            <>
              <motion.button
                type="button"
                aria-label="关闭样式参数"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/55 lg:hidden"
                onClick={() => setIsSettingsOpen(false)}
              />
              <motion.aside
                aria-label="样式参数"
                initial={{ x: 360, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 360, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="v4-panel absolute inset-y-4 right-4 z-50 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden lg:relative lg:inset-auto lg:z-20 lg:my-6 lg:mr-6 lg:w-[390px] lg:shrink-0"
              >
                <StyleSidebar />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      <OverlayPortal>
        <AnimatePresence>
          {showBackConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ui-modal-layer fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget) setShowBackConfirm(false);
              }}
            >
              <motion.div
                ref={backModalRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="workbench-back-title"
                aria-describedby="workbench-back-description"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="ui-modal"
                tabIndex={-1}
              >
                <h3 id="workbench-back-title" className="text-lg font-semibold text-[var(--v4-text)]">
                  是否重新导入
                </h3>
                <p id="workbench-back-description" className="mt-2 text-sm leading-6 text-[var(--v4-text-muted)]">
                  已导入的文件与轨道选择会保留。再次进入工作台时，将按当前选择重新生成预览。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="ui-action ui-action--quiet w-full"
                    onClick={() => setShowBackConfirm(false)}
                  >
                    继续编辑
                  </button>
                  <button
                    type="button"
                    className="ui-action w-full"
                    onClick={() => {
                      setShowBackConfirm(false);
                      setProcessedSubs(null);
                      setWorkflowStep(1);
                    }}
                  >
                    返回导入
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
  );
};
