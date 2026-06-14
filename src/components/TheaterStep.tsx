'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { ScreenSimulator } from '@/components/Theater/ScreenSimulator';
import { SimulatorBoundary } from '@/components/Theater/SimulatorBoundary';
import { ControlDeck } from '@/components/Theater/ControlDeck';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { ChevronLeft, Sliders } from 'lucide-react';
import { SubtitleDataSlot, BackdropSlot } from '@/types/subtitleTypes';
import { motion, AnimatePresence } from 'framer-motion';

export const TheaterStep: React.FC = () => {
  const {
    processedSubs,
    previewIndex,
    isTemplateLab,
    restartSystem,
    setWorkflowStep,
    isSettingsOpen,
    setIsSettingsOpen,
    customStyle,
    sceneBackground,
    setSceneBackground,
    tmdbBackdrop,
    theaterAspect,
    showGuides,
    tempShowGuides,
    triggerTempGuides,
  } = useStudioStore();

  const safePreviewIndex = processedSubs && processedSubs.length > 0
    ? Math.min(Math.max(previewIndex, 0), processedSubs.length - 1)
    : 0;

  const handleBack = () => {
    if (isTemplateLab) {
      restartSystem();
    } else {
      setWorkflowStep(2);
    }
  };

  // 确保默认场景
  useEffect(() => {
    if (!sceneBackground || sceneBackground === 'solid') {
      setSceneBackground('cinema');
    }
  }, [sceneBackground, setSceneBackground]);

  // 转换数据格式
  const subtitleSlot: SubtitleDataSlot = processedSubs
    ? { status: 'ready', data: processedSubs }
    : { status: 'idle' };

  let backdropSlot: BackdropSlot;
  if (sceneBackground === 'cinema' && tmdbBackdrop) {
    backdropSlot = { type: 'tmdb', backdropUrl: tmdbBackdrop };
  } else if (sceneBackground === 'cinema' || sceneBackground === 'nature' || sceneBackground === 'night') {
    backdropSlot = { type: 'preset', name: sceneBackground };
  } else {
    backdropSlot = { type: 'solid', color: '#0c0c10' };
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative bg-[#050507]">
      
      {/* 顶部导航栏 */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center px-4 md:px-6 py-2 min-h-[52px] bg-[#030305]/40 backdrop-blur-md border-b border-white/[0.06] z-50 flex-shrink-0 gap-3">
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.03, y: -0.5 }}
            whileTap={{ scale: 0.97 }}
            className="p-2 glass-btn-ar rounded-lg flex items-center justify-center cursor-pointer text-neutral-400 hover:text-neutral-200"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
          
          <div>
            <h2 className="text-xs font-mono font-bold text-neutral-450 tracking-wider">THEATER // 放映厅</h2>
            <p className="text-[10px] text-violet-400 font-mono mt-0.5">
              {theaterAspect} · {sceneBackground}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-start xl:justify-end gap-2.5 flex-wrap w-full xl:w-auto">
          <TimelineControls variant="compact" />
          <ControlDeck />
          
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer
              ${isSettingsOpen ? 'glass-btn-ar-active' : 'glass-btn-ar text-neutral-350 hover:text-white'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            样式
          </button>

          <ExportDropdown variant="ghost" />
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Theater 预览区域 */}
        <div className="flex-1 flex items-center justify-center p-3 md:p-6 xl:p-8 relative min-w-0">
          <SimulatorBoundary>
            <ScreenSimulator
              subtitle={subtitleSlot}
              backdrop={backdropSlot}
              style={customStyle}
              previewIndex={safePreviewIndex}
              theaterAspect={theaterAspect}
              guides={{ show: showGuides, temp: tempShowGuides }}
              triggerTempGuides={triggerTempGuides}
            />
          </SimulatorBoundary>
        </div>

        {/* 样式侧边栏 */}
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
    </div>
  );
};
