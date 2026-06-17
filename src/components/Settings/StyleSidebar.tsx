'use client';

import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import type { StyleSettings } from '@/utils/subtitleCore';
import { LayoutGrid, Eye, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoHint } from '@/components/ui/InfoHint';

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
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-sm text-neutral-300 font-medium shrink-0">{label}</span>
    <select
      className="min-w-0 bg-black/25 border border-white/[0.08] focus:border-white/20 rounded-lg text-sm px-2.5 py-2 text-neutral-200 outline-none cursor-pointer transition-all w-40 text-right"
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
    <div className="flex flex-col py-2">
      <div
        className="flex items-center justify-between cursor-pointer select-none group"
        onClick={onToggle}
      >
        <span className="text-sm text-neutral-300 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-500 tabular-nums">{value}</span>
          <div
            className="w-5 h-5 rounded-full border border-white/15 shadow-sm relative transition-all duration-200 group-hover:scale-105"
            style={{ backgroundColor: value }}
          >
            {isOpen && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 8 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.04]">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`h-5 w-5 rounded-full border transition-all cursor-pointer ${value === c ? 'border-[#e5e7eb] shadow-[0_0_8px_rgba(156,163,175,0.35)] scale-105' : 'border-white/[0.10] hover:border-white/25 hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div
                className="relative h-5 w-5 rounded-full overflow-hidden border border-white/[0.10] hover:border-white/25 hover:scale-105 shrink-0 cursor-pointer transition-all"
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
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <div className="flex items-center justify-between gap-3 mb-3">
      <h4 className="text-sm font-semibold text-neutral-100 tracking-tight">{title}</h4>
      {action}
    </div>
    <div className="flex flex-col gap-3">{children}</div>
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
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
      <span>{label}</span>
      <motion.span
        animate={{ scale: [1, 1.035, 1] }}
        key={`${label}-${value}`}
        className="font-mono text-neutral-100 font-semibold text-xs tabular-nums"
      >
        {suffix === 'x' ? value.toFixed(2) : value}{suffix}
      </motion.span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full glass-slider-input"
    />
    {hint && <div className="text-xs text-neutral-500 leading-relaxed">{hint}</div>}
  </div>
);

