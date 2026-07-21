'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { AlignmentDiffPanel } from '@/components/Workbench/AlignmentDiffPanel';
import { SourceMatchPanel } from '@/components/Workbench/SourceMatchPanel';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { useWorkflowChrome } from '@/components/Global/WorkflowChrome';
import { ChevronDown, GitCompareArrows, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeAlignmentDiff } from '@/utils/timeline/alignmentDiff';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

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
  const [sourceDurationMs, setSourceDurationMs] = useState<number | undefined>(undefined);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const alignmentSummary = useMemo(
    () => processedSubs ? analyzeAlignmentDiff(processedSubs) : null,
    [processedSubs]
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showBackConfirm) setShowBackConfirm(false);
      else if (isSettingsOpen) setIsSettingsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, setIsSettingsOpen, showBackConfirm]);

  useEffect(() => {
    setInfoBar({
      title: '字幕工作台',
      subtitle: `${processedSubs?.length || 0} 行 / ${customFilename || '未命名字幕'}`,
      status: tmdbData
        ? { label: '已匹配', tone: 'ok' }
        : { label: '未匹配', tone: 'muted' },
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
            className={`v4-focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-semibold transition-all
              ${isSettingsOpen ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]'}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="调整字幕样式"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--v4-accent-strong)]" />
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
      disabledReason: '还没有可预览的字幕时间轴，请先完成合轴。',
      onClick: () => setWorkflowStep(3),
    });
    return () => setEdgeNext(null);
  }, [processedSubs, setEdgeNext, setWorkflowStep]);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--v4-canvas)]">
      {/* Main Split stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Center Panel: Subtitle sequence list */}
        <div className="flex-1 p-4 md:p-6 min-h-0 min-w-0 overflow-hidden flex flex-col items-center z-10">
          <div className="max-w-[1480px] w-full flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            {processedSubs && processedSubs.length > 0 && (
              <section className="flex-shrink-0 overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)]">
                <button
                  type="button"
                  className="v4-focus-ring flex w-full items-center justify-between gap-4 px-4 py-3 text-left md:px-5"
                  onClick={() => setIsInspectionOpen(value => !value)}
                  aria-expanded={isInspectionOpen}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <GitCompareArrows className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--v4-text)]">字幕检查</span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-[var(--v4-text-muted)]">
                        {alignmentSummary && alignmentSummary.entries.length > 0
                          ? `${alignmentSummary.entries.length} 处结构差异待复核`
                          : '未发现需要复核的结构差异'}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--v4-text-muted)]">
                    {isInspectionOpen ? '收起报告' : '查看报告'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isInspectionOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
                <div hidden={!isInspectionOpen} className="space-y-3 border-t border-[var(--v4-line)] p-3 md:p-4">
                  <SourceMatchPanel
                    rows={processedSubs}
                    onTimelineDurationChange={setSourceDurationMs}
                  />
                  <AlignmentDiffPanel rows={processedSubs} />
                </div>
              </section>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <SequenceList key={selectedTaskId || customFilename} timelineDurationMs={sourceDurationMs} />
            </div>
          </div>
        </div>

        {/* Floating Style Drawer */}
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
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="v4-panel absolute inset-y-4 right-4 z-50 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg lg:relative lg:inset-auto lg:z-20 lg:my-6 lg:mr-6 lg:w-[390px] lg:shrink-0"
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
              onClick={(event) => { if (event.target === event.currentTarget) setShowBackConfirm(false); }}
            >
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="workbench-back-title"
                aria-describedby="workbench-back-description"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="w-full max-w-sm rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
              >
                <h3 id="workbench-back-title" className="text-lg font-semibold text-[var(--v4-text)]">返回导入页？</h3>
                <p id="workbench-back-description" className="mt-2 text-sm leading-6 text-[var(--v4-text-muted)]">
                  已导入的文件与轨道选择会保留。再次进入工作台时，将按当前选择重新生成预览。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]"
                    onClick={() => setShowBackConfirm(false)}
                  >
                    留在工作台
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[color:rgba(239,141,95,0.32)] bg-[var(--v4-accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-accent-strong)] hover:bg-[color:rgba(239,141,95,0.22)]"
                    onClick={() => { setShowBackConfirm(false); setProcessedSubs(null); setWorkflowStep(1); }}
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
