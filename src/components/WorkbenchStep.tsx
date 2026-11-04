'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { ReviewCard } from '@/components/Workbench/ReviewCard';
import { WorkbenchSourceMeta, WorkbenchTaskIdentity, taskIdentityLabel } from '@/components/Workbench/Act2Identity';
import { OverviewDrawer } from '@/components/Workbench/OverviewDrawer';
import { OutputModeControl } from '@/components/Workbench/OutputModeControl';
import { reviewTaskKey } from '@/core/reviewKey';
import { reviewNoticeMessage, reviewNoticeTitle } from '@/components/Global/ReviewNoticeSync';
import { useWorkflowChrome, WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import { MergeReviewModal } from '@/components/Workbench/MergeReviewModal';
import { motion, AnimatePresence } from 'motion/react';
import { InlineMessageBar } from '@/components/Global/InlineMessageBar';
import { buildMergeReviewQueue, type MergeReviewItem } from '@/utils/timeline/alignmentDiff';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { AlertTriangle } from 'lucide-react';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';
import { computeWorkbenchScore } from '@/core/workbenchScore';
import {
  buildPagerItems,
  buildRailHitsForFocus,
  computeReviewGroupCounts,
  focusedArrayIndexes,
  type ReviewFocusId,
} from '@/core/workbenchReview';
import type { WorkbenchListController } from '@/components/Workbench/workbenchFocus';
import type { LineKind } from '@/utils/subtitleCore';
import { EMPTY_CHECKED_IDS } from '@/lib/emptyCheckedIds';

export const WorkbenchStep: React.FC = () => {
  const {
    processedSubs,
    tasks,
    setWorkflowStep,
    setProcessedSubs,
    selectedTaskId,
    isSettingsOpen,
    setIsSettingsOpen,
    mergeReviewCheckedByTask,
    markMergeReviewChecked,
    setStatusNotice,
    setPreviewIndex,
    setJumpLineVal,
    setShowAllSubs,
    showAllSubs,
    setLineKind,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    tasks: state.tasks,
    setWorkflowStep: state.setWorkflowStep,
    setProcessedSubs: state.setProcessedSubs,
    selectedTaskId: state.selectedTaskId,
    isSettingsOpen: state.isSettingsOpen,
    setIsSettingsOpen: state.setIsSettingsOpen,
    mergeReviewCheckedByTask: state.mergeReviewCheckedByTask,
    markMergeReviewChecked: state.markMergeReviewChecked,
    setStatusNotice: state.setStatusNotice,
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
  // null = dashboard at rest (no dim). A category click is the filter.
  const [focus, setFocus] = useState<ReviewFocusId | null>(null);
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

  /** Pager / side rail keep walking the review queue when no filter is on. Dimming uses `focus` only. */
  const pagerFocus: ReviewFocusId = focus ?? 'review';

  const pagerItems = useMemo(() => {
    if (!processedSubs) return [];
    const onlyUnresolved = pagerFocus === 'review'
      || pagerFocus === 'structure'
      || pagerFocus === 'suspect';
    return buildPagerItems(processedSubs, pagerFocus, reviewQueue ?? undefined, {
      onlyUnresolved,
      checkedIds,
    });
  }, [processedSubs, pagerFocus, reviewQueue, checkedIds]);

  const safePagerIndex = pagerItems.length === 0
    ? 0
    : Math.min(pagerIndex, pagerItems.length - 1);
  const activeItem = pagerItems[safePagerIndex] ?? null;

  const focusedIndexes = useMemo(
    () => (processedSubs && focus ? focusedArrayIndexes(processedSubs, focus, reviewQueue ?? undefined) : null),
    [processedSubs, focus, reviewQueue],
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
    () => buildRailHitsForFocus(processedSubs ?? [], pagerFocus, reviewQueue ?? undefined, checkedIds),
    [processedSubs, pagerFocus, reviewQueue, checkedIds],
  );

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
    setFocus(next);
    setPagerIndex(0);
  }, []);

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
      focus,
      focusedIndexes,
      passedArrayIndexes,
      activeItem,
      checkedReviewIds: checkedSet,
      highlightArrayIndex,
      highlightNonce,
      railHits,
      onClearFocus: () => setFocus(null),
      onMarkReviewed,
      onConfirmCategory,
      onIgnore,
      onJumpToArrayIndex: jumpToArrayIndex,
    };
  }, [
    processedSubs,
    focus,
    focusedIndexes,
    passedArrayIndexes,
    activeItem,
    checkedSet,
    highlightArrayIndex,
    highlightNonce,
    railHits,
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
    const activeTask = tasks.find((task) => task.id === selectedTaskId);
    const reviewOn = focus === 'review';
    const gateLabel = `待核 ${counts.reviewRemaining}`;
    setInfoBar({
      title: taskIdentityLabel(activeTask),
      identity: <WorkbenchTaskIdentity />,
      sourceMeta: <WorkbenchSourceMeta />,
      onBack: () => setWorkflowStep(1),
      display: (
        <>
          <OutputModeControl />
          {counts.reviewRemaining > 0 ? (
            <button
              type="button"
              className={`wb-gate wb-focus-ring${reviewOn ? ' is-on wb-sel' : ''}`}
              data-testid="wb-gate"
              data-layer={reviewOn ? 'd' : 'a'}
              title={reviewOn
                ? `正在只看待复核。已核对 ${counts.reviewChecked} / ${counts.reviewTotal}`
                : `还有 ${counts.reviewRemaining} 项待复核。点击只看这些行。已核对 ${counts.reviewChecked} / ${counts.reviewTotal}`}
              aria-pressed={reviewOn}
              aria-label={reviewOn ? `${gateLabel}，筛选已打开` : gateLabel}
              onClick={() => handleFocusChange(reviewOn ? null : 'review')}
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {gateLabel}
            </button>
          ) : null}
        </>
      ),
      actions: <WorkflowContinueInFlow />,
    });
    return () => setInfoBar(null);
  }, [
    tasks,
    selectedTaskId,
    setInfoBar,
    setWorkflowStep,
    counts.reviewRemaining,
    counts.reviewChecked,
    counts.reviewTotal,
    focus,
    handleFocusChange,
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
            <InlineMessageBar />
            {processedSubs && processedSubs.length > 0 && (
              <ReviewCard
                score={score}
                counts={counts}
                focus={focus}
                emptyFocus={Boolean(focus && focusedIndexes && focusedIndexes.size === 0)}
                onFocusChange={handleFocusChange}
                pagerItems={pagerItems}
                pagerIndex={safePagerIndex}
                onPagerChange={jumpToPagerIndex}
                onOpenOverview={() => setOverviewOpen(true)}
              />
            )}
            <div className="flex min-h-[50vh] flex-1 flex-col overflow-hidden">
              <SequenceList
                key={selectedTaskId || 'workbench'}
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
              className="ui-modal-layer fixed inset-0 grid place-items-center bg-[var(--pt-scrim)] p-4"
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
