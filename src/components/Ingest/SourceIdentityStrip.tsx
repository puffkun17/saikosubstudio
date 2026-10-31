'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { Image as ImageIcon, Search, LoaderCircle, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FilmMetaBlock, buildFilmRatings } from '@/components/Ingest/FilmMetaBlock';
import { resolveFilmTitles } from '@/utils/filmTitles';
import {
  computeSynopsisLayout,
  countLines,
  shouldCompactRematch,
  SYNOPSIS_TOGGLE_PX,
} from '@/core/synopsisClamp';

/** 桌面（lg）左栏才做自适应折叠；窄屏是单行条，简介整段隐藏（见 ds.css）。 */
const DESKTOP_QUERY = '(min-width: 1024px)';
/** 封面优先：完整 2:3 不裁切。只有极矮窗口（连「2 行简介 + 展开按钮」都放不下）才等比缩小，最低到这里，再不够左栏自己滚动。 */
const POSTER_HARD_FLOOR_PX = 120;
/** TMDB 署名在完整「手动匹配」按钮下方的间距（mt-3），与 JSX 保持一致。 */
const TMDB_LINK_GAP_PX = 12;
/** 标题各段之间的读屏/复制用空格（视觉间距由 padding 给）。 */
/** 第 2 行原名自动缩字的下限；再小就省略号 + title 提示。 */
const ALT_FONT_FLOOR_PX = 11;
const SEP = <span className="sr-only"> </span>;

interface SynopsisLayout {
  clamp: number | null;
  /** 封面高度：null = 按栏宽完整 2:3；数值 = 极矮窗口下等比缩小后的高度（不裁切，左右留纸色）。 */
  posterPx: number | null;
  /** 「手动匹配」收成封面角上的放大镜（仅 lg）。 */
  compact: boolean;
  /** 标题行超过 2 行被截断：此时把完整标题放进 title 提示。 */
  titleTruncated: boolean;
  /** 标题排法：one = 「主标题 原名 年份」一行放得下；two = 「主标题 年份」/「原名」两行。 */
  titleMode: 'one' | 'two';
  /** 两行模式下第 2 行原名的字号（px）；null = 基准字号（标题的 0.75em）。 */
  altFontPx: number | null;
}

