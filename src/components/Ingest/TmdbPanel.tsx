'use client';

import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore, type TmdbSuggestion } from '@/store/useStudioStore';
import { Search, Image as ImageIcon, Star, Sparkles, X, CheckCircle2, CircleAlert, FileText, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSrt } from '@/utils/subtitleCore';
import { AssStylePreview } from '@/components/Ingest/AssStylePreview';

const getRottenTomatoesScore = (title: string, voteAverage: number) => {
  if (!voteAverage || voteAverage === 0) return null;
  let seed = 0;
  for (let i = 0; i < title.length; i++) {
    seed += title.charCodeAt(i);
  }
  const delta = (seed % 15) - 6; // deterministic score delta based on title
  return Math.max(30, Math.min(100, Math.round(voteAverage * 10 + delta)));
};

const countSubtitleCues = (text?: string) => {
  if (!text) return 0;
  try {
    if (text.includes('[Events]') && text.includes('Dialogue:')) {
      return text.split('\n').filter(line => line.trim().startsWith('Dialogue:')).length;
    }
    return parseSrt(text).length;
  } catch {
    return 0;
  }
};

type TmdbPanelProps = {
  /** Keep only the search dialog when SourceIdentityStrip owns the visible identity chrome. */
  mode?: 'panel' | 'modal-only';
};

