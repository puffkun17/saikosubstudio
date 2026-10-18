'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { EpisodeTabs } from '@/components/Workbench/EpisodeTabs';
import { ReviewCard } from '@/components/Workbench/ReviewCard';
import { OverviewDrawer } from '@/components/Workbench/OverviewDrawer';
import { OutputModeControl } from '@/components/Workbench/OutputModeControl';
import { taskDisplayTitle } from '@/store/useStudioStore';
import { reviewTaskKey } from '@/core/reviewKey';
import { reviewNoticeMessage, reviewNoticeTitle } from '@/components/Global/ReviewNoticeSync';
import { useWorkflowChrome, WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import { MergeReviewModal } from '@/components/Workbench/MergeReviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { buildMergeReviewQueue, type MergeReviewItem } from '@/utils/timeline/alignmentDiff';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';
import { computeWorkbenchScore } from '@/core/workbenchScore';
import {
  REVIEW_FOCUS_LABEL,
  buildPagerItems,
  buildRailHitsForFocus,
  computeReviewGroupCounts,
  focusedArrayIndexes,
  type ReviewFocusId,
} from '@/core/workbenchReview';
import { lineCountLabel } from '@/core/lineKinds';
import type { WorkbenchListController } from '@/components/Workbench/workbenchFocus';
import type { LineKind } from '@/utils/subtitleCore';
import { EMPTY_CHECKED_IDS } from '@/lib/emptyCheckedIds';

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
    markMergeReviewChecked,
    setStatusNotice,
    filenameEpKey,
    activeTaskTitle,
    auxMode,
    setPreviewIndex,
    setJumpLineVal,
    setShowAllSubs,
    showAllSubs,
    setLineKind,
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
    markMergeReviewChecked: state.markMergeReviewChecked,
    setStatusNotice: state.setStatusNotice,
    filenameEpKey: state.filenameEpKey,
    auxMode: state.customStyle.auxiliaryMode || 'keep',
    activeTaskTitle: state.tasks.find((t) => t.id === state.selectedTaskId)?.title ?? '',
    setPreviewIndex: state.setPreviewIndex,
    setJumpLineVal: state.setJumpLineVal,
    setShowAllSubs: state.setShowAllSubs,
    showAllSubs: state.showAllSubs,
    setLineKind: state.setLineKind,
  })));
  const { setInfoBar, setForwardAction } = useWorkflowChrome();

  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const backModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(showBackConfirm, backModalRef, () => setShowBackConfirm(false));
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewFocusNonce, setReviewFocusNonce] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const openLegacyReviewModal = useCallback(() => {
    setIsReviewModalOpen(true);
    setReviewFocusNonce((v) => v + 1);
  }, []);
  const [focus, setFocus] = useState<ReviewFocusId | null>('review');
  const [pagerIndex, setPagerIndex] = useState(0);
  const [highlightArrayIndex, setHighlightArrayIndex] = useState<number | null>(null);
  const [highlightNonce, setHighlightNonce] = useState(0);

  const reviewQueue = useMemo(
    () => (processedSubs ? buildMergeReviewQueue(processedSubs) : null),
    [processedSubs],
  );
  const reviewKey = reviewTaskKey(selectedTaskId, processedSubs);
  const checkedIds = mergeReviewCheckedByTask[reviewKey] ?? EMPTY_CHECKED_IDS;
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  let sourceDurationMs: number | undefined;
  if (processedSubs?.length) {
    const last = processedSubs[processedSubs.length - 1];
    const endMatch = last?.ts?.match(/-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d+)/);
    if (endMatch) {
      sourceDurationMs = (
        Number(endMatch[1]) * 3600
        + Number(endMatch[2]) * 60
        + Number(endMatch[3])
      ) * 1000 + Number(endMatch[4].padEnd(3, '0').slice(0, 3));
    }
  }

  const counts = useMemo(
    () => computeReviewGroupCounts(processedSubs ?? [], checkedIds, reviewQueue ?? undefined),
    [processedSubs, checkedIds, reviewQueue],
  );

  const score = useMemo(
    () => computeWorkbenchScore({
      rows: processedSubs ?? [],
      checkedIds,
      videoDurationMs: sourceDurationMs,
    }),
    [processedSubs, checkedIds, sourceDurationMs],
  );

  const effectiveFocus: ReviewFocusId = focus ?? 'review';

  const pagerItems = useMemo(() => {
    if (!processedSubs) return [];
    const onlyUnresolved = effectiveFocus === 'review'
      || effectiveFocus === 'structure'
      || effectiveFocus === 'suspect';
    return buildPagerItems(processedSubs, effectiveFocus, reviewQueue ?? undefined, {
      onlyUnresolved,
      checkedIds,
    });
  }, [processedSubs, effectiveFocus, reviewQueue, checkedIds]);

  const safePagerIndex = pagerItems.length === 0
    ? 0
    : Math.min(pagerIndex, pagerItems.length - 1);
  const activeItem = pagerItems[safePagerIndex] ?? null;

  const focusedIndexes = useMemo(
    () => (processedSubs ? focusedArrayIndexes(processedSubs, effectiveFocus, reviewQueue ?? undefined) : null),
    [processedSubs, effectiveFocus, reviewQueue],
  );

  const passedArrayIndexes = useMemo(() => {
    const set = new Set<number>();
    if (!processedSubs || !reviewQueue) return set;
    for (const item of reviewQueue.items) {
      if (!checkedSet.has(item.id)) continue;
      for (const line of item.rowIndexes) {
        const idx = processedSubs.findIndex((r) => r.index === line);
        if (idx >= 0) set.add(idx);
      }
    }
    return set;
  }, [processedSubs, reviewQueue, checkedSet]);

  const railHits = useMemo(
    () => buildRailHitsForFocus(processedSubs ?? [], effectiveFocus, reviewQueue ?? undefined, checkedIds),
    [processedSubs, effectiveFocus, reviewQueue, checkedIds],
  );

  const filterStatus = useMemo(() => {
    if (!processedSubs) return null;
    const label = REVIEW_FOCUS_LABEL[effectiveFocus];
    const shown = focusedIndexes?.size ?? processedSubs.length;
    if (effectiveFocus === 'review') {
      return `显示 ${counts.reviewRemaining} / ${processedSubs.length} · 待复核`;
    }
    return `显示 ${shown} / ${processedSubs.length} · ${label}`;
  }, [processedSubs, effectiveFocus, focusedIndexes, counts.reviewRemaining]);

  const jumpToArrayIndex = useCallback((arrayIndex: number) => {
    if (!processedSubs || arrayIndex < 0 || arrayIndex >= processedSubs.length) return;
    if (arrayIndex >= 100 && !showAllSubs) setShowAllSubs(true);
    setPreviewIndex(arrayIndex);
    setJumpLineVal(String(processedSubs[arrayIndex].index));
    setHighlightArrayIndex(arrayIndex);
    setHighlightNonce((n) => n + 1);
  }, [processedSubs, showAllSubs, setShowAllSubs, setPreviewIndex, setJumpLineVal]);

  const jumpToPagerIndex = useCallback((next: number) => {
    setPagerIndex(next);
    const item = pagerItems[next];
    if (item) jumpToArrayIndex(item.arrayIndex);
  }, [pagerItems, jumpToArrayIndex]);

  const handleFocusChange = useCallback((next: ReviewFocusId | null) => {
    setFocus(next ?? 'review');
    setPagerIndex(0);
  }, []);

  // When focus changes, jump to first item of the new set
  useEffect(() => {
    if (!pagerItems.length) return;
    const item = pagerItems[0];
    if (item) {
      // Don't auto-scroll on every checked-id change — only when focus identity changes
    }
  }, [effectiveFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceAfterResolve = useCallback((resolvedId: string) => {
    const remaining = pagerItems.filter((item) => item.id !== resolvedId);
    if (remaining.length === 0) {
      setPagerIndex(0);
      return;
    }
    const nextIndex = Math.min(pagerIndex, remaining.length - 1);
    setPagerIndex(nextIndex);
    // Jump after state settles: use remaining list directly
    const next = remaining[nextIndex];
    if (next) {
      window.setTimeout(() => jumpToArrayIndex(next.arrayIndex), 40);
    }
  }, [pagerItems, pagerIndex, jumpToArrayIndex]);

  const onMarkReviewed = useCallback((itemId: string) => {
    markMergeReviewChecked(reviewKey, itemId);
    advanceAfterResolve(itemId);
  }, [markMergeReviewChecked, reviewKey, advanceAfterResolve]);

  const onIgnore = useCallback((itemId: string) => {
    markMergeReviewChecked(reviewKey, itemId);
    advanceAfterResolve(itemId);
  }, [markMergeReviewChecked, reviewKey, advanceAfterResolve]);

  const onConfirmCategory = useCallback((item: MergeReviewItem, kind: Exclude<LineKind, 'credit'>) => {
    const line = item.rowIndexes[0];
    if (line != null) setLineKind(line, kind);
    markMergeReviewChecked(reviewKey, item.id);
    advanceAfterResolve(item.id);
  }, [setLineKind, markMergeReviewChecked, reviewKey, advanceAfterResolve]);

  const listController: WorkbenchListController | null = useMemo(() => {
    if (!processedSubs?.length) return null;
    return {
      focus: effectiveFocus,
      focusedIndexes,
      passedArrayIndexes,
      activeItem: (effectiveFocus === 'review' || effectiveFocus === 'structure' || effectiveFocus === 'suspect')
        ? activeItem
        : activeItem,
      checkedReviewIds: checkedSet,
      highlightArrayIndex,
      highlightNonce,
      railHits,
      filterStatus,
      onClearFocus: () => setFocus('review'),
      onMarkReviewed,
      onConfirmCategory,
      onIgnore,
      onJumpToArrayIndex: jumpToArrayIndex,
    };
  }, [
    processedSubs,
    effectiveFocus,
    focusedIndexes,
    passedArrayIndexes,
    activeItem,
    checkedSet,
    highlightArrayIndex,
    highlightNonce,
    railHits,
    filterStatus,
    onMarkReviewed,
    onConfirmCategory,
    onIgnore,
    jumpToArrayIndex,
  ]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showBackConfirm || isReviewModalOpen || overviewOpen) {
        if (overviewOpen) setOverviewOpen(false);
        return;
      }
      if (isSettingsOpen) setIsSettingsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isReviewModalOpen, isSettingsOpen, setIsSettingsOpen, showBackConfirm, overviewOpen]);

  useEffect(() => {
    setInfoBar({
      title: tmdbData?.title || customFilename || '字幕调校',
      year: tmdbData?.year || undefined,
      localChips: [
        lineCountLabel(processedSubs, auxMode),
        taskDisplayTitle(tmdbData, filenameEpKey) || activeTaskTitle || '未命名字幕',
        tmdbData ? undefined : '未匹配',
      ].filter((item): item is string => Boolean(item)),
      onBack: () => setWorkflowStep(1),
      actions: (
        <>
          <OutputModeControl />
          {counts.reviewRemaining > 0 ? (
            <span className="wb-gate" title="软提示：不阻断打开预览">
              ⚠ 还有 {counts.reviewRemaining} 项待复核
            </span>
          ) : null}
          <WorkflowContinueInFlow />
        </>
      ),
    });
    return () => setInfoBar(null);
  }, [
    processedSubs,
    auxMode,
    customFilename,
    filenameEpKey,
    activeTaskTitle,
    isSettingsOpen,
    tmdbData,
    setInfoBar,
    setIsSettingsOpen,
    setWorkflowStep,
    counts.reviewRemaining,
  ]);

  useEffect(() => {
    const hasTimeline = Boolean(processedSubs && processedSubs.length > 0);
    setForwardAction({
      label: '打开预览',
      disabled: !hasTimeline,
      ready: hasTimeline,
      disabledReason: '还没有可预览的字幕时间轴，请先完成合轴或分配。',
      onClick: () => {
        if (counts.reviewRemaining > 0) {
          setStatusNotice({
            id: 'merge-review-unchecked',
            tone: 'notice',
            title: reviewNoticeTitle(counts.reviewRemaining),
            message: reviewNoticeMessage(counts.reviewChecked, counts.reviewTotal),
          });
        }
        setWorkflowStep(3);
      },
    });
    return () => setForwardAction(null);
  }, [processedSubs, counts.reviewRemaining, counts.reviewChecked, counts.reviewTotal, setForwardAction, setStatusNotice, setWorkflowStep]);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--v4-canvas)]">
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 p-[var(--ds-gap-group)] min-h-0 min-w-0 overflow-hidden flex flex-col items-center z-10">
          <div className="max-w-[1280px] w-full flex-1 min-h-0 flex flex-col gap-[var(--ds-gap-group)] overflow-hidden">
            <EpisodeTabs />
            {processedSubs && processedSubs.length > 0 && (
              <ReviewCard
                score={score}
                counts={counts}
                focus={effectiveFocus}
                onFocusChange={handleFocusChange}
                pagerItems={pagerItems}
                pagerIndex={safePagerIndex}
                onPagerChange={jumpToPagerIndex}
                onOpenOverview={() => setOverviewOpen(true)}
              />
            )}
            <div className="flex min-h-[50vh] flex-1 flex-col overflow-hidden">
              <SequenceList
                key={selectedTaskId || customFilename}
                timelineDurationMs={sourceDurationMs}
                listController={listController}
              />
            </div>
          </div>
        </div>

        {processedSubs && (
          <OverviewDrawer
            open={overviewOpen}
            onClose={() => setOverviewOpen(false)}
            rows={processedSubs}
            score={score}
            videoDurationMs={sourceDurationMs}
            onOpenLegacyReview={openLegacyReviewModal}
          />
        )}
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
