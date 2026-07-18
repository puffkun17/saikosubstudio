'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStudioStore } from '@/store/useStudioStore';

/**
 * Soft system logs in the bottom tray — flip one at a time, never steal focus.
 * Errors stay in FeedbackCenter.
 */
export const SoftLogMarquee: React.FC = () => {
  const logs = useStudioStore((s) => s.logs);
  const shouldReduceMotion = useReducedMotion();
  const softLogs = logs.filter((log) => log.type !== 'error' && !log.fade);
  const latestId = softLogs[softLogs.length - 1]?.id;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (softLogs.length <= 1 || shouldReduceMotion) return;
    const id = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 3200);
    return () => window.clearInterval(id);
  }, [softLogs.length, latestId, shouldReduceMotion]);

  if (softLogs.length === 0) return null;

  // Prefer newest first, then cycle older messages.
  const offset = shouldReduceMotion ? 0 : tick % softLogs.length;
  const active = softLogs[softLogs.length - 1 - offset];

  return (
    <div className="soft-log-marquee" aria-live="polite" aria-label="系统消息">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={active.id}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="soft-log-marquee__text"
        >
          {active.msg}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};
