'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Film, Search, LoaderCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dual-anchor identity bar: authority signal + contextual film-match feedback.
 * Match notices live here so they never float over the checklist.
 */
export const SourceIdentityStrip: React.FC = () => {
  const {
    tmdbData,
    isSearchingTmdb,
    customFilename,
    tasks,
    selectedTaskId,
    setTmdbManualOpen,
    statusNotices,
    dismissStatusNotice,
  } = useStudioStore();

  const activeTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0];
  const optimisticTitle = customFilename || activeTask?.title || '待匹配影片';
  const needsTitleInput = Boolean(activeTask?.title.includes('待补充片名'));

  const statusLabel = tmdbData
    ? '已匹配'
    : isSearchingTmdb
      ? '匹配中'
      : needsTitleInput
        ? '待补充片名'
        : '未匹配';

  const filmNotice = [...statusNotices]
    .reverse()
    .find((notice) => notice.id === 'media-match' || notice.id === 'media-identity');

  const showInlineNotice = Boolean(filmNotice && !tmdbData);

  return (
    <div className="flex flex-col gap-2">
      <div className="v4-panel flex flex-col gap-3 rounded-lg px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-11 w-[1.9rem] shrink-0 overflow-hidden rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-muted)]">
            <AnimatePresence mode="wait">
              {tmdbData?.posterUrl ? (
                <motion.img
                  key={tmdbData.posterUrl}
                  src={tmdbData.posterUrl}
                  alt=""
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <motion.div
                  key={isSearchingTmdb ? 'searching' : 'empty'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex h-full w-full items-center justify-center ${isSearchingTmdb ? 'animate-pulse bg-[var(--v4-accent-soft)]' : 'text-[var(--v4-text-faint)]'}`}
                >
                  {isSearchingTmdb ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-[var(--v4-accent-strong)]" aria-hidden="true" />
                  ) : (
                    <Film className="h-4 w-4" aria-hidden="true" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold tracking-tight text-[var(--v4-text)] md:text-lg">
                {tmdbData?.title || optimisticTitle}
              </h3>
              {(tmdbData?.year || activeTask?.epKey) && (
                <span className="shrink-0 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--v4-text-muted)]">
                  {[tmdbData?.year, activeTask?.epKey].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--v4-text-muted)] md:text-sm">
              {tmdbData?.originalTitle && tmdbData.originalTitle !== tmdbData.title
                ? tmdbData.originalTitle
                : '影片资料用于命名与预览背景，可稍后补充'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-stretch md:self-auto">
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
              tmdbData
                ? 'border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                : isSearchingTmdb
                  ? 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'
                  : 'border-[var(--v4-line)] text-[var(--v4-text-faint)]'
            }`}
          >
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={() => setTmdbManualOpen(true)}
            className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-3 text-sm font-semibold text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-accent-soft)]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {tmdbData ? '更改' : needsTitleInput ? '补充片名' : '搜索'}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showInlineNotice && filmNotice && (
          <motion.div
            key={`${filmNotice.id}-${filmNotice.createdAt}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:rgba(197,164,114,0.28)] bg-[color:rgba(28,22,14,0.72)] px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm text-[#f0e6d4]">
                <span className="font-semibold">{filmNotice.title}</span>
                {filmNotice.message && (
                  <span className="text-[color:rgba(240,230,212,0.78)]"> · {filmNotice.message}</span>
                )}
              </p>
              {filmNotice.actionLabel && (
                <button
                  type="button"
                  onClick={() => setTmdbManualOpen(true)}
                  className="v4-focus-ring inline-flex h-8 shrink-0 items-center rounded-md border border-[color:rgba(208,164,111,0.28)] bg-[var(--v4-accent-soft)] px-2.5 text-xs font-semibold text-[var(--v4-accent-strong)]"
                >
                  {filmNotice.actionLabel}
                </button>
              )}
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dismissStatusNotice(filmNotice.id)}
                className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md text-[color:rgba(240,230,212,0.5)] hover:bg-white/[0.05] hover:text-[#f0e6d4]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
