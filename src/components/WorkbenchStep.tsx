'use client';

import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { ChevronLeft, Eye, Sliders } from 'lucide-react';
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

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#050507]">
      {/* Top Navbar */}
      <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-white/[0.055] bg-[#030305]/58 backdrop-blur-md gap-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-4 text-left shrink-0">
          <div className="relative">
            {/* Bounce back button */}
            <motion.button 
              whileHover={{ scale: 1.03, y: -0.5 }}
              whileTap={{ scale: 0.97 }}
              className="p-2 glass-btn-ar rounded-lg flex items-center justify-center cursor-pointer text-neutral-400 hover:text-neutral-200"
              onClick={handleBack}
              title="返回上传配对页面"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            {/* Inline back confirm dialog */}
            <AnimatePresence>
              {showBackConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute top-full left-0 mt-2 z-50 glass-panel-ar rounded-xl p-4 w-64 shadow-2xl"
                >
                  <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                    返回将<span className="text-rose-400 font-bold"> 清除当前对齐数据</span>，确认？
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold glass-btn-ar rounded cursor-pointer"
                      onClick={() => setShowBackConfirm(false)}
                    >
                      取消
                    </button>
                    <button
                      className="flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold bg-rose-500/80 hover:bg-rose-500 text-white rounded cursor-pointer transition-colors duration-200"
                      onClick={() => { setShowBackConfirm(false); setProcessedSubs(null); setWorkflowStep(1); }}
                    >
                      确认返回
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-200 tracking-wide pl-0.5">字幕工作台</h2>
            <p className="text-xs text-[#d8c39a] mt-0.5 max-w-[620px] whitespace-normal break-words leading-relaxed pl-0.5" title={customFilename}>
              {processedSubs?.length || 0} 行已准备 · {customFilename || '未命名字幕'}
            </p>
          </div>
        </div>

        {/* Timeline Slider and controls in header */}
        <div className="flex-1 w-full md:w-auto flex items-center justify-end gap-3.5 flex-wrap">
          <div className="flex-1 min-w-[360px] max-w-4xl">
            <TimelineControls />
          </div>

          {/* Style sidebar toggle */}
          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className={`py-2 px-3.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer
              ${isSettingsOpen ? 'glass-btn-ar-active' : 'glass-btn-ar text-neutral-350 hover:text-white'}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="样式配置选项"
          >
            <Sliders className="w-3.5 h-3.5" />
            样式参数
          </motion.button>

          {/* Shared export dropdown */}
          <ExportDropdown variant="ghost" />

          <div className="w-[1px] h-4 bg-white/[0.08] hidden md:block" />

          {/* Preview scene button with Arrow bounce guide */}
          <motion.button 
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            className="group py-2 px-3.5 glass-btn-ar text-sm font-bold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            onClick={() => setWorkflowStep(3)}
          >
            <Eye className="w-3.5 h-3.5 text-[#d8c39a]" />
            放映厅预览
          </motion.button>
        </div>
      </div>

      {/* Main Split stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Center Panel: Subtitle sequence list */}
        <div className={`flex-1 p-6 min-h-0 overflow-hidden flex flex-col items-center z-10 transition-all duration-300 ${isSettingsOpen ? 'lg:pr-[364px]' : 'pr-0'}`}>
          <div className="max-w-5xl w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-white/[0.01] border border-white/[0.06] rounded-xl">
            <SequenceList />
          </div>
        </div>

        {/* Floating Style Drawer */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-6 top-6 bottom-6 w-[340px] z-50 glass-panel-ar rounded-3xl overflow-hidden flex flex-col"
            >
              <StyleSidebar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click-outside helper overlay for back confirm */}
      {showBackConfirm && (
        <div className="fixed inset-0 z-10" onClick={() => setShowBackConfirm(false)} />
      )}
    </div>
  );
};
