'use client';

import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import type { StyleSettings } from '@/utils/subtitleCore';
import { LayoutGrid, Eye, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_COLORS = ['#FFFFFF', '#E0E0E0', '#B0B0B0', '#F2A900', '#FF9C41', '#FF4D4D', '#A8E6CF', '#A0C4FF', '#000000'];

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
  <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
    <span className="text-sm text-neutral-300 font-medium">{label}</span>
    <select
      className="bg-white/[0.02] border border-white/[0.08] focus:border-white/15 rounded-lg text-sm px-2 py-1.5 text-neutral-200 outline-none cursor-pointer transition-all w-40 text-right"
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
    <div className="flex flex-col py-2 border-b border-white/[0.03]">
      <div 
        className="flex items-center justify-between cursor-pointer select-none group"
        onClick={onToggle}
      >
        <span className="text-sm text-neutral-300 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-450 tabular-nums">{value}</span>
          <div 
            className="w-5 h-5 rounded-full border border-white/10 shadow-sm relative transition-all duration-200 group-hover:scale-105"
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
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/[0.03]">
              {PRESET_COLORS.map(c => (
                <button 
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`w-5.5 h-5.5 rounded-full border transition-all cursor-pointer ${value === c ? 'border-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.6)] scale-105' : 'border-white/[0.08] hover:border-white/25 hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div 
                className="relative w-5.5 h-5.5 rounded-full overflow-hidden border border-white/[0.08] hover:border-white/25 hover:scale-105 shrink-0 cursor-pointer transition-all" 
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
      zhOutline: '#FF9C41', 
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
    <div className="flex flex-col gap-4 p-4 text-left w-full h-full bg-transparent overflow-y-auto scrollbar-thin">
      <div className="pb-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 select-none">
          <LayoutGrid className="w-4 h-4 text-violet-400" />
          <h3 className="text-base font-semibold text-neutral-100 tracking-tight pl-0.5">
            样式模板
          </h3>
        </div>
        
        {/* Compact guides toggle */}
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 select-none"
          onClick={() => setShowGuides(!showGuides)}
          title="定位辅助线开关"
        >
          <Eye className={`w-4 h-4 ${showGuides ? 'text-violet-400' : 'text-neutral-500'}`} />
          <input 
            type="checkbox"
            checked={showGuides}
            readOnly
            className="w-3 h-3 rounded border-white/[0.08] text-violet-400 bg-transparent focus:ring-transparent pointer-events-none"
          />
        </div>
      </div>

      {/* Templates & Presets */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 flex-shrink-0">
        <div className="flex justify-between items-center select-none">
          <span className="text-sm text-neutral-300 font-medium pl-0.5">预设模板</span>
          <button 
            className="flex items-center gap-1 text-sm text-[#d8c39a] hover:text-[#f0ddaf] transition-colors cursor-pointer font-medium"
            onClick={() => {
              setTemplateNameInput(`自定义模板 ${customTemplates.length + 1}`);
              setShowTemplateSave(v => !v);
            }}
          >
            <Save className="w-3 h-3" /> 保存当前
          </button>
        </div>

        {/* Inline template save block with bounce */}
        <AnimatePresence>
          {showTemplateSave && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 py-1.5">
                <input
                  type="text"
                  autoFocus
                  value={templateNameInput}
                  onChange={e => setTemplateNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowTemplateSave(false); }}
                  className="flex-1 bg-white/[0.02] border border-white/[0.08] focus:border-white/15 text-neutral-200 text-sm rounded-lg py-1.5 px-2.5 outline-none transition-all"
                  placeholder="模板名称..."
                />
                <button
                  onClick={handleSaveTemplate}
                  className="px-3 py-1.5 bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition flex-shrink-0 cursor-pointer"
                >
                  保存
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Dropdown template selector */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
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
              className="w-full h-9 bg-white/[0.01] border border-white/[0.08] focus:border-white/15 rounded-lg text-sm px-2.5 text-neutral-300 outline-none cursor-pointer transition-all"
            >
              <option value="classic">默认经典样式</option>
              {customTemplates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
              {activePreset === 'custom' && (
                <option value="custom" disabled>自定义配置（未保存）</option>
              )}
            </select>
          </div>
          {activePreset !== 'classic' && activePreset !== 'custom' && (
            <button 
              onClick={() => deleteCustomTemplate(activePreset)}
              className="p-2 text-neutral-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="删除当前模板"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Style Editors */}
      <div className="flex flex-col gap-4 flex-1">
        <span className="text-sm text-neutral-300 font-medium select-none pl-0.5">参数微调</span>
        
        {/* 整体缩放 (globalScale) - 高优先暴露 */}
        <div className="flex flex-col gap-1 border-b border-white/[0.04] pb-3">
          <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
            <span>整体缩放</span>
            <motion.span 
              animate={{ scale: [1, 1.05, 1] }} 
              key={customStyle.globalScale ?? 1}
              className="font-mono text-[#d8c39a] font-semibold text-xs"
            >
              {(customStyle.globalScale ?? 1).toFixed(2)}×
            </motion.span>
          </div>
          <input 
            type="range" min="0.6" max="1.8" step="0.05"
            value={customStyle.globalScale ?? 1}
            onChange={e => handleStyleChange('globalScale', parseFloat(e.target.value))}
            className="w-full glass-slider-input"
          />
          <div className="text-xs text-neutral-500">影响所有字号的最终换算</div>
        </div>

        {/* Font Sizes & Sliders */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
              <span>中文字号</span>
              <motion.span 
                animate={{ scale: [1, 1.05, 1] }} 
                key={customStyle.zhFontSize} 
                className="font-mono text-[#d8c39a] font-semibold text-xs"
              >
                {customStyle.zhFontSize}px
              </motion.span>
            </div>
            <input 
              type="range" min="12" max="36" 
              value={customStyle.zhFontSize}
              onChange={e => handleStyleChange('zhFontSize', parseInt(e.target.value, 10))}
              className="w-full glass-slider-input"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
              <span>英文字号</span>
              <motion.span 
                animate={{ scale: [1, 1.05, 1] }}
                key={customStyle.enFontSize}
                className="font-mono text-[#d8c39a] font-semibold text-xs"
              >
                {customStyle.enFontSize}px
              </motion.span>
            </div>
            <input 
              type="range" min="8" max="24" 
              value={customStyle.enFontSize}
              onChange={e => handleStyleChange('enFontSize', parseInt(e.target.value, 10))}
              className="w-full glass-slider-input"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
              <span>垂直边距</span>
              <motion.span 
                animate={{ scale: [1, 1.05, 1] }}
                key={customStyle.marginV}
                className="font-mono text-[#d8c39a] font-semibold text-xs"
              >
                {customStyle.marginV}px
              </motion.span>
            </div>
            <input 
              type="range" min="10" max="60" 
              value={customStyle.marginV}
              onChange={e => {
                handleStyleChange('marginV', parseInt(e.target.value, 10));
                triggerTempGuides();
              }}
              className="w-full glass-slider-input"
            />
          </div>
        </div>

        {/* 字体家族选择 - 阅片环境 CJK 协调核心 */}
        <div className="flex flex-col mt-1 border-t border-white/[0.04] pt-2">
          <span className="text-sm text-neutral-300 font-medium select-none pl-0.5 mb-1">字体家族</span>
          
          <FontFamilySelect 
            label="中文字体" 
            value={customStyle.zhFontFamily || FONT_FAMILIES_ZH[0].value} 
            options={FONT_FAMILIES_ZH} 
            onChange={(v) => handleStyleChange('zhFontFamily', v)} 
          />
          <FontFamilySelect 
            label="英文字体" 
            value={customStyle.enFontFamily || FONT_FAMILIES_EN[0].value} 
            options={FONT_FAMILIES_EN} 
            onChange={(v) => handleStyleChange('enFontFamily', v)} 
          />
        </div>

        {/* Color pickers & resolution */}
        <div className="flex flex-col mt-1 border-t border-white/[0.04] pt-2">
          <ColorPicker 
            label="中文/主字色" 
            value={customStyle.zhColor} 
            isOpen={openPicker === 'zhColor'}
            onToggle={() => setOpenPicker(openPicker === 'zhColor' ? null : 'zhColor')}
            onChange={(c) => handleStyleChange('zhColor', c)} 
          />
          <ColorPicker 
            label="中文描边色" 
            value={customStyle.zhOutline} 
            isOpen={openPicker === 'zhOutline'}
            onToggle={() => setOpenPicker(openPicker === 'zhOutline' ? null : 'zhOutline')}
            onChange={(c) => handleStyleChange('zhOutline', c)} 
          />
          <ColorPicker 
            label="英文/次字色" 
            value={customStyle.enColor} 
            isOpen={openPicker === 'enColor'}
            onToggle={() => setOpenPicker(openPicker === 'enColor' ? null : 'enColor')}
            onChange={(c) => handleStyleChange('enColor', c)} 
          />
          <ColorPicker 
            label="英文描边色" 
            value={customStyle.enOutline || '#000000'} 
            isOpen={openPicker === 'enOutline'}
            onToggle={() => setOpenPicker(openPicker === 'enOutline' ? null : 'enOutline')}
            onChange={(c) => handleStyleChange('enOutline', c)} 
          />
          
          <div className="flex items-center justify-between py-2.5 border-b border-white/[0.03]">
            <span className="text-sm text-neutral-300 font-medium">画质分辨率</span>
            <select
              className="bg-white/[0.02] border border-white/[0.08] focus:border-white/15 rounded-lg text-sm px-2 py-1.5 text-neutral-300 outline-none cursor-pointer transition-all w-36 text-right"
              value={customStyle.resolution || '1080p'}
              onChange={e => handleStyleChange('resolution', e.target.value as StyleSettings['resolution'])}
            >
              <option value="SD">标清 SD</option>
              <option value="1080p">全高清 1080p</option>
              <option value="4K">超高清 4K</option>
            </select>
          </div>
        </div>

        {/* Lyrics Styles */}
        {hasLyrics && (
        <div className="flex flex-col gap-2 pb-4">
          <div 
            className="flex justify-between items-center cursor-pointer select-none group"
            onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
          >
            <span className="text-sm text-neutral-300 font-medium flex items-center group-hover:text-neutral-100 transition-colors pl-0.5">
              歌词特殊样式
              {hasLyrics && <span className="text-violet-300 ml-2 text-xs font-medium bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/15 animate-pulse">已识别</span>}
            </span>
            <div className="p-1 rounded group-hover:bg-white/[0.05] transition-colors">
              {isLyricsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
            </div>
          </div>
          
          <AnimatePresence initial={false}>
            {isLyricsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="pt-2 flex flex-col border-t border-white/[0.04]">
                  {hasLyrics ? (
                    <div className="flex flex-col">
                      <div className="flex flex-col gap-1.5 py-2 border-b border-white/[0.03]">
                        <div className="flex justify-between text-sm font-medium text-neutral-300 select-none">
                          <span>歌词字号</span>
                          <span className="font-mono text-violet-300 font-semibold text-xs">{customStyle.lyricFontSize ?? 16}px</span>
                        </div>
                        <input 
                          type="range" min="10" max="30" 
                          value={customStyle.lyricFontSize ?? 16}
                          onChange={e => handleStyleChange('lyricFontSize', parseInt(e.target.value, 10))}
                          className="w-full glass-slider-input"
                        />
                      </div>

                      <ColorPicker 
                        label="歌词颜色" 
                        value={customStyle.lyricColor ?? '#E6E6FA'} 
                        isOpen={openPicker === 'lyricColor'}
                        onToggle={() => setOpenPicker(openPicker === 'lyricColor' ? null : 'lyricColor')}
                        onChange={(c) => handleStyleChange('lyricColor', c)} 
                      />
                      
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                        <span className="text-sm text-neutral-300 font-medium">歌词位置</span>
                        <select
                          className="bg-white/[0.02] border border-white/[0.08] focus:border-white/15 rounded-lg text-sm px-2 py-1.5 text-neutral-300 outline-none cursor-pointer transition-all w-32 text-right"
                          value={customStyle.lyricPosition ?? 'top'}
                          onChange={e => handleStyleChange('lyricPosition', e.target.value as StyleSettings['lyricPosition'])}
                        >
                          <option value="top">顶部置顶</option>
                          <option value="bottom">底部置底</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-300 font-medium">启用斜体</span>
                        <button 
                          type="button"
                          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all border cursor-pointer
                            ${customStyle.lyricItalic ?? true 
                              ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' 
                              : 'bg-white/[0.01] border-white/[0.06] text-neutral-500'}`}
                          onClick={() => handleStyleChange('lyricItalic', !(customStyle.lyricItalic ?? true))}
                        >
                          斜体
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-450 bg-white/[0.005] border border-white/[0.05] p-2.5 rounded-xl leading-relaxed mt-2">
                      未检测到包含 ♪ ♫ 等音符标记的歌词序列轨道。样式配置将不生效。
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>
    </div>
  );
};
