'use client';

import React from 'react';

type ScoreRingProps = {
  score: number;
  size?: number;
  stroke?: number;
};

/** Grammarly-like circular score gauge. */
export const ScoreRing: React.FC<ScoreRingProps> = ({ score, size = 54, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c * (1 - clamped / 100);
  const tone = clamped >= 85 ? '#2f6b44' : clamped >= 70 ? '#1f7f78' : '#b8433c';

  return (
    <div className="wb-ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--v5-panel-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <b className="wb-ring__n">{clamped}</b>
    </div>
  );
};
