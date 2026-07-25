'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Clapperboard,
  Image as ImageIcon,
  ImageOff,
  Maximize2,
  RectangleHorizontal,
  Sparkles,
  Square,
  StretchHorizontal,
  Shuffle,
  Tv,
} from 'lucide-react';
import type { StyleSettings } from '@/utils/subtitleCore';

type Preset = {
  id: string;
  name: string;
  desc: string;
  styles: Partial<StyleSettings>;
  icon: React.ReactNode;
};

const PRESETS: Preset[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    desc: '轻阴影',
    styles: { zhFontSize: 22, enFontSize: 13, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#000000', marginV: 25 },
    icon: <Tv className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />,
  },
  {
    id: 'classic',
    name: '大银幕',
    desc: '黄白配',
    styles: { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', marginV: 20 },
    icon: <Clapperboard className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />,
  },
  {
    id: 'anime',
    name: '动漫',
    desc: '深描边',
    styles: { zhFontSize: 24, enFontSize: 14, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#6D4438', marginV: 30 },
    icon: <Sparkles className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />,
  },
];

const ASPECT_RATIOS = [
  { id: '4:3', label: '4:3', description: '标准画幅', icon: <Square className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" /> },
  { id: '16:9', label: '16:9', description: '宽屏', icon: <RectangleHorizontal className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" /> },
  { id: '2.39:1', label: '2.39:1', description: '宽银幕', icon: <StretchHorizontal className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" /> },
  { id: '1.9:1', label: 'IMAX', description: '沉浸画幅', icon: <Maximize2 className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" /> },
];

const IconChip = ({
  active,
  label,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`theater-chrome-chip v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors disabled:cursor-default disabled:opacity-35
      ${active
        ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
        : 'border-[var(--v4-line)] text-[var(--v4-text-muted)] hover:text-[var(--v4-text)]'}`}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-[var(--v4-line)] sm:block" aria-hidden="true" />
);

/** 放映厅播放条内嵌的图标工具组（画幅 / 画面 / 预设）。 */
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

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    setCustomStyle({ ...customStyle, ...preset.styles });
  };

  const hasBackdropPool = tmdbBackdropList.length > 0;
  const canShuffleBackdrop = tmdbBackdropList.length > 1;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {ASPECT_RATIOS.map((item) => (
        <IconChip
          key={item.id}
          active={theaterAspect === item.id}
          label={`画幅 ${item.label} · ${item.description}`}
          onClick={() => setTheaterAspect(item.id)}
        >
          {item.icon}
        </IconChip>
      ))}

      <Divider />

      <IconChip
        active={!tmdbBackdrop}
        label="默认背景"
        onClick={() => setTmdbBackdrop(null)}
      >
        <ImageOff className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />
      </IconChip>
      <IconChip
        active={Boolean(tmdbBackdrop)}
        label={hasBackdropPool ? `影片剧照（${tmdbBackdropList.length} 张）` : '匹配影片后可用剧照'}
        onClick={() => {
          if (!hasBackdropPool) return;
          if (!tmdbBackdrop) setTmdbBackdrop(tmdbBackdropList[0]);
        }}
        disabled={!hasBackdropPool}
      >
        <ImageIcon className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />
      </IconChip>
      {canShuffleBackdrop && tmdbBackdrop ? (
        <IconChip
          active={false}
          label="换一张剧照"
          onClick={shuffleBackdrop}
        >
          <Shuffle className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />
        </IconChip>
      ) : null}

      <Divider />

      {PRESETS.map((preset) => (
        <IconChip
          key={preset.id}
          active={activePreset === preset.id}
          label={`${preset.name} · ${preset.desc}`}
          onClick={() => applyPreset(preset)}
        >
          {preset.icon}
        </IconChip>
      ))}
    </div>
  );
};
