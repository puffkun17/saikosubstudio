'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { ScreenSimulator } from '@/components/Theater/ScreenSimulator';
import { SimulatorBoundary } from '@/components/Theater/SimulatorBoundary';
import { ControlDeck } from '@/components/Theater/ControlDeck';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
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

  // 放映厅只保留片源剧照 / 默认影院画面，旧场景配置统一回退到影院模式。
  useEffect(() => {
    if (sceneBackground !== 'cinema') {
      setSceneBackground('cinema');
    }
  }, [sceneBackground, setSceneBackground]);

  // 转换数据格式
  const subtitleSlot: SubtitleDataSlot = processedSubs
    ? { status: 'ready', data: processedSubs }
    : { status: 'idle' };

  let backdropSlot: BackdropSlot;
  if (tmdbBackdrop) {
    backdropSlot = { type: 'tmdb', backdropUrl: tmdbBackdrop };
  } else {
    backdropSlot = { type: 'preset', name: sceneBackground };
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative bg-[#050507]">
      
      {/* 顶部导航栏 */}
      <div className="relative z-[70] flex flex-col gap-3 border-b border-white/[0.07] bg-[#020203]/72 px-5 py-4 backdrop-blur-md md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              <h2 className="text-xl font-semibold tracking-tight text-neutral-100">放映厅预览</h2>
              <p className="mt-0.5 text-sm text-[#e5e7eb]">{theaterAspect} · {tmdbBackdrop ? '片源剧照' : '影院默认画面'}</p>
            </div>
          </div>

          <div className="relative z-[90] flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all cursor-pointer
                ${isSettingsOpen ? 'glass-btn-ar-active' : 'glass-btn-ar text-neutral-350 hover:text-white'}`}
            >
              <SlidersHorizontal className="h-4 w-4 stroke-[2.25]" />
              样式
            </button>
            <ExportDropdown variant="ghost" />
          </div>
        </div>
        <ControlDeck />
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Theater 预览区域 */}
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 p-3 md:p-5 xl:p-6 relative min-w-0 transition-[padding] duration-500 ease-out ${isSettingsOpen ? 'xl:pr-[390px]' : ''}`}>
          <div className="w-full max-w-[1080px] shrink-0 px-1">
            <TimelineControls variant="theater" />
          </div>
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            <SimulatorBoundary>
              <ScreenSimulator
                subtitle={subtitleSlot}
                backdrop={backdropSlot}
                style={customStyle}
                previewIndex={safePreviewIndex}
                theaterAspect={theaterAspect}
                guides={{ show: showGuides, temp: tempShowGuides }}
              />
            </SimulatorBoundary>
          </div>
        </div>

        {/* 样式侧边栏 */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-4 top-4 bottom-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl glass-panel-ar md:right-6 md:top-6 md:bottom-6"
            >
              <StyleSidebar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
