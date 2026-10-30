'use client';

import { classifyLineKind } from '@/core/lineKinds';
import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { type StyleSettings } from '@/utils/subtitleCore';
import { StyleLibrary, useSelectedStyleEntry } from '@/components/Settings/StyleLibrary';
import { RotateCcw, ALargeSmall, ChevronDown, ChevronUp, FileType, Pipette, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InfoHint } from '@/components/ui/InfoHint';
import { ColorSampler } from '@/components/Settings/ColorSampler';
import { resolveEffectiveStyle } from '@/utils/previewStyle';
import { EXPORT_PRESETS } from '@/utils/exportPresets';

const PRESET_COLORS = ['#FFFFFF', '#E0E0E0', '#B0B0B0', '#9CAFB8', '#A8B7A3', '#B9A7B5', '#C0A89A', '#7F8C8D', '#000000'];

const FONT_FAMILIES_ZH = [
  { value: 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif', label: '系统 / 苹方' },
  { value: '"PingFang SC", "Noto Sans SC", sans-serif', label: '苹方 SC' },
  { value: '"Noto Sans SC", "Source Han Sans CN", sans-serif', label: '思源黑体' },
  { value: 'system-ui, sans-serif', label: '系统默认' },
];

const FONT_FAMILIES_EN = [
  { value: 'Helvetica Neue, Arial, "Inter", sans-serif', label: 'Helvetica Neue' },
  { value: 'Inter, Arial, sans-serif', label: 'Inter' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'system-ui, sans-serif', label: '系统默认' },
];

type FontFamilyOption = {
  value: string;
  label: string;
};

const FontFamilySelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: FontFamilyOption[];
  onChange: (v: string) => void
}) => (
  <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-[var(--ds-gap-group)]">
    <span className="text-sm text-[var(--v4-text-muted)] font-medium">{label}</span>
    <select
      className="h-[var(--ds-ctl-h)] min-w-0 w-full rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-[var(--ds-ctl-px)] text-left text-sm text-[var(--v4-text)] outline-none transition-all focus:border-[var(--v4-accent)] focus:bg-[var(--v4-panel-raised)] cursor-pointer"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const ColorPicker = ({
  label,
  value,
  isOpen,
  onToggle,
  onChange
}: {
  label: string,
  value: string,
  isOpen: boolean,
  onToggle: () => void,
  onChange: (val: string) => void
}) => {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        className="flex w-full items-center justify-between cursor-pointer select-none group"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-sm text-[var(--v4-text-muted)] font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium text-[var(--v4-text-muted)] tabular-nums">{value}</span>
          <div
            className="w-5 h-5 rounded-full border border-[var(--v4-line-strong)] shadow-sm relative transition-all duration-200 group-hover:scale-105"
            style={{ backgroundColor: value }}
          >
            {isOpen && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--v4-text)]/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-[var(--v4-accent-ink)] rounded-full" />
              </div>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 8 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--v4-line)]">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`h-5 w-5 rounded-full border transition-all cursor-pointer ${value === c ? 'border-[var(--v4-accent-strong)] ring-1 ring-[var(--accent-line)] scale-105' : 'border-[var(--v4-line)] hover:border-[var(--v4-line-strong)] hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div
                className="relative h-5 w-5 rounded-full overflow-hidden border border-[var(--v4-line)] hover:border-[var(--v4-line-strong)] hover:scale-105 shrink-0 cursor-pointer transition-all"
                title="自定义颜色"
              >
                <div className="absolute inset-0 bg-[conic-gradient(red,yellow,green,cyan,blue,magenta,red)] opacity-80" />
                <input
                  type="color"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 m-0"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingSection = ({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) => (
  <section className="ds-style-section border-t border-[var(--v4-line)] pt-[var(--ds-pad-card)] first:border-t-0 first:pt-0">
    <div className="flex min-h-8 items-center justify-between gap-[var(--ds-gap-group)] mb-[var(--ds-gap-group)]">
      <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--v4-text)] tracking-tight">
        {icon}
        {title}
      </h4>
      {action}
    </div>
    <div className="flex flex-col gap-[var(--ds-gap-group)]">{children}</div>
  </section>
);

