'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { SourceIdentityStrip } from '@/components/Ingest/SourceIdentityStrip';
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
    isIngestClearing,
  } = useStudioStore();

  const shellState: 'empty' | 'clearing' | 'ready' = isIngestClearing
    ? 'clearing'
    : tasks.length === 0
      ? 'empty'
      : 'ready';

  useEffect(() => {
    if (!isLibraryOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLibraryOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isLibraryOpen, setLibraryOpen]);

  return (
    <div className="ingest-shell relative z-0 flex h-full w-full flex-1 flex-col overflow-y-auto p-5 md:p-8 lg:p-10 2xl:p-12">
      {shellState === 'ready' ? (
        <div className="z-20 mb-4 flex flex-shrink-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--v4-text)] md:text-[1.75rem]">核对清单</h1>
            <p className="mt-1 text-sm text-[var(--v4-text-muted)]">请确认字幕轨与导出名称，完成后即可进入下一步。</p>
          </div>
          <span className="shrink-0 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-xs font-medium text-[var(--v4-text-muted)]">
            {tasks.length} 个任务
          </span>
        </div>
      ) : shellState === 'clearing' ? (
        <div className="ingest-heading z-20 mb-5 flex flex-shrink-0 items-end justify-between gap-5 md:mb-6">
          <div className="min-w-0 text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--v4-text)] md:text-3xl">正在整理</h1>
            <p className="mt-2 max-w-xl text-base leading-7 text-[var(--v4-text-muted)]">
              正在本地识别字幕轨、按集归组，并尝试匹配影片资料。
            </p>
          </div>
        </div>
      ) : (
        <div className="ingest-heading z-20 mb-5 flex flex-shrink-0 items-end justify-between gap-5 md:mb-7">
          <div className="min-w-0 text-left">
            <p
              className="mb-2 font-mono text-[11px] font-medium tracking-[0.14em] text-[var(--v4-accent-strong)] uppercase"
            >
              Bay 01 · 取用
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--v4-text)] md:text-[2.35rem]">
              片源文件先进台面
            </h1>
            <p className="mt-2 max-w-lg text-pretty text-[15px] leading-7 text-[var(--v4-text-muted)]">
              命名、压缩包、文件夹都从这里开始。松手只入清单，不会立刻处理。
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {shellState === 'ready' ? (
          <motion.div 
            key="ready-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-3"
          >
            {/* Identity bar above tasks — compact strip, not a tall left card. */}
            <SourceIdentityStrip />
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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
            className="ingest-empty mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch justify-start gap-5 py-1 md:py-2"
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
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-panel-ar flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-lg shadow-[0_24px_70px_rgba(0,0,0,0.46)]"
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
                          className="group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-3 transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)]"
                        >
                          {item.backdrop && (
                            <div
                              className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                              style={{ backgroundImage: `url(${item.backdrop})` }}
                            />
                          )}

                          <button type="button" className="min-w-0 flex-1 rounded-lg border border-transparent p-3 text-left transition-colors duration-200 group-hover:border-[var(--v4-line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8fa3d1]/70" onClick={() => { loadFromLibrary(item); setLibraryOpen(false); }}>
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
