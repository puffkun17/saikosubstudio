'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { SourceIdentityStrip } from '@/components/Ingest/SourceIdentityStrip';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react';
import { EASE_OUT, MOTION_S } from '@/core/motion';
import { stageSharedHandoffEnabled } from '@/core/stageFlags';
import { InlineMessageBar } from '@/components/Global/InlineMessageBar';

export const IngestStep: React.FC = () => {
  const { 
    tasks,
    isIngestClearing,
  } = useStudioStore(useShallow((state) => ({
    tasks: state.tasks,
    isIngestClearing: state.isIngestClearing,
  })));


  const shellState: 'empty' | 'clearing' | 'ready' = isIngestClearing
    ? 'clearing'
    : tasks.length === 0
      ? 'empty'
      : 'ready';

  // Ready-state info bar is owned by TaskList (show name / episode + file actions).
  const reduce = useReducedMotion();
  // 共享元素交接（flag）：两页同时在场（popLayout），文件行按 objectId 从清单移到任务页轨道行；
  // 其余内容只做 0.25 s 淡入淡出。减少动态：不移动，0.15 s 淡入淡出。
  const [shared] = React.useState(stageSharedHandoffEnabled);
  const fade = { duration: reduce ? MOTION_S.reduced : MOTION_S.slow, ease: EASE_OUT };

  return (
    <div
      className={`ingest-shell relative z-0 flex h-full w-full flex-1 flex-col px-[var(--ds-page-x)] py-[var(--ds-gap-section)] ${
        shellState === 'ready'
          ? 'ingest-shell--ready min-h-0 overflow-hidden'
          : 'overflow-y-auto'
      }`}
    >
      <InlineMessageBar className="mx-auto mb-2 w-full max-w-[1180px] shrink-0 md:mb-3" />
      {/* initial={false}: returning to 导入 remounts IngestStep; do not fade the empty shell in again. */}
      {/* Act 1 舞台（plan B）：所有区共用一个 LayoutGroup，objectId 作 layoutId 跨区接续。
          第 1 页 → 第 2 页：flag 开 = popLayout 共享元素交接；flag 关 = mode="wait" 先退后进（方案 C 退路）。 */}
      <LayoutGroup id="act1-stage">
      <AnimatePresence mode={shared ? 'popLayout' : 'wait'} initial={false}>
        {shellState === 'ready' ? (
          <motion.div 
            key="ready-state"
            data-stage-zone="ledger"
            initial={shared || reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
            className="z-10 mx-auto grid w-full max-w-[1180px] min-h-0 flex-1 grid-cols-1 gap-[var(--ds-gap-section)] lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:items-stretch lg:gap-[var(--ds-gap-group)]"
          >
            <SourceIdentityStrip />
            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
              <TaskList />
            </div>
            <TmdbPanel mode="modal-only" />
          </motion.div>
        ) : (
          <motion.div 
            key="handoff-state"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: fade }}
            transition={fade}
            className="ingest-empty flex w-full flex-1 flex-col"
          >
            <DragZone />
          </motion.div>
        )}
      </AnimatePresence>
      </LayoutGroup>

    </div>
  );
};
