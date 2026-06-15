'use client';

import React from 'react';
import { BackdropSlot, SubtitleDataSlot, StyleSettings } from '@/types/subtitleTypes';

const getOutlineShadow = (outlineColor: string) => {
  return `
    -1px -1px 0 ${outlineColor},  
     1px -1px 0 ${outlineColor},
    -1px  1px 0 ${outlineColor},
     1px  1px 0 ${outlineColor},
    -2px -2px 2px rgba(0,0,0,0.8),
     2px -2px 2px rgba(0,0,0,0.8),
    -2px  2px 2px rgba(0,0,0,0.8),
     2px  2px 2px rgba(0,0,0,0.8)
  `;
};

interface ScreenSimulatorProps {
  subtitle: SubtitleDataSlot;
  backdrop: BackdropSlot;
  style: StyleSettings;
  previewIndex: number;
  theaterAspect: string;
  guides: { show: boolean; temp: boolean };
  triggerTempGuides: () => void;
}

export const ScreenSimulator: React.FC<ScreenSimulatorProps> = ({
  subtitle,
  backdrop,
  style,
  previewIndex,
  theaterAspect,
  guides,
  triggerTempGuides
}) => {
  const activeSub = subtitle.status === 'ready' && subtitle.data ? subtitle.data[previewIndex] : null;
  
  const scale = style.globalScale || 1.0;

  // 注意：大量使用 cqh（container query height）单位
  // 要求现代浏览器支持（Chrome 105+ / Safari 16+ / Firefox 110+）
  // 这是为了让字幕定位精确跟随物理屏幕区域
  const zhSizeCqh = (style.zhFontSize * scale / 288) * 100;
  const enSizeCqh = (style.enFontSize * scale / 288) * 100;
  const paddingBottomCqh = (style.marginV / 288) * 100;

  const {
    lyricFontSize = 16,
    lyricColor = '#E6E6FA',
    lyricItalic = true,
    lyricPosition = 'top'
  } = style;

  const lyricZhSizeCqh = (lyricFontSize * scale / 288) * 100;
  const lyricEnSizeCqh = (Math.max(10, lyricFontSize * 0.75) * scale / 288) * 100;
  const noteSizeCqh = (18 * scale / 288) * 100;

  // Detect what to render at Top and Bottom
  let topElement: React.ReactNode = null;
  let bottomElement: React.ReactNode = null;

  if (activeSub) {
    const normalizedText = (activeSub.text || '').replace(/\\N/gi, '\n');

    if (activeSub.type === 'note' || activeSub.type === 'commentary') {
      topElement = (
        <div 
          style={{
            fontSize: `${noteSizeCqh}cqh`,
            color: '#FFFFFF',
            fontWeight: 500,
            textShadow: getOutlineShadow('#000000'),
            lineHeight: 1.25,
            fontFamily: style.zhFontFamily || 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
            whiteSpace: 'pre-wrap'
          }}
        >
          {normalizedText}
        </div>
      );
    } else if (activeSub.type === 'lyrics') {
      const parts = normalizedText.split('\n');
      const lyricZh = parts[0] || '';
      const lyricEn = parts[1] || '';
      const lyricEl = (
        <div className="flex flex-col items-center animate-fade-in">
          {lyricZh && (
            <div 
              style={{
                fontSize: `${lyricZhSizeCqh}cqh`,
                color: lyricColor,
                fontWeight: 600,
                fontStyle: lyricItalic ? 'italic' : 'normal',
                textShadow: getOutlineShadow('#000000'),
                lineHeight: 1.25,
                fontFamily: style.zhFontFamily || 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif'
              }}
            >
              {lyricZh}
            </div>
          )}
          {lyricEn && (
            <div 
              className="mt-1"
              style={{
                fontSize: `${lyricEnSizeCqh}cqh`,
                color: lyricColor,
                fontWeight: 600,
                fontStyle: lyricItalic ? 'italic' : 'normal',
                textShadow: getOutlineShadow('#000000'),
                lineHeight: 1.2,
                transform: `scale(${style.enScale ? style.enScale / 100 : 0.9})`,
                fontFamily: style.enFontFamily || 'Helvetica Neue, Arial, sans-serif'
              }}
            >
              {lyricEn}
            </div>
          )}
        </div>
      );

      if (lyricPosition === 'top') {
        topElement = lyricEl;
      } else {
        bottomElement = lyricEl;
      }
    } else {
      const parts = normalizedText.split('\n');
      const zh = parts[0] || '';
      const en = parts[1] || '';
      bottomElement = (
        <div className="flex flex-col items-center">
          {zh && (
            <div 
              style={{
                fontSize: `${zhSizeCqh}cqh`,
                color: style.zhColor,
                fontWeight: 700,
                textShadow: getOutlineShadow(style.zhOutline),
                lineHeight: 1.25,
                fontFamily: style.zhFontFamily || 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif'
              }}
            >
              {zh}
            </div>
          )}
          {en && (
            <div 
              className="mt-1"
              style={{
                fontSize: `${enSizeCqh}cqh`,
                color: style.enColor,
                fontWeight: 600,
                textShadow: getOutlineShadow(style.enOutline || '#000000'),
                lineHeight: 1.2,
                transform: `scale(${style.enScale ? style.enScale / 100 : 0.9})`,
                fontFamily: style.enFontFamily || 'Helvetica Neue, Arial, sans-serif'
              }}
            >
              {en}
            </div>
          )}
        </div>
      );
    }
  }

  const isImax = theaterAspect === '1.9:1';

  const getBackdropStyle = () => {
    const bgSize = theaterAspect === '4:3' ? '100% 100%' : 'cover';
    
    switch (backdrop.type) {
      case 'solid':
        return { backgroundColor: backdrop.color };
      case 'preset':
        if (backdrop.name === 'nature') {
          return { backgroundImage: 'url("/scene_nature.png")', backgroundSize: bgSize, backgroundPosition: 'center' };
        }
        if (backdrop.name === 'night') {
          return { backgroundImage: 'url("/scene_night.png")', backgroundSize: bgSize, backgroundPosition: 'center' };
        }
        // default cinema preset
        return { backgroundImage: 'url("/scene_portrait.png")', backgroundSize: bgSize, backgroundPosition: 'center' };
      case 'image':
        return { backgroundImage: `url(${backdrop.url})`, backgroundSize: bgSize, backgroundPosition: 'center' };
      case 'tmdb':
        return { backgroundImage: `url(${backdrop.backdropUrl})`, backgroundSize: bgSize, backgroundPosition: 'center' };
      default:
        return { backgroundColor: '#09090d' };
    }
  };

  // === 家庭观影环境 TV 遮罩 ===
  const isCrt = theaterAspect === '4:3';
  const maskAspect = isCrt ? '1536/1288' : '1725/1058';
  const maskImg = isCrt ? '/tv-crt_v2.png' : '/tv-modern_v2.png';

  const screenPos = isCrt 
      ? { left: '10.8073%', top: '11.4907%', width: '78.3854%', height: '71.0404%' }
      : { left: '1.6812%', top: '3.8752%', width: '96.0000%', height: '90.3592%' };

  const innerAspect = theaterAspect === '16:9' ? '16/9' :
                      theaterAspect === '4:3' ? '4/3' :
                      isImax ? '16/9' : '2.39/1';

  // 改进后的黑条磁吸计算，对宽屏（2.39:1 / 1.9:1）支持更好
  const getBlackBarCenterCqh = () => {
    const physAspect = isCrt ? (4/3) : (16/9);
    let movieAspectNum = 16/9;

    if (theaterAspect === '4:3') movieAspectNum = 4/3;
    else if (isImax) movieAspectNum = physAspect;
    else if (theaterAspect === '2.39:1') movieAspectNum = 2.39;

    if (movieAspectNum > physAspect) {
      const movieHeightPct = physAspect / movieAspectNum;
      const blackBarHeightPct = (1 - movieHeightPct) / 2;
      return (blackBarHeightPct / 2) * 100;
    }
    return 0;
  };

  const targetCqh = getBlackBarCenterCqh();
  const isMagnetic = targetCqh > 0 && Math.abs(paddingBottomCqh - targetCqh) < 1.0;

  return (
    <div 
      className="flex-1 flex justify-center items-center bg-[#050507] w-full h-full overflow-hidden p-4 md:p-8 relative"
      onMouseEnter={triggerTempGuides}
      onMouseMove={triggerTempGuides}
    >
      {/* 空间极光氛围呼吸光晕（家庭观影环境氛围） */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
        <div className="absolute top-[20%] left-[20%] w-[55%] h-[55%] rounded-full bg-aurora-glow-purple" />
        <div className="absolute bottom-[20%] right-[20%] w-[45%] h-[45%] rounded-full bg-aurora-glow-emerald" />
      </div>

      {/* Outer wrapper constrained to the TV Mask's Aspect Ratio */}
      <div 
        className="relative flex justify-center items-center fade-in-up border border-white/[0.06] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] z-10"
        style={{
          aspectRatio: maskAspect,
          maxWidth: '100%',
          maxHeight: '100%',
          height: '100%',
          minHeight: 0
        }}
      >
        {/* TV Frame Mask Layer（电视机外壳 PNG，最上层 z-20） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={maskImg} 
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20 drop-shadow-2xl" 
          alt="TV Frame Mask" 
        />

        {/* Physical Screen Black Background（屏幕玻璃有效区域） */}
        <div 
          className="absolute bg-[#000] flex items-center justify-center overflow-hidden z-10"
          style={{
            left: screenPos.left,
            top: screenPos.top,
            width: screenPos.width,
            height: screenPos.height,
            containerType: 'size',
          }}
        >
          {/* Inner Movie Canvas（使用大宽度强制扩展，配合 maxWidth 限制） */}
          <div 
            className="relative flex-shrink-0 bg-[#070709] transition-all duration-300 overflow-hidden"
            style={{
              aspectRatio: innerAspect,
              width: isImax ? '100%' : '10000px',
              height: isImax ? '100%' : undefined,
              maxWidth: '100%',
              maxHeight: '100%',
              ...getBackdropStyle()
            }}
          />

          {isImax && !isCrt && (
            <div className="absolute inset-0 pointer-events-none z-20">
              <div className="absolute inset-x-0 top-0 h-[7%] bg-gradient-to-b from-black/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-[7%] bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute left-[4%] right-[4%] top-[4%] bottom-[4%] border border-[#d8c39a]/12 rounded-sm" />
            </div>
          )}

          {/* Render State Machine */}
          {subtitle.status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 select-none">
              <span className="text-white/20 text-xs font-mono tracking-widest uppercase">
                [ Empty Canvas ]
              </span>
            </div>
          )}

          {subtitle.status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none bg-black/60 backdrop-blur-xs">
              <div className="w-6 h-6 border-2 border-accent-neon border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-white/40 text-xs font-mono tracking-widest uppercase">
                {subtitle.progress ? `Loading ${Math.round(subtitle.progress * 100)}%` : 'Loading Subtitles...'}
              </span>
            </div>
          )}

          {subtitle.status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none bg-black/85">
              <span className="text-rose-500/80 text-xs font-mono tracking-widest uppercase mb-1">
                [ Data Error ]
              </span>
              <span className="text-white/40 text-[0.625rem] font-mono tracking-wide px-4 text-center max-w-xs break-words">
                {subtitle.message}
              </span>
            </div>
          )}
          
          {/* Top Subtitle Rendering Layer */}
          {topElement && (
            <div 
              className="absolute left-[5%] right-[5%] flex flex-col items-center justify-start text-center pointer-events-none select-none z-40 transition-all duration-200"
              style={{ top: `${paddingBottomCqh * 0.8}cqh` }}
            >
              {topElement}
            </div>
          )}

          {/* Subtitle Rendering Layer (Bottom) */}
          {bottomElement && (
            <div 
              className="absolute left-[5%] right-[5%] flex flex-col items-center justify-end text-center pointer-events-none select-none z-40 transition-all duration-200"
              style={{ bottom: `${paddingBottomCqh}cqh` }}
            >
              {bottomElement}
            </div>
          )}

          {/* Alignment Guide Lines */}
          <div 
            className="absolute left-0 right-0 z-40 transition-all duration-300 pointer-events-none flex items-center"
            style={{
              bottom: `${paddingBottomCqh}cqh`,
              opacity: (guides.show || guides.temp) ? 1 : 0,
              borderBottom: `1px dashed ${isMagnetic ? '#10b981' : 'rgba(168,85,247,0.45)'}`,
              boxShadow: isMagnetic ? '0 0 10px #10b981, 0 0 4px #10b981' : 'none',
              transform: 'scaleY(0.5)',
              transformOrigin: 'bottom'
            }}
          >
            {isMagnetic && (
               <div className="absolute right-4 -top-3.5 text-[0.5625rem] text-[#10b981]/90 font-mono tracking-[0.2em] uppercase bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.5)] scale-y-200">
                 MAGNETIC ALIGNED
               </div>
            )}
          </div>
          
          {/* Target Black Bar Center Line */}
          {targetCqh > 0 && (
            <div 
              className="absolute left-0 right-0 z-30 transition-all duration-300 pointer-events-none"
              style={{
                bottom: `${targetCqh}cqh`,
                opacity: (guides.show || guides.temp) && !isMagnetic ? 1 : 0,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                transform: 'scaleY(0.5)',
                transformOrigin: 'bottom'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
