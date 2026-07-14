'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { Database, Trash2, Calendar, FolderClock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const IngestStep: React.FC = () => {
  const { 
    tasks, 
    libraryList, 
    loadFromLibrary, 
    deleteFromLibrary,
    isLibraryOpen,
    setLibraryOpen,
  } = useStudioStore();

  useEffect(() => {
    if (!isLibraryOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLibraryOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isLibraryOpen, setLibraryOpen]);

  return (
    <div className="ingest-shell flex-1 w-full h-full flex flex-col p-5 md:p-8 lg:p-10 2xl:p-12 overflow-y-auto relative bg-[var(--v4-canvas)] z-0">
      <div className={`flex items-center gap-2 select-none z-20 flex-shrink-0 ${tasks.length === 0 ? 'mb-4' : 'mb-2'}`}>
        <span className="h-px w-5 bg-[var(--v4-accent)]" />
        <span className="v4-kicker">
          Local subtitle workbench
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="ingest-heading flex flex-col md:flex-row justify-between items-start md:items-end gap-5 mb-6 md:mb-8 z-20 flex-shrink-0">
          <div className="flex flex-col gap-2 text-left">
            <h1 className="text-[clamp(2.25rem,5vw,4.75rem)] font-semibold tracking-tight text-[var(--v4-text)] flex max-w-full items-center flex-wrap gap-x-4 gap-y-2 font-sans leading-[0.98] break-words [overflow-wrap:anywhere]">
              <span className="max-w-full break-all sm:break-normal">SaikoSubStudio</span>
              <span className="rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] px-2.5 py-1 text-xs font-mono font-semibold text-[var(--v4-accent-strong)]">
                v4.0 Beta
              </span>
            </h1>
            <p className="max-w-2xl text-base text-[var(--v4-text-muted)]">
              先规划导入清单，再整理轨道、片源与输出。
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-shrink-0 items-end justify-between gap-4 border-b border-[var(--v4-line)] pb-4 z-20">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.75rem]">字幕导入</h1>
            <p className="mt-1 text-sm text-neutral-500">确认轨道、命名与片源信息</p>
          </div>
          <span className="shrink-0 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-xs font-medium text-[var(--v4-text-muted)]">
            {tasks.length} 个任务
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {tasks.length === 0 ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="ingest-empty flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full items-center justify-start py-1 md:py-3"
          >
            <DragZone />
          </motion.div>
        ) : (
          /* Task List when files are loaded - Split Grid Layout */
          <motion.div 
            key="task-list-container"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="z-10 mx-auto grid w-full max-w-[1720px] flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(310px,0.34fr)_minmax(0,0.66fr)]"
          >
            {/* TMDB Panel */}
            <div className="desktop-panel-fit-hidden min-w-0">
              <TmdbPanel />
            </div>
            {/* TaskList */}
            <div className="relative flex min-w-0 flex-col desktop-panel-fit-visible">
              <TaskList />
            </div>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[2000] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setLibraryOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-panel-ar rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col gap-0 max-h-[85vh] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="library-title"
            >
              <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <FolderClock className="w-5 h-5 text-[#e5e7eb]" />
                  <h2 id="library-title" className="text-base font-bold text-white tracking-wide">历史存档字幕</h2>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition cursor-pointer"
                  onClick={() => setLibraryOpen(false)}
                  type="button"
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
                          className="relative overflow-hidden p-3 bg-white/[0.015] hover:bg-white/[0.035] border border-white/5 hover:border-white/10 rounded-2xl flex gap-2 transition-all duration-300 items-center justify-between group shadow-lg"
                        >
                          {item.backdrop && (
                            <div 
                              className="absolute inset-0 bg-cover bg-center opacity-[0.05] group-hover:opacity-[0.1] transition-opacity -z-10 filter blur-[8px] scale-110"
                              style={{ backgroundImage: `url(${item.backdrop})` }}
                            />
                          )}

                          <button type="button" className="min-w-0 flex-1 rounded-xl p-3 text-left border-l-2 border-transparent group-hover:border-[#9ca3af] transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8fa3d1]/70" onClick={() => { loadFromLibrary(item); setLibraryOpen(false); }}>
                            <h4 className="text-base font-bold text-white/90 group-hover:text-white truncate transition-colors pl-3">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-450 font-mono pl-3">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-white/40" />
                                {item.date}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-white/20" />
                              <span className="text-white/60 font-sans font-medium">
                                {isBilingual ? '双语轨' : '单轨'}
                              </span>
                            </div>
                          </button>

                          <div className="flex items-center gap-4 z-10">
                            <span className="text-white/50 font-mono text-xs">
                              {item.subs.length} 行
                            </span>
                            <button
                              type="button"
                              className="text-white/25 hover:text-rose-400 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
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
                  <div className="flex flex-col items-center justify-center py-20 text-white/30">
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
