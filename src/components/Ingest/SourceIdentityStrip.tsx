'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { Image as ImageIcon, Search, LoaderCircle, X, Star, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** 把「原文 + 英文」粘在同一串的标题拆成两行，避免折行糊成一团。 */
const splitAltTitles = (original?: string | null) => {
  if (!original?.trim()) return { scriptTitle: null as string | null, latinTitle: null as string | null };
  const trimmed = original.trim();
  const mixed = trimmed.match(/^(.+?[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff])\s+([A-Za-z0-9].+)$/);
  if (mixed) {
    return { scriptTitle: mixed[1].trim(), latinTitle: mixed[2].trim() };
  }
  if (/[A-Za-z]/.test(trimmed) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(trimmed)) {
    return { scriptTitle: null, latinTitle: trimmed };
  }
  return { scriptTitle: trimmed, latinTitle: null };
};

/**
 * Left rail for media identity — poster, meta, rematch.
 * Stretches with the checklist card; typography sized for scanability.
 */
export const SourceIdentityStrip: React.FC = () => {
  const {
    tmdbData,
    tmdbAlternateSuggestion,
    isSearchingTmdb,
    customFilename,
    tasks,
    selectedTaskId,
    setTmdbManualOpen,
    swapTmdbAlternate,
    statusNotices,
    dismissStatusNotice,
  } = useStudioStore(useShallow((state) => ({
    tmdbData: state.tmdbData,
    tmdbAlternateSuggestion: state.tmdbAlternateSuggestion,
    isSearchingTmdb: state.isSearchingTmdb,
    customFilename: state.customFilename,
    tasks: state.tasks,
    selectedTaskId: state.selectedTaskId,
    setTmdbManualOpen: state.setTmdbManualOpen,
    swapTmdbAlternate: state.swapTmdbAlternate,
    statusNotices: state.statusNotices,
    dismissStatusNotice: state.dismissStatusNotice,
  })));

  const activeTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0];
  const optimisticTitle = customFilename || activeTask?.title || '待匹配影片';
  const needsTitleInput = Boolean(activeTask?.title.includes('待补充片名'));

  const filmNotice = [...statusNotices]
    .reverse()
    .find((notice) => notice.id === 'media-match' || notice.id === 'media-identity');

  const showInlineNotice = Boolean(filmNotice && !tmdbData);
  const displayTitle = tmdbData?.title || optimisticTitle;
  const { scriptTitle, latinTitle } = splitAltTitles(
    tmdbData?.originalTitle && tmdbData.originalTitle !== tmdbData.title
      ? tmdbData.originalTitle
      : null,
  );
  const hasScore = Boolean(tmdbData && tmdbData.voteAverage > 0);
  const overview = tmdbData?.overview?.trim() || '';
  const rematchLabel = tmdbData ? '手动匹配' : needsTitleInput ? '补充片名' : '搜索影片';

  return (
    <aside className="source-identity-rail v4-panel flex h-full w-full flex-col overflow-hidden rounded-lg">
      <div className="source-identity-rail__poster relative w-full shrink-0 overflow-hidden border-b border-[var(--v4-line)]">
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
              className="absolute inset-0 h-full w-full"
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
                    封面完整显示 · 2:3
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3
                className="font-display min-w-0 text-[1.2rem] leading-snug text-[var(--v4-text)] md:text-[1.35rem]"
                title={displayTitle}
              >
                {displayTitle}
              </h3>
              {tmdbData?.year ? (
                <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-[var(--v4-text-muted)]">
                  {tmdbData.year}
                </span>
              ) : null}
            </div>

            {scriptTitle ? (
              <p className="prose-serif mt-1.5 truncate text-[14px] text-[var(--v4-text-muted)]" title={scriptTitle}>
                {scriptTitle}
              </p>
            ) : null}
            {latinTitle ? (
              <p className="mt-0.5 truncate font-mono text-[12.5px] font-medium tracking-wide text-[var(--v4-text-faint)]" title={latinTitle}>
                {latinTitle}
              </p>
            ) : null}
            {!tmdbData && !scriptTitle && !latinTitle ? (
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[var(--v4-text-muted)]">
                用于命名与预览背景，可稍后补充。
              </p>
            ) : null}

            {(hasScore || (tmdbData?.genres?.length ?? 0) > 0) && (
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                {hasScore && (
                  <span className="ui-meta ui-meta--key gap-1">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {tmdbData!.voteAverage.toFixed(1)}
                  </span>
                )}
                {tmdbData?.genres?.slice(0, 4).map((genre) => (
                  <span key={genre} className="ui-meta">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {overview ? (
            <p className="prose-serif text-[14.5px] leading-[1.75] text-[var(--v4-text)] md:text-[15px]">
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
                <div className="rounded-lg border border-[color:rgba(196,137,58,0.28)] bg-[var(--v4-panel-muted)] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--v4-text)]">
                      <span className="font-semibold">{filmNotice.title}</span>
                      {filmNotice.message && (
                        <span className="text-[var(--v4-text-muted)]"> · {filmNotice.message}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      aria-label="关闭提示"
                      onClick={() => dismissStatusNotice(filmNotice.id)}
                      className="v4-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--v4-text-faint)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {filmNotice.actionLabel && (
                    <button
                      type="button"
                      onClick={() => setTmdbManualOpen(true)}
                      className="ui-action mt-2 w-full"
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
          <div className="flex flex-col gap-2">
            {tmdbData && tmdbAlternateSuggestion ? (
              <>
                <button
                  type="button"
                  onClick={() => { void swapTmdbAlternate(); }}
                  disabled={isSearchingTmdb}
                  className="ui-action w-full"
                  title="切换到同一次搜索缓存的另一同名候选，不再发起检索"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  不是这个？
                </button>
                <button
                  type="button"
                  onClick={() => setTmdbManualOpen(true)}
                  className="ui-action ui-action--secondary w-full"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  手动匹配
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setTmdbManualOpen(true)}
                className="ui-action w-full"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {rematchLabel}
              </button>
            )}
          </div>
          {tmdbData ? (
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 text-[12px] font-medium text-[var(--v4-text-faint)] transition-colors hover:text-[var(--v4-text-muted)]"
              title="This product uses the TMDB API but is not endorsed or certified by TMDB."
            >
              <span>Powered by</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tmdb_logo_blue_square.svg"
                alt="TMDB"
                className="h-5 w-auto object-contain opacity-80"
              />
            </a>
          ) : null}
        </div>
      </div>
    </aside>
  );
};
