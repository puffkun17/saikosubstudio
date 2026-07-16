'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const tooltipWidth = Math.min(304, window.innerWidth - 32);
      const desiredLeft = side === 'left'
        ? rect.left - tooltipWidth - 16
        : rect.right + 16;
      setPosition({
        top: Math.min(window.innerHeight - 28, Math.max(28, rect.top + rect.height / 2)),
        left: Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, desiredLeft)),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, side]);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition-colors hover:border-white/[0.16] hover:text-neutral-200 focus-visible:border-white/25 focus-visible:text-neutral-100 focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          style={{ top: position.top, left: position.left }}
          className="pointer-events-none fixed z-[100] w-[min(19rem,calc(100vw-2rem))] -translate-y-1/2 rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-4 py-3 text-left text-sm leading-5 text-[var(--v4-text)] shadow-[0_16px_40px_rgba(0,0,0,0.48)]"
        >
          {children}
        </span>,
        document.body
      )}
    </span>
  );
};
