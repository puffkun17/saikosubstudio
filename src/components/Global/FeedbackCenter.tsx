'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Search, X } from 'lucide-react';
import { StatusNotice, useStudioStore } from '@/store/useStudioStore';

const toneStyles: Record<StatusNotice['tone'], {
  icon: React.ReactNode;
  shell: string;
  rail: string;
  iconWrap: string;
  label: string;
}> = {
  message: {
    icon: <Info className="h-4 w-4" />,
    shell: 'border-white/[0.08] bg-[#101013]/88 text-neutral-200',
    rail: 'bg-neutral-300/55',
    iconWrap: 'bg-white/[0.05] text-neutral-300',
    label: '消息',
  },
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    shell: 'border-[#8ea79b]/22 bg-[#07110d]/90 text-[#d8e2db]',
    rail: 'bg-[#8ea79b]',
    iconWrap: 'bg-[#8ea79b]/12 text-[#b8c8bf]',
    label: '完成',
  },
  notice: {
    icon: <Info className="h-4 w-4" />,
    shell: 'border-[#9ba6b1]/20 bg-[#0c0f12]/90 text-[#dce1e5]',
    rail: 'bg-[#9ba6b1]',
    iconWrap: 'bg-[#9ba6b1]/12 text-[#c9d0d6]',
    label: '状态',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    shell: 'border-[#b7aa96]/24 bg-[#13100c]/90 text-[#e1d9cc]',
    rail: 'bg-[#b7aa96]',
    iconWrap: 'bg-[#b7aa96]/12 text-[#d4c7b3]',
    label: '注意',
  },
  alert: {
    icon: <AlertTriangle className="h-4 w-4" />,
    shell: 'border-[#b07b7d]/28 bg-[#160d0e]/92 text-[#ead6d7]',
    rail: 'bg-[#b07b7d]',
    iconWrap: 'bg-[#b07b7d]/14 text-[#e0b6b8]',
    label: '警报',
  },
};

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

export const FeedbackCenter: React.FC = () => {
  const {
    logs,
    statusNotices,
    dismissStatusNotice,
    setTmdbManualOpen,
  } = useStudioStore();

  const runAction = (notice: StatusNotice) => {
    if (notice.action === 'openTmdbManual') {
      setTmdbManualOpen(true);
    }
  };

  return (
    <aside
      aria-label="系统反馈"
      className="fixed right-4 top-[84px] z-[2200] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-3 pointer-events-none md:right-6"
    >
      <AnimatePresence initial={false}>
        {statusNotices.map((notice) => {
          const styles = toneStyles[notice.tone];
          return (
            <motion.section
              key={notice.id}
              initial={{ opacity: 0, x: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 12, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className={`relative overflow-hidden rounded-2xl border shadow-[0_18px_55px_rgba(0,0,0,0.42)] backdrop-blur-2xl pointer-events-auto ${styles.shell}`}
            >
              <div className={`absolute left-0 top-0 h-full w-[3px] ${styles.rail}`} />
              <div className="flex gap-3 p-4">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.iconWrap}`}>
                  {styles.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-white/42">
                      {styles.label}
                    </span>
                    {notice.meta && (
                      <span className="min-w-0 truncate rounded-md border border-white/[0.07] bg-white/[0.035] px-1.5 py-0.5 text-[11px] font-medium text-white/54">
                        {notice.meta}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-white/92">
                    {notice.title}
                  </h3>
                  {notice.message && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-white/58">
                      {notice.message}
                    </p>
                  )}
                  {notice.action && notice.actionLabel && (
                    <button
                      type="button"
                      onClick={() => runAction(notice)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.055] px-2.5 py-1.5 text-[12px] font-semibold text-white/78 transition hover:border-white/[0.14] hover:bg-white/[0.09] hover:text-white"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {notice.actionLabel}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissStatusNotice(notice.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/32 transition hover:bg-white/[0.06] hover:text-white/72"
                  aria-label="关闭状态提示"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.section>
          );
        })}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const styles = logStyles[log.type];
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 14, scale: 0.98 }}
                animate={{ opacity: log.fade ? 0 : 1, x: log.fade ? 10 : 0, scale: log.fade ? 0.98 : 1 }}
                exit={{ opacity: 0, x: 12, scale: 0.98 }}
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
      </div>
    </aside>
  );
};
