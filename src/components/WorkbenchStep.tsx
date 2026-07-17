'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { AlignmentDiffPanel } from '@/components/Workbench/AlignmentDiffPanel';
import { SourceMatchPanel } from '@/components/Workbench/SourceMatchPanel';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { ChevronDown, ChevronLeft, GitCompareArrows, MonitorCheck, SlidersHorizontal } from 'lucide-react';
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
    setIsSettingsOpen
  } = useStudioStore();

  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [sourceDurationMs, setSourceDurationMs] = useState<number | undefined>(undefined);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const alignmentSummary = useMemo(
    () => processedSubs ? analyzeAlignmentDiff(processedSubs) : null,
    [processedSubs]
  );

  const handleBack = () => {
    if (processedSubs && processedSubs.length > 0) {
      setShowBackConfirm(true);
    } else {
      setWorkflowStep(1);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showBackConfirm) setShowBackConfirm(false);
      else if (isSettingsOpen) setIsSettingsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, setIsSettingsOpen, showBackConfirm]);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--v4-canvas)]">
      {/* Top Navbar */}
      <div className="relative z-[var(--z-raised)] flex flex-shrink-0 flex-col items-center justify-between gap-4 border-b border-[var(--v4-line)] bg-[var(--v4-canvas-raised)] px-6 py-4 md:flex-row md:px-8">
        <div className="flex shrink-0 items-center gap-4 text-left">
          <div>
            <motion.button 
              whileHover={{ scale: 1.03, y: -0.5 }}
              whileTap={{ scale: 0.97 }}
              className="v4-focus-ring flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-accent-strong)] hover:bg-[var(--v4-panel)]"
              onClick={handleBack}
              aria-label="返回导入页"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
          </div>
          
          <div className="min-w-0 max-w-[720px]">
            <h2 className="pl-0.5 text-xl font-semibold tracking-tight text-[var(--v4-text)]">字幕工作台</h2>
            <p className="mt-0.5 whitespace-normal break-words pl-0.5 text-sm leading-relaxed text-[var(--v4-text-muted)]" title={customFilename}>
              <span className="font-semibold text-[var(--v4-text)]">{processedSubs?.length || 0} 行</span>
              <span className="mx-2 text-[var(--v4-text-faint)]">/</span>
              <span>{customFilename || '未命名字幕'}</span>
            </p>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-wrap items-center justify-end gap-2.5 md:w-auto">
          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className={`v4-focus-ring flex cursor-pointer items-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all
              ${isSettingsOpen ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]'}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="调整字幕样式"
          >
            <SlidersHorizontal className="w-4 h-4 text-[var(--v4-accent-strong)]" />
            字幕样式
          </motion.button>

          <ExportDropdown variant="ghost" />

          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className="v4-focus-ring group flex cursor-pointer items-center gap-2 rounded-md bg-[var(--v4-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--v4-accent-ink)] transition-colors hover:bg-[var(--v4-accent-strong)]"
            onClick={() => setWorkflowStep(3)}
          >
            <MonitorCheck className="w-4 h-4" />
            打开预览
          </motion.button>
        </div>
      </div>

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
                      <span className="mt-0.5 block truncate text-sm text-[var(--v4-text-muted)]">
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
                    className="rounded-md border border-[color:rgba(208,164,111,0.32)] bg-[var(--v4-accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-accent-strong)] hover:bg-[color:rgba(208,164,111,0.22)]"
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
