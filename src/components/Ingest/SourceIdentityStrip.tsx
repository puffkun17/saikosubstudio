'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Image as ImageIcon, Search, LoaderCircle, X, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Left rail for media identity — poster, meta, rematch.
 * Stretches with the checklist card; typography sized for scanability.
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
  const displayTitle = tmdbData?.title || optimisticTitle;
  const displayOriginal = tmdbData?.originalTitle && tmdbData.originalTitle !== tmdbData.title
    ? tmdbData.originalTitle
    : null;
  const metaBits = [tmdbData?.year, activeTask?.epKey].filter(Boolean);
  const hasScore = Boolean(tmdbData && tmdbData.voteAverage > 0);
  const overview = tmdbData?.overview?.trim() || '';
  const rematchLabel = tmdbData ? '重新校准匹配' : needsTitleInput ? '补充片名' : '搜索影片';

  return (
    <aside className="source-identity-rail v4-panel flex h-full w-full flex-col overflow-hidden rounded-lg">
      <div className="source-identity-rail__poster relative aspect-[2/3] w-full shrink-0 overflow-hidden border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)]">
        <AnimatePresence mode="wait">
          {tmdbData?.posterUrl ? (
            <motion.img
              key={tmdbData.posterUrl}
              src={tmdbData.posterUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <motion.div
              key={isSearchingTmdb ? 'searching' : 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isSearchingTmdb ? 'animate-pulse bg-[var(--v4-accent-soft)]' : 'text-[var(--v4-text-faint)]'}`}
            >
              {isSearchingTmdb ? (
                <LoaderCircle className="h-5 w-5 animate-spin text-[var(--v4-accent-strong)]" aria-hidden="true" />
              ) : (
                <>
                  <ImageIcon className="h-7 w-7" aria-hidden="true" />
                  <span className="px-3 text-center text-xs leading-relaxed text-[var(--v4-text-faint)]">
                    封面按 2:3 预留
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="min-w-0 text-[1.125rem] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[1.2rem]"
                title={displayTitle}
              >
                {displayTitle}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                  tmdbData
                    ? 'border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                    : isSearchingTmdb
                      ? 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'
                      : 'border-[var(--v4-line)] text-[var(--v4-text-faint)]'
                }`}
              >
                {statusLabel}
              </span>
            </div>

            {displayOriginal ? (
              <p
                className="mt-1.5 text-[13px] font-medium leading-relaxed text-[var(--v4-text-muted)]"
                title={displayOriginal}
              >
                {displayOriginal}
              </p>
            ) : (
              !tmdbData && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--v4-text-muted)]">
                  用于命名与预览背景，可稍后补充。
                </p>
              )
            )}

            {(metaBits.length > 0 || hasScore || (tmdbData?.genres?.length ?? 0) > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {metaBits.length > 0 && (
                  <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-[12px] font-medium tabular-nums text-[var(--v4-text)]">
                    {metaBits.join(' · ')}
                  </span>
                )}
                {hasScore && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[var(--v4-text)]">
                    <Star className="h-3.5 w-3.5 fill-[var(--v4-accent)] text-[var(--v4-accent)]" aria-hidden="true" />
                    {tmdbData!.voteAverage.toFixed(1)}
                  </span>
                )}
                {tmdbData?.genres?.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-md border border-[var(--v4-line)] bg-black/20 px-2.5 py-1 text-[12px] font-medium text-[var(--v4-text-muted)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {overview ? (
            <p className="text-[13px] leading-6 text-[var(--v4-text-muted)] md:text-[14px] md:leading-7">
              {overview}
            </p>
          ) : null}

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
                <div className="rounded-lg border border-[color:rgba(197,164,114,0.28)] bg-[color:rgba(28,22,14,0.72)] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#f0e6d4]">
                      <span className="font-semibold">{filmNotice.title}</span>
                      {filmNotice.message && (
                        <span className="text-[color:rgba(240,230,212,0.78)]"> · {filmNotice.message}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      aria-label="关闭提示"
                      onClick={() => dismissStatusNotice(filmNotice.id)}
                      className="v4-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md text-[color:rgba(240,230,212,0.5)] hover:bg-white/[0.05] hover:text-[#f0e6d4]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {filmNotice.actionLabel && (
                    <button
                      type="button"
                      onClick={() => setTmdbManualOpen(true)}
                      className="v4-focus-ring mt-2 inline-flex h-8 w-full items-center justify-center rounded-md border border-[color:rgba(208,164,111,0.28)] bg-[var(--v4-accent-soft)] px-2.5 text-xs font-semibold text-[var(--v4-accent-strong)]"
                    >
                      {filmNotice.actionLabel}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 pt-1">
          <button
            type="button"
            onClick={() => setTmdbManualOpen(true)}
            className="v4-focus-ring inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] px-3 text-sm font-semibold text-[var(--v4-accent-strong)] transition-colors hover:bg-[color:rgba(208,164,111,0.22)]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {rematchLabel}
          </button>
        </div>
      </div>
    </aside>
  );
};
