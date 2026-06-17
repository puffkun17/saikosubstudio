'use client';

import React from 'react';
import { Info } from 'lucide-react';

interface InfoHintProps {
  label: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export const InfoHint: React.FC<InfoHintProps> = ({
  label,
  children,
  side = 'right',
  className = '',
}) => (
  <span className={`group/infotip relative inline-flex items-center ${className}`}>
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition-colors hover:border-white/[0.16] hover:text-neutral-200 focus-visible:border-white/25 focus-visible:text-neutral-100 focus-visible:outline-none"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-1/2 z-[80] hidden w-72 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#101115]/95 px-3.5 py-3 text-left text-xs leading-5 text-neutral-300 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-md group-hover/infotip:block group-focus-within/infotip:block ${
        side === 'left' ? 'right-6' : 'left-6'
      }`}
    >
      {children}
    </span>
  </span>
);
