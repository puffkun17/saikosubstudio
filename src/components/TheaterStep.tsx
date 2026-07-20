'use client';

import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { ScreenSimulator } from '@/components/Theater/ScreenSimulator';
import { SimulatorBoundary } from '@/components/Theater/SimulatorBoundary';
import { ControlDeck } from '@/components/Theater/ControlDeck';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportDropdown } from '@/hooks/useExport';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { ChevronLeft, LampCeiling, SlidersHorizontal } from 'lucide-react';
import { SubtitleDataSlot, BackdropSlot, StyleSettings } from '@/types/subtitleTypes';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 只有这个小组件按帧订阅播放时钟——
 * TheaterStep 本体（含标题栏 / ControlDeck / 样式抽屉）不再跟着 60fps 重渲染。
 */
const SimulatorWithClock: React.FC<{
  subtitle: SubtitleDataSlot;
  backdrop: BackdropSlot;
  style: StyleSettings;
  previewIndex: number;
  theaterAspect: string;
  guides: { show: boolean; temp: boolean };
}> = (props) => {
  const previewClockMs = useStudioStore((state) => state.previewClockMs);
  const isPreviewPlaying = useStudioStore((state) => state.isPreviewPlaying);
  return (
    <ScreenSimulator
      {...props}
      previewClockMs={previewClockMs}
      isPreviewPlaying={isPreviewPlaying}
    />
  );
};

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
    isLightsOff,
    setLightsOff,
    setPreviewIndex,
    setJumpLineVal,
    setIsPreviewPlaying,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    previewIndex: state.previewIndex,
    isTemplateLab: state.isTemplateLab,
    restartSystem: state.restartSystem,
    setWorkflowStep: state.setWorkflowStep,
    isSettingsOpen: state.isSettingsOpen,
    setIsSettingsOpen: state.setIsSettingsOpen,
    customStyle: state.customStyle,
    sceneBackground: state.sceneBackground,
    setSceneBackground: state.setSceneBackground,
    tmdbBackdrop: state.tmdbBackdrop,
    theaterAspect: state.theaterAspect,
    showGuides: state.showGuides,
    tempShowGuides: state.tempShowGuides,
    isLightsOff: state.isLightsOff,
    setLightsOff: state.setLightsOff,
    setPreviewIndex: state.setPreviewIndex,
    setJumpLineVal: state.setJumpLineVal,
    setIsPreviewPlaying: state.setIsPreviewPlaying,
  })));

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

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSettingsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, setIsSettingsOpen]);

  // ── 关灯模式退出规则 ────────────────────────────────────────────
  // 1) Esc / 点击暗幕 / 再按 L → 退出；2) 打开样式抽屉 → 自动开灯；3) 离开放映厅 → 复位。
  useEffect(() => {
    if (isSettingsOpen && isLightsOff) setLightsOff(false);
  }, [isSettingsOpen, isLightsOff, setLightsOff]);

  useEffect(() => () => setLightsOff(false), [setLightsOff]);

  // 放映厅键盘操作：← / → 切行，空格播放暂停，L 关灯。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const state = useStudioStore.getState();
      const subs = state.processedSubs;

      if (event.key === 'Escape' && state.isLightsOff) {
        event.preventDefault();
        setLightsOff(false);
        return;
      }
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        setLightsOff(!state.isLightsOff);
        return;
      }
      if (!subs || subs.length === 0) return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        const next = Math.max(0, Math.min(subs.length - 1, state.previewIndex + delta));
        setIsPreviewPlaying(false);
        setPreviewIndex(next);
        setJumpLineVal(String(next + 1));
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        setIsPreviewPlaying(!state.isPreviewPlaying);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setLightsOff, setIsPreviewPlaying, setPreviewIndex, setJumpLineVal]);

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
    <div data-surface="forest" className="relative flex h-full w-full flex-1 flex-col overflow-hidden">
      
      {/* 顶部导航栏 */}
      <div className="relative z-[var(--z-raised)] flex flex-col gap-3 border-b border-[var(--v4-line)] bg-[var(--v4-canvas-raised)] px-5 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <motion.button
            whileHover={{ scale: 1.03, y: -0.5 }}
            whileTap={{ scale: 0.97 }}
            className="v4-focus-ring flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-accent-strong)] hover:bg-[var(--v4-panel)]"
            onClick={handleBack}
            aria-label="返回工作台"
          >
            <ChevronLeft className="w-4 h-4" />
            </motion.button>
          
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--v4-text)]">字幕预览</h2>
              <p className="mt-0.5 text-sm text-[var(--v4-text-muted)]">{theaterAspect} · {tmdbBackdrop ? '影片剧照' : '默认背景'}</p>
            </div>
          </div>

          <div className="relative z-[var(--z-dropdown)] flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`v4-focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-medium transition-all
                ${isSettingsOpen ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]'}`}
            >
              <SlidersHorizontal className="h-4 w-4 stroke-[2.25]" />
              字幕样式
            </button>
            <ExportDropdown variant="ghost" />
          </div>
        </div>
        <ControlDeck />
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Theater 预览区域（关灯时提到暗幕之上，保持点亮） */}
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 p-3 md:p-5 xl:p-6 relative min-w-0 ${isLightsOff ? 'lights-off-stage' : ''}`}>
          <div className="theater-stage-chrome flex w-full max-w-[1080px] shrink-0 items-center gap-2 px-1">
            <div className="min-w-0 flex-1">
              <TimelineControls variant="theater" />
            </div>
            <button
              type="button"
              onClick={() => setLightsOff(!isLightsOff)}
              aria-pressed={isLightsOff}
              title={isLightsOff ? '开灯（L / Esc）' : '关灯观影（L）'}
              aria-label={isLightsOff ? '开灯' : '关灯观影'}
              className={`v4-focus-ring grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border transition-colors
                ${isLightsOff
                  ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                  : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]'}`}
            >
              <LampCeiling className="h-4.5 w-4.5 stroke-[2]" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            <SimulatorBoundary>
              <SimulatorWithClock
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
            <>
              <motion.button
                type="button"
                aria-label="关闭样式参数"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black/55 xl:hidden"
                onClick={() => setIsSettingsOpen(false)}
              />
              <motion.aside
                aria-label="样式参数"
                initial={{ x: 360, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 360, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="v4-panel absolute inset-y-4 right-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg xl:relative xl:inset-auto xl:z-20 xl:my-5 xl:mr-5 xl:w-[380px] xl:shrink-0"
              >
                <StyleSidebar />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 关灯暗幕：压暗双托盘与放映厅其余界面，点击即开灯 */}
      <OverlayPortal>
        <AnimatePresence>
          {isLightsOff && (
            <motion.button
              type="button"
              aria-label="开灯"
              title="点击开灯（L / Esc）"
              initial={{ opacity: 0 }}
              // 关灯像影院调光：先快速压到六成，再缓缓沉到全暗；开灯一步到位（快出）。
              animate={{ opacity: [0, 0.62, 1] }}
              exit={{ opacity: 0, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] } }}
              transition={{ duration: 0.68, times: [0, 0.38, 1], ease: [0.16, 1, 0.3, 1] }}
              className="lights-off-scrim"
              onClick={() => setLightsOff(false)}
            />
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
  );
};
