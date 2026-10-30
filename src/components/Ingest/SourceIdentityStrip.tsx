'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { Image as ImageIcon, Search, LoaderCircle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FilmMetaBlock, buildFilmRatings } from '@/components/Ingest/FilmMetaBlock';
import { resolveFilmTitles } from '@/utils/filmTitles';
import { computeSynopsisClamp, countLines } from '@/core/synopsisClamp';

/** 桌面（lg）左栏才做自适应折叠；窄屏是单行条，简介整段隐藏（见 ds.css）。 */
const DESKTOP_QUERY = '(min-width: 1024px)';
/** 封面最少占左栏高度的比例 / 下限：简介可以向封面「借」高度，但借到这里为止，再不够就折叠。 */
const POSTER_SHARE = 0.45;
const POSTER_FLOOR_PX = 180;
/** 封面让高度的底线：低于它就不再压封面，改为左栏内滚动（只在极矮窗口出现）。 */
const POSTER_HARD_FLOOR_PX = 120;
/** 「展开」按钮：mt-1 (4px) + h-5 (20px)。 */
const TOGGLE_RESERVE_PX = 24;

interface SynopsisLayout {
  clamp: number | null;
  posterMinPx: number | null;
}

const px = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

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

  const reduceMotion = useReducedMotion();
  const posterUrl = tmdbData?.posterUrl || null;
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);
  const posterFailed = Boolean(posterUrl && failedPosterUrl === posterUrl);
  const showPoster = Boolean(posterUrl && !posterFailed);

  const overviewId = useId();
  const railRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLParagraphElement>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [layout, setLayout] = useState<SynopsisLayout>({ clamp: null, posterMinPx: null });

  useEffect(() => {
    setOverviewExpanded(false);
  }, [overview]);

  /**
   * 只读不写布局：输入（左栏高度、宽度、标题/标签块、底部按钮、隐藏量尺里的全文行数）
   * 都不受折叠结果影响——左栏在 lg 上 contain:size，高度只跟右栏走——所以不会自激循环。
   */
  const measure = useCallback(() => {
    const rail = railRef.current;
    const body = bodyRef.current;
    const col = colRef.current;
    const meta = metaRef.current;
    const foot = footRef.current;
    if (!rail || !body || !col || !meta || !foot) return;
    let next: SynopsisLayout = { clamp: null, posterMinPx: null };
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      const railH = rail.clientHeight;
      const naturalPoster = rail.clientWidth * 1.5;
      const posterTarget = Math.min(naturalPoster, Math.max(POSTER_FLOOR_PX, railH * POSTER_SHARE));
      const bs = getComputedStyle(body);
      const cs = getComputedStyle(col);
      const sizer = sizerRef.current;
      const fixed =
        px(bs.paddingTop) + px(bs.paddingBottom) + px(bs.rowGap) +
        foot.offsetHeight + meta.offsetHeight + (sizer ? px(cs.rowGap) : 0);
      let clamp: number | null = null;
      let textPx = 0;
      if (sizer) {
        const lh = px(getComputedStyle(sizer).lineHeight);
        const total = countLines(sizer.offsetHeight, lh);
        clamp = computeSynopsisClamp(railH - posterTarget - fixed, lh, total, {
          toggleReservePx: TOGGLE_RESERVE_PX,
        });
        textPx = clamp === null ? sizer.offsetHeight : clamp * lh + TOGGLE_RESERVE_PX;
      }
      // 封面是弹性的那一块：回差的 1–2 行、或「至少 3 行」放不下的部分，都从封面高度里让出来，
      // 但不低于 POSTER_HARD_FLOOR_PX（再矮就让左栏自己滚动）。
      // 2px：吸收行高小数（20.3px）与边框的取整误差。
      const room = Math.floor(railH - fixed - Math.ceil(textPx) - 2);
      const posterMinPx = Math.max(POSTER_HARD_FLOOR_PX, Math.min(Math.floor(posterTarget), room));
      next = { clamp, posterMinPx };
    }
    setLayout((prev) => (prev.clamp === next.clamp && prev.posterMinPx === next.posterMinPx ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, overview, tmdbData, showFilmMeta, episodeKey]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    for (const el of [railRef.current, metaRef.current, footRef.current, sizerRef.current]) {
      if (el) ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [measure, overview]);

  const clampLines = overviewExpanded ? null : layout.clamp;
  const showToggle = Boolean(overview) && (layout.clamp !== null || overviewExpanded);

  return (
    <aside
      ref={railRef}
      data-synopsis-expanded={overviewExpanded ? '' : undefined}
      className="source-identity-rail v4-panel flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div
        className="source-identity-rail__poster relative w-full border-b border-[var(--v4-line)]"
        data-poster-state={showPoster ? 'image' : posterFailed ? 'failed' : isSearchingTmdb ? 'searching' : 'empty'}
        style={layout.posterMinPx !== null ? { minHeight: layout.posterMinPx } : undefined}
      >
        <AnimatePresence mode="wait">
          {showPoster && posterUrl ? (
            <motion.img
              key={posterUrl}
              src={posterUrl}
              alt=""
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
              onError={() => setFailedPosterUrl(posterUrl)}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <motion.div
              key={isSearchingTmdb ? 'searching' : posterFailed ? 'failed' : 'empty'}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isSearchingTmdb ? 'animate-pulse bg-[var(--v4-accent-soft)]' : 'text-[var(--v4-text-faint)]'}`}
            >
              {isSearchingTmdb ? (
                <LoaderCircle className="h-5 w-5 animate-spin text-[var(--v4-accent-strong)]" aria-hidden="true" />
              ) : (
                <>
                  <ImageIcon className="h-7 w-7" aria-hidden="true" />
                  <span className="source-identity-rail__poster-note px-3 text-center text-xs leading-relaxed text-[var(--v4-text-faint)]">
                    {posterFailed ? '封面加载失败' : tmdbData ? '暂无封面' : '匹配后显示封面'}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={bodyRef} className="source-identity-rail__body ds-card flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-group)]">
        <div ref={colRef} className="flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-item)] overflow-y-auto">
          <div ref={metaRef} className="min-w-0">
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
            <div className="source-identity-rail__overview-wrap relative">
              <p
                id={overviewId}
                data-synopsis-clamp={clampLines ?? 'none'}
                className="source-identity-rail__overview ds-body prose-serif"
                style={
                  clampLines !== null
                    ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: clampLines, overflow: 'hidden' }
                    : undefined
                }
              >
                {overview}
              </p>
              {/* 量尺：同字号同宽度的全文，不占位、不可见，只用来数总行数。 */}
              <div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
                <p ref={sizerRef} className="source-identity-rail__overview-sizer ds-body prose-serif">
                  {overview}
                </p>
              </div>
              {showToggle && (
                <button
                  type="button"
                  aria-expanded={overviewExpanded}
                  aria-controls={overviewId}
                  className="v4-focus-ring mt-1 h-5 rounded-sm text-xs font-semibold leading-5 text-[var(--v4-accent-strong)] hover:underline"
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

        <div ref={footRef} className="shrink-0 pt-1">
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
