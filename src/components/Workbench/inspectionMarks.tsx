'use client';

import React from 'react';

/** 时间轴检查标记：结构差异 / 画面文字 / 声音描述 / 歌词 / 署名信息 */
export type InspectionMarkKind = 'structure' | 'screen' | 'sound' | 'lyrics' | 'credit';

export type InspectionMarkFilter =
  | 'all'
  | 'structure'
  | 'screen-text'
  | 'sound-caption'
  | 'lyrics'
  | 'credit';

/** Ridgeline 辅色 — 禁止体系外蓝与紫 */
export const MARK_COLOR: Record<InspectionMarkKind, string> = {
  structure: '#c45b55', // --v5-danger
  screen: '#456660', // forest slate
  sound: '#c4893a', // --v5-warning
  lyrics: '#9a7b4f', // bronze
  credit: '#8a7355', // warm stone，署名星标
};

/** 全局全称 */
export const MARK_LABEL: Record<InspectionMarkKind, string> = {
  structure: '结构差异',
  screen: '画面文字',
  sound: '声音描述',
  lyrics: '歌词',
  credit: '署名信息',
};

/** 五轨 ridgeline 纵向位置（配合 h-11 轨道） */
export const MARK_LANE_TOP: Record<InspectionMarkKind, string> = {
  structure: '4px',
  screen: '12px',
  sound: '20px',
  lyrics: '28px',
  credit: '36px',
};

export const MARK_KIND_ORDER: InspectionMarkKind[] = ['structure', 'screen', 'sound', 'lyrics', 'credit'];

export const MARK_FILTERS: Array<{ id: InspectionMarkFilter; kind?: InspectionMarkKind; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'structure', kind: 'structure', label: MARK_LABEL.structure },
  { id: 'screen-text', kind: 'screen', label: MARK_LABEL.screen },
  { id: 'sound-caption', kind: 'sound', label: MARK_LABEL.sound },
  { id: 'lyrics', kind: 'lyrics', label: MARK_LABEL.lyrics },
  { id: 'credit', kind: 'credit', label: MARK_LABEL.credit },
];

type GlyphProps = {
  kind: InspectionMarkKind;
  size?: number;
  className?: string;
  muted?: boolean;
};

/** 方块=结构；圆=画面；三角=声音；音符=歌词；五角星=署名 */
export function InspectionMarkGlyph({ kind, size = 8, className = '', muted = false }: GlyphProps) {
  const color = MARK_COLOR[kind];
  const opacity = muted ? 0.28 : 1;

  if (kind === 'structure') {
    return (
      <span
        className={`inline-block shrink-0 ${className}`}
        style={{ width: size, height: size, background: color, opacity }}
        aria-hidden="true"
      />
    );
  }

  if (kind === 'screen') {
    return (
      <span
        className={`inline-block shrink-0 rounded-full ${className}`}
        style={{ width: size, height: size, background: color, opacity }}
        aria-hidden="true"
      />
    );
  }

  if (kind === 'lyrics') {
    return (
      <svg
        className={`shrink-0 ${className}`}
        width={size}
        height={size}
        viewBox="0 0 10 10"
        aria-hidden="true"
        style={{ opacity }}
      >
        <path
          fill={color}
          d="M6.2 1.1v4.55a1.85 1.85 0 1 1-.85-1.55V3.35L8.9 2.55v3.55a1.85 1.85 0 1 1-.85-1.55V1.35L6.2 1.1z"
        />
      </svg>
    );
  }

  if (kind === 'credit') {
    return (
      <svg
        className={`shrink-0 ${className}`}
        width={size}
        height={size}
        viewBox="0 0 10 10"
        aria-hidden="true"
        style={{ opacity }}
      >
        <path
          fill={color}
          d="M5 0.9l1.18 2.39 2.64.38-1.91 1.86.45 2.63L5 6.92 2.64 8.16l.45-2.63L1.18 3.67l2.64-.38L5 0.9z"
        />
      </svg>
    );
  }

  return (
    <svg
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{ opacity }}
    >
      <polygon points="5,1.2 9.2,8.8 0.8,8.8" fill={color} />
    </svg>
  );
}