const SliderControl = ({
  label,
  value,
  min,
  max,
  step,
  suffix,
  hint,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint?: string;
  onChange: (value: number) => void;
}) => (
  <div className="ds-slider">
    <div className="ds-slider__head select-none">
      <span>{label}</span>
      <span className="ds-slider__value">
        {suffix === 'x' ? value.toFixed(2) : value}{suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="ds-slider__track glass-slider-input"
      aria-label={label}
    />
    {hint && <div className="ds-slider__hint">{hint}</div>}
  </div>
);

type StyleSidebarTone = 'cream' | 'theater';

export const StyleSidebar: React.FC<{ tone?: StyleSidebarTone; embedded?: boolean }> = ({ tone = 'cream', embedded = false }) => {
  const {
    processedSubs,
    customStyle: baseStyle,
    setCustomStyle,
    exportPresetId,
    styleOverrides,
    setStyleOverrides,
    activePreset,
    customTemplates,
    foundAssStyle,
    applyStyleEntry,
    triggerTempGuides,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customStyle: state.customStyle,
    setCustomStyle: state.setCustomStyle,
    exportPresetId: state.exportPresetId,
    styleOverrides: state.styleOverrides,
    setStyleOverrides: state.setStyleOverrides,
    activePreset: state.activePreset,
    customTemplates: state.customTemplates,
    foundAssStyle: state.foundAssStyle,
    applyStyleEntry: state.applyStyleEntry,
    triggerTempGuides: state.triggerTempGuides,
  })));
  const { entry: selectedEntry, tuned } = useSelectedStyleEntry(customTemplates, foundAssStyle, activePreset, baseStyle, exportPresetId, styleOverrides);
  const selectedId = selectedEntry?.id ?? 'classic';
  const selectedName = selectedEntry?.name ?? '自定义';
  // 面板显示与编辑的都是“实际生效样式”（侧栏样式 → 导出预设 → 用户微调），与预览、导出同源。
  const customStyle = React.useMemo(
    () => resolveEffectiveStyle(baseStyle, exportPresetId, styleOverrides),
    [baseStyle, exportPresetId, styleOverrides],
  );
  const presetLocksStyle = Boolean(EXPORT_PRESETS[exportPresetId]?.style);
  /** Write a style patch into the one shared state. Fixed presets keep their profile; edits layer on top. */
  const commitStyle = (patch: Partial<StyleSettings>) => {
    if (presetLocksStyle) setStyleOverrides(patch);
    else setCustomStyle({ ...baseStyle, ...patch });
  };

  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);

  const hasCredit = Boolean(processedSubs?.some((sub) => classifyLineKind(sub) === 'credit'));
  const hasLyrics = processedSubs?.some(sub => {
    if (!sub.text) return false;
    return /[♪♫♬♩🎵🎶]/.test(sub.text);
  });
  const handleStyleChange = <K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) => {
    commitStyle({ [key]: value } as Partial<StyleSettings>);
  };

  return (
    <div
      data-paper={tone === 'theater' ? undefined : 'sheet'}
      className={
        tone === 'theater'
          ? `theater-style-drawer flex h-full w-full flex-col overflow-y-auto text-left text-[var(--v4-text)] scrollbar-thin ${embedded ? 'p-[var(--ds-pad-card)]' : 'p-[var(--ds-pad-card)]'}`
          : `flex h-full w-full flex-col overflow-y-auto text-left text-[var(--v4-text)] scrollbar-thin ${embedded ? 'p-[var(--ds-pad-card)]' : 'bg-[var(--paper-desk)] p-[var(--ds-pad-card)]'}`
      }
    >
      <StyleLibrary />

      <div className="mt-[var(--ds-gap-section)] flex flex-1 flex-col gap-[var(--ds-pad-card)] border-t border-[var(--v4-line)] pt-[var(--ds-pad-card)]">
        <div className="flex min-h-8 items-center justify-between gap-[var(--ds-gap-group)]">
          <h4 className="ds-label">微调</h4>
          {tuned ? (
            <button type="button" className="ui-action ui-action--quiet min-h-8 px-[var(--ds-ctl-px-sm)] text-xs" onClick={() => applyStyleEntry(selectedId)} data-testid="style-reset">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              重置为「{selectedName}」
            </button>
          ) : (
            <span className="ds-meta">基于「{selectedName}」</span>
          )}
        </div>
        {(
          <>
        <SettingSection
          title="文字尺寸"
          icon={<ALargeSmall className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />}
          action={
            <InfoHint label="尺寸单位说明" side="left">
              字幕参考数值单位（以 288 高度画幅为基准），导出时规格自动换算为预览最终比例呈现。
            </InfoHint>
          }
        >
          <SliderControl
            label="整体缩放"
            value={customStyle.globalScale ?? 1}
            min={0.6}
            max={1.8}
            step={0.05}
            suffix="x"
            hint="按比例缩放全部字幕"
            onChange={value => handleStyleChange('globalScale', value)}
          />
          <SliderControl
            label="主字幕"
            value={customStyle.zhFontSize}
            min={12}
            max={36}
            suffix=""
            onChange={value => handleStyleChange('zhFontSize', value)}
          />
          <SliderControl
            label="副字幕"
            value={customStyle.enFontSize}
            min={8}
            max={24}
            suffix=""
            onChange={value => handleStyleChange('enFontSize', value)}
          />
          <SliderControl
            label="底部距离"
            value={customStyle.marginV}
            min={10}
            max={60}
            suffix=""
            onChange={value => {
              handleStyleChange('marginV', value);
              triggerTempGuides();
            }}
          />
        </SettingSection>

        <SettingSection title="字体" icon={<FileType className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />}>
          <FontFamilySelect
            label="主字幕"
            value={customStyle.zhFontFamily || FONT_FAMILIES_ZH[0].value}
            options={FONT_FAMILIES_ZH}
            onChange={(v) => handleStyleChange('zhFontFamily', v)}
          />
          <FontFamilySelect
            label="副字幕"
            value={customStyle.enFontFamily || FONT_FAMILIES_EN[0].value}
            options={FONT_FAMILIES_EN}
            onChange={(v) => handleStyleChange('enFontFamily', v)}
          />
        </SettingSection>

        <SettingSection title="颜色" icon={<Pipette className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />}>
          <ColorPicker
            label="主字幕文字"
            value={customStyle.zhColor}
            isOpen={openPicker === 'zhColor'}
            onToggle={() => setOpenPicker(openPicker === 'zhColor' ? null : 'zhColor')}
            onChange={(c) => handleStyleChange('zhColor', c)}
          />
          <ColorPicker
            label="主字幕描边"
            value={customStyle.zhOutline}
            isOpen={openPicker === 'zhOutline'}
            onToggle={() => setOpenPicker(openPicker === 'zhOutline' ? null : 'zhOutline')}
            onChange={(c) => handleStyleChange('zhOutline', c)}
          />
          <ColorPicker
            label="副字幕文字"
            value={customStyle.enColor}
            isOpen={openPicker === 'enColor'}
            onToggle={() => setOpenPicker(openPicker === 'enColor' ? null : 'enColor')}
            onChange={(c) => handleStyleChange('enColor', c)}
          />
          <ColorPicker
            label="副字幕描边"
            value={customStyle.enOutline || '#000000'}
            isOpen={openPicker === 'enOutline'}
            onToggle={() => setOpenPicker(openPicker === 'enOutline' ? null : 'enOutline')}
            onChange={(c) => handleStyleChange('enOutline', c)}
          />
          <ColorSampler />
        </SettingSection>
          </>
        )}

        {(
          <>
        {/* 输出规格（画面规格）不再单独暴露：由所选样式决定。 */}

        {hasCredit && (
          <SettingSection title="署名" icon={<Star className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />}>
            <div className="flex flex-col gap-[var(--ds-gap-item)]">
              <span className="text-sm font-medium text-[var(--v4-text-muted)]">画面位置</span>
              <div className="ui-choice-group w-full" role="radiogroup" aria-label="署名画面位置">
                {([['center', '居中'], ['bottom', '底部'], ['top', '顶部']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={(customStyle.creditPosition ?? 'center') === id}
                    className={`ui-choice flex-1 ${(customStyle.creditPosition ?? 'center') === id ? 'ui-choice--on' : ''}`}
                    onClick={() => handleStyleChange('creditPosition', id)}
                    data-credit-pos={id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="ds-meta">只改位置；署名时间点保持原样。</p>
            </div>
          </SettingSection>
        )}

        {hasLyrics && (
          <SettingSection
            title="歌词"
            action={
              <button
                type="button"
                className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-1 text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)] cursor-pointer"
                onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
              >
                {isLyricsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            }
          >
            <AnimatePresence initial={false}>
              {isLyricsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 pt-1">
                    <SliderControl
                      label="歌词字号"
                      value={customStyle.lyricFontSize ?? 16}
                      min={10}
                      max={30}
                      suffix=""
                      onChange={value => handleStyleChange('lyricFontSize', value)}
                    />
                    <ColorPicker
                      label="歌词颜色"
                      value={customStyle.lyricColor ?? '#E6E6FA'}
                      isOpen={openPicker === 'lyricColor'}
                      onToggle={() => setOpenPicker(openPicker === 'lyricColor' ? null : 'lyricColor')}
                      onChange={(c) => handleStyleChange('lyricColor', c)}
                    />
                    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-[var(--ds-gap-group)]">
                      <span className="text-sm font-medium text-[var(--v4-text-muted)]">位置</span>
                      <select
                        className="h-[var(--ds-ctl-h)] w-full min-w-0 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-[var(--ds-ctl-px)] text-left text-sm text-[var(--v4-text)] outline-none transition-all focus:border-[var(--v4-accent)] focus:bg-[var(--v4-panel-raised)] cursor-pointer"
                        value={customStyle.lyricPosition ?? 'top'}
                        onChange={e => handleStyleChange('lyricPosition', e.target.value as StyleSettings['lyricPosition'])}
                      >
                        <option value="top">顶部</option>
                        <option value="bottom">底部</option>
                      </select>
                    </div>
                    <div className="ui-choice-group" role="group" aria-label="斜体歌词">
                      <button
                        type="button"
                        className={`ui-choice ${(customStyle.lyricItalic ?? true) ? 'ui-choice--on' : ''}`}
                        aria-pressed={customStyle.lyricItalic ?? true}
                        onClick={() => handleStyleChange('lyricItalic', !(customStyle.lyricItalic ?? true))}
                      >
                        斜体歌词
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SettingSection>
        )}
          </>
        )}
      </div>
    </div>
  );
};
