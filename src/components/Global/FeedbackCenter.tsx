'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
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

export const FeedbackCenter: React.FC = () => {
  const { logs } = useStudioStore();

  return (
    <aside
      aria-label="系统反馈"
      className="fixed right-4 top-[84px] z-[2200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 pointer-events-none md:right-6"
    >
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
    </aside>
  );
};
