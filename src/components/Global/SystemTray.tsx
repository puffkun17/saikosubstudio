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

const trayChrome =
  'flex h-[var(--tray-h)] w-full items-center gap-3 border-[var(--v4-line)] bg-[color:rgba(12,11,10,0.92)] px-4 backdrop-blur-md transition-colors duration-300 sm:px-6 md:px-8';

/** Icon+label control: never squash copy — hide label via container query instead. */
const trayCtrl =
  'v4-focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-[15px] font-medium text-[var(--v4-text-muted)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)] hover:text-white';

/**
 * Labels appear from available deck width (parent @container), not control width —
 * avoids the hide↔narrow feedback loop. Thresholds stay generous.
 */
const trayLabelLong = 'hidden whitespace-nowrap @[22rem]/tray:inline';
const trayLabelShort = 'hidden whitespace-nowrap @[14rem]/tray:inline';

const getDefaultScale = () => {
  if (typeof window === 'undefined') return 1.0;

  const savedScale = localStorage.getItem('nexus_site_scale');
  if (savedScale) {
    const parsed = parseFloat(savedScale);
    if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 1.3) return parsed;
  }

  return 1.0;
};

const readLocalStamp = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const city = tz.includes('/') ? tz.split('/').pop()?.replace(/_/g, ' ') : '';
    const short = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')
      ?.value;
    return {
      zoneShort: short || 'LOCAL',
      zoneCity: city || '',
    };
  } catch {
    return { zoneShort: 'LOCAL', zoneCity: '' };
  }
};

export const SystemTray = () => {
  const [time, setTime] = useState('');
  const [{ zoneShort, zoneCity }] = useState(readLocalStamp);
  const [scale, setScale] = useState(getDefaultScale);
  const [pendingReset, setPendingReset] = useState(false);
  const pathname = usePathname();
  const {
    workflowStep,
    restartSystem,
    tasks,
    processedSubs,
    libraryList,
    setLibraryOpen,
    setWorkflowStep,
    setStatusNotice,
  } = useStudioStore();
  const isInfoPage = pathname === '/about' || pathname === '/feedback';

  const hasUploadData = tasks.length > 0;
  const hasWorkbenchData = Boolean(processedSubs?.length);
  const showLibrary = !isInfoPage && workflowStep === 1;

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
      {/* ── Top: brand + workflow + scale + local clock ───────────────── */}
      <nav
        aria-label="全局导航"
        className={`system-tray system-tray--top fixed top-0 z-[var(--z-nav)] justify-between border-b ${trayChrome}`}
      >
        <div className="flex min-w-0 items-center gap-3 tracking-tight">
          <button
            type="button"
            onClick={() => handleStepClick(1)}
            className="v4-focus-ring flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-md text-[17px] font-semibold text-[var(--v4-text)] transition-colors duration-150 hover:text-white"
            aria-label="返回导入页"
          >
            <Image
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="h-8 w-8 rounded-[9px] shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            />
            <span className="hidden whitespace-nowrap min-[420px]:inline">SubStudio</span>
          </button>

          {!isInfoPage && (
            <div className="hidden items-center gap-1 border-l border-[var(--v4-line)] pl-3 min-[720px]:flex">
              {WORKFLOW_STEPS.map((step) => {
                const isActive = workflowStep === step.id;
                const disabled =
                  (step.id === 2 && !hasUploadData && !hasWorkbenchData)
                  || (step.id === 3 && !hasWorkbenchData);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    className={`v4-focus-ring cursor-pointer whitespace-nowrap rounded-md px-4 py-2 text-[15px] font-semibold transition-all ${
                      isActive
                        ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                        : disabled
                          ? 'cursor-help text-[var(--v4-text-faint)]'
                          : 'text-[var(--v4-text-muted)] hover:bg-white/[0.04] hover:text-white'
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                    aria-disabled={disabled}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          )}

          {isInfoPage && (
            <Link
              href="/"
              className={`${trayCtrl} border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)] hover:border-[var(--v4-accent)]`}
              aria-label="返回首页"
            >
              <ArrowLeft className="h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
              <span className="hidden whitespace-nowrap min-[480px]:inline">返回首页</span>
            </Link>
          )}

          {!isInfoPage && (
            <span className="truncate text-[15px] font-medium text-white/45 min-[720px]:hidden">
              {STEP_LABEL[workflowStep]}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={cycleScale}
            className={`${trayCtrl} cursor-pointer select-none font-mono`}
            title="调节网页整体缩放"
            aria-label={`网页缩放 ${Math.round(scale * 100)}%`}
          >
            <span className="text-[13px] font-bold tracking-wide text-[var(--v4-accent-strong)]">A±</span>
            <span className="font-bold text-[var(--v4-text)]" suppressHydrationWarning>
              {Math.round(scale * 100)}%
            </span>
          </button>

          <div
            className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3"
            aria-label={`本地时间 ${zoneShort} ${time}`}
          >
            <span className="rounded border border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--v4-accent-strong)]">
              LOCAL
            </span>
            <span className="text-[15px] font-medium tabular-nums text-[var(--v4-text)]" suppressHydrationWarning>
              {time || '--:--:--'}
            </span>
            <span className="hidden font-mono text-[12px] text-[var(--v4-text-muted)] min-[900px]:inline" suppressHydrationWarning>
              {zoneShort}
            </span>
            {zoneCity ? (
              <span className="hidden text-[12px] text-[var(--v4-text-faint)] min-[1100px]:inline" suppressHydrationWarning>
                {zoneCity}
              </span>
            ) : null}
          </div>
        </div>
      </nav>

      {/* ── Bottom: ops — left grows with scene actions; right never squashes labels ─ */}
      <div
        role="toolbar"
        aria-label="操作台"
        className={`system-tray system-tray--bottom fixed bottom-0 z-[var(--z-nav)] border-t ${trayChrome}`}
      >
        <div className="flex min-w-0 items-center justify-start gap-2">
          {/* Scene primary actions land here later */}
        </div>

        {/* Container = remaining deck width (generous when left is empty). */}
        <div className="@container/tray flex min-w-0 flex-1 items-center justify-end">
          <div className="flex shrink-0 items-center gap-2">
            {showLibrary && (
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className={`${trayCtrl} cursor-pointer`}
                title="历史存档字幕"
                aria-label="历史存档"
              >
                <FolderClock className="h-5 w-5 shrink-0 stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
                <span className={trayLabelLong}>历史存档</span>
                {libraryList.length > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded bg-[var(--v4-accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--v4-accent-strong)]">
                    {libraryList.length}
                  </span>
                )}
              </button>
            )}
            <Link href="/about" className={trayCtrl} title="隐私与版权" aria-label="隐私与版权">
              <ShieldCheck className="h-5 w-5 shrink-0 stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
              <span className={trayLabelLong}>隐私与版权</span>
            </Link>
            <Link href="/feedback" className={trayCtrl} title="提交反馈" aria-label="反馈">
              <MessageSquareText className="h-5 w-5 shrink-0 stroke-[2.2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
              <span className={trayLabelShort}>反馈</span>
            </Link>
          </div>
        </div>
      </div>

      {pendingReset && (
        <OverlayPortal>
          <div
            className="ui-modal-layer fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) setPendingReset(false);
            }}
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
                  <h2 id="restart-title" className="text-lg font-semibold text-[var(--v4-text)]">
                    清空当前进度？
                  </h2>
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
                  onClick={() => {
                    setPendingReset(false);
                    restartSystem();
                  }}
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
