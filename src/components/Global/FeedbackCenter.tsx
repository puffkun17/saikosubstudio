'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

const CONTEXTUAL_NOTICE_IDS = new Set(['media-match', 'media-identity']);

const logStyles: Record<'info' | 'success' | 'error', {
  shell: string;
  icon: React.ReactNode;
}> = {
  info: {
    shell: 'border-[var(--v4-line)] bg-[color:rgba(18,16,14,0.94)] text-[var(--v4-text)]',
    icon: <Info className="h-3.5 w-3.5 text-[var(--v4-text-muted)]" />,
  },
  success: {
    shell: 'border-[color:rgba(208,164,111,0.28)] bg-[color:rgba(28,22,14,0.96)] text-[#f0e2cf]',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--v4-accent-strong)]" />,
  },
  error: {
    shell: 'border-[color:rgba(201,138,134,0.32)] bg-[color:rgba(28,16,15,0.96)] text-[#f0d9d7]',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-[var(--v4-danger)]" />,
  },
};

const noticeStyles = {
  message: 'border-[var(--v4-line-strong)] bg-[color:rgba(18,16,14,0.97)] text-[var(--v4-text)]',
  success: 'border-[color:rgba(208,164,111,0.32)] bg-[color:rgba(28,22,14,0.97)] text-[#f0e2cf]',
  notice: 'border-[color:rgba(208,164,111,0.28)] bg-[color:rgba(24,20,16,0.97)] text-[#efe4d4]',
  warning: 'border-[color:rgba(197,164,114,0.34)] bg-[color:rgba(28,22,14,0.97)] text-[#f0e6d4]',
  alert: 'border-[color:rgba(201,138,134,0.36)] bg-[color:rgba(28,16,15,0.97)] text-[#f0d9d7]',
} as const;

/**
 * Floating dock = short system tips only (bottom-center).
 * Film-match notices render inline in SourceIdentityStrip — never as overlays.
 */
export const FeedbackCenter: React.FC = () => {
  const {
    logs,
    statusNotices,
    dismissStatusNotice,
  } = useStudioStore();
  const shouldReduceMotion = useReducedMotion();

  const floatingNotices = statusNotices.filter((notice) => !CONTEXTUAL_NOTICE_IDS.has(notice.id));
  const latestNotice = floatingNotices[floatingNotices.length - 1];
  const pendingNoticeCount = floatingNotices.length;

  return (
    <OverlayPortal>
      <div className="feedback-dock" role="region" aria-label="系统提示">
        <AnimatePresence initial={false}>
          {latestNotice && (
            <motion.aside
              key={`${latestNotice.id}-${latestNotice.createdAt}`}
              aria-label="当前状态"
              aria-live="polite"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto rounded-lg border px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.42)] backdrop-blur-md ${noticeStyles[latestNotice.tone]}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold leading-5">{latestNotice.title}</p>
                    {pendingNoticeCount > 1 && (
                      <span className="shrink-0 text-xs tabular-nums text-current/55">+{pendingNoticeCount - 1}</span>
                    )}
                  </div>
                  {latestNotice.message && (
                    <p className="mt-1 text-sm leading-5 text-current/78">{latestNotice.message}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="关闭提示"
                  onClick={() => dismissStatusNotice(latestNotice.id)}
                  className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md text-current/45 transition-colors hover:bg-white/[0.06] hover:text-current"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <aside aria-label="短暂提示" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              const styles = logStyles[log.type];
              return (
                <motion.div
                  key={log.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: log.fade ? 0 : 1, y: log.fade ? 4 : 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium leading-relaxed shadow-[0_10px_28px_rgba(0,0,0,0.34)] ${styles.shell}`}
                >
                  <span className="mt-0.5 shrink-0">{styles.icon}</span>
                  <span className="min-w-0 flex-1 break-words">{log.msg}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </aside>
      </div>
    </OverlayPortal>
  );
};