const px = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Work-level identity rail — poster, one-line title (main + original + year), overview, rematch.
 * No episode label: the card is the work; episode info lives in the file list (multi-file batches).
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

  const filmNotice = [...statusNotices]
    .reverse()
    .find((notice) => notice.id === 'media-match' || notice.id === 'media-identity');

  const showInlineNotice = Boolean(filmNotice && !tmdbData);
  const { main: mainTitle, originalScript, originalLatin } = resolveFilmTitles(
    tmdbData?.title,
    tmdbData?.originalTitle,
    optimisticTitle,
  );
  // 标题：中文主标题 + 原名（优先拉丁/英文名，没有才用原文字形）+ 年份。原名与主标题相同时只显示一次。
  // 一行放得下 →「主标题 原名 年份」；放不下 →「主标题 年份」（主标题可省略，年份永远可见）/「原名」（单行省略）。
  const altTitle = originalLatin || originalScript || null;
  const year = tmdbData?.year?.trim() || null;
  const fullTitleText = [mainTitle, originalScript, originalLatin, year].filter(Boolean).join(' ');
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleProbeRef = useRef<HTMLSpanElement>(null);
  const altProbeRef = useRef<HTMLSpanElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLParagraphElement>(null);
  const rematchRef = useRef<HTMLButtonElement>(null);
  const rematchRowRef = useRef<HTMLDivElement>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [layout, setLayout] = useState<SynopsisLayout>({
    clamp: null, posterPx: null, compact: false, titleTruncated: false, titleMode: 'one', altFontPx: null,
  });

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
    // 标题排法只看「一行版」的自然宽度和标题栏宽度，两者都不受排法影响，所以不会来回切换。
    const heading = headingRef.current;
    const probe = titleProbeRef.current;
    const titleMode: SynopsisLayout['titleMode'] =
      heading && probe && probe.offsetWidth > heading.clientWidth + 0.5 ? 'two' : 'one';
    // 第 2 行原名：按基准字号下的自然宽度 / 可用宽度直接算出能放下的字号（0.5px 一档，向下取），
    // 不低于 11px；同样只依赖与排法无关的量尺，所以不会来回跳。
    let altFontPx: number | null = null;
    const altProbe = altProbeRef.current;
    if (heading && altProbe && titleMode === 'two') {
      const natural = altProbe.offsetWidth;
      const base = px(getComputedStyle(altProbe).fontSize);
      const avail = heading.clientWidth - 1;
      if (natural > avail && base > 0) {
        altFontPx = Math.max(ALT_FONT_FLOOR_PX, Math.floor(((base * avail) / natural) * 2) / 2);
        if (altFontPx >= base) altFontPx = null;
      }
    }
    const titleTruncated = Boolean(
      heading && titleMode === 'two' &&
      Array.from(heading.querySelectorAll<HTMLElement>('[data-title-fit]'))
        .some((el) => el.scrollWidth > el.clientWidth + 1),
    );
    let next: SynopsisLayout = { clamp: null, posterPx: null, compact: false, titleTruncated, titleMode, altFontPx };
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      const railH = rail.clientHeight;
      const naturalPoster = rail.clientWidth * 1.5;
      const bs = getComputedStyle(body);
      const cs = getComputedStyle(col);
      const sizer = sizerRef.current;
      // 完整按钮那一行的高度：紧凑模式下完整按钮仍在 DOM 里（脱离文档流、不可见），照样能量。
      const btn = rematchRef.current;
      const row = rematchRowRef.current;
      const btnIsOut = Boolean(btn && btn.dataset.collapsed === 'true');
      // 紧凑模式省下的高度：按钮本身 + 它与「更换候选」之间的行距；没有「更换候选」时，
      // TMDB 署名的上边距（mt-3）也一起收掉，署名紧贴「展开全文」下方 12px（body gap）。
      const hasTmdbLink = Boolean(foot.querySelector('.source-identity-rail__tmdb'));
      const rowPx = btn && row
        ? btn.offsetHeight + (row.childElementCount > 1 ? px(getComputedStyle(row).rowGap) : hasTmdbLink ? TMDB_LINK_GAP_PX : 0)
        : 0;
      const fixedBase =
        px(bs.paddingTop) + px(bs.paddingBottom) + px(bs.rowGap) +
        meta.offsetHeight + (sizer ? px(cs.rowGap) : 0);
      const footFull = foot.offsetHeight + (btnIsOut ? rowPx : 0);
      let clamp: number | null = null;
      let compact = false;
      let posterPx: number | null = null;
      if (sizer) {
        const lh = px(getComputedStyle(sizer).lineHeight);
        const total = countLines(sizer.offsetHeight, lh);
        // 1) 先用「完整按钮 + 完整封面」口径决定要不要收成放大镜（与当前模式无关，不会自激）。
        const availFull = railH - naturalPoster - fixedBase - footFull;
        compact = rowPx > 0 && shouldCompactRematch(availFull, lh, total);
        // 2) 再按选定模式给简介定行数。
        const avail = availFull + (compact ? rowPx : 0);
        clamp = computeSynopsisLayout(avail, lh, total, { toggleReservePx: SYNOPSIS_TOGGLE_PX }).clamp;
        // 3) 封面只在放不下时等比缩小。2px 吸收行高小数（20.3px）与边框的取整误差。
        const textPx = clamp === null ? sizer.offsetHeight : clamp * lh + SYNOPSIS_TOGGLE_PX;
        const room = Math.floor(railH - fixedBase - footFull + (compact ? rowPx : 0) - Math.ceil(textPx) - 2);
        if (room < naturalPoster) posterPx = Math.max(POSTER_HARD_FLOOR_PX, room);
      }
      next = { clamp, posterPx, compact, titleTruncated, titleMode, altFontPx };
    }
    setLayout((prev) =>
      prev.clamp === next.clamp && prev.posterPx === next.posterPx && prev.compact === next.compact &&
        prev.titleTruncated === next.titleTruncated && prev.titleMode === next.titleMode &&
        prev.altFontPx === next.altFontPx
        ? prev
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, overview, tmdbData, showFilmMeta, fullTitleText]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    let alive = true;
    const schedule = () => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    // 字体换上后一行版的自然宽度会变，再量一次。
    void document.fonts?.ready.then(schedule);
    for (const el of [railRef.current, metaRef.current, footRef.current, sizerRef.current, titleProbeRef.current, altProbeRef.current, headingRef.current]) {
      if (el) ro.observe(el);
    }
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [measure, overview]);

  const clampLines = overviewExpanded ? null : layout.clamp;
  const showToggle = Boolean(overview) && (layout.clamp !== null || overviewExpanded);

  // 紧凑模式下完整按钮仍留在 DOM 里量高度：脱离文档流、不可见、inert，读屏和 Tab 都跳过它。
  const rematchButton = (
    <button
      ref={rematchRef}
      type="button"
      onClick={() => setTmdbManualOpen(true)}
      data-collapsed={layout.compact ? 'true' : 'false'}
      aria-hidden={layout.compact || undefined}
      inert={layout.compact || undefined}
      tabIndex={layout.compact ? -1 : undefined}
      className={`ui-action ui-action--secondary w-full${layout.compact ? ' pointer-events-none invisible absolute inset-x-0 bottom-0' : ''}`}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      {rematchLabel}
    </button>
  );

  return (
    <aside
      ref={railRef}
      data-synopsis-expanded={overviewExpanded ? '' : undefined}
      className="source-identity-rail v4-panel flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div
        className="source-identity-rail__poster relative w-full border-b border-[var(--v4-line)]"
        data-poster-state={showPoster ? 'image' : posterFailed ? 'failed' : isSearchingTmdb ? 'searching' : 'empty'}
        data-poster-fit={layout.posterPx !== null ? 'scaled' : 'full'}
        style={layout.posterPx !== null ? { height: layout.posterPx, aspectRatio: 'auto' } : undefined}
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
        {layout.compact ? (
          <button
            type="button"
            onClick={() => setTmdbManualOpen(true)}
            aria-label={rematchLabel}
            className="source-identity-rail__rematch-fab"
            data-testid="rematch-compact"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="source-identity-rail__rematch-tip" aria-hidden="true">{rematchLabel}</span>
          </button>
        ) : null}
      </div>

      <div ref={bodyRef} className="source-identity-rail__body ds-card flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-group)]">
        <div
          ref={colRef}
          className="source-identity-rail__col -mx-1 -mb-2 flex min-h-0 flex-col gap-[var(--ds-gap-group)] overflow-y-auto px-1 pb-2"
        >
          <div ref={metaRef} className="min-w-0">
            <h3
              ref={headingRef}
              data-title-mode={layout.titleMode}
              className="source-identity-rail__heading relative overflow-hidden text-[1.15rem] leading-snug text-[var(--v4-text)] md:text-[1.25rem]"
              title={layout.titleTruncated ? fullTitleText : undefined}
            >
              {layout.titleMode === 'one' || !altTitle ? (
                <span className="flex min-w-0 items-baseline">
                  <span data-title-fit="" className="source-identity-rail__title source-identity-rail__main font-display min-w-0 truncate">
                    {mainTitle}
                  </span>
                  {altTitle ? (
                    <span className="source-identity-rail__alt min-w-0 shrink truncate pl-[0.4em]">{SEP}{altTitle}</span>
                  ) : null}
                  {year ? <span className="source-identity-rail__alt source-identity-rail__year shrink-0 pl-[0.4em]">{SEP}{year}</span> : null}
                </span>
              ) : (
                <>
                  <span className="flex min-w-0 items-baseline">
                    <span data-title-fit="" className="source-identity-rail__title source-identity-rail__main font-display min-w-0 truncate">
                      {mainTitle}
                    </span>
                    {year ? <span className="source-identity-rail__alt source-identity-rail__year shrink-0 pl-[0.4em]">{SEP}{year}</span> : null}
                  </span>
                  <span
                    data-title-fit=""
                    className="source-identity-rail__alt source-identity-rail__alt-line block truncate"
                    style={layout.altFontPx ? { fontSize: `${layout.altFontPx}px` } : undefined}
                  >
                    {SEP}{altTitle}
                  </span>
                </>
              )}
            </h3>
            {/* 量尺：一行版的自然宽度（同字号），不可见、不占位、不进标题文本，只用来决定排法。 */}
            <div aria-hidden="true" className="pointer-events-none invisible relative h-0 overflow-hidden">
              <span
                ref={titleProbeRef}
                className="absolute left-0 top-0 whitespace-nowrap text-[1.15rem] leading-snug md:text-[1.25rem]"
              >
                <span className="source-identity-rail__main font-display">{mainTitle}</span>
                {altTitle ? <span className="source-identity-rail__alt pl-[0.4em]">{altTitle}</span> : null}
                {year ? <span className="source-identity-rail__alt source-identity-rail__year pl-[0.4em]">{year}</span> : null}
              </span>
              {altTitle ? (
                <span className="absolute left-0 top-0 whitespace-nowrap text-[1.15rem] leading-snug md:text-[1.25rem]">
                  <span ref={altProbeRef} className="source-identity-rail__alt">{altTitle}</span>
                </span>
              ) : null}
            </div>
            {!tmdbData && !originalScript && !originalLatin ? (
              <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--v4-text-muted)]">
                用于命名与预览背景，可稍后补充。
              </p>
            ) : null}

            {showFilmMeta && (
              <FilmMetaBlock
                className="mt-2"
                gapClassName="gap-2"
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
                  className="source-identity-rail__toggle v4-focus-ring"
                  onClick={() => setOverviewExpanded((v) => !v)}
                >
                  {overviewExpanded ? '收起简介' : '展开全文'}
                  {overviewExpanded
                    ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
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

        <div
          ref={footRef}
          className={`source-identity-rail__foot relative shrink-0${layout.clamp === null && !overviewExpanded ? ' mt-auto' : ''}`}
        >
          <div ref={rematchRowRef} className="flex flex-col gap-2">
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
                {rematchButton}
              </>
            ) : (
              rematchButton
            )}
          </div>
          {tmdbData ? (
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={`source-identity-rail__tmdb ${layout.compact && !tmdbAlternateSuggestion ? 'mt-0' : 'mt-3'} flex w-full items-center justify-center gap-2 text-xs font-medium text-[var(--v4-text-muted)] transition-colors hover:text-[var(--v4-text)]`}
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