export const StyleSidebar: React.FC = () => {
  const {
    processedSubs,
    customStyle,
    setCustomStyle,
    activePreset,
    setActivePreset,
    showGuides,
    setShowGuides,
    triggerTempGuides,
    customTemplates,
    saveCustomTemplate,
    deleteCustomTemplate
  } = useStudioStore();

  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);

  const hasLyrics = processedSubs?.some(sub => {
    if (!sub.text) return false;
    return /[♪♫♬♩🎵🎶]/.test(sub.text);
  });


  const handleApplyPreset = (preset: { id: string; styles: Partial<StyleSettings> }) => {
    setActivePreset(preset.id);
    const updated = {
      ...customStyle,
      ...preset.styles
    };
    setCustomStyle(updated);
  };

  const handleRestore = () => {
    setActivePreset('classic');
    const defaultStyle = {
      zhFontSize: 20,
      enFontSize: 12,
      zhColor: '#FFFFFF',
      enColor: '#B0B0B0',
      zhOutline: '#4B5563',
      enOutline: '#000000',
      marginV: 20,
      lyricFontSize: 16,
      lyricColor: '#E6E6FA',
      lyricItalic: true,
      lyricPosition: 'top' as const,
      enScale: 90,
      maxLenZh: 20,
      maxLenEn: 80,
      resolution: '1080p' as const,
      aspectRatio: '16:9' as const,
      globalScale: 1.0,
      // 阅片环境字体协调默认值
      zhFontFamily: 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
      enFontFamily: 'Helvetica Neue, Arial, "Inter", sans-serif'
    };
    setCustomStyle(defaultStyle);
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('nexus_subtitle_styles_v4') || '{}');
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({ ...stored, preset: 'classic', style: defaultStyle }));
    }
  };

  const handleStyleChange = <K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) => {
    setActivePreset('custom');
    const updated = {
      ...customStyle,
      [key]: value
    };
    setCustomStyle(updated);
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('nexus_subtitle_styles_v4') || '{}');
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({ ...stored, preset: 'custom', style: updated }));
    }
  };

  const handleSaveTemplate = () => {
    if (!templateNameInput.trim()) return;
    saveCustomTemplate(templateNameInput.trim());
    setTemplateNameInput('');
    setShowTemplateSave(false);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#08080a]/72 p-5 text-left scrollbar-thin">
      <div className="mb-5 flex flex-shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="min-w-0 select-none">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-neutral-200" />
            <h3 className="text-lg font-semibold tracking-tight text-neutral-50">
              样式参数
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            调整字幕在预览与导出中的呈现
          </p>
        </div>

        <button
          type="button"
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all cursor-pointer
            ${showGuides
              ? 'border-white/15 bg-white/[0.08] text-neutral-100'
              : 'border-white/[0.07] bg-white/[0.02] text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.05]'}`}
          onClick={() => setShowGuides(!showGuides)}
          title="预览辅助线"
        >
          <Eye className="h-3.5 w-3.5" />
          辅助线
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <SettingSection
          title="模板"
          action={
            <button
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:text-white cursor-pointer"
              onClick={() => {
                setTemplateNameInput(`自定义模板 ${customTemplates.length + 1}`);
                setShowTemplateSave(v => !v);
              }}
            >
              <Save className="h-3.5 w-3.5" />
              保存
            </button>
          }
        >
          <AnimatePresence>
            {showTemplateSave && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 pb-1">
                  <input
                    type="text"
                    autoFocus
                    value={templateNameInput}
                    onChange={e => setTemplateNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowTemplateSave(false); }}
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-neutral-200 outline-none transition-all focus:border-white/20"
                    placeholder="模板名称"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200 cursor-pointer"
                  >
                    确定
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <select
              value={activePreset}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'classic') handleRestore();
                else {
                  const tpl = customTemplates.find(t => t.id === val);
                  if (tpl) handleApplyPreset(tpl);
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/25 px-3 text-sm text-neutral-200 outline-none transition-all focus:border-white/20 cursor-pointer"
            >
              <option value="classic">默认经典样式</option>
              {customTemplates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
              {activePreset === 'custom' && (
                <option value="custom" disabled>自定义配置（未保存）</option>
              )}
            </select>
            {activePreset !== 'classic' && activePreset !== 'custom' && (
              <button
                onClick={() => deleteCustomTemplate(activePreset)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-neutral-200 cursor-pointer"
                title="删除当前模板"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </SettingSection>

        <SettingSection title="文字尺寸">
          <SliderControl
            label="整体缩放"
            value={customStyle.globalScale ?? 1}
            min={0.6}
            max={1.8}
            step={0.05}
            suffix="x"
            hint="统一影响字幕整体大小"
            onChange={value => handleStyleChange('globalScale', value)}
          />
          <SliderControl
            label="中文字幕"
            value={customStyle.zhFontSize}
            min={12}
            max={36}
            suffix="px"
            onChange={value => handleStyleChange('zhFontSize', value)}
          />
          <SliderControl
            label="英文字幕"
            value={customStyle.enFontSize}
            min={8}
            max={24}
            suffix="px"
            onChange={value => handleStyleChange('enFontSize', value)}
          />
          <SliderControl
            label="底部距离"
            value={customStyle.marginV}
            min={10}
            max={60}
            suffix="px"
            onChange={value => {
              handleStyleChange('marginV', value);
              triggerTempGuides();
            }}
          />
        </SettingSection>

        <SettingSection title="字体">
          <FontFamilySelect
            label="中文"
            value={customStyle.zhFontFamily || FONT_FAMILIES_ZH[0].value}
            options={FONT_FAMILIES_ZH}
            onChange={(v) => handleStyleChange('zhFontFamily', v)}
          />
          <FontFamilySelect
            label="英文"
            value={customStyle.enFontFamily || FONT_FAMILIES_EN[0].value}
            options={FONT_FAMILIES_EN}
            onChange={(v) => handleStyleChange('enFontFamily', v)}
          />
        </SettingSection>

        <SettingSection title="颜色">
          <ColorPicker
            label="中文文字"
            value={customStyle.zhColor}
            isOpen={openPicker === 'zhColor'}
            onToggle={() => setOpenPicker(openPicker === 'zhColor' ? null : 'zhColor')}
            onChange={(c) => handleStyleChange('zhColor', c)}
          />
          <ColorPicker
            label="中文描边"
            value={customStyle.zhOutline}
            isOpen={openPicker === 'zhOutline'}
            onToggle={() => setOpenPicker(openPicker === 'zhOutline' ? null : 'zhOutline')}
            onChange={(c) => handleStyleChange('zhOutline', c)}
          />
          <ColorPicker
            label="英文文字"
            value={customStyle.enColor}
            isOpen={openPicker === 'enColor'}
            onToggle={() => setOpenPicker(openPicker === 'enColor' ? null : 'enColor')}
            onChange={(c) => handleStyleChange('enColor', c)}
          />
          <ColorPicker
            label="英文描边"
            value={customStyle.enOutline || '#000000'}
            isOpen={openPicker === 'enOutline'}
            onToggle={() => setOpenPicker(openPicker === 'enOutline' ? null : 'enOutline')}
            onChange={(c) => handleStyleChange('enOutline', c)}
          />
        </SettingSection>

        <SettingSection title="输出">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-neutral-300 inline-flex items-center gap-1.5">
              画面规格
              <InfoHint label="画面规格说明" side="left">
                用作 ASS 字幕样式的参考画布尺寸，影响字号、边距和描边换算；不会改变视频文件本身的分辨率。
              </InfoHint>
            </span>
            <select
              className="h-10 w-36 rounded-lg border border-white/[0.08] bg-black/25 px-3 text-right text-sm text-neutral-200 outline-none transition-all focus:border-white/20 cursor-pointer"
              value={customStyle.resolution || '1080p'}
              onChange={e => handleStyleChange('resolution', e.target.value as StyleSettings['resolution'])}
            >
              <option value="SD">标清 SD</option>
              <option value="1080p">全高清 1080p</option>
              <option value="4K">超高清 4K</option>
            </select>
          </div>
        </SettingSection>

        {hasLyrics && (
          <SettingSection
            title="歌词"
            action={
              <button
                type="button"
                className="rounded-md border border-white/[0.08] bg-white/[0.02] p-1 text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-neutral-100 cursor-pointer"
                onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
              >
                {isLyricsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                      suffix="px"
                      onChange={value => handleStyleChange('lyricFontSize', value)}
                    />
                    <ColorPicker
                      label="歌词颜色"
                      value={customStyle.lyricColor ?? '#E6E6FA'}
                      isOpen={openPicker === 'lyricColor'}
                      onToggle={() => setOpenPicker(openPicker === 'lyricColor' ? null : 'lyricColor')}
                      onChange={(c) => handleStyleChange('lyricColor', c)}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-neutral-300">位置</span>
                      <select
                        className="h-10 w-32 rounded-lg border border-white/[0.08] bg-black/25 px-3 text-right text-sm text-neutral-200 outline-none transition-all focus:border-white/20 cursor-pointer"
                        value={customStyle.lyricPosition ?? 'top'}
                        onChange={e => handleStyleChange('lyricPosition', e.target.value as StyleSettings['lyricPosition'])}
                      >
                        <option value="top">顶部</option>
                        <option value="bottom">底部</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className={`h-9 rounded-lg border px-3 text-sm font-semibold transition-all cursor-pointer
                        ${customStyle.lyricItalic ?? true
                          ? 'border-white/15 bg-white/[0.08] text-neutral-100'
                          : 'border-white/[0.07] bg-white/[0.02] text-neutral-500 hover:text-neutral-200'}`}
                      onClick={() => handleStyleChange('lyricItalic', !(customStyle.lyricItalic ?? true))}
                    >
                      斜体歌词
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SettingSection>
        )}
      </div>
    </div>
  );
};
