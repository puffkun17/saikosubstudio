'use client';

import React from 'react';
import { BackdropSlot, SubtitleDataSlot, StyleSettings } from '@/types/subtitleTypes';
import { parseSubtitleRange } from '@/utils/timeline/timecode';

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
  /** Continuous clock for fade-in / fade-out preview. */
  previewClockMs?: number;
  isPreviewPlaying?: boolean;
  theaterAspect: string;
  guides: { show: boolean; temp: boolean };
}

/** Preview fade window (ASS-like). Kept modest so styles stay readable. */
const PREVIEW_FADE_MS = 280;

const cueOpacity = (
  clockMs: number | undefined,
  startMs: number,
  endMs: number,
): number => {
  if (clockMs == null || !Number.isFinite(clockMs)) return 1;
  if (clockMs < startMs || clockMs >= endMs) return 0;
  const into = clockMs - startMs;
  const left = endMs - clockMs;
  const fade = Math.min(PREVIEW_FADE_MS, Math.max(40, (endMs - startMs) / 3));
  if (into < fade) return Math.max(0, into / fade);
  if (left < fade) return Math.max(0, left / fade);
  return 1;
};

export const ScreenSimulator: React.FC<ScreenSimulatorProps> = ({
  subtitle,
  backdrop,
  style,
  previewIndex,
  previewClockMs,
  isPreviewPlaying = false,
  theaterAspect,
  guides,
}) => {
  const activeSub = subtitle.status === 'ready' && subtitle.data ? subtitle.data[previewIndex] : null;
  
  const scale = style.globalScale || 1.0;

  const activeRange = activeSub?.ts ? parseSubtitleRange(activeSub.ts) : null;
  const fadeOpacity = isPreviewPlaying && activeRange
    ? cueOpacity(previewClockMs, activeRange.startMs, activeRange.endMs)
    : 1;

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
            WebkitTextStroke: '0.6px #000000',
            paintOrder: 'stroke fill',
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
                WebkitTextStroke: '0.5px #000000',
                paintOrder: 'stroke fill',
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
                WebkitTextStroke: '0.4px #000000',
                paintOrder: 'stroke fill',
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
                WebkitTextStroke: `0.7px ${style.zhOutline || '#000000'}`,
                paintOrder: 'stroke fill',
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
                WebkitTextStroke: `0.5px ${style.enOutline || '#000000'}`,
                paintOrder: 'stroke fill',
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
    <div className="screen-sim-root relative flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--v4-canvas)] p-4 md:p-8">

      {/* Outer wrapper constrained to the TV Mask's Aspect Ratio */}
      <div 
        className="screen-sim-frame fade-in-up relative z-0 flex items-center justify-center overflow-hidden rounded-sm border border-[var(--v4-line-strong)] shadow-[var(--elevation-3-dim)]"
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
              <div className="absolute left-[4%] right-[4%] top-[4%] bottom-[4%] border border-[#e5e7eb]/12 rounded-sm" />
            </div>
          )}

          {/* Render State Machine */}
          {subtitle.status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 select-none">
              <span className="text-white/30 text-sm font-medium">
                暂无字幕预览
              </span>
            </div>
          )}

          {subtitle.status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none bg-black/60 backdrop-blur-xs">
              <div className="w-6 h-6 border-2 border-accent-neon border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-white/55 text-sm font-medium">
                {subtitle.progress ? `字幕载入中 ${Math.round(subtitle.progress * 100)}%` : '正在载入字幕'}
              </span>
            </div>
          )}

          {subtitle.status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none bg-black/85">
              <span className="text-rose-300/85 text-sm font-semibold mb-1">
                预览数据异常
              </span>
              <span className="text-white/45 text-xs px-4 text-center max-w-xs break-words leading-relaxed">
                {subtitle.message}
              </span>
            </div>
          )}
          
          {/* Top Subtitle Rendering Layer */}
          {topElement && fadeOpacity > 0.01 && (
            <div 
              className="absolute left-[5%] right-[5%] z-40 flex select-none flex-col items-center justify-start text-center pointer-events-none"
              style={{ top: `${paddingBottomCqh * 0.8}cqh`, opacity: fadeOpacity }}
            >
              {topElement}
            </div>
          )}

          {/* Subtitle Rendering Layer (Bottom) */}
          {bottomElement && fadeOpacity > 0.01 && (
            <div 
              className="absolute left-[5%] right-[5%] z-40 flex select-none flex-col items-center justify-end text-center pointer-events-none"
              style={{ bottom: `${paddingBottomCqh}cqh`, opacity: fadeOpacity }}
            >
              {bottomElement}
            </div>
          )}

          {/* Alignment guides stay explicit when enabled; temporary guides are used only while adjusting a related value. */}
          <div 
            className="pointer-events-none absolute left-0 right-0 z-50 flex items-center border-b transition-all duration-300"
            style={{
              bottom: `${paddingBottomCqh}cqh`,
              opacity: (guides.show || guides.temp) ? 1 : 0,
              borderColor: isMagnetic ? 'var(--v5-orange)' : 'rgba(239, 141, 95, 0.55)',
              borderStyle: isMagnetic ? 'solid' : 'dashed',
              boxShadow: isMagnetic ? '0 0 14px rgba(239, 141, 95, 0.55)' : '0 0 10px rgba(239, 141, 95, 0.22)',
            }}
          >
            <span className="absolute left-3 -top-6 rounded bg-black/72 px-1.5 py-0.5 text-xs font-semibold tracking-[var(--tracking-eyebrow-wide)] text-[var(--v5-orange-strong)]">
              字幕基线
            </span>
            <span className="absolute -left-px -top-1 h-2 w-px bg-[var(--v5-orange-strong)]" />
            <span className="absolute -right-px -top-1 h-2 w-px bg-[var(--v5-orange-strong)]" />
            {isMagnetic && (
               <div className="absolute right-4 -top-6 rounded bg-black/72 px-1.5 py-0.5 text-xs font-semibold text-[var(--v5-orange-strong)]">
                 已贴合参考线
               </div>
            )}
          </div>
          
          {/* Target Black Bar Center Line */}
          {targetCqh > 0 && (
            <div 
            className="pointer-events-none absolute left-0 right-0 z-40 border-b border-dashed border-white/35 transition-all duration-300"
            style={{
              bottom: `${targetCqh}cqh`,
              opacity: (guides.show || guides.temp) && !isMagnetic ? 1 : 0,
            }}
          >
            <span className="absolute right-3 -top-6 rounded bg-black/72 px-1.5 py-0.5 text-xs font-medium text-white/58">画幅参考线</span>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
