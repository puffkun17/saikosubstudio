'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Film, Search, LoaderCircle, X, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Film identity card — hugs content height, standard 2:3 poster,
 * Chinese title (Source Han) vs Latin original (Geist), single-line titles.
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

  return (
    <div className="flex w-full flex-col gap-2.5">
      <section className="v4-panel w-full rounded-lg p-4 md:p-5">
        <div className="flex items-start gap-4">
          {/* Standard theatrical poster 2:3 — never stretch with the text column */}
          <div className="relative aspect-[2/3] w-[6.75rem] shrink-0 self-start overflow-hidden rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-muted)] sm:w-[7.5rem]">
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
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 ${isSearchingTmdb ? 'animate-pulse bg-[var(--v4-accent-soft)]' : 'text-[var(--v4-text-faint)]'}`}
                >
                  {isSearchingTmdb ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-[var(--v4-accent-strong)]" aria-hidden="true" />
                  ) : (
                    <>
                      <Film className="h-6 w-6" aria-hidden="true" />
                      <span className="text-[10px] font-medium">暂无封面</span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {/* Chinese / primary title: Source Han via font-sans, single line */}
                <h3
                  className="truncate whitespace-nowrap font-sans text-lg font-semibold leading-snug tracking-tight text-[var(--v4-text)]"
                  title={displayTitle}
                >
                  {displayTitle}
                </h3>
                {displayOriginal ? (
                  /* Latin original: Geist only — distinct from CJK face */
                  <p
                    className="mt-1 truncate whitespace-nowrap text-[13px] font-medium leading-snug tracking-[0.02em] text-[var(--v4-text-muted)]"
                    style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
                    title={displayOriginal}
                  >
                    {displayOriginal}
                  </p>
                ) : (
                  !tmdbData && (
                    <p className="mt-1 text-sm leading-snug text-[var(--v4-text-muted)]">
                      用于命名与预览背景，可稍后补充。
                    </p>
                  )
                )}
              </div>
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
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

            {(metaBits.length > 0 || hasScore || (tmdbData?.genres?.length ?? 0) > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {metaBits.length > 0 && (
                  <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--v4-text-muted)]">
                    {metaBits.join(' · ')}
                  </span>
                )}
                {hasScore && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--v4-text)]">
                    <Star className="h-3 w-3 fill-[var(--v4-accent)] text-[var(--v4-accent)]" aria-hidden="true" />
                    {tmdbData!.voteAverage.toFixed(1)}
                  </span>
                )}
                {tmdbData?.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-md border border-[var(--v4-line)] bg-black/20 px-2 py-0.5 text-[11px] font-medium text-[var(--v4-text-muted)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {overview ? (
              <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-[var(--v4-text-muted)]">
                {overview}
              </p>
            ) : (
              !tmdbData && (
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--v4-text-faint)]">
                  匹配后显示封面、评分与简介。
                </p>
              )
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTmdbManualOpen(true)}
                className="v4-focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-2.5 text-xs font-semibold text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-accent-soft)]"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {tmdbData ? '更改匹配' : needsTitleInput ? '补充片名' : '搜索影片'}
              </button>
              {!tmdbData && !isSearchingTmdb && (
                <span className="text-[11px] text-[var(--v4-text-faint)]">不挡下一步</span>
              )}
            </div>
          </div>
        </div>
      </section>

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
