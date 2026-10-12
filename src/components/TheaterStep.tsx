'use client';

import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { ScreenSimulator } from '@/components/Theater/ScreenSimulator';
import { SimulatorBoundary } from '@/components/Theater/SimulatorBoundary';
import { TheaterSystemChrome, TheaterDockOptions, DockToggle, DOCK_TITLES, type TheaterDockId } from '@/components/Theater/ControlDeck';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { StyleSidebar } from '@/components/Settings/StyleSidebar';
import { ExportPanel } from '@/hooks/useExport';
import { resolvePreviewStyle } from '@/utils/previewStyle';
import { SPECIAL_LABEL, specialIndices, pagerOrdinal, stepSpecial, slideIndexFor, type SpecialKind } from '@/core/specialLines';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { ChevronLeft, SlidersHorizontal, SquareArrowRightExit, X } from 'lucide-react';
import { SubtitleDataSlot, BackdropSlot, StyleSettings } from '@/types/subtitleTypes';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 只有这个小组件按帧订阅播放时钟——
 * TheaterStep 本体（含标题栏 / 样式抽屉）不再跟着 60fps 重渲染。
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
    tmdbBackdropList,
    theaterAspect,
    showGuides,
    tempShowGuides,
    isLightsOff,
    setLightsOff,
    setPreviewIndex,
    setJumpLineVal,
    setIsPreviewPlaying,
    exportPresetId,
    hdrEnabled,
    hdrLevel,
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
    tmdbBackdropList: state.tmdbBackdropList,
    theaterAspect: state.theaterAspect,
    showGuides: state.showGuides,
    tempShowGuides: state.tempShowGuides,
    isLightsOff: state.isLightsOff,
    setLightsOff: state.setLightsOff,
    setPreviewIndex: state.setPreviewIndex,
    setJumpLineVal: state.setJumpLineVal,
    setIsPreviewPlaying: state.setIsPreviewPlaying,
    exportPresetId: state.exportPresetId,
    hdrEnabled: state.hdrEnabled,
    hdrLevel: state.hdrLevel,
  })));
  // Preview == export: render with the chosen ASS preset, and dim fills like the HDR copy when it is on.
  const previewStyle = React.useMemo(
    () => resolvePreviewStyle(customStyle, exportPresetId, hdrEnabled ? hdrLevel : null),
    [customStyle, exportPresetId, hdrEnabled, hdrLevel],
  );

  const safePreviewIndex = processedSubs && processedSubs.length > 0
    ? Math.min(Math.max(previewIndex, 0), processedSubs.length - 1)
    : 0;

  const [showLightsExitTip, setShowLightsExitTip] = useState(false);
  const [slideshow, setSlideshow] = useState(true);
  // 唯一的右侧停靠面板（spec v1.1 §6）：所有工具栏选项都在这里打开，预览缩小但始终完整可见。
  const [dock, setDock] = useState<TheaterDockId | null>(() => (isSettingsOpen ? 'style' : null));
  const toggleDock = (id: TheaterDockId) => {
    const next = dock === id ? null : id;
    setDock(next);
    setIsSettingsOpen(next === 'style');
  };
  // 特殊行导航（spec v1.1 §6.3）：分类标签 + 分类内翻页 + 时间轴刻度/高亮。
  const special = React.useMemo(() => specialIndices(processedSubs ?? []), [processedSubs]);
  const kinds = (Object.keys(SPECIAL_LABEL) as SpecialKind[]).filter((k) => special[k].length > 0);
  const [specialKind, setSpecialKind] = useState<SpecialKind | null>(null);
  const [pulse, setPulse] = useState<{ row: number; key: number } | null>(null);
  const pulseSeq = React.useRef(0);
  const goRow = (row: number) => {
    if (row < 0) return;
    setIsPreviewPlaying(false);
    setPreviewIndex(row);
    setJumpLineVal(String(row + 1));
    pulseSeq.current += 1;
    setPulse({ row, key: pulseSeq.current });
  };
  const pickKind = (kind: SpecialKind) => {
    setSpecialKind(kind);
    goRow(special[kind][0]);
  };
  const activeIdx = specialKind ? special[specialKind] : [];
  const [coachSeen, setCoachSeen] = useState(true);
  useEffect(() => {
    try { setCoachSeen(localStorage.getItem('saiko_coach_special') === '1'); } catch { /* private mode */ }
  }, []);
  const dismissCoach = () => {
    setCoachSeen(true);
    try { localStorage.setItem('saiko_coach_special', '1'); } catch { /* ignore */ }
  };

  // 进入关灯时给短提示；开灯或卸载时清掉。
  useEffect(() => {
    if (!isLightsOff) {
      setShowLightsExitTip(false);
      return;
    }
    setShowLightsExitTip(true);
    const timer = window.setTimeout(() => setShowLightsExitTip(false), 3500);
    return () => window.clearTimeout(timer);
  }, [isLightsOff]);

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
    if (!dock) return;
    const handleEscape = (event: KeyboardEvent) => {
      // 关灯优先吃掉 Esc；再按一次才关面板。
      if (useStudioStore.getState().isLightsOff) return;
      if (event.key === 'Escape') { setDock(null); setIsSettingsOpen(false); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dock, setIsSettingsOpen]);

  // ── 关灯模式退出规则 ────────────────────────────────────────────
  // Esc / 点击暗幕 / 再按 L → 退出；离开放映厅 → 复位。
  // 样式抽屉可与关灯共存（夜光 LCD 侧栏）；不再因开抽屉强制开灯。
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
  // Slideshow: with several stills, the still advances with the timeline position.
  const slideUrl = slideshow && tmdbBackdrop && tmdbBackdropList.length > 1
    ? tmdbBackdropList[slideIndexFor(safePreviewIndex, processedSubs?.length ?? 0, tmdbBackdropList.length)]
    : null;
  if (slideUrl || tmdbBackdrop) {
    backdropSlot = { type: 'tmdb', backdropUrl: (slideUrl || tmdbBackdrop) as string };
  } else {
    backdropSlot = { type: 'preset', name: sceneBackground };
  }

  return (
    <div data-surface="forest" className="relative flex h-full w-full flex-1 flex-col overflow-hidden">
      
      {/* 顶部导航栏 */}
      <div className="relative z-[var(--z-raised)] flex flex-col gap-2 border-b border-[var(--v4-line)] bg-[var(--v4-canvas-raised)] px-3 py-2 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <motion.button
            whileHover={{ scale: 1.03, y: -0.5 }}
            whileTap={{ scale: 0.97 }}
            className="ui-action ui-action--secondary ui-action--icon"
            onClick={handleBack}
            aria-label="返回工作台"
          >
            <ChevronLeft className="w-4 h-4" />
            </motion.button>
          
            <div>
              <h2 className="ds-head">字幕预览</h2>
              <p className="ds-meta">{theaterAspect} · {tmdbBackdrop ? '影片剧照' : '默认背景'}</p>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-end gap-2">
            <TheaterSystemChrome dock={dock} onToggle={toggleDock} />
            <DockToggle id="style" active={dock} onToggle={toggleDock} icon={<SlidersHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" />} label="字幕样式" />
            <DockToggle id="export" active={dock} onToggle={toggleDock} primary icon={<SquareArrowRightExit className="h-4 w-4" aria-hidden="true" />} label="导出字幕" />
          </div>
        </div>
      </div>

      {/* 主体：关灯时整块（预览 + 夜光侧栏）提到暗幕之上 */}
        <div className={`flex-1 flex min-h-0 flex-col overflow-hidden relative lg:flex-row ${isLightsOff ? 'lights-off-stage' : ''}`}>
        {/* L0 舞台：隔离内部 z，避免电视框压过样式面板 */}
        <div className="relative z-[var(--z-theater-stage)] isolate flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-3 md:p-5 xl:p-6">
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            <SimulatorBoundary>
              <SimulatorWithClock
                subtitle={subtitleSlot}
                backdrop={backdropSlot}
                style={previewStyle}
                previewIndex={safePreviewIndex}
                theaterAspect={theaterAspect}
                guides={{ show: showGuides, temp: tempShowGuides }}
              />
            </SimulatorBoundary>
          </div>

          {/* 特殊行导航：空分类不显示；无任何特殊行时整条隐藏 */}
          {kinds.length > 0 && (
            <div className="theater-special-nav flex w-full max-w-[1080px] flex-wrap items-center gap-2 px-1" role="toolbar" aria-label="特殊行导航">
              <div className="flex flex-wrap items-center gap-1.5">
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="ds-chip"
                    aria-pressed={specialKind === kind}
                    data-kind={kind}
                    onClick={() => pickKind(kind)}
                    title={`定位到第一处${SPECIAL_LABEL[kind]}`}
                  >
                    {SPECIAL_LABEL[kind]}
                    <span className="ds-chip__count">{special[kind].length}</span>
                  </button>
                ))}
              </div>
              {specialKind && (
                <div className="ds-pager" role="group" aria-label={`${SPECIAL_LABEL[specialKind]}翻页`}>
                  <button type="button" className="ds-pager__btn" aria-label="上一处" onClick={() => goRow(stepSpecial(activeIdx, safePreviewIndex, -1))}>‹</button>
                  <span className="ds-pager__pos" aria-live="polite">{pagerOrdinal(activeIdx, safePreviewIndex)} / {activeIdx.length}</span>
                  <button type="button" className="ds-pager__btn" aria-label="下一处" onClick={() => goRow(stepSpecial(activeIdx, safePreviewIndex, 1))}>›</button>
                </div>
              )}
              {!coachSeen && (
                <p className="ds-coach" role="note">
                  选择类别可定位特殊行，用 ‹ › 逐处查看。
                  <button type="button" className="ds-coach__close" aria-label="不再提示" onClick={dismissCoach}>知道了</button>
                </p>
              )}
            </div>
          )}

          {/* 播放条：几何避让由抽屉 bottom 让出，禁止临时抬 z。 */}
          <div className="theater-stage-chrome relative flex w-full max-w-[1080px] shrink-0 px-1">
            <TimelineControls
              variant="theater"
              theaterChrome={{
                lightsOff: isLightsOff,
                marks: specialKind ? activeIdx : undefined,
                pulse,
              }}
            />
          </div>
        </div>

        {/* 停靠面板：文档流内的兄弟节点（不是浮层），预览随之缩小、保持比例、不被遮挡。 */}
        {dock && (
          <aside id="theater-dock" data-surface="forest" className="theater-style-shell ds-dock" aria-label={DOCK_TITLES[dock]}>
            <header className="ds-dock__head">
              <h3 className="ds-head">{DOCK_TITLES[dock]}</h3>
              <button type="button" className="ui-action ui-action--secondary ui-action--icon" aria-label="关闭面板" onClick={() => { setDock(null); setIsSettingsOpen(false); }}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="ds-dock__body">
              {dock === 'style' && <StyleSidebar tone="theater" embedded />}
              {dock === 'export' && <ExportPanel />}
              {(dock === 'aspect' || dock === 'backdrop' || dock === 'preset') && <TheaterDockOptions panel={dock} />}
              {dock === 'backdrop' && tmdbBackdropList.length > 1 && (
                <label className="ds-check ds-dock__group" title="按播放进度切换剧照">
                  <input type="checkbox" checked={slideshow} onChange={(e) => setSlideshow(e.target.checked)} />
                  剧照轮播
                </label>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 关灯暗幕：压暗双托盘与放映厅其余界面，点击即开灯 */}
      <OverlayPortal>
        <AnimatePresence>
          {isLightsOff && (
            <motion.button
              type="button"
              aria-label="点击空白处、按 Esc 或 L 退出关灯"
              title="点击空白处、按 Esc 或 L 退出关灯"
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
        <AnimatePresence>
          {isLightsOff && showLightsExitTip && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="lights-off-exit-tip pointer-events-none fixed bottom-8 left-1/2 z-[calc(var(--z-dim)+1)] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 text-center"
            >
              <span className="inline-flex items-center rounded-[var(--radius-md)] border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-medium tracking-wide text-white/90 shadow-[var(--elevation-2)] backdrop-blur-sm">
                点击空白处、按 Esc 或 L 退出关灯
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
  );
};
