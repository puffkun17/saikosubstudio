'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  resolveNoticeChannel,
  useStudioStore,
  type StatusNotice,
} from '@/store/useStudioStore';

const barTone: Record<StatusNotice['tone'], string> = {
  message: 'border-[var(--v4-line-strong)] bg-[color-mix(in_srgb,var(--v5-panel)_94%,transparent)]',
  success: 'border-[color-mix(in_srgb,var(--state-success)_36%,var(--v4-line-strong))] bg-[color-mix(in_srgb,var(--state-success)_10%,var(--v5-panel))]',
  notice: 'border-[var(--rule-strong)] bg-[var(--v5-panel)]',
  warning: 'border-[color-mix(in_srgb,var(--v5-warning)_40%,var(--v4-line-strong))] bg-[color-mix(in_srgb,var(--v5-warning)_10%,var(--v5-panel))]',
  alert: 'border-[color-mix(in_srgb,var(--v5-danger)_36%,var(--v4-line-strong))] bg-[color-mix(in_srgb,var(--v5-danger)_10%,var(--v5-panel))]',
};

/**
 * Persistent in-step MessageBar (Fluent MessageBar usage → our tokens).
 * Manual dismiss only; never auto-hidden.
 */
export const InlineMessageBar: React.FC<{
  /** Limit to specific notice ids when a step owns a subset. */
  ids?: string[];
  className?: string;
}> = ({ ids, className = '' }) => {
  const { statusNotices, dismissStatusNotice } = useStudioStore(useShallow((s) => ({
    statusNotices: s.statusNotices,
    dismissStatusNotice: s.dismissStatusNotice,
  })));
  const reduceMotion = useReducedMotion();

  const bars = statusNotices.filter((notice) => {
    if (resolveNoticeChannel(notice) !== 'inline') return false;
    if (ids && !ids.includes(notice.id)) return false;
    return true;
  });

  // Critical first (Fluent stacking order).
  const rank = (tone: StatusNotice['tone']) =>
    ({ alert: 0, warning: 1, success: 2, notice: 3, message: 4 }[tone]);
  const ordered = [...bars].sort((a, b) => rank(a.tone) - rank(b.tone));

  if (ordered.length === 0) return null;

  return (
    <div className={`inline-message-stack flex w-full flex-col gap-2 ${className}`.trim()} data-testid="inline-message-stack">
      <AnimatePresence initial={false}>
        {ordered.map((notice) => {
          const assertive = notice.tone === 'alert' || notice.tone === 'warning';
          return (
            <motion.aside
              key={`${notice.id}-${notice.createdAt}`}
              role="status"
              aria-live={assertive ? 'assertive' : 'polite'}
              data-notice-channel="inline"
              data-notice-id={notice.id}
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`inline-message-bar flex items-start gap-2 rounded-[var(--radius-lg)] border px-3.5 py-2.5 ${barTone[notice.tone]}`}
            >
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold leading-5 text-[var(--v4-text)]">{notice.title}</p>
                {notice.message && (
                  <p className="mt-0.5 text-xs leading-5 text-[var(--v4-text-muted)] md:text-sm">{notice.message}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dismissStatusNotice(notice.id)}
                className="v4-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--v4-text-muted)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.aside>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
