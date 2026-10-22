'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { Image as ImageIcon, Search, LoaderCircle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FilmMetaBlock, buildFilmRatings } from '@/components/Ingest/FilmMetaBlock';
import { resolveFilmTitles } from '@/utils/filmTitles';

/**
 * Work-level identity rail — poster, title (once), episode, overview, rematch.
 * Task-level counts / CTAs live in the info bar (see TaskList).
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
  const episodeKey = activeTask?.epKey?.toUpperCase() || null;

  const filmNotice = [...statusNotices]
    .reverse()
    .find((notice) => notice.id === 'media-match' || notice.id === 'media-identity');

  const showInlineNotice = Boolean(filmNotice && !tmdbData);
  const { main: mainTitle, originalScript, originalLatin } = resolveFilmTitles(
    tmdbData?.title,
    tmdbData?.originalTitle,
    optimisticTitle,
  );
  const hasScore = Boolean(tmdbData && tmdbData.voteAverage > 0);
  const genres = tmdbData?.genres ?? [];
  const showFilmMeta = hasScore || genres.length > 0;
  const overview = tmdbData?.overview?.trim() || '';
  const rematchLabel = tmdbData ? '手动匹配' : needsTitleInput ? '补充片名' : '搜索影片';

  const overviewRef = useRef<HTMLParagraphElement>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [overviewClamped, setOverviewClamped] = useState(false);

  useEffect(() => {
    setOverviewExpanded(false);
  }, [overview]);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || overviewExpanded) {
      setOverviewClamped(false);
      return;
    }
    const measure = () => {
      setOverviewClamped(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [overview, overviewExpanded]);

  return (
    <aside className="source-identity-rail v4-panel flex h-full min-h-0 w-full flex-col overflow-hidden">
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

      <div className="ds-card flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-group)]">
        <div className="flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-item)] overflow-y-auto">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3
                className="source-identity-rail__title font-display min-w-0 text-[1.15rem] leading-snug text-[var(--v4-text)] md:text-[1.25rem]"
                title={mainTitle}
              >
                {mainTitle}
              </h3>
              {tmdbData?.year ? (
                <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-[var(--v4-text-muted)]">
                  {tmdbData.year}
                </span>
              ) : null}
              {episodeKey ? (
                <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[var(--v4-text-muted)]">
                  {episodeKey}
                </span>
              ) : null}
            </div>

            {originalScript ? (
              <p
                className="source-identity-rail__alt prose-serif mt-1.5 text-[14px] text-[var(--v4-text-muted)]"
                title={originalScript}
              >
                {originalScript}
              </p>
            ) : null}
            {originalLatin ? (
              <p
                className="source-identity-rail__alt mt-0.5 font-mono text-[12.5px] font-medium tracking-wide text-[var(--v4-text-faint)]"
                title={originalLatin}
              >
                {originalLatin}
              </p>
            ) : null}
            {!tmdbData && !originalScript && !originalLatin ? (
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--v4-text-muted)]">
                用于命名与预览背景，可稍后补充。
              </p>
            ) : null}

            {showFilmMeta && (
              <FilmMetaBlock
                className="mt-2.5"
                ratings={buildFilmRatings(tmdbData?.voteAverage)}
                genres={genres}
                maxGenres={4}
              />
            )}
          </div>

          {overview ? (
            <div className="source-identity-rail__overview-wrap">
              <p
                ref={overviewRef}
                className={`source-identity-rail__overview ds-body prose-serif ${overviewExpanded ? '' : 'line-clamp-3'}`}
              >
                {overview}
              </p>
              {(overviewClamped || overviewExpanded) && (
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-[var(--v4-accent-strong)] hover:underline"
                  onClick={() => setOverviewExpanded((v) => !v)}
                >
                  {overviewExpanded ? '收起' : '展开'}
                </button>
              )}
            </div>
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
                <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--v5-warning)_28%,transparent)] bg-[var(--v4-panel-muted)] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--v4-text)]">
                      <span className="font-semibold">{filmNotice.title}</span>
                      {filmNotice.message && (
                        <span className="text-[var(--v4-text-muted)]"> · {filmNotice.message}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      aria-label="关闭提示"
                      onClick={() => dismissStatusNotice(filmNotice.id)}
                      className="v4-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--v4-text-muted)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]"
                    >
                      <X className="h-4 w-4" />
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
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  更换候选
                </button>
                <button
                  type="button"
                  onClick={() => setTmdbManualOpen(true)}
                  className="ui-action ui-action--secondary w-full"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  手动匹配
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setTmdbManualOpen(true)}
                className="ui-action ui-action--secondary w-full"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {rematchLabel}
              </button>
            )}
          </div>
          {tmdbData ? (
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="source-identity-rail__tmdb mt-3 flex w-full items-center justify-center gap-2 text-xs font-medium text-[var(--v4-text-muted)] transition-colors hover:text-[var(--v4-text)]"
              title="This product uses the TMDB API but is not endorsed or certified by TMDB."
            >
              <span>Powered by</span>
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
