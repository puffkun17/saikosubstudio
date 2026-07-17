'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowLeft, FolderClock, MessageSquareText, RotateCcw, ShieldCheck } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

const STEP_LABEL: Record<number, string> = {
  1: '导入',
  2: '工作台',
  3: '预览',
};

const WORKFLOW_STEPS = [
  { id: 1, label: '导入' },
  { id: 2, label: '工作台' },
  { id: 3, label: '预览' },
];

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
  const [time, setTime] = useState('');
  const [scale, setScale] = useState(getDefaultScale);
  const [pendingReset, setPendingReset] = useState(false);
  const pathname = usePathname();
  const { workflowStep, restartSystem, tasks, processedSubs, libraryList, setLibraryOpen, setWorkflowStep, setStatusNotice } = useStudioStore();
  const isInfoPage = pathname === '/about' || pathname === '/feedback';

  const hasUploadData = tasks.length > 0;
  const hasWorkbenchData = Boolean(processedSubs?.length);

  const handleStepClick = (targetStep: number) => {
    if (targetStep === workflowStep) return;

    if (targetStep === 1) {
      if (hasUploadData || hasWorkbenchData) {
        setPendingReset(true);
        return;
      }
      setWorkflowStep(1);
      return;
    }

    if (targetStep === 2) {
      if (!hasUploadData && !hasWorkbenchData) {
        setStatusNotice({
          id: 'workflow-guard',
          tone: 'notice',
          title: '请先导入字幕',
          message: '加入文件并整理后，即可进入工作台。',
        });
        return;
      }
      setWorkflowStep(2);
      return;
    }

    if (targetStep === 3) {
      if (!hasWorkbenchData) {
        setStatusNotice({
          id: 'workflow-guard',
          tone: 'notice',
          title: '请先生成预览',
          message: '在工作台确认轨道后，再打开预览。',
        });
        return;
      }
      setWorkflowStep(3);
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

  useEffect(() => {
    if (!pendingReset) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingReset(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [pendingReset]);

  return (
    <>
    <nav
      aria-label="全局导航"
      className="fixed top-0 z-[var(--z-nav)] flex h-[68px] w-full items-center justify-between border-b border-[var(--v4-line)] bg-[color:rgba(12,11,10,0.92)] px-5 backdrop-blur-md transition-colors duration-300 md:px-8"
    >
      {/* ── Left: brand + nav ──────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-3 tracking-tight">
        <button
          type="button"
          onClick={() => handleStepClick(1)}
          className="v4-focus-ring flex shrink-0 cursor-pointer items-center gap-2 rounded-md text-base font-semibold text-[var(--v4-text)] transition-colors duration-150 hover:text-white"
          aria-label="返回导入页"
        >
          <Image src="/favicon.svg" alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8 rounded-[9px] shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
          <span className="hidden sm:inline">SubStudio</span>
        </button>

        {!isInfoPage && <div className="hidden items-center gap-1 border-l border-[var(--v4-line)] pl-3 md:flex">
          {WORKFLOW_STEPS.map(step => {
            const isActive = workflowStep === step.id;
            const disabled = (step.id === 2 && !hasUploadData && !hasWorkbenchData) || (step.id === 3 && !hasWorkbenchData);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                  className={`v4-focus-ring cursor-pointer rounded-md px-4 py-2 text-base font-semibold transition-all
                  ${isActive
                    ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                    : disabled
                      ? 'cursor-help text-[var(--v4-text-faint)]'
                      : 'text-[var(--v4-text-muted)] hover:bg-white/[0.04] hover:text-white'}`}
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={disabled}
              >
                {step.label}
              </button>
            );
          })}
        </div>}

        {isInfoPage && (
          <Link
            href="/"
            className="v4-focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] px-3 text-sm font-medium text-[var(--v4-accent-strong)] transition-colors hover:border-[var(--v4-accent)]"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
            <span className="hidden lg:inline">返回首页</span>
          </Link>
        )}

        {!isInfoPage && <span className="md:hidden text-white/45 font-medium truncate">
          {STEP_LABEL[workflowStep]}
        </span>}
      </div>

      {/* ── Right: scale selector & clock ─────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {workflowStep === 1 && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
          className="v4-focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)] hover:text-white"
            title="历史存档字幕"
          >
            <FolderClock className="h-[18px] w-[18px] stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
            <span className="hidden lg:inline">历史存档</span>
            {libraryList.length > 0 && (
              <span className="hidden min-w-5 items-center justify-center rounded bg-[var(--v4-accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--v4-accent-strong)] lg:inline-flex">
                {libraryList.length}
              </span>
            )}
          </button>
        )}
        <Link
          href="/about"
          className="v4-focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)] hover:text-white"
          title="隐私与版权"
        >
          <ShieldCheck className="h-[18px] w-[18px] stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
          <span className="hidden lg:inline">隐私与版权</span>
        </Link>
        <Link
          href="/feedback"
          className="v4-focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)] hover:text-white"
          title="提交反馈"
        >
          <MessageSquareText className="h-[18px] w-[18px] stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
          <span className="hidden sm:inline">反馈</span>
        </Link>
        <button
          onClick={cycleScale}
          className="v4-focus-ring hidden h-10 cursor-pointer select-none items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-sm font-mono text-[var(--v4-text-muted)] hover:text-white lg:flex"
          title="调节网页整体缩放"
        >
          <span className="text-xs opacity-75 font-bold tracking-wide">A±</span>
          <span className="font-bold text-[var(--v4-text)]" suppressHydrationWarning>{Math.round(scale * 100)}%</span>
        </button>
        <span
          className="status-clock hidden md:inline text-sm text-white/70 tabular-nums"
          aria-label="当前时间"
        >
          {time}
        </span>
      </div>
    </nav>

    {pendingReset && (
      <OverlayPortal>
        <div
          className="ui-modal-layer fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setPendingReset(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restart-title"
            aria-describedby="restart-description"
            className="w-full max-w-sm rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] p-5 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 id="restart-title" className="text-lg font-semibold text-[var(--v4-text)]">清空当前进度？</h2>
                <p id="restart-description" className="mt-1.5 text-sm leading-6 text-[var(--v4-text-muted)]">
                  将清除已导入的文件、轨道选择与预览结果。历史存档不会受到影响。
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-text-muted)] hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]"
                onClick={() => setPendingReset(false)}
              >
                继续编辑
              </button>
              <button
                type="button"
                className="rounded-md border border-[color:rgba(201,138,134,0.32)] bg-[color:rgba(201,138,134,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-danger)] hover:bg-[color:rgba(201,138,134,0.2)]"
                onClick={() => { setPendingReset(false); restartSystem(); }}
              >
                清空并重新开始
              </button>
            </div>
          </div>
        </div>
      </OverlayPortal>
    )}
    </>
  );
};
