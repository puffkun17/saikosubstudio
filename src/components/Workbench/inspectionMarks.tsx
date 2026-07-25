'use client';

import React from 'react';

/** 时间轴检查标记：结构差异 / 画面文字 / 声音描述 */
export type InspectionMarkKind = 'structure' | 'screen' | 'sound';

export type InspectionMarkFilter = 'all' | 'structure' | 'screen-text' | 'sound-caption';

export const MARK_COLOR: Record<InspectionMarkKind, string> = {
  structure: '#c45b55',
  screen: '#3b82f6',
  sound: '#c4893a',
};

/** 全局全称，禁止缩成「结构 / 画面 / 声音」 */
export const MARK_LABEL: Record<InspectionMarkKind, string> = {
  structure: '结构差异',
  screen: '画面文字',
  sound: '声音描述',
};

export const MARK_LANE_TOP: Record<InspectionMarkKind, string> = {
  structure: '7px',
  screen: '17px',
  sound: '27px',
};

export const MARK_FILTERS: Array<{ id: InspectionMarkFilter; kind?: InspectionMarkKind; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'structure', kind: 'structure', label: MARK_LABEL.structure },
  { id: 'screen-text', kind: 'screen', label: MARK_LABEL.screen },
  { id: 'sound-caption', kind: 'sound', label: MARK_LABEL.sound },
];

type GlyphProps = {
  kind: InspectionMarkKind;
  size?: number;
  className?: string;
  /** 暗点轨用半透明 */
  muted?: boolean;
};

/** 方块 = 结构差异；圆形 = 画面文字；三角形 = 声音描述 */
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
