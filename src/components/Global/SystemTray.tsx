'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useStudioStore } from '@/store/useStudioStore';

// ─── Icons ───────────────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

// ─── Route configuration ──────────────────────────────────────────────────────

const NAV_ITEMS: { href: string; label: string; Icon: React.FC }[] = [];

const CRUMB_MAP: Record<string, string> = {
  '/': 'SubStudio',
};

const STEP_LABEL: Record<number, string> = {
  1: '上传',
  2: '工作台',
  3: '放映厅',
};

const getDefaultScale = () => {
  if (typeof window === 'undefined') return 1.0;

  const savedScale = localStorage.getItem('nexus_site_scale');
  if (savedScale) {
    const parsed = parseFloat(savedScale);
    if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 1.3) return parsed;
  }

  return 1.0;
};

// ─── Tray ─────────────────────────────────────────────────────────────────────

export const SystemTray = () => {
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [scale, setScale] = useState(getDefaultScale);
  const { workflowStep, restartSystem, tasks } = useStudioStore();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isHome && tasks.length > 0 && workflowStep > 1) {
      const confirmLeave = window.confirm('离开此页面将丢失当前的字幕任务信息，确定要离开吗？');
      if (!confirmLeave) {
        e.preventDefault();
      } else {
        restartSystem();
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('nexus_site_scale', String(scale));
    document.documentElement.style.setProperty('--site-scale', String(scale));
  }, [scale]);

  const cycleScale = () => {
    const nextScales: Record<number, number> = { 1.0: 1.1, 1.1: 1.2, 1.2: 1.3, 1.3: 1.0 };
    const next = nextScales[scale] || 1.0;
    setScale(next);
    localStorage.setItem('nexus_site_scale', String(next));
    document.documentElement.style.setProperty('--site-scale', String(next));
  };

  // L-2 fix: setInterval (1s) instead of rAF — no need to re-render 60×/s for a clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const isHome = pathname === '/';
  const crumb  = CRUMB_MAP[pathname] ?? 'SubStudio';

  return (
    <nav
      aria-label="System tray"
      className="fixed top-0 w-full z-50 h-[64px] flex items-center px-5 md:px-8
        bg-[#020203]/72 backdrop-blur-md border-b border-white/[0.07]
        justify-between transition-colors duration-300"
    >
      {/* ── Left: brand + nav ──────────────────────────────── */}
      <div className="flex items-center gap-3 text-base tracking-tight min-w-0">
        <Link
          href="/"
          onClick={handleNavClick}
          className={`flex items-center gap-1.5 transition-colors duration-150 shrink-0 font-semibold
            ${isHome ? 'text-white/90' : 'text-white/40 hover:text-white/80'}`}
          aria-label="Go to SubStudio home"
        >
          <HomeIcon />
          <span>SubStudio</span>
        </Link>

        <span className="text-white/15 select-none">/</span>
        <span className="text-[#e5e7eb] font-medium truncate">
          {isHome ? STEP_LABEL[workflowStep] : crumb}
        </span>
      </div>

      {/* ── Center: app nav tabs ─────────────────────────────────────── */}
      {NAV_ITEMS.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5
          bg-white/[0.015] p-1 rounded-full border border-white/[0.08] backdrop-blur-md">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3.5 py-1 rounded-full text-[12px] font-medium
                  transition-all duration-150 border
                  ${isActive
                    ? 'text-white bg-white/[0.06] border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                    : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.03]'}`}
              >
                <span className={`transition-colors duration-150 ${isActive ? 'text-emerald-400' : 'text-current'}`}>
                  <Icon />
                </span>
                <span>{label.toLowerCase()}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Right: scale selector & clock ─────────────────────────────── */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={cycleScale}
          className="px-3 py-1.5 rounded-xl glass-btn-ar text-xs font-mono text-neutral-300 hover:text-neutral-100 cursor-pointer select-none flex items-center gap-1.5"
          title="调节网页整体缩放"
        >
          <span className="text-xs opacity-70 font-bold tracking-wide">A±</span>
          <span className="font-bold text-[#e5e7eb]" suppressHydrationWarning>{Math.round(scale * 100)}%</span>
        </button>
        <span
          className="text-xs font-mono text-white/50 tabular-nums"
          aria-label="Current time"
        >
          {time}
        </span>
      </div>
    </nav>
  );
};
