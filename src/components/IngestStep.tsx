'use client';

import React, { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { SourceIdentityStrip } from '@/components/Ingest/SourceIdentityStrip';
import { Database, Trash2, Calendar, FolderClock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';

export const IngestStep: React.FC = () => {
  const { 
    tasks, 
    libraryList, 
    loadFromLibrary, 
    deleteFromLibrary,
    isLibraryOpen,
    setLibraryOpen,
    isIngestClearing,
  } = useStudioStore(useShallow((state) => ({
    tasks: state.tasks,
    libraryList: state.libraryList,
    loadFromLibrary: state.loadFromLibrary,
    deleteFromLibrary: state.deleteFromLibrary,
    isLibraryOpen: state.isLibraryOpen,
    setLibraryOpen: state.setLibraryOpen,
    isIngestClearing: state.isIngestClearing,
  })));

  const libraryModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(isLibraryOpen, libraryModalRef, () => setLibraryOpen(false));

  const shellState: 'empty' | 'clearing' | 'ready' = isIngestClearing
    ? 'clearing'
    : tasks.length === 0
      ? 'empty'
      : 'ready';

  // Ready-state info bar is owned by TaskList (show name / episode + file actions).

  return (
    <div className="ingest-shell relative z-0 flex h-full w-full flex-1 flex-col overflow-y-auto px-5 py-5 md:px-8 md:py-8 lg:px-10 xl:px-14 2xl:px-16">
      <AnimatePresence mode="wait">
        {shellState === 'ready' ? (
          <motion.div 
            key="ready-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="z-10 mx-auto grid w-full max-w-[1180px] flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:items-stretch lg:gap-5"
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="ingest-empty mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch justify-start gap-3 pb-6 pt-4 md:gap-4 md:pb-8 md:pt-8 lg:pt-10"
          >
            <DragZone />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library Modal */}
      <AnimatePresence>
        {isLibraryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setLibraryOpen(false); }}
          >
            <motion.div 
              ref={libraryModalRef}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="ui-modal ui-modal--wide glass-panel-ar flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden !p-0"
              role="dialog"
              aria-modal="true"
              aria-labelledby="library-title"
              tabIndex={-1}
            >
              <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--v4-line)] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <FolderClock className="w-5 h-5 text-[var(--v4-accent-strong)]" />
                  <h2 id="library-title" className="text-base font-bold text-[var(--v4-text)] tracking-wide">历史存档字幕</h2>
                </div>
                <button
                  type="button"
                  className="ui-action ui-action--quiet ui-action--icon ui-action--icon-sm"
                  onClick={() => setLibraryOpen(false)}
                  aria-label="关闭历史存档"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {libraryList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {libraryList.map((item) => {
                      const isBilingual = item.subs.some(s => s.text.includes('\n'));
                      return (
                        <motion.div 
                          key={item.id}
                          whileHover={{ y: -2 }}
                          className="group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-3 transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)]"
                        >
                          {item.backdrop && (
                            <div
                              className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                              style={{ backgroundImage: `url(${item.backdrop})` }}
                            />
                          )}

                          <button type="button" className="v4-focus-ring min-w-0 flex-1 rounded-lg border border-transparent p-3 text-left transition-colors duration-200 group-hover:border-[var(--v4-line-strong)]" onClick={() => { loadFromLibrary(item); setLibraryOpen(false); }}>
                            <h4 className="text-base font-bold text-[var(--v4-text)] group-hover:text-[var(--v4-accent-strong)] truncate transition-colors pl-3">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-3 mt-2 text-xs text-[var(--v4-text-faint)] font-mono pl-3">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-[var(--v4-text-faint)]" />
                                {item.date}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-[var(--v4-line-strong)]" />
                              <span className="text-[var(--v4-text-muted)] font-sans font-medium">
                                {isBilingual ? '双语轨' : '单轨'}
                              </span>
                            </div>
                          </button>

                          <div className="flex items-center gap-4 z-10">
                            <span className="text-[var(--v4-text-faint)] font-mono text-xs">
                              {item.subs.length} 行
                            </span>
                            <button
                              type="button"
                              className="text-[var(--v4-text-muted)] hover:text-[var(--v4-danger)] p-2 rounded-md hover:bg-[var(--v4-accent-soft)] transition cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); deleteFromLibrary(item.id); }}
                              aria-label={`删除存档：${item.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-[var(--v4-text-faint)]">
                    <Database className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-medium text-sm">暂无存档的字幕项目</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
