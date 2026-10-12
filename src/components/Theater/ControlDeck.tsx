'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Check,
  Image as ImageIcon,
  ImageOff,
  Maximize2,
  RectangleHorizontal,
  Sparkles,
  Square,
  StretchHorizontal,
  Shuffle,
} from 'lucide-react';
import { ASS_PRESET_IDS, EXPORT_PRESETS } from '@/utils/exportPresets';
import { HDR_LEVEL_ORDER, HDR_LEVELS_PROVISIONAL } from '@/utils/hdrPresets';

const ASPECT_RATIOS = [
  { id: '4:3', label: '4:3', description: '标准', icon: <Square className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '16:9', label: '16:9', description: '宽屏', icon: <RectangleHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '2.39:1', label: '2.39:1', description: '宽银幕', icon: <StretchHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '1.9:1', label: 'IMAX', description: '1.90:1', icon: <Maximize2 className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
];

export type TheaterDockId = 'aspect' | 'backdrop' | 'preset' | 'style' | 'export';

export const DOCK_TITLES: Record<TheaterDockId, string> = {
  aspect: '画幅',
  backdrop: '剧照',
  preset: '样式预设',
  style: '样式参数',
  export: '导出字幕',
};

/** 工具栏入口：不再弹下拉，统一打开右侧停靠面板（spec v1.1 §6）。 */
export const DockToggle: React.FC<{
  id: TheaterDockId;
  active: TheaterDockId | null;
  onToggle: (id: TheaterDockId) => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}> = ({ id, active, onToggle, icon, label, primary }) => (
  <button
    type="button"
    className={primary || active === id ? 'ui-action' : 'ui-action ui-action--secondary'}
    aria-expanded={active === id}
    aria-controls="theater-dock"
    data-dock={id}
    onClick={() => onToggle(id)}
  >
    {icon}
    <span className="max-sm:sr-only">{label}</span>
  </button>
);

const MenuItem = ({
  active,
  disabled = false,
  onClick,
  icon,
  title,
  description,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description?: string;
}) => (
  <button
    type="button"
    disabled={disabled}
    aria-pressed={active ? true : undefined}
    className={`v4-focus-ring flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-[var(--ds-gap-item)] text-left transition-colors disabled:cursor-default disabled:opacity-40
      ${active ? 'ds-dock__item--active' : ''} ds-dock__item`}
    onClick={onClick}
  >
    <span className="grid h-5 w-5 shrink-0 place-items-center opacity-90" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold leading-5">{title}</span>
      {description ? (
        <span className="mt-0.5 block ds-meta !leading-4">{description}</span>
      ) : null}
    </span>
    {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <span className="w-4 shrink-0" aria-hidden="true" />}
  </button>
);

/**
 * 放映厅顶部系统控件：画幅 / 剧照 / 模版 / 关灯。
 * 原底栏图标堆已迁到这里，并补上中文标签。
 */
export const TheaterSystemChrome: React.FC<{
  dock: TheaterDockId | null;
  onToggle: (id: TheaterDockId) => void;
}> = ({ dock, onToggle }) => {
  const { theaterAspect, tmdbBackdrop } = useStudioStore(useShallow((state) => ({
    theaterAspect: state.theaterAspect,
    tmdbBackdrop: state.tmdbBackdrop,
  })));
  const activeAspect = ASPECT_RATIOS.find((item) => item.id === theaterAspect) ?? ASPECT_RATIOS[1];
  return (
    <div className="theater-system-chrome flex flex-wrap items-center gap-2">
      <DockToggle id="aspect" active={dock} onToggle={onToggle} icon={activeAspect.icon} label="画幅" />
      <DockToggle
        id="backdrop"
        active={dock}
        onToggle={onToggle}
        icon={tmdbBackdrop ? <ImageIcon className="h-4 w-4 stroke-[2]" aria-hidden="true" /> : <ImageOff className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
        label="剧照"
      />
      <DockToggle id="preset" active={dock} onToggle={onToggle} icon={<Sparkles className="h-4 w-4 stroke-[2]" aria-hidden="true" />} label="样式预设" />
    </div>
  );
};

/** 停靠面板内容：画幅 / 剧照 / 样式预设。选中即生效，面板保持打开以便对照画面。 */
export const TheaterDockOptions: React.FC<{ panel: 'aspect' | 'backdrop' | 'preset' }> = ({ panel }) => {
  const {
    theaterAspect, setTheaterAspect, tmdbBackdrop, tmdbBackdropList, setTmdbBackdrop, shuffleBackdrop,
    exportPresetId, setExportPresetId, hdrEnabled, hdrLevel, setHdr,
  } = useStudioStore(useShallow((state) => ({
    theaterAspect: state.theaterAspect,
    setTheaterAspect: state.setTheaterAspect,
    tmdbBackdrop: state.tmdbBackdrop,
    tmdbBackdropList: state.tmdbBackdropList,
    setTmdbBackdrop: state.setTmdbBackdrop,
    shuffleBackdrop: state.shuffleBackdrop,
    exportPresetId: state.exportPresetId,
    setExportPresetId: state.setExportPresetId,
    hdrEnabled: state.hdrEnabled,
    hdrLevel: state.hdrLevel,
    setHdr: state.setHdr,
  })));
  const hasBackdropPool = tmdbBackdropList.length > 0;
  const canShuffleBackdrop = tmdbBackdropList.length > 1;

  if (panel === 'aspect') {
    return (
      <div className="ds-dock__list" role="radiogroup" aria-label="画幅">
        {ASPECT_RATIOS.map((item) => (
          <MenuItem key={item.id} active={theaterAspect === item.id} icon={item.icon} title={item.label} description={item.description} onClick={() => setTheaterAspect(item.id)} />
        ))}
      </div>
    );
  }
  if (panel === 'backdrop') {
    return (
      <div className="ds-dock__list" aria-label="剧照">
        <MenuItem active={!tmdbBackdrop} icon={<ImageOff className="h-4 w-4 stroke-[2]" aria-hidden="true" />} title="默认背景" description="不使用剧照" onClick={() => setTmdbBackdrop(null)} />
        <MenuItem
          active={Boolean(tmdbBackdrop)}
          disabled={!hasBackdropPool}
          icon={<ImageIcon className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
          title={hasBackdropPool ? `影片剧照（${tmdbBackdropList.length} 张）` : '影片剧照'}
          description={hasBackdropPool ? '取自匹配影片' : '需先匹配影片'}
          onClick={() => { if (hasBackdropPool && !tmdbBackdrop) setTmdbBackdrop(tmdbBackdropList[0]); }}
        />
        {canShuffleBackdrop ? (
          <MenuItem
            icon={<Shuffle className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
            title="更换剧照"
            description={tmdbBackdrop ? '随机选取另一张' : '需先启用影片剧照'}
            disabled={!tmdbBackdrop}
            onClick={() => { if (tmdbBackdrop) shuffleBackdrop(); }}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="ds-dock__list" aria-label="样式预设">
      <p className="ds-label ds-dock__group">字幕样式</p>
      {ASS_PRESET_IDS.map((id) => (
        <MenuItem key={id} active={exportPresetId === id} icon={<Sparkles className="h-4 w-4 stroke-[2]" aria-hidden="true" />} title={EXPORT_PRESETS[id].label} onClick={() => setExportPresetId(id)} />
      ))}
      <p className="ds-label ds-dock__group">显示亮度</p>
      <MenuItem active={!hdrEnabled} icon={<span className="text-xs font-semibold">SDR</span>} title="SDR" description="普通屏幕" onClick={() => setHdr(false)} />
      {HDR_LEVEL_ORDER.map((id) => (
        <MenuItem key={id} active={hdrEnabled && hdrLevel === id} icon={<span className="text-xs font-semibold">HDR</span>} title={`HDR · ${HDR_LEVELS_PROVISIONAL[id].label}`} onClick={() => setHdr(true, id)} />
      ))}
    </div>
  );
};
