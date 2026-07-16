'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Search, X } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';

const logStyles: Record<'info' | 'success' | 'error', {
  dot: string;
  shell: string;
  icon: React.ReactNode;
}> = {
  info: {
    dot: 'bg-neutral-300/65',
    shell: 'border-white/[0.08] bg-[#111113]/86 text-neutral-200',
    icon: <Info className="h-3.5 w-3.5" />,
  },
  success: {
    dot: 'bg-[#8697b9]',
    shell: 'border-[#8697b9]/20 bg-[#07110d]/86 text-[#d6e1da]',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  error: {
    dot: 'bg-[#b07b7d]',
    shell: 'border-[#b07b7d]/24 bg-[#160d0e]/88 text-[#ead6d7]',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const noticeStyles = {
  message: 'border-white/[0.1] bg-[#111113]/94 text-neutral-100',
  success: 'border-[#8697b9]/26 bg-[#0b1611]/94 text-[#dbe9e0]',
  notice: 'border-[#8fa3d1]/28 bg-[#0b1513]/94 text-[#e2f1ec]',
  warning: 'border-[#c0a89a]/28 bg-[#18130f]/94 text-[#eee1d6]',
  alert: 'border-[#b07b7d]/30 bg-[#180f10]/94 text-[#f0d9da]',
} as const;

export const FeedbackCenter: React.FC = () => {
  const {
    logs,
    statusNotices,
    dismissStatusNotice,
    setTmdbManualOpen,
  } = useStudioStore();
  const latestNotice = statusNotices[statusNotices.length - 1];
  const pendingNoticeCount = statusNotices.length;

  const openNoticeAction = () => {
    if (latestNotice?.action === 'openTmdbManual') {
      setTmdbManualOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence initial={false}>
        {latestNotice && (
          <motion.aside
            key={`${latestNotice.id}-${latestNotice.createdAt}`}
            aria-label="当前状态"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed left-1/2 top-[76px] z-[80] flex min-h-12 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.28)] backdrop-blur-xl ${noticeStyles[latestNotice.tone]}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8fa3d1] shadow-[0_0_10px_rgba(143, 163, 209,0.52)]" />
            <span className="shrink-0 text-sm font-semibold">{latestNotice.title}</span>
            {latestNotice.message && (
              <span className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-current/70">{latestNotice.message}</span>
            )}
            {pendingNoticeCount > 1 && <span className="shrink-0 text-xs tabular-nums text-current/55">{pendingNoticeCount} 条</span>}
            {latestNotice.action && latestNotice.actionLabel && (
              <button
                type="button"
                onClick={openNoticeAction}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#8fa3d1]/28 bg-[#8fa3d1]/[0.09] px-2.5 text-sm font-semibold text-[#d2d9e9] transition-colors hover:bg-[#8fa3d1]/[0.16] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fa3d1]/70"
              >
                <Search className="h-3 w-3" aria-hidden="true" />
                {latestNotice.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="关闭当前状态提示"
              onClick={() => dismissStatusNotice(latestNotice.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/42 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      <aside
        aria-label="短暂系统日志"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:right-6 md:bottom-6"
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const styles = logStyles[log.type];
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: log.fade ? 0 : 1, y: log.fade ? 6 : 0, scale: log.fade ? 0.98 : 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium leading-relaxed shadow-[0_10px_28px_rgba(0,0,0,0.32)] ${styles.shell}`}
              >
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
                <span className="mt-0.5 shrink-0 text-white/48">{styles.icon}</span>
                <span className="min-w-0 flex-1 break-words">{log.msg}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </>
  );
};
