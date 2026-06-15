'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Film, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { StyleSettings } from '@/utils/subtitleCore';

type Preset = {
  id: string;
  name: string;
  desc: string;
  styles: Partial<StyleSettings>;
};

const PRESETS: Preset[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    desc: '轻阴影',
    styles: { zhFontSize: 22, enFontSize: 13, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#000000', marginV: 25 }
  },
  {
    id: 'classic',
    name: '大银幕',
    desc: '黄白配',
    styles: { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#FF9C41', marginV: 20 }
  },
  {
    id: 'anime',
    name: '动漫',
    desc: '深描边',
    styles: { zhFontSize: 24, enFontSize: 14, zhColor: '#FFFFFF', enColor: '#FFFFFF', zhOutline: '#6D4438', marginV: 30 }
  }
];

const SCENES = [
  { id: "cinema", name: "影院", desc: "经典电影院" },
  { id: "nature", name: "自然", desc: "户外光影" },
  { id: "night", name: "夜景", desc: "低光环境" }
];


export const ControlDeck: React.FC = () => {
  const { 
    theaterAspect, 
    setTheaterAspect, 
    sceneBackground, 
    setSceneBackground,
    activePreset, 
    setActivePreset, 
    customStyle, 
    setCustomStyle,
    tmdbBackdrop,
    tmdbBackdropList,
    shuffleBackdrop
  } = useStudioStore();

  const handleApplyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    const updated = { ...customStyle, ...preset.styles };
    setCustomStyle(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({
        preset: preset.id,
        style: updated,
        templates: []
      }));
    }
  };

  const aspectRatios = [
    { id: '4:3', label: '4:3', desc: 'TV' },
    { id: '16:9', label: '16:9', desc: 'HD' },
    { id: '2.39:1', label: '2.39:1', desc: 'Wide' },
    { id: '1.9:1', label: 'IMAX', desc: 'IMAX' }
  ];

  return (
    <div className="flex flex-row flex-wrap items-center gap-2.5 2xl:gap-5 justify-start xl:justify-end w-full py-1">
      {/* Aspect Ratio Cards */}
      <div className="flex items-center gap-2">
        <span className="hidden 2xl:inline text-xs text-neutral-400 font-medium whitespace-nowrap">画幅比例</span>
        <div className="flex items-center gap-1.5">
          {aspectRatios.map(ar => {
            const isActive = theaterAspect === ar.id;
            let boxW = 18;
            let boxH = 10;
            if (ar.id === '4:3') { boxW = 14; boxH = 10; }
            else if (ar.id === '16:9') { boxW = 18; boxH = 10; }
            else if (ar.id === '2.39:1') { boxW = 24; boxH = 9; }
            else if (ar.id === '1.9:1') { boxW = 20; boxH = 10; }

            return (
              <button
                key={ar.id}
                type="button"
                className={`py-1.5 px-2.5 2xl:py-2 2xl:px-3.5 flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-all duration-205 rounded-lg border
                  ${isActive 
                    ? 'glass-btn-ar-active' 
                    : 'glass-btn-ar text-neutral-400 hover:text-neutral-250 border-white/[0.04]'}`}
                onClick={() => setTheaterAspect(ar.id)}
              >
                <div 
                   className="border border-current rounded-sm opacity-60 flex-shrink-0" 
                   style={{ width: `${boxW}px`, height: `${boxH}px` }}
                />
                <span>{ar.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden 2xl:block w-[1px] h-6 bg-white/[0.06]" />

      {/* Background Cards */}
      <div className="flex items-center gap-2">
        <span className="hidden 2xl:inline text-xs text-neutral-400 font-medium whitespace-nowrap">模拟场景</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SCENES.map(scene => {
            const isActive = sceneBackground === scene.id;
            const isCinemaWithBackdrop = scene.id === 'cinema' && Boolean(tmdbBackdrop);

            return (
              <button
                key={scene.id}
                type="button"
                className={`py-1.5 px-2.5 2xl:py-2 2xl:px-3.5 flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-all duration-205 rounded-lg border
                  ${isActive
                    ? 'glass-btn-ar-active'
                    : 'glass-btn-ar text-neutral-400 hover:text-neutral-250 border-white/[0.04]'}`}
                onClick={() => setSceneBackground(scene.id)}
                title={scene.desc}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-[#d8c39a] shadow-[0_0_8px_rgba(197,164,110,0.65)]' : 'bg-white/20'}`} />
                {scene.id === 'cinema' && <Film className="w-4 h-4 text-[#d8c39a]" />}
                <span>{isCinemaWithBackdrop ? '剧照' : scene.name}</span>
              </button>
            );
          })}
          {tmdbBackdrop && tmdbBackdropList.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.02, y: -0.5 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="py-1.5 px-2.5 2xl:py-2 2xl:px-3.5 flex items-center gap-1.5 text-sm font-medium cursor-pointer text-[#d8c39a] hover:text-[#f0ddaf] border border-[#c5a46e]/20 bg-[#c5a46e]/5 hover:bg-[#c5a46e]/10 rounded-lg transition-all duration-205 ml-1 flex-shrink-0"
              onClick={shuffleBackdrop}
              title="更换背景图"
            >
              <RefreshCw className="w-3 h-3 text-[#d8c39a] animate-hover-spin" />
              <span>换张剧照</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="hidden 2xl:block w-[1px] h-6 bg-white/[0.06]" />

      {/* Preset Pills */}
      <div className="flex items-center gap-2">
        <span className="hidden 2xl:inline text-xs text-neutral-400 font-medium whitespace-nowrap">字幕预设</span>
        <div className="flex items-center gap-1.5">
          {PRESETS.map(p => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`py-1.5 px-2.5 2xl:py-2 2xl:px-3.5 flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-all duration-205 rounded-lg border
                  ${isActive 
                    ? 'glass-btn-ar-active' 
                    : 'glass-btn-ar text-neutral-400 hover:text-neutral-250 border-white/[0.04]'}`}
                onClick={() => handleApplyPreset(p)}
              >
                <div 
                   className="w-2 h-2 rounded-full border border-black/30 flex-shrink-0 shadow-[0_0_4px_rgba(255,255,255,0.15)]" 
                   style={{ backgroundColor: p.styles.zhColor }} 
                />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