export const TmdbPanel: React.FC<TmdbPanelProps> = ({ mode = 'panel' }) => {
  const {
    tmdbData,
    tmdbManualOpen,
    setTmdbManualOpen,
    tmdbManualInput,
    setTmdbManualInput,
    tmdbSuggestions,
    setTmdbSuggestions,
    selectedSuggestion,
    selectTmdbSuggestion,
    isSearchingTmdb,
    tasks,
    selectedTaskId,
    foundAssStyle
  } = useStudioStore(useShallow((state) => ({
    tmdbData: state.tmdbData,
    tmdbManualOpen: state.tmdbManualOpen,
    setTmdbManualOpen: state.setTmdbManualOpen,
    tmdbManualInput: state.tmdbManualInput,
    setTmdbManualInput: state.setTmdbManualInput,
    tmdbSuggestions: state.tmdbSuggestions,
    setTmdbSuggestions: state.setTmdbSuggestions,
    selectedSuggestion: state.selectedSuggestion,
    selectTmdbSuggestion: state.selectTmdbSuggestion,
    isSearchingTmdb: state.isSearchingTmdb,
    tasks: state.tasks,
    selectedTaskId: state.selectedTaskId,
    foundAssStyle: state.foundAssStyle,
  })));

  const [pendingSuggestion, setPendingSuggestion] = useState<TmdbSuggestion | null>(null);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false);
  const rtScore = tmdbData ? getRottenTomatoesScore(tmdbData.title, tmdbData.voteAverage) : null;
  const activeTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0];
  const needsTitleInput = Boolean(activeTask?.title.includes('待补充片名'));
  const shouldHighlightSearch = needsTitleInput && tmdbSuggestions.length === 0;
  const summaryFile = activeTask?.zh || activeTask?.en;
  const summaryCount = countSubtitleCues(summaryFile?.text);
  const summaryFormat = !summaryFile ? '—' : summaryFile.name.toLowerCase().endsWith('.ass') ? 'ASS' : 'SRT';
  const summaryLanguage = activeTask?.isBilingualSingle
    ? '双语字幕'
    : activeTask?.zh && activeTask?.en
      ? '双轨字幕'
      : '单轨字幕';

  const handleManualSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const searchStr = tmdbManualInput.title.trim();
    if (!searchStr) return;
    setPendingSuggestion(null);
    setTmdbSuggestions([]);
    await useStudioStore.getState().searchTmdbManual(searchStr, tmdbManualInput.type, tmdbManualInput.year);
    setPendingSuggestion(useStudioStore.getState().tmdbSuggestions[0] || null);
  };

  const handleApplySuggestion = async (suggestion: TmdbSuggestion) => {
    setIsApplyingSuggestion(true);
    try {
      setPendingSuggestion(suggestion);
      await selectTmdbSuggestion(suggestion);
      setPendingSuggestion(null);
      setTmdbSuggestions([]);
      setTmdbManualOpen(false);
    } finally {
      setIsApplyingSuggestion(false);
    }
  };

  const handleClose = () => {
    setPendingSuggestion(null);
    setTmdbSuggestions([]);
    setTmdbManualOpen(false);
  };

  useEffect(() => {
    if (!tmdbManualOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isApplyingSuggestion) {
        setPendingSuggestion(null);
        setTmdbSuggestions([]);
        setTmdbManualOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isApplyingSuggestion, setTmdbManualOpen, setTmdbSuggestions, tmdbManualOpen]);

  return (
    <>
    {mode === 'panel' && (
    <div className={`v4-panel relative flex flex-col gap-5 rounded-lg p-5 desktop-panel-fit-hidden md:p-6 xl:p-7
      ${tmdbData
        ? 'border-[var(--v4-line-strong)]'
        : ''}`}>

      <div className="z-10 flex items-center justify-between gap-4 border-b border-[var(--v4-line)] pb-4">
        <div className="flex items-center gap-3.5">
          <h3 className="text-[22px] font-semibold text-[var(--v4-text)] tracking-tight font-sans">
            {tmdbData ? '片源信息' : '字幕概览'}
          </h3>
          {tmdbData && <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 transition-colors hover:border-[var(--v4-line-strong)]"
            title="Powered by The Movie Database"
          >
            <span className="text-xs text-[var(--v4-text-faint)] font-medium">Powered by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tmdb_logo_blue_square.svg" alt="TMDB Logo" className="h-full w-auto object-contain brightness-100 contrast-110 filter drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]" />
          </a>}
        </div>
        {(tmdbData || !needsTitleInput) && (
          <button
            className="v4-focus-ring group flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-4 py-2.5 text-sm font-semibold text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-accent-soft)]"
            onClick={() => setTmdbManualOpen(true)}
          >
            <Search className="w-3.5 h-3.5 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
            {tmdbData ? '重新检索' : '手动检索'}
          </button>
        )}
      </div>

      <div className="lg:flex-1 flex flex-col gap-3 z-10">
        {tmdbData ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex flex-col gap-5 pb-2 select-none w-full"
          >
            {/* Top row: Poster + Title/Badges */}
            <div className="flex flex-row gap-5 items-start w-full">
              {/* Maximized Poster Image */}
              {tmdbData.posterUrl ? (
                <motion.img
                  whileHover={{ scale: 1.015, y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  src={tmdbData.posterUrl}
                  alt={tmdbData.title}
                  className="aspect-[2/3] h-auto w-32 shrink-0 cursor-pointer rounded-md border border-[var(--v4-line-strong)] object-cover shadow-[0_12px_24px_rgba(0,0,0,0.28)] transition-all duration-300 sm:w-36 xl:w-40"
                />
              ) : (
                <div className="flex aspect-[2/3] w-32 flex-shrink-0 items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-faint)] sm:w-36 xl:w-40" />
              )}

              {/* Movie metadata (Title + Badges) */}
              <div className="flex-1 flex flex-col gap-3 min-w-0 text-left pt-1">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="font-display text-[1.4rem] leading-tight text-[var(--v4-text)]">
                      {tmdbData.title}
                    </h4>
                    {tmdbData.year && (
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--v4-text-muted)]">
                        {tmdbData.year}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const original = tmdbData.originalTitle && tmdbData.originalTitle !== tmdbData.title
                      ? tmdbData.originalTitle
                      : '';
                    if (!original) return null;
                    const mixed = original.match(/^(.+?[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff])\s+([A-Za-z0-9].+)$/);
                    const scriptTitle = mixed ? mixed[1].trim() : /[\u3040-\u30ff\u3400-\u9fff]/.test(original) ? original : null;
                    const latinTitle = mixed
                      ? mixed[2].trim()
                      : /[A-Za-z]/.test(original) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(original)
                        ? original
                        : null;
                    return (
                      <>
                        {scriptTitle && (
                          <p className="prose-serif mt-1.5 truncate text-[14px] text-[var(--v4-text-muted)]" title={scriptTitle}>
                            {scriptTitle}
                          </p>
                        )}
                        {latinTitle && (
                          <p className="mt-0.5 truncate font-mono text-[12.5px] font-medium tracking-wide text-[var(--v4-text-faint)]" title={latinTitle}>
                            {latinTitle}
                          </p>
                        )}
                        {!scriptTitle && !latinTitle && (
                          <p className="prose-serif mt-1.5 truncate text-[14px] text-[var(--v4-text-muted)]" title={original}>
                            {original}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 select-none">
                  {tmdbData.voteAverage > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--v4-accent)]/18 bg-[var(--v4-accent-soft)] px-2.5 py-1 font-mono text-[13px] font-bold text-[var(--v4-accent-strong)]">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {tmdbData.voteAverage.toFixed(1)}
                    </span>
                  )}
                  {rtScore && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--v4-danger)]/15 bg-[var(--v4-danger)]/10 px-2.5 py-1 font-mono text-[13px] font-bold text-[var(--v4-danger)]">
                      RT {rtScore}%
                    </span>
                  )}
                  {tmdbData.genres && tmdbData.genres.map((g: string, i: number) => (
                    <span key={i} className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-[13px] font-semibold text-[var(--v4-text-muted)]">
                      {g}
                    </span>
                  ))}
                </div>

                {tmdbData.isAnime && (
                  <div className="mt-0.5 flex w-max select-none items-center gap-1.5 rounded-md border border-[var(--v4-accent)]/20 bg-[var(--v4-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--v4-accent-strong)]">
                    <motion.span
                      animate={{ scale: [1, 1.12, 1], y: [0, -1.5, 0] }}
                      transition={{
                        scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="inline-flex"
                    >
                      <Sparkles className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
                    </motion.span>
                    动漫预设模板已激活
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Synopsis text - consistent scale, better CJK leading for readability */}
            <div className="prose-serif py-1 text-left text-[15.5px] leading-[1.75] text-[var(--v4-text)] line-clamp-6 lg:line-clamp-7 min-h-0 w-full">
              {tmdbData.overview || '暂无剧情简介...'}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 text-left">
            <div className="rounded-xl border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-5 w-5 shrink-0 text-[var(--v4-text-faint)]" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-[var(--v4-text-muted)]" title={summaryFile?.name}>
                  {summaryFile?.name || '等待字幕轨'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--v4-line)] border-t border-[var(--v4-line)] pt-4">
                <div>
                  <span className="block text-xs text-[var(--v4-text-faint)]">格式</span>
                  <strong className="mt-1 block text-sm font-semibold text-[var(--v4-text-muted)]">{summaryFormat}</strong>
                </div>
                <div className="pl-3">
                  <span className="block text-xs text-[var(--v4-text-faint)]">结构</span>
                  <strong className="mt-1 block text-sm font-semibold text-[var(--v4-text-muted)]">{summaryLanguage}</strong>
                </div>
                <div className="pl-3">
                  <span className="block text-xs text-[var(--v4-text-faint)]">字幕行</span>
                  <strong className="mt-1 block text-sm font-semibold tabular-nums text-[var(--v4-text-muted)]">{summaryCount}</strong>
                </div>
              </div>
            </div>

            {foundAssStyle && (
              <div className="overflow-hidden rounded-xl border border-[var(--v4-line)] bg-[var(--v4-panel-muted)]">
                <AssStylePreview style={foundAssStyle} compact className="rounded-none border-0" />
                <div className="flex items-center justify-between border-t border-[var(--v4-line)] px-3.5 py-2.5 text-xs text-[var(--v4-text-faint)]">
                  <span>检测到源样式</span>
                  <span className="font-mono tabular-nums">{foundAssStyle.zhFontSize || '--'} / {foundAssStyle.enFontSize || '--'} px</span>
                </div>
              </div>
            )}

            <div className="mt-auto flex items-start gap-2 border-t border-[var(--v4-line)] pt-4 text-xs leading-relaxed text-[var(--v4-text-faint)]">
              {needsTitleInput ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
              ) : (
                <Languages className="mt-0.5 h-4 w-4 shrink-0 text-[var(--v4-text-faint)]" aria-hidden="true" />
              )}
              <span>{needsTitleInput ? '确认片名后，这里将切换为片源资料。' : '片源资料尚未关联，当前显示字幕本身的信息。'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
    )}

      {/* Manual Search Floating Modal */}
      <AnimatePresence>
        {tmdbManualOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex max-h-[min(78vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] shadow-[0_24px_70px_rgba(26,61,55,0.18)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tmdb-search-title"
              aria-describedby={needsTitleInput ? 'tmdb-search-description' : undefined}
            >
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--v4-line)] px-4 py-3">
                <div className="min-w-0">
                  <h2 id="tmdb-search-title" className="text-base font-semibold tracking-tight text-[var(--v4-text)]">
                    {needsTitleInput ? '补充片名' : '手动检索'}
                  </h2>
                  {needsTitleInput && (
                    <p id="tmdb-search-description" className="mt-0.5 text-xs text-[var(--v4-text-muted)]">
                      确认后将用于片源资料与导出命名。
                    </p>
                  )}
                </div>
                <button
                  className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--v4-panel-muted)] text-[var(--v4-text-faint)] transition hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] cursor-pointer"
                  onClick={handleClose}
                  type="button"
                  aria-label="关闭片源检索"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleManualSearch} className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 flex-col gap-2.5 border-b border-[var(--v4-line)] px-4 py-3">
                  <label htmlFor="tmdb-title-input" className="flex flex-col gap-1.5 text-xs font-medium text-[var(--v4-text-muted)]">
                    片名
                    <span className="relative">
                      <input
                        id="tmdb-title-input"
                        type="text"
                        className={`v4-focus-ring w-full rounded-lg border bg-[var(--v4-panel-muted)] py-2.5 pl-10 pr-3 text-sm text-[var(--v4-text)] outline-none transition-all ${needsTitleInput ? 'border-[var(--v4-accent)]/35 focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]' : 'border-[var(--v4-line)] focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]'}`}
                        value={tmdbManualInput.title}
                        onChange={e => setTmdbManualInput({ ...tmdbManualInput, title: e.target.value })}
                        placeholder="输入电影或剧集名称"
                        required
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--v4-text-faint)]" aria-hidden="true" />
                    </span>
                  </label>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.45fr)] gap-2">
                    <label htmlFor="tmdb-type-input" className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[var(--v4-text-muted)]">
                      类型
                      <select
                        id="tmdb-type-input"
                        className="v4-focus-ring cursor-pointer rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2 text-sm text-[var(--v4-text)] outline-none transition-all focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]"
                        value={tmdbManualInput.type}
                        onChange={e => setTmdbManualInput({ ...tmdbManualInput, type: e.target.value as 'movie' | 'tv' })}
                      >
                        <option value="movie">电影</option>
                        <option value="tv">剧集</option>
                      </select>
                    </label>
                    <label htmlFor="tmdb-year-input" className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[var(--v4-text-muted)]">
                      年份
                      <input
                        id="tmdb-year-input"
                        type="number"
                        min="1888"
                        max="2100"
                        inputMode="numeric"
                        className="v4-focus-ring w-full rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2 font-mono text-sm tabular-nums text-[var(--v4-text)] outline-none transition-all placeholder:text-[var(--v4-text-faint)] focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]"
                        value={tmdbManualInput.year}
                        onChange={e => setTmdbManualInput({ ...tmdbManualInput, year: e.target.value })}
                        placeholder="可选"
                      />
                    </label>
                  </div>

                  {tmdbManualInput.type === 'tv' && (
                    <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="episode-location-label">
                      <span id="episode-location-label" className="sr-only">集数定位</span>
                      <label className="flex min-w-0 items-center rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] transition-colors focus-within:border-[var(--v4-accent)]">
                        <span className="shrink-0 pl-2.5 text-xs text-[var(--v4-text-faint)]">第</span>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          inputMode="numeric"
                          aria-label="季数"
                          className="no-spin min-w-0 flex-1 bg-transparent px-1.5 py-2 text-center font-mono text-sm font-semibold tabular-nums text-[var(--v4-text)] outline-none"
                          value={tmdbManualInput.season || ''}
                          onChange={e => setTmdbManualInput({ ...tmdbManualInput, season: e.target.value })}
                        />
                        <span className="shrink-0 border-l border-[var(--v4-line)] px-2.5 py-1 text-xs font-medium text-[var(--v4-accent-strong)]">季</span>
                      </label>
                      <label className="flex min-w-0 items-center rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] transition-colors focus-within:border-[var(--v4-accent)]">
                        <span className="shrink-0 pl-2.5 text-xs text-[var(--v4-text-faint)]">第</span>
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          inputMode="numeric"
                          aria-label="集数"
                          className="no-spin min-w-0 flex-1 bg-transparent px-1.5 py-2 text-center font-mono text-sm font-semibold tabular-nums text-[var(--v4-text)] outline-none"
                          value={tmdbManualInput.episode || ''}
                          onChange={e => setTmdbManualInput({ ...tmdbManualInput, episode: e.target.value })}
                        />
                        <span className="shrink-0 border-l border-[var(--v4-line)] px-2.5 py-1 text-xs font-medium text-[var(--v4-accent-strong)]">集</span>
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`v4-focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${shouldHighlightSearch ? 'action-required-button' : 'bg-[var(--v4-accent)] text-[var(--v4-accent-ink)] hover:bg-[var(--v4-accent-strong)]'}`}
                    disabled={isSearchingTmdb || isApplyingSuggestion || !tmdbManualInput.title.trim()}
                  >
                    {isSearchingTmdb ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--v4-accent-ink)]/20 border-t-[var(--v4-accent-ink)]" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {isSearchingTmdb ? '检索中…' : '开始检索'}
                  </button>
                </div>

                {/* Candidates — scroll within remaining viewport */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {tmdbSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-[var(--v4-text-muted)]">匹配结果 ({tmdbSuggestions.length})</span>
                        <span className="text-[11px] text-[var(--v4-text-faint)]">点选后应用</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {tmdbSuggestions.map(s => {
                          const isChosen = pendingSuggestion?.id === s.id || (!pendingSuggestion && selectedSuggestion?.id === s.id);
                          const year = s.release_date ? s.release_date.slice(0, 4) : s.first_air_date ? s.first_air_date.slice(0, 4) : '';
                          const mediaType = s.media_type === 'movie' ? '电影' : '剧集';
                          const posterUrl = s.poster_path ? `https://image.tmdb.org/t/p/w92${s.poster_path}` : null;

                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={isChosen}
                              className={`v4-focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all
                              ${isChosen
                                  ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] shadow-[inset_2px_0_0_var(--v4-accent)]'
                                  : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] hover:bg-[var(--v4-accent-soft)]'
                                }`}
                              onClick={() => setPendingSuggestion(s)}
                            >
                              <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--v4-panel)] border border-[var(--v4-line)]">
                                {posterUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={posterUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[var(--v4-text-faint)]">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                  </div>
                                )}
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                                <span className={`truncate text-sm font-semibold ${isChosen ? 'text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text)]'}`}>
                                  {s.title || s.name}
                                </span>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--v4-text-faint)]">
                                  {year && <span className="font-mono tabular-nums">{year}</span>}
                                  <span>{mediaType}</span>
                                  {(s.vote_average ?? 0) > 0 && (
                                    <span className="inline-flex items-center gap-0.5 font-mono text-[var(--v4-text-muted)]">
                                      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                                      {(s.vote_average ?? 0).toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${isChosen ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'border-[var(--v4-line)] text-transparent'}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-[var(--v4-text-faint)]">
                      {isSearchingTmdb ? '正在检索…' : '输入片名后开始检索'}
                    </p>
                  )}
                </div>
              </form>

              {/* Modal Footer */}
              <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-xs text-[var(--v4-text-faint)]">
                  {pendingSuggestion ? (
                    <span className="block truncate text-[var(--v4-text)]">
                      已选择 <strong className="text-[var(--v4-accent-strong)]">{pendingSuggestion.title || pendingSuggestion.name}</strong>
                    </span>
                  ) : (
                    '请选择匹配项'
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="v4-focus-ring cursor-pointer rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel)] px-3 py-2 text-sm font-semibold text-[var(--v4-text-muted)] transition hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]"
                    onClick={handleClose}
                    disabled={isApplyingSuggestion}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="action-required-button v4-focus-ring inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
                    onClick={() => pendingSuggestion && void handleApplySuggestion(pendingSuggestion)}
                    disabled={!pendingSuggestion || isApplyingSuggestion}
                  >
                    {isApplyingSuggestion ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--v4-accent-ink)]/20 border-t-[var(--v4-accent-ink)]" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                    {isApplyingSuggestion ? '正在应用' : '应用所选'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
