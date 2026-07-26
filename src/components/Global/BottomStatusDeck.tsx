'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useWorkflowChromeOptional, type BottomStatusConfig } from '@/components/Global/WorkflowChrome';
import { SoftLogMarquee } from '@/components/Global/SoftLogMarquee';

/**
 * 底栏状态甲板：工序进度 / 统计走这里；无状态时回落 SoftLogMarquee。
 * 顶栏 InfoBar 留给 T0（身份、阻断、关键操作）。
 */
export const BottomStatusDeck: React.FC = () => {
  const chrome = useWorkflowChromeOptional();
  const shouldReduceMotion = useReducedMotion();
  const status = chrome?.bottomStatus ?? null;

  return (
    <div className="bottom-status-deck min-w-0 flex-1">
      <AnimatePresence mode="wait" initial={false}>
        {status ? (
          <motion.div
            key={`${status.title}:${status.subtitle || ''}:${status.steps?.map((s) => `${s.label}${s.done}`).join('') || ''}`}
            role="status"
            aria-live="polite"
            aria-label="工序状态"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="bottom-status-deck__card min-w-0"
          >
            <p className="bottom-status-deck__title truncate" title={status.title}>
              {status.title}
            </p>
            <div className="bottom-status-deck__meta flex min-w-0 items-center gap-x-2.5 gap-y-0.5 overflow-hidden">
              {status.steps && status.steps.length > 0 ? (
                <ol className="bottom-status-deck__steps flex shrink-0 items-center">
                  {status.steps.map((step, index) => {
                    const prevDone = status.steps!.slice(0, index).every((s) => s.done);
                    const isActive = !step.done && prevDone;
                    return (
                      <li
                        key={step.label}
                        className={`bottom-status-deck__step inline-flex items-center ${
                          step.done ? 'is-done' : isActive ? 'is-active' : 'is-pending'
                        }`}
                      >
                        <span className="bottom-status-deck__dot" aria-hidden="true" />
                        <span>{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              {status.subtitle ? (
                <p className="bottom-status-deck__subtitle min-w-0 truncate" title={status.subtitle}>
                  {status.steps?.length ? `· ${status.subtitle}` : status.subtitle}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="soft-log"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0"
          >
            <SoftLogMarquee />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Re-export type for callers that only need the shape. */
export type { BottomStatusConfig };
