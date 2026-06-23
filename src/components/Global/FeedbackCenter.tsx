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
    dot: 'bg-[#8ea79b]',
    shell: 'border-[#8ea79b]/20 bg-[#07110d]/86 text-[#d6e1da]',
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
  success: 'border-[#8ea79b]/26 bg-[#0b1611]/94 text-[#dbe9e0]',
  notice: 'border-[#9ddacb]/28 bg-[#0b1513]/94 text-[#e2f1ec]',
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
            className={`fixed right-4 bottom-[5.5rem] left-4 z-[60] flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.3)] backdrop-blur-xl md:right-6 md:left-auto md:w-[min(420px,calc(100vw-3rem))] xl:top-3 xl:right-auto xl:bottom-auto xl:left-[calc(50%+1.5rem)] xl:h-11 xl:w-[min(620px,calc(100vw-42rem))] xl:-translate-x-1/2 xl:py-0 ${noticeStyles[latestNotice.tone]}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9ddacb] shadow-[0_0_10px_rgba(157,218,203,0.52)]" />
            <span className="shrink-0 text-[13px] font-semibold tracking-tight">{latestNotice.title}</span>
            {latestNotice.message && (
              <span className="min-w-0 flex-1 truncate text-xs text-current/65">{latestNotice.message}</span>
            )}
            {latestNotice.action && latestNotice.actionLabel && (
              <button
                type="button"
                onClick={openNoticeAction}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#9ddacb]/28 bg-[#9ddacb]/[0.09] px-2 py-1 text-xs font-semibold text-[#c5eee5] transition-colors hover:bg-[#9ddacb]/[0.16] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ddacb]/70"
              >
                <Search className="h-3 w-3" aria-hidden="true" />
                {latestNotice.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="关闭当前状态提示"
              onClick={() => dismissStatusNotice(latestNotice.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/36 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
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
                className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium leading-relaxed shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-xl ${styles.shell}`}
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
