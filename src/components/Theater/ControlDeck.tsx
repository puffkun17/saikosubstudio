'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { Captions, Image as ImageIcon, Ratio, Shuffle } from 'lucide-react';
import type { StyleSettings } from '@/utils/subtitleCore';

type Preset = {
  id: string;
  name: string;
  desc: string;
  styles: Partial<StyleSettings>;
};

const PRESETS: Preset[] = [
  { id: 'netflix', name: 'Netflix', desc: '轻阴影', styles: { zhFontSize: 22, enFontSize: 13, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#000000', marginV: 25 } },
  { id: 'classic', name: '大银幕', desc: '黄白配', styles: { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', marginV: 20 } },
  { id: 'anime', name: '动漫', desc: '深描边', styles: { zhFontSize: 24, enFontSize: 14, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#6D4438', marginV: 30 } },
];

const ASPECT_RATIOS = [
  { id: '4:3', label: '4:3', description: '标准画幅' },
  { id: '16:9', label: '16:9', description: '宽屏' },
  { id: '2.39:1', label: '2.39:1', description: '宽银幕' },
  { id: '1.9:1', label: 'IMAX', description: '沉浸画幅' },
];

interface SegmentGroupProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}

const SegmentGroup = ({ label, icon, children, trailing }: SegmentGroupProps) => (
  <section className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:px-4">
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-accent-strong)]">
          {icon}
        </span>
        <p className="text-xs font-semibold tracking-wide text-[var(--v4-text-muted)]">{label}</p>
      </div>
      {trailing}
    </div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </section>
);

interface SegmentProps {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}

const Segment = ({ active, label, hint, onClick, disabled = false }: SegmentProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={hint}
    aria-pressed={active}
    className={`v4-focus-ring inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-40
      ${active
        ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)] ring-1 ring-[var(--v4-accent)]/35'
        : 'bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]'}`}
  >
    {label}
  </button>
);

export const ControlDeck: React.FC = () => {
  const {
    theaterAspect,
    setTheaterAspect,
    activePreset,
    setActivePreset,
    customStyle,
    setCustomStyle,
    tmdbBackdrop,
    tmdbBackdropList,
    setTmdbBackdrop,
    shuffleBackdrop,
  } = useStudioStore(useShallow((state) => ({
    theaterAspect: state.theaterAspect,
    setTheaterAspect: state.setTheaterAspect,
    activePreset: state.activePreset,
    setActivePreset: state.setActivePreset,
    customStyle: state.customStyle,
    setCustomStyle: state.setCustomStyle,
    tmdbBackdrop: state.tmdbBackdrop,
    tmdbBackdropList: state.tmdbBackdropList,
    setTmdbBackdrop: state.setTmdbBackdrop,
    shuffleBackdrop: state.shuffleBackdrop,
  })));

  // 持久化统一走 store 的 persistStyles（setActivePreset / setCustomStyle 内部落盘），
  // 不再在此直接写 localStorage —— 旧实现曾把用户自定义模板整表清空。
  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    setCustomStyle({ ...customStyle, ...preset.styles });
  };

  const hasBackdropPool = tmdbBackdropList.length > 0;
  const canShuffleBackdrop = tmdbBackdropList.length > 1;

  return (
    <div className="v4-panel-muted grid w-full divide-y divide-[var(--v4-line)] overflow-hidden rounded-lg lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      <SegmentGroup
        label="画幅比例"
        icon={<Ratio className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />}
      >
        {ASPECT_RATIOS.map((item) => (
          <Segment
            key={item.id}
            active={theaterAspect === item.id}
            label={item.label}
            hint={item.description}
            onClick={() => setTheaterAspect(item.id)}
          />
        ))}
      </SegmentGroup>

      <SegmentGroup
        label="预览画面"
        icon={<ImageIcon className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />}
        trailing={
          canShuffleBackdrop && tmdbBackdrop ? (
            <button
              type="button"
              onClick={shuffleBackdrop}
              className="v4-focus-ring inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-accent-strong)]"
              title="换一张剧照"
              aria-label="换一张剧照"
            >
              <Shuffle className="h-3 w-3" aria-hidden="true" />
              换一张
            </button>
          ) : null
        }
      >
        <Segment
          active={!tmdbBackdrop}
          label="默认背景"
          hint="默认影院画面"
          onClick={() => setTmdbBackdrop(null)}
        />
        <Segment
          active={Boolean(tmdbBackdrop)}
          label="影片剧照"
          hint={hasBackdropPool ? '使用匹配影片的剧照' : '匹配影片后可用'}
          onClick={() => {
            if (!hasBackdropPool) return;
            if (!tmdbBackdrop) setTmdbBackdrop(tmdbBackdropList[0]);
          }}
          disabled={!hasBackdropPool}
        />
        {hasBackdropPool && (
          <span className="self-center text-[11px] font-medium text-[var(--v4-text-faint)]">
            {tmdbBackdropList.length} 张
          </span>
        )}
      </SegmentGroup>

      <SegmentGroup
        label="字幕预设"
        icon={<Captions className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />}
      >
        {PRESETS.map((preset) => (
          <Segment
            key={preset.id}
            active={activePreset === preset.id}
            label={preset.name}
            hint={preset.desc}
            onClick={() => applyPreset(preset)}
          />
        ))}
      </SegmentGroup>
    </div>
  );
};
