'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, ArrowLeft, Menu, PenLine, RotateCcw, Scale, X } from 'lucide-react';
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

/**
 * Narrow chrome breakpoint: below this, workflow steps leave the top tray
 * and become equal segments in the bottom forest tray. ≥844 keeps desktop top tabs.
 */
const NARROW_CHROME_MQ = '(max-width: 843px)';

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

const subscribeNarrowChrome = (onStoreChange: () => void) => {
  const mq = window.matchMedia(NARROW_CHROME_MQ);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
};

const getNarrowChromeSnapshot = () => window.matchMedia(NARROW_CHROME_MQ).matches;
const getNarrowChromeServerSnapshot = () => false;

const useNarrowChrome = () =>
  useSyncExternalStore(subscribeNarrowChrome, getNarrowChromeSnapshot, getNarrowChromeServerSnapshot);

type WorkflowStepButtonProps = {
  step: (typeof WORKFLOW_STEPS)[number];
  index: number;
  workflowStep: number;
  disabled: boolean;
  onSelect: (id: number) => void;
  /** Bottom mobile segments: larger tap target, equal columns. */
  variant: 'top' | 'bottom';
};

const WorkflowStepButton: React.FC<WorkflowStepButtonProps> = ({
  step,
  index,
  workflowStep,
  disabled,
  onSelect,
  variant,
}) => {
  const isActive = workflowStep === step.id;
  const isFilled = step.id <= workflowStep;
  const gatedHint = step.id === 2 || step.id === 3 ? '请先添加字幕' : undefined;

  if (variant === 'bottom') {
    return (
      <button
        type="button"
        onClick={() => onSelect(step.id)}
        className={`system-tray__workflow-seg v4-focus-ring relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center px-2 text-[length:var(--type-control)] font-bold tracking-wide transition-colors
          ${index > 0 ? 'border-l border-[color:color-mix(in_srgb,var(--v5-cream)_12%,transparent)]' : ''}
          ${isFilled
            ? 'text-[var(--v5-green)]'
            : disabled
              ? 'cursor-help text-[color:color-mix(in_srgb,var(--v5-cream)_65%,transparent)]'
              : 'text-[color:color-mix(in_srgb,var(--v5-cream)_78%,transparent)] hover:text-[var(--tray-ink)]'}
          ${isActive ? 'underline decoration-2 underline-offset-4' : ''}`}
        aria-current={isActive ? 'step' : undefined}
        aria-disabled={disabled || undefined}
        aria-label={disabled && gatedHint ? gatedHint : `前往${step.label}`}
        title={disabled && gatedHint ? gatedHint : `前往${step.label}`}
      >
        <span className="truncate">{step.label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      className={`v4-focus-ring relative flex cursor-pointer items-center justify-center px-1 text-[length:var(--type-control)] font-bold tracking-wide transition-colors
        ${index > 0 ? 'border-l border-[color:color-mix(in_srgb,var(--v5-green)_12%,transparent)]' : ''}
        ${isFilled
          ? 'text-[var(--v5-green)]'
          : disabled
            ? 'cursor-help text-[color:color-mix(in_srgb,var(--v5-cream)_65%,transparent)]'
            : 'text-[color:color-mix(in_srgb,var(--v5-cream)_78%,transparent)] hover:text-[var(--tray-ink)]'}
        ${isActive ? 'underline decoration-2 underline-offset-4' : ''}`}
      aria-current={isActive ? 'step' : undefined}
      aria-disabled={disabled || undefined}
      aria-label={disabled && gatedHint ? gatedHint : `前往${step.label}`}
      title={disabled && gatedHint ? gatedHint : `前往${step.label}`}
    >
      {step.label}
    </button>
  );
};

export const SystemTray = () => {
  const [time, setTime] = useState('');
  const { zoneShort, zoneCity } = useSyncExternalStore(
    subscribeNoop,
    readLocalStamp,
    () => EMPTY_LOCAL_STAMP,
  );
  const [scale, setScale] = useState(getDefaultScale);
  const [pendingReset, setPendingReset] = useState(false);
  const [opsMenuOpen, setOpsMenuOpen] = useState(false);
  const resetModalRef = useRef<HTMLDivElement>(null);
  const opsMenuRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(pendingReset, resetModalRef, () => setPendingReset(false));
  useUiModalFocus(opsMenuOpen, opsMenuRef, () => setOpsMenuOpen(false));
  const pathname = usePathname();
  const isNarrowChrome = useNarrowChrome();
  const {
    workflowStep,
    restartSystem,
    hasUploadData,
    hasWorkbenchData,
    hasSessionWork,
    libraryCount,
    setLibraryOpen,
    setWorkflowStep,
    setStatusNotice,
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
    setStatusNotice: state.setStatusNotice,
  })));
  const isInfoPage = pathname === '/about' || pathname === '/feedback';
  const showLibrary = !isInfoPage && workflowStep === 1;
  /** Narrow studio: workflow lives in bottom tray; status deck yields. */
  const showBottomWorkflow = isNarrowChrome && !isInfoPage;
  const showTopWorkflow = !isNarrowChrome && !isInfoPage;

  const confirmLeaveSession = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasSessionWork) return;
    const ok = window.confirm(
      '当前导入尚未结束。离开本页会丢失未存档的进度；已写入「存档」的项目仍可恢复。确定离开？',
    );
    if (!ok) {
      event.preventDefault();
      return;
    }
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
        setStatusNotice({
          id: 'workflow-gated',
          tone: 'notice',
          title: '请先添加字幕',
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
          id: 'workflow-gated',
          tone: 'notice',
          title: '请先添加字幕',
          message: hasUploadData
            ? '在工作台确认轨道后，再打开预览。'
            : '加入文件并整理后，再进入工作台与预览。',
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

  const stepDisabled = (stepId: number) =>
    (stepId === 2 && !hasUploadData && !hasWorkbenchData)
    || (stepId === 3 && !hasWorkbenchData);

  const workflowCluster = (variant: 'top' | 'bottom') => (
    <div
      className={
        variant === 'top'
          ? 'relative h-9 w-full max-w-[14rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--tray-line)] bg-[var(--tray-fill-soft)] sm:max-w-[18rem] md:max-w-[22rem]'
          : 'system-tray__workflow-bar relative flex h-11 w-full min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--tray-line)] bg-[var(--tray-fill-soft)]'
      }
      role="group"
      aria-label="工作流程进度"
    >
      <motion.div
        className="absolute inset-y-0 left-0 bg-[var(--v5-orange)]"
        initial={false}
        animate={{ width: `${(workflowStep / WORKFLOW_STEPS.length) * 100}%` }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        aria-hidden="true"
      />
      <div
        className={
          variant === 'top'
            ? 'relative z-10 grid h-full grid-cols-3'
            : 'relative z-10 flex h-full min-w-0 flex-1'
        }
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <WorkflowStepButton
            key={step.id}
            step={step}
            index={index}
            workflowStep={workflowStep}
            disabled={stepDisabled(step.id)}
            onSelect={handleStepClick}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );

  const wideOpsControls = (
    <div className="@container/tray flex min-w-0 shrink-0 items-center justify-end">
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
  );

  return (
    <>
      {/* ── Top: menu + brand + (desktop) workflow + essentials ─────────── */}
      <nav
        aria-label="全局导航"
        className={`system-tray system-tray--top fixed top-0 z-[var(--z-nav)] justify-between border-b ${trayChrome}`}
        data-chrome={isNarrowChrome ? 'narrow' : 'wide'}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 tracking-tight sm:gap-2.5">
          {/* Narrow: overflow menu holds 存档/隐私/反馈 so bottom can be 3 equal steps */}
          {showBottomWorkflow && (
            <button
              type="button"
              onClick={() => setOpsMenuOpen(true)}
              className={`${trayCtrl} system-tray__menu-btn cursor-pointer px-2.5`}
              aria-label="打开菜单"
              aria-expanded={opsMenuOpen}
              aria-haspopup="dialog"
            >
              <Menu className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleStepClick(1)}
            className="v4-focus-ring flex h-11 min-w-0 shrink cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg text-[20px] font-semibold leading-none tracking-tight text-[var(--v5-cream)] transition-colors duration-150 hover:text-white sm:gap-2.5 sm:text-[22px] md:text-[24px]"
            aria-label="返回导入页"
          >
            <BrandMark className="h-9 w-9 shrink-0 rounded-[var(--radius-md)] shadow-[var(--elevation-1-dim)] sm:h-10 sm:w-10" />
            {isNarrowChrome ? (
              <>
                <span className="hidden whitespace-nowrap min-[360px]:inline min-[420px]:hidden">Saiko</span>
                <span className="hidden whitespace-nowrap min-[420px]:inline">SaikoSubStudio</span>
              </>
            ) : (
              <span className="hidden whitespace-nowrap min-[420px]:inline">SaikoSubStudio</span>
            )}
          </button>

          {showTopWorkflow && (
            <div className="flex min-w-0 flex-1 items-center border-l border-[color:color-mix(in_srgb,var(--v5-cream)_12%,transparent)] pl-2 sm:pl-3">
              {workflowCluster('top')}
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
            className={`${trayCtrl} system-tray__scale cursor-pointer select-none font-mono`}
            title="调节网页整体缩放"
            aria-label={`网页缩放 ${Math.round(scale * 100)}%`}
          >
            <span className="system-tray__accent text-[length:var(--type-control)] font-bold tracking-wide">A±</span>
            <span
              className="system-tray__scale-pct text-[length:var(--type-control)] font-bold text-[var(--tray-ink)]"
              suppressHydrationWarning
            >
              {Math.round(scale * 100)}%
            </span>
          </button>

          <div
            className="system-tray__clock inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--tray-line)] bg-[var(--tray-fill)] px-2.5 sm:px-3"
            aria-label={`本地时间 ${zoneShort} ${time}`}
          >
            <span className="system-tray__local-badge rounded-[var(--radius-pill)] bg-[var(--v4-accent-soft)] px-1.5 py-0.5 font-mono text-xs font-bold tracking-[var(--tracking-eyebrow-wide)] text-[var(--v5-orange)]">
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

      {/* ── Bottom: narrow = full-width workflow; wide = status + ops ───── */}
      <div
        role="toolbar"
        aria-label="操作台"
        className={`system-tray system-tray--bottom fixed bottom-0 z-[var(--z-nav)] border-t ${trayChrome}`}
        data-chrome={isNarrowChrome ? 'narrow' : 'wide'}
      >
        {showBottomWorkflow ? (
          <div className="flex w-full min-w-0 items-center">
            {workflowCluster('bottom')}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center justify-start gap-2 pr-3">
              <BottomStatusDeck />
            </div>
            {wideOpsControls}
          </>
        )}
      </div>

      {opsMenuOpen && showBottomWorkflow && (
        <OverlayPortal>
          <div
            className="ui-modal-layer fixed inset-0 z-[var(--z-modal)] bg-black/55 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpsMenuOpen(false);
            }}
          >
            <div
              ref={opsMenuRef}
              role="dialog"
              aria-modal="true"
              aria-label="更多操作"
              tabIndex={-1}
              className="system-tray__ops-sheet absolute left-3 right-3 top-[calc(var(--tray-h)+0.5rem)] rounded-[var(--radius-lg)] border border-[var(--v4-line-strong)] bg-[var(--v5-panel)] p-2 shadow-[var(--elevation-2)]"
            >
              <div className="mb-1 flex items-center justify-between px-2 py-1.5">
                <p className="text-sm font-semibold text-[var(--v4-text)]">更多</p>
                <button
                  type="button"
                  className="v4-focus-ring grid h-9 w-9 place-items-center rounded-md text-[var(--v4-text-muted)] hover:bg-[var(--v4-accent-soft)]"
                  aria-label="关闭菜单"
                  onClick={() => setOpsMenuOpen(false)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {showLibrary && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] font-semibold text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                  onClick={() => {
                    setOpsMenuOpen(false);
                    setLibraryOpen(true);
                  }}
                >
                  <Archive className="h-5 w-5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                  存档
                  {libraryCount > 0 && (
                    <span className="ml-auto tabular-nums text-xs text-[var(--v4-text-muted)]">{libraryCount}</span>
                  )}
                </button>
              )}
              <Link
                href="/about"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] font-semibold text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                onClick={(event) => {
                  confirmLeaveSession('/about')(event);
                  if (!event.defaultPrevented) setOpsMenuOpen(false);
                }}
              >
                <Scale className="h-5 w-5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                隐私与版权
              </Link>
              <Link
                href="/feedback"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] font-semibold text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                onClick={(event) => {
                  confirmLeaveSession('/feedback')(event);
                  if (!event.defaultPrevented) setOpsMenuOpen(false);
                }}
              >
                <PenLine className="h-5 w-5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                反馈
              </Link>
            </div>
          </div>
        </OverlayPortal>
      )}

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
