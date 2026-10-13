'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { EpisodeTabs } from '@/components/Workbench/EpisodeTabs';
import { SourceMatchPanel, type InspectionMarkFilter } from '@/components/Workbench/SourceMatchPanel';
import { InspectionMarkGlyph, MARK_FILTERS, MARK_LABEL } from '@/components/Workbench/inspectionMarks';
import { AuxiliaryPolicy } from '@/components/Workbench/AuxiliaryPolicy';
import { CreditPanel } from '@/components/Workbench/CreditPanel';
import { countLineKinds, lineCountLabel } from '@/core/lineKinds';
import { taskDisplayTitle } from '@/store/useStudioStore';
import { reviewTaskKey } from '@/core/reviewKey';
import { reviewNoticeMessage, reviewNoticeTitle } from '@/components/Global/ReviewNoticeSync';
import { useWorkflowChrome, WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';

import { MergeReviewModal } from '@/components/Workbench/MergeReviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeAlignmentDiff, buildMergeReviewQueue } from '@/utils/timeline/alignmentDiff';
import { createSourceMatchReport } from '@/utils/timeline/sourceMatch';
import { formatMsClock } from '@/utils/timeline/timecode';
import { AnimatedCounter } from '@/components/ui/animated-counter';
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
    mergeReviewCheckedByTask,
    setStatusNotice,
    filenameEpKey,
    activeTaskTitle,
    auxMode,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customFilename: state.customFilename,
    setWorkflowStep: state.setWorkflowStep,
    setProcessedSubs: state.setProcessedSubs,
    selectedTaskId: state.selectedTaskId,
    isSettingsOpen: state.isSettingsOpen,
    setIsSettingsOpen: state.setIsSettingsOpen,
    tmdbData: state.tmdbData,
    mergeReviewCheckedByTask: state.mergeReviewCheckedByTask,
    setStatusNotice: state.setStatusNotice,
    filenameEpKey: state.filenameEpKey,
    auxMode: state.customStyle.auxiliaryMode || 'keep',
    activeTaskTitle: state.tasks.find((t) => t.id === state.selectedTaskId)?.title ?? '',
  })));
  const { setInfoBar, setForwardAction } = useWorkflowChrome();

  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const backModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(showBackConfirm, backModalRef, () => setShowBackConfirm(false));
  const [sourceDurationMs, setSourceDurationMs] = useState<number | undefined>(undefined);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewFocusNonce, setReviewFocusNonce] = useState(0);

  const openReviewModal = () => {
    setIsReviewModalOpen(true);
    setReviewFocusNonce(value => value + 1);
  };
  const [markFilter, setMarkFilter] = useState<InspectionMarkFilter>('all');

  const alignmentSummary = useMemo(
    () => (processedSubs ? analyzeAlignmentDiff(processedSubs) : null),
    [processedSubs],
  );
  const reviewQueue = useMemo(
    () => (processedSubs ? buildMergeReviewQueue(processedSubs) : null),
    [processedSubs],
  );
  const profileStats = useMemo(
    () => (processedSubs ? createSourceMatchReport(processedSubs, sourceDurationMs).stats : null),
    [processedSubs, sourceDurationMs],
  );
  const structureCount = alignmentSummary?.entries.length ?? 0;
  const reviewTotal = reviewQueue?.total ?? 0;
  const reviewKey = reviewTaskKey(selectedTaskId, processedSubs);
  const reviewCheckedCount = useMemo(() => {
    if (!reviewQueue) return 0;
    const checked = new Set(mergeReviewCheckedByTask[reviewKey] ?? []);
    return reviewQueue.items.reduce((count, item) => count + (checked.has(item.id) ? 1 : 0), 0);
  }, [reviewQueue, mergeReviewCheckedByTask, reviewKey]);
  const reviewRemaining = Math.max(0, reviewTotal - reviewCheckedCount);
  // 所有特殊行计数共用 core/lineKinds：合并后、应用辅助策略之前的行，各类互斥。
  const lineKinds = useMemo(() => countLineKinds(processedSubs ?? []), [processedSubs]);
  const screenCount = lineKinds.screen;
  const lyricsCount = lineKinds.lyrics;
  const creditCount = lineKinds.credit;
  const soundCount = lineKinds.sound;
  const narrationCount = lineKinds.narration;
  const markCount = (kind: string) => (kind === 'screen' ? screenCount : kind === 'sound' ? soundCount : kind === 'lyrics' ? lyricsCount : kind === 'credit' ? creditCount : 1);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showBackConfirm || isReviewModalOpen) return;
      if (isSettingsOpen) setIsSettingsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isReviewModalOpen, isSettingsOpen, setIsSettingsOpen, showBackConfirm]);

  useEffect(() => {
    setInfoBar({
      title: tmdbData?.title || customFilename || '字幕调校',
      year: tmdbData?.year || undefined,
      localChips: [
        lineCountLabel(processedSubs, auxMode),
        taskDisplayTitle(tmdbData, filenameEpKey) || activeTaskTitle || '未命名字幕',
        tmdbData ? undefined : '未匹配',
      ].filter((item): item is string => Boolean(item)),
      // 返回导入只切换页面：保留合轴结果与导入设置（含「原创」），重新「开始合轴」才会覆盖。
      onBack: () => setWorkflowStep(1),
      actions: (
        <>
          {/* Spec §4: one primary per screen — export lives in Act 3 (preview == export). */}
          <WorkflowContinueInFlow />
        </>
      ),
    });
    return () => setInfoBar(null);
  }, [processedSubs, auxMode, customFilename, filenameEpKey, activeTaskTitle, isSettingsOpen, tmdbData, setInfoBar, setIsSettingsOpen, setWorkflowStep]);

  useEffect(() => {
    const hasTimeline = Boolean(processedSubs && processedSubs.length > 0);
    setForwardAction({
      label: '打开预览',
      disabled: !hasTimeline,
      ready: hasTimeline,
      disabledReason: '还没有可预览的字幕时间轴，请先完成合轴或分配。',
      onClick: () => {
        if (reviewRemaining > 0) {
          setStatusNotice({
            id: 'merge-review-unchecked',
            tone: 'notice',
            title: reviewNoticeTitle(reviewRemaining),
            message: reviewNoticeMessage(reviewCheckedCount, reviewTotal),
          });
        }
        setWorkflowStep(3);
      },
    });
    return () => setForwardAction(null);
  }, [processedSubs, reviewRemaining, reviewCheckedCount, reviewTotal, setForwardAction, setStatusNotice, setWorkflowStep]);

  const isSingleLanguage = Boolean(processedSubs && processedSubs.length > 0 && !processedSubs.some((row) => /\n|\\N/.test(row.text)));

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--v4-canvas)]">
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 p-[var(--ds-gap-group)] min-h-0 min-w-0 overflow-hidden flex flex-col items-center z-10">
          <div className="max-w-[1280px] w-full flex-1 min-h-0 flex flex-col gap-[var(--ds-gap-group)] overflow-hidden">
            <EpisodeTabs />
            {processedSubs && processedSubs.length > 0 && (
              <section className="v4-panel flex-shrink-0 overflow-hidden">
                <div className="workbench-overview flex flex-col gap-[var(--ds-gap-item)] p-[var(--ds-pad-card)] md:flex-row md:items-center md:justify-between md:gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2">
                                            <h2 className="ds-label">概览</h2>
                      {isSingleLanguage && <span className="ds-meta" title="只有一种语言，按单语整理（R-10）">单语</span>}
                      {reviewTotal > 0 && reviewRemaining > 0 ? (
                        <button
                          type="button"
                          className="workbench-review-action v4-focus-ring"
                          title={`合轴待复核剩余 ${reviewRemaining} 项（已核对 ${reviewCheckedCount}/${reviewTotal}：覆盖 / 对话 / 单轨 / 平移 / 存疑）· 点击打开明细`}
                          aria-label={`待复核 ${reviewRemaining} 项，点击打开明细`}
                          aria-haspopup="dialog"
                          aria-expanded={isReviewModalOpen}
                          onClick={openReviewModal}
                        >
                          <span className="workbench-review-action__label">待复核</span>
                          <AnimatedCounter
                            value={reviewRemaining}
                            separator=""
                            className="workbench-review-action__count"
                          />
                          <span className="workbench-review-action__unit">项需关注</span>
                        </button>
                      ) : reviewTotal > 0 ? (
                        <button
                          type="button"
                          className="workbench-review-action workbench-review-action--done v4-focus-ring"
                          title={`合轴待复核已全部核对 ${reviewCheckedCount}/${reviewTotal} · 点击打开明细`}
                          aria-label={`已核对 ${reviewCheckedCount}/${reviewTotal}，点击打开明细`}
                          aria-haspopup="dialog"
                          aria-expanded={isReviewModalOpen}
                          onClick={openReviewModal}
                        >
                          已核对 {reviewCheckedCount}/{reviewTotal}
                        </button>
                      ) : structureCount > 0 ? (
                        <span
                          className="inline-flex min-w-6 items-center justify-center rounded-md bg-[var(--v4-warning)]/12 px-1.5 py-0.5 text-sm font-semibold tabular-nums text-[var(--v4-warning)]"
                          title={`${structureCount} 处结构差异`}
                        >
                          <AnimatedCounter value={structureCount} separator="" className="text-sm font-semibold text-[var(--v4-warning)]" />
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--v4-text-faint)]">无待复核项</span>
                      )}
                    </div>

                    {profileStats && (
                      <div className="hidden flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--v4-text-muted)] sm:flex">
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
                          每分钟
                          <strong className="font-semibold tabular-nums text-[var(--v4-text)]">
                            {profileStats.densityPerMinute}
                          </strong>
                          行
                        </span>
                        {lineKinds.auxiliary > 0 && (
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
                              {narrationCount > 0 && (
                                <span className="inline-flex items-center gap-1">旁白 {narrationCount}</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    <div className="ui-choice-group max-md:w-full max-md:flex-nowrap max-md:overflow-x-auto" role="tablist" aria-label="时间轴标记筛选">
                      {MARK_FILTERS.filter(item => !item.kind || item.kind === 'structure' || markCount(item.kind) > 0).map(item => (
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
                  </div>
                </div>

                <div className="border-t border-[var(--v4-line)]">
                  <AuxiliaryPolicy />
                </div>

                <div className="border-t border-[var(--v4-line)] empty:hidden">
                  <CreditPanel />
                </div>

                <div className="border-t border-[var(--v4-line)]">
                  <SourceMatchPanel
                    rows={processedSubs}
                    onTimelineDurationChange={setSourceDurationMs}
                    markFilter={markFilter}
                  />
                </div>
              </section>
            )}
            <div className="flex min-h-[50vh] flex-1 flex-col overflow-hidden">
              <SequenceList key={selectedTaskId || customFilename} timelineDurationMs={sourceDurationMs} />
            </div>
          </div>
        </div>


      </div>

      <MergeReviewModal
        open={Boolean(isReviewModalOpen && processedSubs)}
        rows={processedSubs ?? []}
        focusNonce={reviewFocusNonce}
        onClose={() => setIsReviewModalOpen(false)}
      />

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
