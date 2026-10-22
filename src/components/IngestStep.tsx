'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { SourceIdentityStrip } from '@/components/Ingest/SourceIdentityStrip';
import { motion, AnimatePresence } from 'motion/react';
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
      <AnimatePresence mode="wait" initial={false}>
        {shellState === 'ready' ? (
          <motion.div 
            key="ready-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
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
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="ingest-empty flex w-full flex-1 flex-col"
          >
            <DragZone />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
