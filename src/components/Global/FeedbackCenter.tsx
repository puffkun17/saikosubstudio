'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

const CONTEXTUAL_NOTICE_IDS = new Set(['media-match', 'media-identity']);

const errorLogStyle = {
  shell: 'border-[color:rgba(196,91,85,0.28)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-danger)]',
  icon: <AlertTriangle className="h-4 w-4 text-[var(--v4-danger)]" />,
};

const noticeStyles = {
  message: 'border-[var(--v4-line-strong)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-text)]',
  success: 'border-[color:rgba(239,141,95,0.32)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-text)]',
  notice: 'border-[color:rgba(26,61,55,0.16)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-text)]',
  warning: 'border-[color:rgba(196,137,58,0.34)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-text)]',
  alert: 'border-[color:rgba(196,91,85,0.32)] bg-[color:rgba(255,252,247,0.96)] text-[var(--v4-danger)]',
} as const;

/**
 * Floating dock = strong notices + errors only.
 * Soft info/success logs flip in the bottom tray marquee.
 * Media-match notices render inline in SourceIdentityStrip.
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
              className={`ui-toast pointer-events-auto border px-3.5 py-3 backdrop-blur-md ${noticeStyles[latestNotice.tone]}`}
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
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          )}
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
