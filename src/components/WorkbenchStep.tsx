'use client';

import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { SequenceList } from '@/components/Workbench/SequenceList';
import { SourceMatchPanel } from '@/components/Workbench/SourceMatchPanel';
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
      <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-8 py-5 border-b border-white/[0.07] bg-[#020203]/72 backdrop-blur-md gap-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-4 text-left shrink-0">
          <div className="relative">
            {/* Bounce back button */}
            <motion.button 
              whileHover={{ scale: 1.03, y: -0.5 }}
              whileTap={{ scale: 0.97 }}
              className="p-2 glass-btn-ar rounded-lg flex items-center justify-center cursor-pointer text-[#9ddacb] hover:text-[#c3eee3]"
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
                  <p className="text-sm text-neutral-300 leading-relaxed mb-3">
                    返回将<span className="text-rose-400 font-bold"> 清除当前对齐数据</span>，确认？
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-2 text-sm font-medium glass-btn-ar rounded-lg cursor-pointer"
                      onClick={() => setShowBackConfirm(false)}
                    >
                      取消
                    </button>
                    <button
                      className="flex-1 py-2 text-sm font-semibold bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg cursor-pointer transition-colors duration-200"
                      onClick={() => { setShowBackConfirm(false); setProcessedSubs(null); setWorkflowStep(1); }}
                    >
                      确认返回
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
            <Sliders className="w-3.5 h-3.5 text-[#9ddacb]" />
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
            <Eye className="w-3.5 h-3.5 text-[#267c6e]" />
            下一步：放映厅预览
          </motion.button>
        </div>
      </div>

      {/* Main Split stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Center Panel: Subtitle sequence list */}
        <div className={`flex-1 p-6 min-h-0 overflow-hidden flex flex-col items-center z-10 transition-all duration-300 ${isSettingsOpen ? 'lg:pr-[396px]' : 'pr-0'}`}>
          <div className="max-w-6xl w-full flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {processedSubs && processedSubs.length > 0 && (
              <SourceMatchPanel rows={processedSubs} />
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white/[0.012] border border-white/[0.075] rounded-xl">
              <SequenceList />
            </div>
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
              className="absolute right-6 top-6 bottom-6 w-[390px] z-50 glass-panel-ar rounded-2xl overflow-hidden flex flex-col"
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
