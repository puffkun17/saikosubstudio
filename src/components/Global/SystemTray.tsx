'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';

import { useLocationPathname } from '@/hooks/useLocationPathname';
import { Archive, ArrowLeft, Menu, PenLine, RotateCcw, Scale, X } from 'lucide-react';
import { motion } from 'motion/react';
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
 * and become equal segments in the bottom paper tray. ≥844 keeps desktop top tabs.
 */
const NARROW_CHROME_MQ = '(max-width: 843px)';

const trayChrome =
  'flex h-[var(--tray-h)] w-full items-center gap-2.5 border-[var(--v4-line)] px-3 transition-colors duration-300 sm:px-4 md:px-5';

/** Icon+label control: never squash copy — hide label via container query instead. */
const trayCtrl =
  'system-tray__ctrl v4-focus-ring inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[length:var(--ds-fs-meta)] font-medium transition-colors';

/**
 * Labels appear from available deck width (parent @container), not control width —
 * avoids the hide↔narrow feedback loop. HOME-BRAND：短标签「存档/隐私/反馈」，
 * 阈值远低于旧 @[22rem]，默认桌面可见；极窄才 icon-only。
 */
const trayLabel = 'whitespace-nowrap'; // spec: core entries are icon + text

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
  const gatedHint = step.id === 2 ? '导入完成（点「开始合轴」）后可进入' : step.id === 3 ? '进入工作台后可预览' : undefined;

  if (variant === 'bottom') {
    return (
      <button
        type="button"
        onClick={() => onSelect(step.id)}
        className={`system-tray__workflow-seg v4-focus-ring relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center px-2 text-[length:var(--type-control)] font-bold tracking-wide transition-colors
          ${index > 0 ? 'border-l border-[var(--rule-hair)]' : ''}
          ${isActive
            ? 'text-[var(--ink-strong)]'
            : disabled
              ? 'cursor-help text-[var(--ink-muted)]'
              : 'text-[var(--ink-body)] hover:text-[var(--ink-strong)]'}
          ${isActive ? 'underline decoration-[var(--accent)] decoration-2 underline-offset-4' : ''}`}
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
        ${index > 0 ? 'border-l border-[var(--rule-hair)]' : ''}
        ${isActive
          ? 'text-[var(--ink-strong)]'
          : disabled
            ? 'cursor-help text-[var(--ink-muted)]'
            : 'text-[var(--ink-body)] hover:text-[var(--ink-strong)]'}
        ${isActive ? 'underline decoration-[var(--accent)] decoration-2 underline-offset-4' : ''}`}
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
  const pathname = useLocationPathname();
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
  // 静态资源按目录托管，/feedback 会落在 /feedback/：先去掉结尾斜杠再判断。
  const routePath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const isInfoPage = routePath === '/about' || routePath === '/feedback';
  const showLibrary = !isInfoPage;
  /** Narrow studio: workflow lives in bottom tray; status deck yields. */
  const showBottomWorkflow = isNarrowChrome && !isInfoPage;
  const showTopWorkflow = !isNarrowChrome && !isInfoPage;

  /** Stay on Import: highlight add-files CTA; toast carries the copy (no tray callout). */
  const focusIngestDropZone = () => {
    if (typeof document === 'undefined') return;
    const zone = document.querySelector<HTMLElement>('[data-ingest-drop-zone]');
    if (!zone) return;
    zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    zone.setAttribute('data-gate-hint', 'true');
    const entries = zone.querySelectorAll<HTMLElement>('.ingest-local-add__entry, [data-ingest-add-cta]');
    entries.forEach((el) => el.setAttribute('data-gate-cta', 'true'));
    window.setTimeout(() => {
      zone.removeAttribute('data-gate-hint');
      entries.forEach((el) => el.removeAttribute('data-gate-cta'));
    }, 2200);
  };

  const emitGateToast = (title: string, message: string, meta: string) => {
    setStatusNotice({
      id: 'gate-no-files',
      tone: 'notice',
      title,
      message,
      meta,
      channel: 'toast',
      durationMs: 3000,
    });
  };

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

    // 「导入」只负责切换，不清空；清空是导入页里单独的「清空本次导入」。
    if (targetStep === 1) {
      setWorkflowStep(1);
      return;
    }

    if (targetStep === 2) {
      if (!hasWorkbenchData) {
        emitGateToast(
          hasUploadData ? '导入尚未完成' : '请先添加字幕',
          hasUploadData ? '在导入页点「开始合轴」后可进入工作台。' : '添加并整理文件后可进入工作台。',
          '2',
        );
        focusIngestDropZone();
        return;
      }
      setWorkflowStep(2);
      return;
    }

    if (targetStep === 3) {
      if (!hasWorkbenchData) {
        emitGateToast(
          '请先添加字幕',
          hasUploadData
            ? '在工作台确认轨道后，再打开预览。'
            : '加入文件并整理后，再进入工作台与预览。',
          '3',
        );
        if (!hasUploadData) focusIngestDropZone();
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
    (stepId === 2 && !hasWorkbenchData)
    || (stepId === 3 && !hasWorkbenchData);

  const workflowCluster = (variant: 'top' | 'bottom') => (
    <div
      className={
        variant === 'top'
          ? 'relative w-full max-w-[14rem] sm:max-w-[18rem] md:max-w-[22rem]'
          : 'relative w-full min-w-0'
      }
    >
      <div
        className={
          variant === 'top'
            ? 'relative h-9 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--tray-line)] bg-[var(--tray-fill-soft)]'
            : 'system-tray__workflow-bar relative flex h-11 w-full min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--tray-line)] bg-[var(--tray-fill-soft)]'
        }
        role="group"
        aria-label="工作流程进度"
      >
        {/* 只标当前页：raised 纸片滑到当前步骤下面（墨字 + 酒红下划线）；其余步骤一律同底（sunken 纸 + 分隔线）。 */}
        <motion.div
          className="absolute inset-y-0 bg-[var(--paper-raised)]"
          initial={false}
          animate={{
            left: `${(Math.max(workflowStep, 1) - 1) / WORKFLOW_STEPS.length * 100}%`,
            width: `${100 / WORKFLOW_STEPS.length}%`,
          }}
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
            <span className={trayLabel}>历史</span>
            {libraryCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-[var(--pt-radius-sm)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]">
                {libraryCount}
              </span>
            )}
          </button>
        )}
        <a
          href="/about"
          className={trayCtrl}
          title="隐私与版权"
          aria-label="隐私与版权"
          onClick={confirmLeaveSession('/about')}
        >
          <Scale className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
          <span className={trayLabel}>隐私</span>
        </a>
        <a
          href="/feedback"
          className={trayCtrl}
          title="反馈"
          aria-label="反馈"
          onClick={confirmLeaveSession('/feedback')}
        >
          <PenLine className="system-tray__accent h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
          <span className={trayLabel}>反馈</span>
        </a>
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
            className="v4-focus-ring flex h-11 min-w-0 shrink cursor-pointer items-center gap-2 whitespace-nowrap rounded-md text-[20px] font-semibold leading-none tracking-tight text-[var(--ink-strong)] transition-colors duration-150 hover:text-[var(--ink-body)] sm:gap-2.5 sm:text-[22px] md:text-[24px]"
            aria-label="返回导入页"
          >
            <BrandMark className="h-9 w-9 shrink-0 rounded-[var(--radius-md)] sm:h-10 sm:w-10" />
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
            <div className="flex min-w-0 flex-1 items-center border-l border-[var(--rule-hair)] pl-2 sm:pl-3">
              {workflowCluster('top')}
            </div>
          )}

          {isInfoPage && (
            <a
              href="/"
              className={`${trayCtrl} text-[var(--accent-text)]`}
              aria-label="返回首页"
            >
              <ArrowLeft className="h-5 w-5 shrink-0 stroke-[2.25]" aria-hidden="true" />
              <span className="hidden whitespace-nowrap min-[480px]:inline">返回首页</span>
            </a>
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

          <span
            className="system-tray__local hidden items-center px-2 text-[length:var(--ds-fs-meta)] font-medium text-[var(--tray-ink-muted)] sm:inline-flex"
            title="字幕只在这台设备上读取和处理，不会上传"
          >
            仅本地处理
          </span>
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
            className="ui-modal-layer fixed inset-0 z-[var(--z-modal)] bg-[var(--pt-scrim)]"
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
              <a
                href="/about"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] font-semibold text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                onClick={(event) => {
                  confirmLeaveSession('/about')(event);
                  if (!event.defaultPrevented) setOpsMenuOpen(false);
                }}
              >
                <Scale className="h-5 w-5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                隐私与版权
              </a>
              <a
                href="/feedback"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] font-semibold text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                onClick={(event) => {
                  confirmLeaveSession('/feedback')(event);
                  if (!event.defaultPrevented) setOpsMenuOpen(false);
                }}
              >
                <PenLine className="h-5 w-5 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                反馈
              </a>
            </div>
          </div>
        </OverlayPortal>
      )}

      {pendingReset && (
        <OverlayPortal>
          <div
            className="ui-modal-layer fixed inset-0 grid place-items-center bg-[var(--pt-scrim)] p-4"
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
