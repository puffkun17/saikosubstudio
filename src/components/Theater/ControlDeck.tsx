'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import {
  Check,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  ImageOff,
  LampCeiling,
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
    icon: <Tv className="h-4 w-4 stroke-[2]" aria-hidden="true" />,
  },
  {
    id: 'classic',
    name: '大银幕',
    desc: '黄白配',
    styles: { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', marginV: 20 },
    icon: <Clapperboard className="h-4 w-4 stroke-[2]" aria-hidden="true" />,
  },
  {
    id: 'anime',
    name: '动漫',
    desc: '深描边',
    styles: { zhFontSize: 24, enFontSize: 14, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#6D4438', marginV: 30 },
    icon: <Sparkles className="h-4 w-4 stroke-[2]" aria-hidden="true" />,
  },
];

const ASPECT_RATIOS = [
  { id: '4:3', label: '4:3', description: '标准画幅', icon: <Square className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '16:9', label: '16:9', description: '宽屏', icon: <RectangleHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '2.39:1', label: '2.39:1', description: '宽银幕', icon: <StretchHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
  { id: '1.9:1', label: 'IMAX', description: '沉浸画幅', icon: <Maximize2 className="h-4 w-4 stroke-[2]" aria-hidden="true" /> },
];

type HeaderMenuProps = {
  label: string;
  icon: React.ReactNode;
  menuLabel: string;
  children: (close: () => void) => React.ReactNode;
};

/** 顶部栏带中文标签的下拉：菜单走 Portal，避免被样式壳裁切。 */
const TheaterHeaderMenu: React.FC<HeaderMenuProps> = ({ label, icon, menuLabel, children }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(16 * 16, window.innerWidth - 32);
      const left = Math.min(
        window.innerWidth - width - 16,
        Math.max(16, rect.right - width),
      );
      setMenuPos({
        top: rect.bottom + 8,
        left,
        width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="ui-action ui-action--secondary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {icon}
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && menuPos && (
        <OverlayPortal>
          <div
            ref={menuRef}
            role="menu"
            aria-label={menuLabel}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className="theater-style-shell dropdown-pop z-[var(--z-dropdown)] overflow-hidden rounded-lg"
          >
            {children(close)}
          </div>
        </OverlayPortal>
      )}
    </div>
  );
};

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
    role="menuitem"
    disabled={disabled}
    aria-current={active ? 'true' : undefined}
    className={`v4-focus-ring flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-40
      ${active ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]'}`}
    onClick={onClick}
  >
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center opacity-90" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold leading-5">{title}</span>
      {description ? (
        <span className="mt-0.5 block text-xs leading-4 text-[var(--v4-text-faint)]">{description}</span>
      ) : null}
    </span>
    {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <span className="w-4 shrink-0" aria-hidden="true" />}
  </button>
);

/**
 * 放映厅顶部系统控件：画幅 / 剧照 / 模版 / 关灯。
 * 原底栏图标堆已迁到这里，并补上中文标签。
 */
export const TheaterSystemChrome: React.FC = () => {
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
    isLightsOff,
    setLightsOff,
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
    isLightsOff: state.isLightsOff,
    setLightsOff: state.setLightsOff,
  })));

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    setCustomStyle({ ...customStyle, ...preset.styles });
  };

  const hasBackdropPool = tmdbBackdropList.length > 0;
  const canShuffleBackdrop = tmdbBackdropList.length > 1;
  const activeAspect = ASPECT_RATIOS.find((item) => item.id === theaterAspect) ?? ASPECT_RATIOS[2];
  const activePresetMeta = PRESETS.find((preset) => preset.id === activePreset);

  return (
    <div className="theater-system-chrome flex flex-wrap items-center gap-2">
      <TheaterHeaderMenu
        label="切换比例"
        menuLabel="切换预览比例"
        icon={activeAspect.icon}
      >
        {(close) => (
          <div className="p-1.5">
            {ASPECT_RATIOS.map((item) => (
              <MenuItem
                key={item.id}
                active={theaterAspect === item.id}
                icon={item.icon}
                title={item.label}
                description={item.description}
                onClick={() => {
                  setTheaterAspect(item.id);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </TheaterHeaderMenu>

      <TheaterHeaderMenu
        label="更换预览剧照"
        menuLabel="更换预览剧照"
        icon={tmdbBackdrop
          ? <ImageIcon className="h-4 w-4 stroke-[2]" aria-hidden="true" />
          : <ImageOff className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
      >
        {(close) => (
          <div className="p-1.5">
            <MenuItem
              active={!tmdbBackdrop}
              icon={<ImageOff className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
              title="默认背景"
              description="影院默认画面"
              onClick={() => {
                setTmdbBackdrop(null);
                close();
              }}
            />
            <MenuItem
              active={Boolean(tmdbBackdrop)}
              disabled={!hasBackdropPool}
              icon={<ImageIcon className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
              title={hasBackdropPool ? `影片剧照（${tmdbBackdropList.length} 张）` : '影片剧照'}
              description={hasBackdropPool ? '使用匹配影片的剧照' : '匹配影片后可用'}
              onClick={() => {
                if (!hasBackdropPool) return;
                if (!tmdbBackdrop) setTmdbBackdrop(tmdbBackdropList[0]);
                close();
              }}
            />
            {canShuffleBackdrop ? (
              <MenuItem
                icon={<Shuffle className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
                title="换一张剧照"
                description={tmdbBackdrop ? '从剧照池随机更换' : '先启用影片剧照'}
                disabled={!tmdbBackdrop}
                onClick={() => {
                  if (!tmdbBackdrop) return;
                  shuffleBackdrop();
                  close();
                }}
              />
            ) : null}
          </div>
        )}
      </TheaterHeaderMenu>

      <TheaterHeaderMenu
        label="快速套用模版"
        menuLabel="快速套用模版"
        icon={activePresetMeta?.icon ?? <Sparkles className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
      >
        {(close) => (
          <div className="p-1.5">
            {PRESETS.map((preset) => (
              <MenuItem
                key={preset.id}
                active={activePreset === preset.id}
                icon={preset.icon}
                title={preset.name}
                description={preset.desc}
                onClick={() => {
                  applyPreset(preset);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </TheaterHeaderMenu>

      <button
        type="button"
        onClick={() => setLightsOff(!isLightsOff)}
        aria-pressed={isLightsOff}
        title="关灯观影（L）· 推荐：沉浸核对字幕"
        aria-label={isLightsOff ? '开灯' : '关灯观影'}
        className={`theater-lights-action v4-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3.5 py-2 text-sm font-bold tracking-wide transition-[color,background,border-color,box-shadow,filter] duration-200
          ${isLightsOff ? 'theater-lights-action--on' : ''}`}
      >
        <LampCeiling className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
        {isLightsOff ? '开灯' : '关灯'}
      </button>
    </div>
  );
};

/** @deprecated 底栏工具已迁到 TheaterSystemChrome；保留别名避免旧引用断裂。 */
export const ControlDeck = TheaterSystemChrome;
