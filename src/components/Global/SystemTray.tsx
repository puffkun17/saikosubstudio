'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, ArrowLeft, PenLine, RotateCcw, Scale } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { BottomStatusDeck } from '@/components/Global/BottomStatusDeck';
import { BrandMark } from '@/components/Global/BrandMark';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';

const WORKFLOW_STEPS = [
  { id: 1, label: '导入' },
  { id: 2, label: '工作台' },
  { id: 3, label: '预览' },
];

const trayChrome =
  'flex h-[var(--tray-h)] w-full items-center gap-2.5 border-[var(--v4-line)] px-3 backdrop-blur-md transition-colors duration-300 sm:px-4 md:px-5';

/** Icon+label control: never squash copy — hide label via container query instead. */
const trayCtrl =
  'system-tray__ctrl v4-focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-[15px] font-semibold transition-colors';

/**
 * Labels appear from available deck width (parent @container), not control width —
 * avoids the hide↔narrow feedback loop. HOME-BRAND：短标签「存档/隐私/反馈」，
 * 阈值远低于旧 @[22rem]，默认桌面可见；极窄才 icon-only。
 */
const trayLabel = 'hidden whitespace-nowrap @[8rem]/tray:inline';

const getDefaultScale = () => {
  if (typeof window === 'undefined') return 1.0;

  const savedScale = localStorage.getItem('nexus_site_scale');
  if (savedScale) {
    const parsed = parseFloat(savedScale);
    if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 1.3) return parsed;
  }

  return 1.0;
};

const EMPTY_LOCAL_STAMP = { zoneShort: 'LOCAL', zoneCity: '' };

let cachedLocalStamp: { zoneShort: string; zoneCity: string } | null = null;

const readLocalStamp = () => {
  if (cachedLocalStamp) return cachedLocalStamp;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const city = tz.includes('/') ? tz.split('/').pop()?.replace(/_/g, ' ') : '';
    const short = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')
      ?.value;
    cachedLocalStamp = {
      zoneShort: short || 'LOCAL',
      zoneCity: city || '',
    };
  } catch {
    cachedLocalStamp = EMPTY_LOCAL_STAMP;
  }
  return cachedLocalStamp;
};

/** Client timezone differs from SSR; useSyncExternalStore avoids React #418 on conditional zoneCity. */
const subscribeNoop = () => () => {};

