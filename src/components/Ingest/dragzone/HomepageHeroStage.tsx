'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileFormatGlyph, type FileFormat } from '@/components/ui/FileFormatIcon';

export interface HomepageHeroStageProps {
  isDragging: boolean;
  tapFirst: boolean;
  folderPickSupported: boolean;
  folderUnsupportedHint: string;
  shouldReduceMotion: boolean;
  onPickFiles: () => void;
  onPickFolder: () => void;
}

type HeroBeat = 'spawn' | 'emerge' | 'lock' | 'unfold' | 'fadeout';
type SubFont = 'sans' | 'serif' | 'kai';
type SubLang = 'en' | 'ja';
type WheelKey = 'scene' | 'font' | 'color' | 'lang' | 'lyric';

interface HeroScene {
  id: number;
  background: string;
  leftName: string;
  leftFmt: FileFormat;
  leftLang: string;
  leftMono: boolean;
  leftLabel: string;
  rightName: string;
  rightFmt: FileFormat;
  rightLang: string;
  rightMono: boolean;
  rightLabel: string;
  zhBadge: string;
  syncShort: string;
  zh: string;
  subEn: string;
  subJa: string;
  demoFont: SubFont;
  dualPrimary: string;
  dualSecondary: string;
  lyricZh: string;
  lyricSub: string;
}

const SUB_FONT_ORDER: SubFont[] = ['sans', 'serif', 'kai'];
const HOVER_POUR_TOKENS: Array<{ fmt: FileFormat; left: number; tilt: string; delay: string }> = [
  { fmt: 'srt', left: 6, tilt: '-10deg', delay: '0ms' },
  { fmt: 'ass', left: 39, tilt: '7deg', delay: '220ms' },
  { fmt: 'zip', left: 72, tilt: '-4deg', delay: '440ms' },
  { fmt: '7z', left: 105, tilt: '9deg', delay: '660ms' },
  { fmt: 'rar', left: 138, tilt: '-6deg', delay: '880ms' },
];

const HERO_SCENES: HeroScene[] = [
  {
    id: 0,
    background: 'radial-gradient(ellipse at 26% 36%, rgba(188, 62, 42, 0.56) 0%, rgba(36, 46, 38, 0.72) 48%, #0E1210 100%)',
    leftName: '2046.Cht.srt',
    leftFmt: 'srt',
    leftLang: '繁',
    leftMono: false,
    leftLabel: '繁 .srt',
    rightName: '2046.Eng.srt',
    rightFmt: 'srt',
    rightLang: 'EN',
    rightMono: true,
    rightLabel: 'EN .srt',
    zhBadge: '繁',
    syncShort: '00:14:22',
    zh: '如果我多一張船票，你會不會跟我一起走？',
    subEn: 'If I had an extra ticket, would you come away with me?',
    subJa: 'もしもう一枚切符があったら、一緒に行ってくれる？',
    demoFont: 'serif',
    dualPrimary: '#f7d98c',
    dualSecondary: '#f4f1ea',
    lyricZh: '♪ 所有的記憶都是潮濕的 ♪',
    lyricSub: '♪ Every memory is drenched in rain ♪',
  },
  {
    id: 1,
    background: 'radial-gradient(ellipse at 72% 74%, rgba(212, 146, 62, 0.44) 0%, rgba(28, 44, 78, 0.78) 46%, #090D16 100%)',
    leftName: 'Interstellar.Chs.ass',
    leftFmt: 'ass',
    leftLang: '简',
    leftMono: false,
    leftLabel: '简 .ass',
    rightName: 'Interstellar.Eng.srt',
    rightFmt: 'srt',
    rightLang: 'EN',
    rightMono: true,
    rightLabel: 'EN .srt',
    zhBadge: '简',
    syncShort: '00:52:14',
    zh: '不要温和地走进那个良夜。',
    subEn: 'Do not go gentle into that good night.',
    subJa: 'あの良き夜に穏やかに入るな。',
    demoFont: 'kai',
    dualPrimary: '#ffffff',
    dualSecondary: '#9cc8f5',
    lyricZh: '♪ 群星在无声处回响，指引归途 ♪',
    lyricSub: '♪ Stay — across the silence of the stars ♪',
  },
  {
    id: 2,
    background: 'radial-gradient(ellipse at 44% 28%, rgba(86, 126, 188, 0.42) 0%, rgba(24, 34, 56, 0.82) 52%, #0B0F1A 100%)',
    leftName: 'Signal.Chs.srt',
    leftFmt: 'srt',
    leftLang: '简',
    leftMono: false,
    leftLabel: '简 .srt',
    rightName: 'Signal.Eng.ass',
    rightFmt: 'ass',
    rightLang: 'EN',
    rightMono: true,
    rightLabel: 'EN .ass',
    zhBadge: '简',
    syncShort: '00:31:06',
    zh: '即使在看不见彼此的远方，信号也会抵达。',
    subEn: 'Even across unseen distances, this signal will reach you.',
    subJa: 'どれほど離れていても、この思いは必ず届く。',
    demoFont: 'serif',
    dualPrimary: '#fff8f1',
    dualSecondary: '#f2b8b5',
    lyricZh: '♪ 光穿过黑夜，终会抵达彼岸 ♪',
    lyricSub: '♪ 光は夜を越えて、きっと届く ♪',
  },
];

