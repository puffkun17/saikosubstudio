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
        className="v4-focus-ring inline-flex h-5 w-5 items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-accent-strong)] focus-visible:border-[var(--v4-accent)] focus-visible:text-[var(--v4-text)] focus-visible:outline-none"
      >
        <Info className="h-4 w-4" />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          style={{ top: position.top, left: position.left }}
          className="pointer-events-none fixed z-[var(--z-dropdown)] w-[min(19rem,calc(100vw-2rem))] -translate-y-1/2 rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-4 py-3 text-left text-sm leading-5 text-[var(--v4-text)] shadow-[var(--elevation-2)]"
        >
          {children}
        </span>,
        document.body
      )}
    </span>
  );
};
