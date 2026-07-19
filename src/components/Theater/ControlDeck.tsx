'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Captions, ChevronLeft, ChevronRight, Image as ImageIcon, Ratio } from 'lucide-react';
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

const cycleIndex = (current: number, direction: -1 | 1, total: number) => (current + direction + total) % total;

interface DialControlProps {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}

const DialControl = ({ label, value, description, icon, onPrevious, onNext, disabled = false }: DialControlProps) => (
  <section className="flex min-w-[220px] items-center gap-3 px-4 py-3">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-accent-strong)]">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-[var(--v4-text-faint)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--v4-text)]" title={description}>{value}</p>
    </div>
    {(onPrevious || onNext) && (
      <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--v4-line)] bg-[var(--v4-canvas)]">
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled}
          className="grid h-8 w-8 place-items-center text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] disabled:cursor-default disabled:opacity-35"
          aria-label={`上一项：${label}`}
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="grid h-8 w-8 place-items-center border-l border-[var(--v4-line)] text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] disabled:cursor-default disabled:opacity-35"
          aria-label={`下一项：${label}`}
        >
          <ChevronRight className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
        </button>
      </div>
    )}
  </section>
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
    shuffleBackdrop,
  } = useStudioStore();

  const aspectIndex = Math.max(0, ASPECT_RATIOS.findIndex((item) => item.id === theaterAspect));
  const activeAspect = ASPECT_RATIOS[aspectIndex];
  const presetIndex = Math.max(0, PRESETS.findIndex((item) => item.id === activePreset));
  const activeStylePreset = PRESETS[presetIndex];

  const selectAspect = (direction: -1 | 1) => {
    setTheaterAspect(ASPECT_RATIOS[cycleIndex(aspectIndex, direction, ASPECT_RATIOS.length)].id);
  };

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    const updated = { ...customStyle, ...preset.styles };
    setCustomStyle(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({ preset: preset.id, style: updated, templates: [] }));
    }
  };

  const selectPreset = (direction: -1 | 1) => {
    applyPreset(PRESETS[cycleIndex(presetIndex, direction, PRESETS.length)]);
  };

  return (
    <div className="v4-panel-muted grid w-full divide-y divide-[var(--v4-line)] overflow-hidden rounded-lg sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">
      <DialControl
        label="画幅比例"
        value={activeAspect.label}
        description={activeAspect.description}
        icon={<Ratio className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />}
        onPrevious={() => selectAspect(-1)}
        onNext={() => selectAspect(1)}
      />
      <DialControl
        label="预览画面"
        value={tmdbBackdrop ? '影片剧照' : '默认背景'}
        description={tmdbBackdrop ? '已使用影片剧照' : '未匹配影片时的默认背景'}
        icon={<ImageIcon className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />}
        onPrevious={tmdbBackdropList.length > 1 ? shuffleBackdrop : undefined}
        onNext={tmdbBackdropList.length > 1 ? shuffleBackdrop : undefined}
        disabled={tmdbBackdropList.length <= 1}
      />
      <DialControl
        label="字幕预设"
        value={activeStylePreset.name}
        description={activeStylePreset.desc}
        icon={<Captions className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />}
        onPrevious={() => selectPreset(-1)}
        onNext={() => selectPreset(1)}
      />
    </div>
  );
};