const TEXT_SHADOW_PRIMARY =
  '0 2px 8px rgba(0,0,0,0.92), -1px -1px 0 rgba(0,0,0,0.85), 1px 1px 0 rgba(0,0,0,0.85)';
const TEXT_SHADOW_SECONDARY =
  '0 1px 6px rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.8), 1px 1px 0 rgba(0,0,0,0.8)';

export const HomepageHeroStage: React.FC<HomepageHeroStageProps> = ({
  isDragging,
  tapFirst,
  folderPickSupported,
  folderUnsupportedHint,
  shouldReduceMotion,
  onPickFiles,
  onPickFolder,
}) => {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [beat, setBeat] = useState<HeroBeat>(shouldReduceMotion ? 'unfold' : 'spawn');
  const [isResetting, setIsResetting] = useState(false);
  const [isLocked, setIsLocked] = useState(Boolean(shouldReduceMotion));
  const [isPrelude, setIsPrelude] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isPouring, setIsPouring] = useState(false);

  const [subFont, setSubFont] = useState<SubFont>(shouldReduceMotion ? HERO_SCENES[0].demoFont : 'sans');
  const [dualColor, setDualColor] = useState(Boolean(shouldReduceMotion));
  const [subLang, setSubLang] = useState<SubLang>(shouldReduceMotion ? 'ja' : 'en');
  const [topLyric, setTopLyric] = useState(Boolean(shouldReduceMotion));
  const [userTouchedStyle, setUserTouchedStyle] = useState(false);
  const [pulsedWheel, setPulsedWheel] = useState<WheelKey | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneCycleBtnRef = useRef<HTMLButtonElement>(null);
  const tumblerBarRef = useRef<HTMLDivElement>(null);
  const beatTimersRef = useRef<number[]>([]);
  const pulseTimerRef = useRef<number | null>(null);
  const pulseRafRef = useRef<number | null>(null);
  const lastWheelAtRef = useRef<Record<string, number>>({});
  const hoveredWheelRef = useRef<{ key: WheelKey; at: number } | null>(null);
  const isDraggingRef = useRef(isDragging);
  const isPouringRef = useRef(isPouring);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isPouringRef.current = isPouring;
  }, [isPouring]);

  const clearAllTimers = useCallback(() => {
    for (const id of beatTimersRef.current) {
      window.clearTimeout(id);
    }
    beatTimersRef.current = [];
  }, []);

  const triggerPulse = useCallback((wheel: WheelKey) => {
    if (shouldReduceMotion) return;
    if (pulseRafRef.current !== null) {
      window.cancelAnimationFrame(pulseRafRef.current);
      pulseRafRef.current = null;
    }
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    setPulsedWheel(null);
    pulseRafRef.current = window.requestAnimationFrame(() => {
      pulseRafRef.current = null;
      setPulsedWheel(wheel);
      pulseTimerRef.current = window.setTimeout(() => {
        pulseTimerRef.current = null;
        setPulsedWheel((curr) => (curr === wheel ? null : curr));
      }, 650);
    });
  }, [shouldReduceMotion]);

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (pulseRafRef.current !== null) {
        window.cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = null;
      }
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
  }, [clearAllTimers]);

  // Run the choreographed single-feature showcase cycle whenever sceneIdx changes
  useEffect(() => {
    clearAllTimers();
    if (shouldReduceMotion) return;

    const s = HERO_SCENES[sceneIdx];
    let innerRaf = 0;

    const scheduleFadeAndAdvance = (delayMs: number) => {
      const tFade = window.setTimeout(() => {
        setBeat('fadeout');
        const tNext = window.setTimeout(() => {
          if (!isDraggingRef.current && !document.hidden) {
            setSceneIdx((prev) => (prev + 1) % HERO_SCENES.length);
          } else {
            setBeat('unfold');
          }
        }, 400);
        beatTimersRef.current.push(tNext);
      }, delayMs);
      beatTimersRef.current.push(tFade);
    };

    const rafId = window.requestAnimationFrame(() => {
      setIsResetting(true);
      setBeat('spawn');
      setIsLocked(false);
      setIsPrelude(false);
      setIsFeeding(false);
      setSubFont('sans');
      setDualColor(false);
      setSubLang('en');
      setTopLyric(false);
      setUserTouchedStyle(false);

      innerRaf = window.requestAnimationFrame(() => {
        setIsResetting(false);
        if (!isPouringRef.current && !isDraggingRef.current) {
          setIsPrelude(true);
        }
        setIsFeeding(true);
      });

      beatTimersRef.current.push(
        window.setTimeout(() => {
          setIsPrelude(false);
          setBeat('emerge');
        }, 420),
        window.setTimeout(() => {
          setIsFeeding(false);
        }, 740),
        window.setTimeout(() => {
          setBeat('lock');
          setIsLocked(true);
        }, 1150),
        window.setTimeout(() => {
          setBeat('unfold');
        }, 1780),
        window.setTimeout(() => {
          setSubFont(s.demoFont);
          triggerPulse('font');
        }, 2950),
        window.setTimeout(() => {
          setDualColor(true);
          triggerPulse('color');
        }, 4350),
        window.setTimeout(() => {
          setSubLang('ja');
          triggerPulse('lang');
        }, 5750),
        window.setTimeout(() => {
          setTopLyric(true);
          triggerPulse('lyric');
        }, 7150),
      );

      scheduleFadeAndAdvance(9350);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (innerRaf) window.cancelAnimationFrame(innerRaf);
      clearAllTimers();
    };
  }, [sceneIdx, shouldReduceMotion, clearAllTimers, triggerPulse]);

  // If user resumes tab visibility while beat ended on fadeout, restart gracefully
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && !userTouchedStyle && beat === 'fadeout') {
        setSceneIdx((prev) => (prev + 1) % HERO_SCENES.length);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [beat, userTouchedStyle]);

  const lockUnfoldForInteraction = useCallback(() => {
    setUserTouchedStyle(true);
    clearAllTimers();
    setIsPrelude(false);
    setIsFeeding(false);
    setIsLocked(true);
    setBeat('unfold');

    if (!shouldReduceMotion) {
      const tFade = window.setTimeout(() => {
        setBeat('fadeout');
        const tNext = window.setTimeout(() => {
          setSceneIdx((prev) => (prev + 1) % HERO_SCENES.length);
        }, 400);
        beatTimersRef.current.push(tNext);
      }, 5800);
      beatTimersRef.current.push(tFade);
    }
  }, [clearAllTimers, shouldReduceMotion]);

  const rollWheel = useCallback(
    (key: Exclude<WheelKey, 'scene'>, delta: 1 | -1 = 1) => {
      const fromReducedDefaults = shouldReduceMotion && !userTouchedStyle;
      const s = HERO_SCENES[sceneIdx];
      lockUnfoldForInteraction();

      if (fromReducedDefaults) {
        if (key !== 'font') setSubFont(s.demoFont);
        if (key !== 'color') setDualColor(true);
        if (key !== 'lang') setSubLang('ja');
        if (key !== 'lyric') setTopLyric(true);
      }

      if (key === 'font') {
        setSubFont((curr) => {
          const base = fromReducedDefaults ? s.demoFont : curr;
          const i = Math.max(0, SUB_FONT_ORDER.indexOf(base));
          return SUB_FONT_ORDER[(i + delta + SUB_FONT_ORDER.length) % SUB_FONT_ORDER.length];
        });
      } else if (key === 'color') {
        setDualColor((curr) => !(fromReducedDefaults ? true : curr));
      } else if (key === 'lang') {
        setSubLang((curr) => ((fromReducedDefaults ? 'ja' : curr) === 'en' ? 'ja' : 'en'));
      } else if (key === 'lyric') {
        setTopLyric((curr) => !(fromReducedDefaults ? true : curr));
      }
      triggerPulse(key);
    },
    [lockUnfoldForInteraction, triggerPulse, shouldReduceMotion, userTouchedStyle, sceneIdx],
  );

  const cycleScene = useCallback(
    (delta: 1 | -1 = 1) => {
      setUserTouchedStyle(false);
      triggerPulse('scene');
      setSceneIdx((curr) => (curr + delta + HERO_SCENES.length) % HERO_SCENES.length);
    },
    [triggerPulse],
  );

  const wheelActionsRef = useRef({ cycleScene, rollWheel });

  useEffect(() => {
    wheelActionsRef.current = { cycleScene, rollWheel };
  }, [cycleScene, rollWheel]);

  // Explicit non-passive wheel listener on HUD controls only; avoid hijacking fast page scroll.
  useEffect(() => {
    const targets: HTMLElement[] = [];
    if (sceneCycleBtnRef.current) targets.push(sceneCycleBtnRef.current);
    if (tumblerBarRef.current) targets.push(tumblerBarRef.current);
    if (targets.length === 0) return;

    const onWheel = (e: WheelEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-hero-wheel]');
      const key = btn?.dataset.heroWheel as WheelKey | undefined;
      if (!btn || !key) return;
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || Math.abs(e.deltaY) < 4) return;

      const pageScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight + 2;
      if (pageScrollable) {
        const isFocused = document.activeElement === btn;
        const hovered = hoveredWheelRef.current;
        const hasDwelled = hovered?.key === key && performance.now() - hovered.at >= 220;
        if (!isFocused && !hasDwelled) return;
      }

      e.preventDefault();
      const now = performance.now();
      if (now - (lastWheelAtRef.current[key] || 0) < 160) return;
      lastWheelAtRef.current[key] = now;
      const delta: 1 | -1 = e.deltaY >= 0 ? 1 : -1;
      if (key === 'scene') wheelActionsRef.current.cycleScene(delta);
      else wheelActionsRef.current.rollWheel(key, delta);
    };

    for (const target of targets) {
      target.addEventListener('wheel', onWheel, { passive: false });
    }
    return () => {
      for (const target of targets) {
        target.removeEventListener('wheel', onWheel);
      }
    };
  }, []);

  const scene = HERO_SCENES[sceneIdx];
  const reduceOverride = shouldReduceMotion && !userTouchedStyle;
  const activeBeat = shouldReduceMotion ? 'unfold' : beat;
  const activeLocked = shouldReduceMotion ? true : isLocked;
  const activeSubFont = reduceOverride ? scene.demoFont : subFont;
  const activeDualColor = reduceOverride ? true : dualColor;
  const activeSubLang = reduceOverride ? 'ja' : subLang;
  const activeTopLyric = reduceOverride ? true : topLyric;

  const fontStep = Math.max(0, SUB_FONT_ORDER.indexOf(activeSubFont));
  const showDragVeil = !tapFirst && isDragging;

  const subPrimaryColor = activeDualColor ? scene.dualPrimary : '#ffffff';
  const subSecondaryColor = activeDualColor ? scene.dualSecondary : 'rgba(255, 255, 255, 0.88)';
  const subSecondaryText = activeSubLang === 'ja' ? scene.subJa : scene.subEn;
  const pairBadge = `${scene.zhBadge} │ ${activeSubLang === 'ja' ? 'あ' : 'EN'}`;

  return (
    <div
      ref={stageRef}
      data-testid="ingest-empty-stage"
      data-beat={activeBeat}
      className={`hero-stage ${isResetting ? 'is-resetting' : ''} ${isPouring ? 'is-pouring' : ''}`}
    >
      {/* Standalone Cinema Color-Script Frame */}
      <div className={`hero-cinema-frame ${activeTopLyric ? 'has-top-lyric' : ''}`}>
        {HERO_SCENES.map((item) => (
          <div
            key={item.id}
            className={`hero-scene-layer ${item.id === sceneIdx ? 'is-active' : ''}`}
            style={{ background: item.background }}
            aria-hidden="true"
          />
        ))}

        {/* Subtle Cinema Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 46%, transparent 50%, rgba(0,0,0,0.52) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Top-Left Unified Status + Integrated Scene Odometer Capsule */}
        <div
          className={`hero-screen-hud hero-echo-pill text-[11px] font-medium text-white/95 ${activeLocked ? 'is-locked' : ''}`}
          style={{ opacity: showDragVeil ? 0 : 1 }}
        >
          <div className="hero-echo-window">
            <div className="hero-echo-state hero-echo-state--split">
              <span className="font-mono text-white/90">{scene.leftLabel}</span>
              <span className="text-white/40">+</span>
              <span className="font-mono text-white/90">{scene.rightLabel}</span>
            </div>
            <div className="hero-echo-state hero-echo-state--locked">
              <span className="font-semibold">{pairBadge}</span>
              <span className="text-white/40">·</span>
              <span className="font-mono text-white/85">{scene.syncShort}</span>
            </div>
          </div>
          <button
            ref={sceneCycleBtnRef}
            type="button"
            data-hero-wheel="scene"
            onClick={() => cycleScene(1)}
            onPointerEnter={() => { hoveredWheelRef.current = { key: 'scene', at: performance.now() }; }}
            onPointerLeave={() => { if (hoveredWheelRef.current?.key === 'scene') hoveredWheelRef.current = null; }}
            className={`hero-scene-cycle-btn ${pulsedWheel === 'scene' ? 'is-just-rolled' : ''}`}
            title="点击切换下一段样片"
          >
            <span className="hero-scene-odometer-window" aria-hidden="true">
              <span
                className="hero-tumbler-reel hero-tumbler-reel--sm font-mono"
                style={{ '--step': sceneIdx } as React.CSSProperties}
              >
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </span>
            </span>
            <span className="sr-only">{`第 ${sceneIdx + 1} 段，共 ${HERO_SCENES.length} 段`}</span>
            <span className="font-mono opacity-55" aria-hidden="true">/{HERO_SCENES.length}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M3.6 2.2L6.4 5L3.6 7.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Top-Right Mechanical Combination-Lock Drum Indicators */}
        <div
          ref={tumblerBarRef}
          className="hero-screen-hud hero-tumbler-bar"
          role="group"
          aria-label="实时字幕功能演示滚筒（点击或滚轮拨动）"
          style={{ opacity: showDragVeil ? 0 : 1 }}
        >
          <button
            type="button"
            data-hero-wheel="font"
            onClick={() => rollWheel('font', 1)}
            onPointerEnter={() => { hoveredWheelRef.current = { key: 'font', at: performance.now() }; }}
            onPointerLeave={() => { if (hoveredWheelRef.current?.key === 'font') hoveredWheelRef.current = null; }}
            className={`hero-tumbler-wheel ${pulsedWheel === 'font' ? 'is-just-rolled' : ''}`}
            aria-pressed={activeSubFont !== 'sans'}
            title="拨动或点击切换主中文字体（黑体 / 宋体 / 楷体）"
          >
            <span className="hero-tumbler-label">字体</span>
            <span className="hero-tumbler-viewport" style={{ minWidth: 34 }}>
              <span
                className="hero-tumbler-reel"
                style={{ '--step': fontStep } as React.CSSProperties}
              >
                <span>黑体</span>
                <span>宋体</span>
                <span>楷体</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            data-hero-wheel="color"
            onClick={() => rollWheel('color', 1)}
            onPointerEnter={() => { hoveredWheelRef.current = { key: 'color', at: performance.now() }; }}
            onPointerLeave={() => { if (hoveredWheelRef.current?.key === 'color') hoveredWheelRef.current = null; }}
            className={`hero-tumbler-wheel ${pulsedWheel === 'color' ? 'is-just-rolled' : ''}`}
            aria-pressed={activeDualColor}
            title="拨动或点击切换双语配色（纯白 / 双色）"
          >
            <span className="hero-tumbler-label">配色</span>
            <span className="hero-tumbler-viewport" style={{ minWidth: 48 }}>
              <span
                className="hero-tumbler-reel"
                style={{ '--step': activeDualColor ? 1 : 0 } as React.CSSProperties}
              >
                <span>
                  <span className="inline-flex items-center -space-x-0.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full" style={{ background: '#ffffff' }} />
                    <span className="h-2 w-2 rounded-full border border-black/30" style={{ background: 'rgba(255,255,255,0.68)' }} />
                  </span>
                  <span>纯白</span>
                </span>
                <span>
                  <span className="inline-flex items-center -space-x-0.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full" style={{ background: scene.dualPrimary }} />
                    <span className="h-2 w-2 rounded-full border border-black/30" style={{ background: scene.dualSecondary }} />
                  </span>
                  <span>双色</span>
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            data-hero-wheel="lang"
            onClick={() => rollWheel('lang', 1)}
            onPointerEnter={() => { hoveredWheelRef.current = { key: 'lang', at: performance.now() }; }}
            onPointerLeave={() => { if (hoveredWheelRef.current?.key === 'lang') hoveredWheelRef.current = null; }}
            className={`hero-tumbler-wheel ${pulsedWheel === 'lang' ? 'is-just-rolled' : ''}`}
            aria-pressed={activeSubLang === 'ja'}
            title="拨动或点击切换副字幕语言（EN / 日文）"
          >
            <span className="hero-tumbler-label">副语</span>
            <span className="hero-tumbler-viewport" style={{ minWidth: 34 }}>
              <span
                className="hero-tumbler-reel"
                style={{ '--step': activeSubLang === 'ja' ? 1 : 0 } as React.CSSProperties}
              >
                <span className="font-mono">EN</span>
                <span>日文</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            data-hero-wheel="lyric"
            onClick={() => rollWheel('lyric', 1)}
            onPointerEnter={() => { hoveredWheelRef.current = { key: 'lyric', at: performance.now() }; }}
            onPointerLeave={() => { if (hoveredWheelRef.current?.key === 'lyric') hoveredWheelRef.current = null; }}
            className={`hero-tumbler-wheel ${pulsedWheel === 'lyric' ? 'is-just-rolled' : ''}`}
            aria-pressed={activeTopLyric}
            title="拨动或点击开启顶部歌曲歌词（♪ … ♪）"
          >
            <span className="hero-tumbler-label">顶部</span>
            <span className="hero-tumbler-viewport" style={{ minWidth: 46 }}>
              <span
                className="hero-tumbler-reel"
                style={{ '--step': activeTopLyric ? 1 : 0 } as React.CSSProperties}
              >
                <span className="opacity-70">关闭</span>
                <span>♪ 歌词</span>
              </span>
            </span>
          </button>
        </div>

        {/* Top Lyric / Song Subtitle Track */}
        <div
          className="hero-cinema-lyric-track"
          style={showDragVeil ? { opacity: 0 } : undefined}
          aria-hidden="true"
        >
          <div
            className={`text-[13px] font-medium tracking-wide md:text-[14.5px] hero-sub-font--${activeSubFont}`}
            style={{
              color: activeDualColor ? scene.dualPrimary : '#fff8f1',
              textShadow: TEXT_SHADOW_PRIMARY,
            }}
          >
            {scene.lyricZh}
          </div>
          <div
            className="mt-0.5 text-[11px] text-white/75 md:text-[12px]"
            style={{ textShadow: TEXT_SHADOW_SECONDARY }}
          >
            {scene.lyricSub}
          </div>
        </div>

        {/* Bilingual Cinema Subtitles Unfolding Along Exact Chip Baselines */}
        <div
          className="hero-cinema-sub-pair"
          style={{ opacity: showDragVeil ? 0 : 1 }}
          aria-hidden="true"
        >
          <div
            className={`hero-cinema-sub-line text-[17px] md:text-[21px] hero-sub-font--${activeSubFont}`}
            style={{ color: subPrimaryColor, textShadow: TEXT_SHADOW_PRIMARY }}
          >
            {scene.zh}
          </div>
          <div
            className="hero-cinema-sub-line hero-cinema-sub-line--secondary mt-1 text-[12px] font-medium md:text-[13.5px]"
            style={{ color: subSecondaryColor, textShadow: TEXT_SHADOW_SECONDARY }}
          >
            {subSecondaryText}
          </div>
        </div>

        {/* Bottom-Edge Optical Glint on Screen Entry */}
        <div className="hero-intake-slit-glow" aria-hidden="true" />

        {/* Drag-Over Veil */}
        <div
          className="hero-drop-veil pointer-events-none absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[4px]"
          style={{
            background: 'rgba(18, 16, 14, 0.62)',
            opacity: showDragVeil ? 1 : 0,
          }}
        >
          <span className="absolute top-3 left-3 h-3.5 w-3.5 border-t-2 border-l-2" style={{ borderColor: 'var(--accent)' }} />
          <span className="absolute top-3 right-3 h-3.5 w-3.5 border-t-2 border-r-2" style={{ borderColor: 'var(--accent)' }} />
          <span className="absolute bottom-3 left-3 h-3.5 w-3.5 border-b-2 border-l-2" style={{ borderColor: 'var(--accent)' }} />
          <span className="absolute right-3 bottom-3 h-3.5 w-3.5 border-r-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          <span
            className="rounded-full border px-6 py-2.5 text-base font-semibold tracking-widest text-[#FFF8F1]"
            style={{
              background: 'rgba(18, 16, 14, 0.72)',
              borderColor: 'rgba(255, 255, 255, 0.24)',
            }}
          >
            {isDragging ? '松手放入' : ''}
          </span>
        </div>
      </div>

      {/* Compact Stacked File Chips Emerging From Behind Split CTA -> Subtitle Baselines */}
      <div
        className="hero-flight-layer"
        style={{ opacity: showDragVeil ? 0 : 1 }}
        aria-hidden="true"
      >
        <div className="hero-file-chip hero-file-chip--upper">
          <div className="hero-chip-fold" />
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="inline-block h-[14px] w-[14px] shrink-0 hero-chip-icon">
              <FileFormatGlyph format={scene.leftFmt} size="sm" withCode={false} />
            </span>
            <span className="truncate font-mono text-[11.5px] font-medium">{scene.leftName}</span>
          </div>
          <span className={`hero-chip-lang-badge shrink-0 ${scene.leftMono ? 'font-mono' : ''}`}>
            {scene.leftLang}
          </span>
        </div>

        <div className="hero-file-chip hero-file-chip--lower">
          <div className="hero-chip-fold" />
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="inline-block h-[14px] w-[14px] shrink-0 hero-chip-icon">
              <FileFormatGlyph format={scene.rightFmt} size="sm" withCode={false} />
            </span>
            <span className="truncate font-mono text-[11.5px] font-medium">{scene.rightName}</span>
          </div>
          <span className={`hero-chip-lang-badge shrink-0 ${scene.rightMono ? 'font-mono' : ''}`}>
            {scene.rightLang}
          </span>
        </div>
      </div>

      {/* Supported Formats Pouring Layer Across 46px Runway */}
      <div className={`hero-pour-layer ${isPrelude ? 'is-prelude' : ''}`} aria-hidden="true">
        <div className="hero-pour-anchor">
          {HOVER_POUR_TOKENS.map((token) => (
            <span
              key={token.fmt}
              className="hero-pour-token hero-pour-token--hover"
              style={
                {
                  left: token.left,
                  '--tilt': token.tilt,
                  '--delay': token.delay,
                } as React.CSSProperties
              }
            >
              <FileFormatGlyph format={token.fmt} size="md" withCode />
            </span>
          ))}
          <span
            className="hero-pour-token hero-pour-token--prelude"
            style={{ left: 54, '--tilt': '-8deg', '--delay': '0ms' } as React.CSSProperties}
          >
            <FileFormatGlyph format={scene.leftFmt} size="md" withCode />
          </span>
          <span
            className="hero-pour-token hero-pour-token--prelude"
            style={{ left: 96, '--tilt': '7deg', '--delay': '90ms' } as React.CSSProperties}
          >
            <FileFormatGlyph format={scene.rightFmt} size="md" withCode />
          </span>
        </div>
      </div>

      {/* Centered Unified Split Primary CTA With 46px Pouring Runway Above */}
      <div className="relative z-20 mt-[46px] flex w-full flex-col items-center gap-3">
        <div
          className={`hero-split-cta transition-opacity ${showDragVeil ? 'pointer-events-none opacity-45' : ''}`}
          role="group"
          aria-label="从本机导入"
        >
          <button
            type="button"
            data-testid="ingest-import-cta"
            data-ingest-add-cta
            onClick={onPickFiles}
            onMouseEnter={() => setIsPouring(true)}
            onMouseLeave={() => setIsPouring(false)}
            onFocus={() => setIsPouring(true)}
            onBlur={() => setIsPouring(false)}
            className={`hero-split-cta-primary ${isFeeding ? 'is-feeding' : ''}`}
          >
            <span className="hero-btn-hopper" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <g className="hero-hopper-drop">
                  <path
                    d="M5.75 2.5H10.25L12.5 4.75V10.5C12.5 11.05 12.05 11.5 11.5 11.5H6.5C5.95 11.5 5.5 11.05 5.5 10.5V2.75C5.5 2.61 5.61 2.5 5.75 2.5Z"
                    fill="rgba(255,248,241,0.92)"
                  />
                  <path d="M10.25 2.5V4.75H12.5" stroke="var(--accent)" strokeWidth="1" />
                </g>
                <path
                  d="M3 12.5V14.75C3 15.16 3.34 15.5 3.75 15.5H14.25C14.66 15.5 15 15.16 15 14.75V12.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>导入字幕</span>
          </button>

          <button
            type="button"
            data-ingest-add-cta
            onClick={onPickFolder}
            aria-disabled={!folderPickSupported || undefined}
            title={folderPickSupported ? '选择整季字幕文件夹' : folderUnsupportedHint}
            aria-label={folderPickSupported ? '选择整季字幕文件夹' : folderUnsupportedHint}
            className="hero-split-cta-secondary"
          >
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center" aria-hidden="true">
              <FileFormatGlyph format="folder" size="sm" interactive onDark />
            </span>
            <span>文件夹</span>
          </button>
        </div>

        <p className="m-0 text-center text-[13px] font-medium text-[var(--ink-muted)]">
          {tapFirst
            ? '支持点按导入 SRT / ASS 字幕或压缩包 · 全程本机处理，不上传服务器'
            : '支持拖放 SRT / ASS / ZIP / RAR / 7z 或整季文件夹至此 · 全程本机处理，不上传服务器'}
        </p>
      </div>
    </div>
  );
};
