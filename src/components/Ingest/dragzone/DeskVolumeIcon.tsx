'use client';

import React, { useId } from 'react';
import type { DeskExt } from '@/core/deskGrouping';

const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--pt-font-mono)',
  fontWeight: 600,
  letterSpacing: '0.04em',
};

const CardFace: React.FC<{
  ext: DeskExt;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}> = ({ ext, x, y, w, h, rx }) => {
  const clipId = useId();

  if (ext === 'zip' || ext === 'rar' || ext === '7z') {
    const code = ext === '7z' ? '7z' : ext.toUpperCase();
    return (
      <>
        <rect x={x + 1} y={y + 3} width={w - 2} height={h} rx={rx} fill="var(--paper-deep)" />
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          fill="var(--paper-raised)"
          stroke="var(--desk-icon-rim-strong)"
          strokeWidth={1}
        />
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect x={x} y={y} width={w} height={18} fill="var(--ink-strong)" />
          <rect x={x} y={y + 18} width={w} height={1} fill="var(--desk-icon-specular)" />
          <rect x={x + w / 2 - 6} y={y + 7} width={2} height={4} rx={1} fill="var(--paper-deep)" opacity={0.42} />
          <rect x={x + w / 2 - 1} y={y + 7} width={2} height={4} rx={1} fill="var(--paper-deep)" opacity={0.42} />
          <rect x={x + w / 2 + 4} y={y + 7} width={2} height={4} rx={1} fill="var(--paper-deep)" opacity={0.42} />
        </g>
        <rect x={x + w / 2 - 8} y={y + 14.5} width={16} height={6.5} rx={3.25} fill="var(--accent)" />
        <text x={x + 9} y={y + h - 10} fontSize={12.5} fill="var(--ink-strong)" style={MONO_STYLE}>
          {code}
        </text>
      </>
    );
  }

  if (ext === 'ass') {
    return (
      <>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
        <rect x={x + 0.5} y={y + 2.5} width={w - 1} height={h} rx={rx} fill="var(--paper-deep)" />
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          fill="var(--paper-raised)"
          stroke="var(--desk-icon-rim)"
          strokeWidth={1}
        />
        <g clipPath={`url(#${clipId})`}>
          <line x1={x} y1={y + 0.75} x2={x + w - 15} y2={y + 0.75} stroke="var(--desk-icon-specular)" strokeWidth={1.2} />
          <path d={`M${x + w - 15} ${y} H${x + w} V${y + 15} Z`} fill="var(--accent)" />
          <line x1={x + w - 15} y1={y} x2={x + w} y2={y + 15} stroke="var(--desk-icon-specular)" strokeWidth={0.9} opacity={0.55} />
        </g>
        <rect x={x + 9} y={y + 22} width={18} height={3} rx={1.5} fill="var(--accent)" opacity={0.88} />
        <rect x={x + 9} y={y + 28} width={11} height={2.5} rx={1.25} fill="var(--rule-strong)" opacity={0.7} />
        <text x={x + 9} y={y + h - 9} fontSize={12.5} fill="var(--accent-text)" style={MONO_STYLE}>
          ASS
        </text>
      </>
    );
  }

  const cut = 13;
  const label = ext === 'srt' ? 'SRT' : 'TXT';
  return (
    <>
      <path
        d={`M${x + rx} ${y + 2.5} H${x + w - cut} L${x + w - 0.5} ${y + cut + 2.5} V${y + h - rx + 2.5} C${x + w - 0.5} ${y + h + 2.5} ${x + w - rx} ${y + h + 2.5} ${x + w - rx} ${y + h + 2.5} H${x + rx} C${x + 0.5} ${y + h + 2.5} ${x + 0.5} ${y + h - rx + 2.5} ${x + 0.5} ${y + h - rx + 2.5} V${y + rx + 2.5} Z`}
        fill="var(--paper-deep)"
      />
      <path
        d={`M${x + rx} ${y} H${x + w - cut} L${x + w} ${y + cut} V${y + h - rx} C${x + w} ${y + h - rx * 0.3} ${x + w - rx * 0.3} ${y + h} ${x + w - rx} ${y + h} H${x + rx} C${x + rx * 0.3} ${y + h} ${x} ${y + h - rx * 0.3} ${x} ${y + h - rx} V${y + rx} C${x} ${y + rx * 0.3} ${x + rx * 0.3} ${y} ${x + rx} ${y} Z`}
        fill="var(--paper-raised)"
        stroke="var(--desk-icon-rim)"
        strokeWidth={1}
      />
      <path
        d={`M${x + w - cut} ${y} V${y + cut - 3} C${x + w - cut} ${y + cut - 1.2} ${x + w - cut + 1.2} ${y + cut} ${x + w - cut + 3} ${y + cut} H${x + w} Z`}
        fill="var(--paper-deep)"
      />
      <rect x={x + 9} y={y + 22} width={16} height={2.5} rx={1.25} fill="var(--rule-strong)" opacity={0.8} />
      <rect x={x + 9} y={y + 27.5} width={10} height={2.5} rx={1.25} fill="var(--rule-hair)" />
      <text x={x + 9} y={y + h - 9} fontSize={12.5} fill="var(--ink-strong)" style={MONO_STYLE}>
        {label}
      </text>
    </>
  );
};

/**
 * Modern sculpted 84x84 paper-tactile desktop icon:
 * - Single files: crisp cardstock thickness + minimal embossed mark.
 * - Multi-file stacks: 3-deck upward layers (GPU transform hover fan) + cutout count badge.
 */
export const DeskVolumeIcon: React.FC<{
  ext: DeskExt;
  count?: number;
  className?: string;
}> = ({ ext, count = 1, className = '' }) => {
  if (count <= 1) {
    const isArchive = ext === 'zip' || ext === 'rar' || ext === '7z';
    return (
      <svg className={`desk-icon-canvas ${className}`.trim()} viewBox="0 0 84 84" fill="none" aria-hidden="true">
        {isArchive ? (
          <CardFace ext={ext} x={15} y={16} w={54} h={52} rx={7} />
        ) : (
          <CardFace ext={ext} x={20} y={12} w={44} h={58} rx={7} />
        )}
      </svg>
    );
  }

  const badgeFill = ext === 'ass' ? 'var(--accent)' : 'var(--ink-strong)';
  const label = `×${count}`;
  const pillW = label.length >= 3 ? 31 : 25;
  const pillX = 76 - pillW;

  return (
    <svg className={`desk-icon-canvas ${className}`.trim()} viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <g className="desk-deck-back">
        <rect x={24} y={7} width={36} height={48} rx={6} fill="var(--paper-deep)" stroke="var(--desk-icon-rim)" strokeWidth={0.9} />
      </g>
      <g className="desk-deck-mid">
        <rect x={21} y={12} width={42} height={52} rx={6.5} fill="var(--paper-sheet)" stroke="var(--desk-icon-rim)" strokeWidth={0.9} />
      </g>
      <g className="desk-deck-front">
        <CardFace ext={ext} x={18} y={17} w={46} h={54} rx={7} />
      </g>
      <rect
        x={pillX}
        y={55}
        width={pillW}
        height={19}
        rx={5.5}
        fill={badgeFill}
        stroke="var(--desk-surface)"
        strokeWidth={2.5}
        style={{ paintOrder: 'stroke fill' }}
      />
      <text
        x={pillX + pillW / 2}
        y={68}
        textAnchor="middle"
        fontSize={11.5}
        fill="var(--accent-ink)"
        style={MONO_STYLE}
      >
        {label}
      </text>
    </svg>
  );
};
