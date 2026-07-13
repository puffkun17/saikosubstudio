'use client';

import React from 'react';
import type { StyleSettings } from '@/utils/subtitleCore';

interface AssStylePreviewProps {
  style: Partial<StyleSettings>;
  className?: string;
  compact?: boolean;
}

const getPreviewFontSize = (value: number | undefined, fallback: number, compact: boolean) => {
  const scaled = (value || fallback) * (compact ? 0.72 : 0.82);
  return Math.max(compact ? 12 : 14, Math.min(compact ? 20 : 24, scaled));
};

const getTextShadow = (outline: string | undefined) => {
  const color = outline || '#000000';
  return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}, 0 2px 5px rgba(0,0,0,0.9)`;
};

export const AssStylePreview: React.FC<AssStylePreviewProps> = ({
  style,
  className = '',
  compact = false,
}) => {
  const zhSize = getPreviewFontSize(style.zhFontSize, 20, compact);
  const enSize = getPreviewFontSize(style.enFontSize, 12, compact);
  const verticalInset = Math.max(compact ? 14 : 18, Math.min(compact ? 30 : 38, (style.marginV || 20) * 0.8));

  return (
    <div
      className={`relative isolate overflow-hidden rounded-lg border border-white/[0.08] bg-[#050607] ${compact ? 'min-h-28' : 'min-h-36'} ${className}`}
      role="img"
      aria-label="ASS 文件内嵌字幕样式预览"
    >
      <div className="absolute inset-x-0 top-1/3 border-t border-white/[0.035]" aria-hidden="true" />
      <div className="absolute inset-x-0 top-2/3 border-t border-white/[0.035]" aria-hidden="true" />
      <div className="absolute inset-y-0 left-1/2 border-l border-white/[0.025]" aria-hidden="true" />

      <div
        className={`relative flex h-full min-h-[inherit] flex-col items-center justify-end text-center ${compact ? 'px-3' : 'px-5'}`}
        style={{ paddingBottom: `${verticalInset}px` }}
      >
        <span
          className="max-w-full truncate font-semibold leading-tight"
          style={{
            color: style.zhColor || '#FFFFFF',
            fontFamily: style.zhFontFamily || 'system-ui, sans-serif',
            fontSize: `${zhSize}px`,
            textShadow: getTextShadow(style.zhOutline),
          }}
        >
          字幕样式预览
        </span>
        <span
          className="mt-1 max-w-full truncate leading-tight"
          style={{
            color: style.enColor || '#E5E7EB',
            fontFamily: style.enFontFamily || 'Helvetica Neue, Arial, sans-serif',
            fontSize: `${enSize}px`,
            textShadow: getTextShadow(style.enOutline),
          }}
        >
          Subtitle style preview
        </span>
      </div>
    </div>
  );
};
