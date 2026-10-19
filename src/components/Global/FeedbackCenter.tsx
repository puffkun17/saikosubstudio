'use client';

import { ReviewNoticeSync } from '@/components/Global/ReviewNoticeSync';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  resolveNoticeChannel,
  useStudioStore,
  type StatusNotice,
} from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

const errorLogStyle = {
  shell: 'border-[color-mix(in_srgb,var(--v5-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-danger)]',
  icon: <AlertTriangle className="h-4 w-4 text-[var(--v4-danger)]" />,
};

const noticeStyles = {
  message: 'border-[var(--v4-line-strong)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-text)]',
  success: 'border-[color-mix(in_srgb,var(--v5-orange)_32%,transparent)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-text)]',
  notice: 'border-[color-mix(in_srgb,var(--v5-green)_16%,transparent)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-text)]',
  warning: 'border-[color-mix(in_srgb,var(--v5-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-text)]',
  alert: 'border-[color-mix(in_srgb,var(--v5-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--v5-panel)_96%,transparent)] text-[var(--v4-danger)]',
} as const;

const DEFAULT_TOAST_MS = 4200;
const GATE_TOAST_MS = 3000;

function toastDuration(notice: StatusNotice): number {
  if (typeof notice.durationMs === 'number') return notice.durationMs;
  if (notice.id === 'gate-no-files' || notice.id.startsWith('gate-')) return GATE_TOAST_MS;
  return DEFAULT_TOAST_MS;
}

const ToastItem: React.FC<{
  notice: StatusNotice;
  onDismiss: (id: string) => void;
  reduceMotion: boolean | null;
}> = ({ notice, onDismiss, reduceMotion }) => {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toastDuration(notice));
  const startedRef = useRef(0);

  useEffect(() => {
    remainingRef.current = toastDuration(notice);
    startedRef.current = Date.now();
  }, [notice]);

  useEffect(() => {
    if (paused) return;
    startedRef.current = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(notice.id);
    }, remainingRef.current);
    return () => window.clearTimeout(timer);
  }, [paused, notice.id, notice.createdAt, onDismiss]);

  return (
    <motion.aside
      data-notice-channel="toast"
      data-notice-id={notice.id}
      aria-label="当前状态"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => {
        remainingRef.current = Math.max(400, remainingRef.current - (Date.now() - startedRef.current));
        setPaused(true);
      }}
      onMouseLeave={() => setPaused(false)}
      className={`ui-toast pointer-events-auto border p-[var(--ds-pad-card)] backdrop-blur-md ${noticeStyles[notice.tone]}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{notice.title}</p>
          {notice.message && (
            <p className="mt-1 text-sm leading-5 text-current/78">{notice.message}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="关闭提示"
          onClick={() => onDismiss(notice.id)}
          className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md text-current/45 transition-colors hover:bg-white/[0.06] hover:text-current"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.aside>
  );
};

/**
 * Toast dock only (Fluent Toast usage → our visuals).
 * Inline MessageBars and contextual surfaces render elsewhere.
 */
export const FeedbackCenter: React.FC = () => {
  const {
    logs,
    statusNotices,
    dismissStatusNotice,
  } = useStudioStore(useShallow((state) => ({
    logs: state.logs,
    statusNotices: state.statusNotices,
    dismissStatusNotice: state.dismissStatusNotice,
  })));
  const shouldReduceMotion = useReducedMotion();

  const toasts = statusNotices.filter((notice) => resolveNoticeChannel(notice) === 'toast');

  return (
    <OverlayPortal>
      <ReviewNoticeSync />
      <div className="feedback-dock" role="region" aria-label="系统提示" data-testid="toast-dock">
        <AnimatePresence initial={false}>
          {toasts.map((notice) => (
            <ToastItem
              key={notice.id}
              notice={notice}
              onDismiss={dismissStatusNotice}
              reduceMotion={shouldReduceMotion}
            />
          ))}
        </AnimatePresence>

        <aside aria-label="重要提示" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {logs.filter((log) => log.type === 'error').map((log) => (
                <motion.div
                  key={log.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: log.fade ? 0 : 1, y: log.fade ? 4 : 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={`ui-toast pointer-events-auto flex items-start gap-2.5 border px-3.5 py-2.5 text-sm font-medium leading-relaxed ${errorLogStyle.shell}`}
                >
                  <span className="mt-0.5 shrink-0">{errorLogStyle.icon}</span>
                  <span className="min-w-0 flex-1 break-words">{log.msg}</span>
                </motion.div>
            ))}
          </AnimatePresence>
        </aside>
      </div>
    </OverlayPortal>
  );
};