export const SystemTray = () => {
  const [time, setTime] = useState('');
  const { zoneShort, zoneCity } = useSyncExternalStore(
    subscribeNoop,
    readLocalStamp,
    () => EMPTY_LOCAL_STAMP,
  );
  const [scale, setScale] = useState(getDefaultScale);
  const [pendingReset, setPendingReset] = useState(false);
  const resetModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(pendingReset, resetModalRef, () => setPendingReset(false));
  const pathname = usePathname();
  const {
    workflowStep,
    restartSystem,
    hasUploadData,
    hasWorkbenchData,
    hasSessionWork,
    libraryCount,
    setLibraryOpen,
    setWorkflowStep,
  } = useStudioStore(useShallow((state) => ({
    workflowStep: state.workflowStep,
    restartSystem: state.restartSystem,
    hasUploadData: state.tasks.length > 0,
    hasWorkbenchData: Boolean(state.processedSubs?.length),
    hasSessionWork: state.tasks.length > 0
      || state.uploadedFiles.length > 0
      || Boolean(state.processedSubs?.length),
    libraryCount: state.libraryList.length,
    setLibraryOpen: state.setLibraryOpen,
    setWorkflowStep: state.setWorkflowStep,
  })));
  const isInfoPage = pathname === '/about' || pathname === '/feedback';
  const showLibrary = !isInfoPage && workflowStep === 1;

  const confirmLeaveSession = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasSessionWork) return;
    const ok = window.confirm(
      '当前导入尚未结束。离开本页会丢失未存档的进度；已写入「存档」的项目仍可恢复。确定离开？',
    );
    if (!ok) {
      event.preventDefault();
      return;
    }
    // Allow navigation; confirm already warned.
    void href;
  };

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
        window.alert('请先导入字幕\n\n加入文件并整理后，即可进入工作台。');
        return;
      }
      setWorkflowStep(2);
      return;
    }

    if (targetStep === 3) {
      if (!hasWorkbenchData) {
        window.alert('请先生成预览\n\n在工作台确认轨道后，再打开预览。');
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

  return (
    <>
      {/* ── Top: brand + workflow + scale + local clock ───────────────── */}
      <nav
        aria-label="全局导航"
        className={`system-tray system-tray--top fixed top-0 z-[var(--z-nav)] justify-between border-b ${trayChrome}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 tracking-tight">
          <button
            type="button"
            onClick={() => handleStepClick(1)}
            className="v4-focus-ring flex h-11 shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg text-[22px] font-semibold leading-none tracking-tight text-[var(--v5-cream)] transition-colors duration-150 hover:text-white md:text-[24px]"
            aria-label="返回导入页"
          >
            <BrandMark className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] shadow-[var(--elevation-1-dim)]" />
            <span className="hidden whitespace-nowrap min-[420px]:inline">SaikoSubStudio</span>
          </button>

          {!isInfoPage && (
            <div className="flex min-w-0 flex-1 items-center border-l border-[color:color-mix(in_srgb,var(--v5-cream)_12%,transparent)] pl-2 sm:pl-3">
              <div
                className="relative h-9 w-full max-w-[14rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--tray-line)] bg-[var(--tray-fill-soft)] sm:max-w-[18rem] md:max-w-[22rem]"
                role="group"
                aria-label="工作流程进度"
              >
                {/* 橙色充电填充：随步骤推进像电量一样涨满 */}
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[var(--v5-orange)]"
                  initial={false}
                  animate={{ width: `${(workflowStep / WORKFLOW_STEPS.length) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  aria-hidden="true"
                />
                <div className="relative z-10 grid h-full grid-cols-3">
                  {WORKFLOW_STEPS.map((step, index) => {
                    const isActive = workflowStep === step.id;
                    const isFilled = step.id <= workflowStep;
                    const disabled =
                      (step.id === 2 && !hasUploadData && !hasWorkbenchData)
                      || (step.id === 3 && !hasWorkbenchData);
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => handleStepClick(step.id)}
                        className={`v4-focus-ring relative flex cursor-pointer items-center justify-center px-1 text-[length:var(--type-control)] font-bold tracking-wide transition-colors
                          ${index > 0 ? 'border-l border-[color:color-mix(in_srgb,var(--v5-green)_12%,transparent)]' : ''}
                          ${isFilled
                            ? 'text-[var(--v5-green)]'
                            : disabled
                              ? 'cursor-help text-[color:color-mix(in_srgb,var(--v5-cream)_65%,transparent)]'
                              : 'text-[color:color-mix(in_srgb,var(--v5-cream)_78%,transparent)] hover:text-[var(--tray-ink)]'}
                          ${isActive ? 'underline decoration-2 underline-offset-4' : ''}`}
                        aria-current={isActive ? 'step' : undefined}
                        aria-disabled={disabled}
                        title={disabled ? '请先完成前序步骤' : `前往${step.label}`}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {isInfoPage && (
            <Link
              href="/"
              className={`${trayCtrl} text-[var(--v5-orange)]`}
              aria-label="返回首页"
            >
              <ArrowLeft className="h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
              <span className="hidden whitespace-nowrap min-[480px]:inline">返回首页</span>
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={cycleScale}
            className={`${trayCtrl} cursor-pointer select-none font-mono`}
            title="调节网页整体缩放"
            aria-label={`网页缩放 ${Math.round(scale * 100)}%`}
          >
            <span className="system-tray__accent text-[length:var(--type-control)] font-bold tracking-wide">A±</span>
            <span className="text-[length:var(--type-control)] font-bold text-[var(--tray-ink)]" suppressHydrationWarning>
              {Math.round(scale * 100)}%
            </span>
          </button>

          <div
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--tray-line)] bg-[var(--tray-fill)] px-3"
            aria-label={`本地时间 ${zoneShort} ${time}`}
          >
            <span className="rounded-[var(--radius-pill)] bg-[var(--v4-accent-soft)] px-1.5 py-0.5 font-mono text-xs font-bold tracking-[var(--tracking-eyebrow-wide)] text-[var(--v5-orange)]">
              LOCAL
            </span>
            <span className="text-[length:var(--type-body)] font-semibold tabular-nums text-[var(--tray-ink)]" suppressHydrationWarning>
              {time || '--:--:--'}
            </span>
            <span className="hidden font-mono text-xs text-[var(--tray-ink-muted)] min-[900px]:inline" suppressHydrationWarning>
              {zoneShort}
            </span>
            {zoneCity ? (
              <span className="hidden text-xs text-[var(--tray-ink-faint)] min-[1100px]:inline" suppressHydrationWarning>
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
        <div className="flex min-w-0 flex-1 items-center justify-start gap-2 pr-3">
          <BottomStatusDeck />
        </div>

        {/* Container = remaining deck width (generous when left is empty). */}
        <div className="@container/tray flex min-w-0 flex-1 items-center justify-end">
          <div className="flex shrink-0 items-center gap-2">
            {showLibrary && (
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className={`${trayCtrl} cursor-pointer`}
                title="历史存档"
                aria-label="历史存档"
              >
                <Archive className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
                <span className={trayLabel}>存档</span>
                {libraryCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--v5-orange)_22%,transparent)] px-1.5 py-0.5 text-xs font-semibold text-[var(--v5-orange)]">
                    {libraryCount}
                  </span>
                )}
              </button>
            )}
            <Link
              href="/about"
              className={trayCtrl}
              title="隐私与版权"
              aria-label="隐私与版权"
              onClick={confirmLeaveSession('/about')}
            >
              <Scale className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
              <span className={trayLabel}>隐私</span>
            </Link>
            <Link
              href="/feedback"
              className={trayCtrl}
              title="反馈"
              aria-label="反馈"
              onClick={confirmLeaveSession('/feedback')}
            >
              <PenLine className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
              <span className={trayLabel}>反馈</span>
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
              ref={resetModalRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="restart-title"
              aria-describedby="restart-description"
              className="ui-modal"
              tabIndex={-1}
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
                  className="ui-action ui-action--quiet w-full"
                  onClick={() => setPendingReset(false)}
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  className="ui-action ui-action--danger w-full"
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
