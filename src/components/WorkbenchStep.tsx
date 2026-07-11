'use client';

import React, { useEffect, useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { AlignmentDiffPanel } from '@/components/Workbench/AlignmentDiffPanel';
import { SourceMatchPanel } from '@/components/Workbench/SourceMatchPanel';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { ChevronLeft, MonitorCheck, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const WorkbenchStep: React.FC = () => {
  const { 
    processedSubs, 
    customFilename, 
    setWorkflowStep,
    setProcessedSubs,
    isSettingsOpen,
    setIsSettingsOpen
  } = useStudioStore();

  const [showBackConfirm, setShowBackConfirm] = useState(false);

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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#050507]">
      {/* Top Navbar */}
      <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-8 py-5 border-b border-white/[0.07] bg-[#020203]/72 backdrop-blur-md gap-4 z-[70] flex-shrink-0">
        <div className="flex items-center gap-4 text-left shrink-0">
          <div>
            {/* Bounce back button */}
            <motion.button 
              whileHover={{ scale: 1.03, y: -0.5 }}
              whileTap={{ scale: 0.97 }}
              className="p-2 glass-btn-ar rounded-lg flex items-center justify-center cursor-pointer text-[#9ddacb] hover:text-[#c3eee3]"
              onClick={handleBack}
              aria-label="返回字幕配对"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

          </div>
          
          <div className="min-w-0 max-w-[720px]">
            <h2 className="text-xl font-semibold text-neutral-100 tracking-tight pl-0.5">字幕工作台</h2>
            <p className="text-sm text-neutral-400 mt-0.5 whitespace-normal break-words leading-relaxed pl-0.5" title={customFilename}>
              <span className="text-neutral-100 font-semibold">{processedSubs?.length || 0} 行</span>
              <span className="mx-2 text-white/18">/</span>
              <span>{customFilename || '未命名字幕'}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 w-full md:w-auto flex items-center justify-end gap-2.5 flex-wrap">
          {/* Style sidebar toggle */}
          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer
              ${isSettingsOpen ? 'glass-btn-ar-active' : 'glass-btn-ar text-neutral-350 hover:text-white'}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="样式配置选项"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#9ddacb]" />
            样式参数
          </motion.button>

          {/* Shared export dropdown */}
          <ExportDropdown variant="ghost" />

          {/* Preview scene button with Arrow bounce guide */}
          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className="group py-2.5 px-5 rounded-xl bg-white text-black text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer border border-white/20 hover:bg-neutral-200 hover:scale-[1.01] shadow-[0_10px_26px_rgba(255,255,255,0.08)]"
            onClick={() => setWorkflowStep(3)}
          >
            <MonitorCheck className="w-3.5 h-3.5 text-[#267c6e]" />
            下一步：放映厅预览
          </motion.button>
        </div>
      </div>

      {/* Main Split stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Center Panel: Subtitle sequence list */}
        <div className="flex-1 p-4 md:p-6 min-h-0 min-w-0 overflow-hidden flex flex-col items-center z-10">
          <div className="max-w-6xl w-full flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {processedSubs && processedSubs.length > 0 && (
              <SourceMatchPanel rows={processedSubs} />
            )}
            {processedSubs && processedSubs.length > 0 && (
              <AlignmentDiffPanel rows={processedSubs} />
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white/[0.012] border border-white/[0.075] rounded-xl">
              <SequenceList />
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
                className="absolute inset-y-4 right-4 z-50 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl glass-panel-ar lg:relative lg:inset-auto lg:z-20 lg:my-6 lg:mr-6 lg:w-[390px] lg:shrink-0"
              >
                <StyleSidebar />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showBackConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
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
              className="w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#0b0b0d] p-5 shadow-2xl"
            >
              <h3 id="workbench-back-title" className="text-lg font-semibold text-white">返回字幕配对</h3>
              <p id="workbench-back-description" className="mt-2 text-sm leading-6 text-neutral-400">
                已导入文件和轨道选择会保留；再次进入工作台时将重新生成当前预览结果。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/[0.07] hover:text-white" onClick={() => setShowBackConfirm(false)}>
                  继续编辑
                </button>
                <button type="button" className="rounded-xl border border-[#9ddacb]/25 bg-[#9ddacb]/10 px-4 py-2.5 text-sm font-semibold text-[#d6f2eb] hover:bg-[#9ddacb]/16" onClick={() => { setShowBackConfirm(false); setProcessedSubs(null); setWorkflowStep(1); }}>
                  返回配对
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
