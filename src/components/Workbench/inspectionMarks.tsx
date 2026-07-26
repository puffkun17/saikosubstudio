'use client';

import React from 'react';

/** 时间轴检查标记：结构差异 / 画面文字 / 声音描述 / 歌词 */
export type InspectionMarkKind = 'structure' | 'screen' | 'sound' | 'lyrics';

export type InspectionMarkFilter = 'all' | 'structure' | 'screen-text' | 'sound-caption' | 'lyrics';

/** Ridgeline 辅色：Danger / Forest slate / Warning / Bronze — 禁止体系外蓝与紫 */
export const MARK_COLOR: Record<InspectionMarkKind, string> = {
  structure: '#c45b55', // --v5-danger
  screen: '#456660', // forest slate（墨绿派生，替代 #3b82f6）
  sound: '#c4893a', // --v5-warning
  lyrics: '#9a7b4f', // bronze，与 warning 琥珀区分
};

/** 全局全称，禁止缩成「结构 / 画面 / 声音 / 歌词」以外的简称乱造 */
export const MARK_LABEL: Record<InspectionMarkKind, string> = {
  structure: '结构差异',
  screen: '画面文字',
  sound: '声音描述',
  lyrics: '歌词',
};

/** 四轨 ridgeline 纵向位置（配合 h-10 轨道） */
export const MARK_LANE_TOP: Record<InspectionMarkKind, string> = {
  structure: '5px',
  screen: '14px',
  sound: '23px',
  lyrics: '32px',
};

export const MARK_KIND_ORDER: InspectionMarkKind[] = ['structure', 'screen', 'sound', 'lyrics'];

export const MARK_FILTERS: Array<{ id: InspectionMarkFilter; kind?: InspectionMarkKind; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'structure', kind: 'structure', label: MARK_LABEL.structure },
  { id: 'screen-text', kind: 'screen', label: MARK_LABEL.screen },
  { id: 'sound-caption', kind: 'sound', label: MARK_LABEL.sound },
  { id: 'lyrics', kind: 'lyrics', label: MARK_LABEL.lyrics },
];

type GlyphProps = {
  kind: InspectionMarkKind;
  size?: number;
  className?: string;
  /** 暗点轨用半透明 */
  muted?: boolean;
};

/** 方块 = 结构差异；圆形 = 画面文字；三角形 = 声音描述；音符 = 歌词 */
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

  // sound — triangle
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
