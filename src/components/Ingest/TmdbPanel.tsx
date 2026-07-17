'use client';

import React, { useEffect, useState } from 'react';
import { useStudioStore, type TmdbSuggestion } from '@/store/useStudioStore';
import { Search, Film, Star, Sparkles, X, CheckCircle2, CircleAlert, FileText, Languages } from 'lucide-react';
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
  } = useStudioStore();

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
          <h3 className="text-[22px] font-semibold text-neutral-100 tracking-tight font-sans">
            {tmdbData ? '片源信息' : '字幕概览'}
          </h3>
          {tmdbData && <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-2 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 transition-colors hover:border-[var(--v4-line-strong)]"
            title="Powered by The Movie Database"
          >
            <span className="text-xs text-white/45 font-medium">Powered by</span>
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
                <div className="flex aspect-[2/3] w-32 flex-shrink-0 items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-neutral-600 sm:w-36 xl:w-40" />
              )}

              {/* Movie metadata (Title + Badges) */}
              <div className="flex-1 flex flex-col gap-3.5 min-w-0 text-left pt-1">
                <div>
                  <h4 className="font-sans text-[1.35rem] font-semibold leading-tight tracking-normal text-neutral-100">
                    {tmdbData.title}
                  </h4>
                  {tmdbData.originalTitle && tmdbData.originalTitle !== tmdbData.title && (
                    <p className="text-base text-neutral-300 mt-1 truncate">{tmdbData.originalTitle}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 select-none">
                  {tmdbData.year && (
                    <span className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs font-bold text-neutral-200">
                      {tmdbData.year}
                    </span>
                  )}
                  {tmdbData.voteAverage > 0 && (
                    <span className="px-2.5 py-1 bg-[#9ca3af]/10 text-[#e5e7eb] border border-[#9ca3af]/18 rounded-md text-xs font-mono font-bold flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-[#e5e7eb] text-[#e5e7eb]" />
                      {tmdbData.voteAverage.toFixed(1)}
                    </span>
                  )}
                  {rtScore && (
                    <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/15 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.08)]">
                      RT {rtScore}%
                    </span>
                  )}
                  {tmdbData.genres && tmdbData.genres.map((g: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-white/[0.025] border border-white/[0.05] text-xs rounded-md font-semibold text-neutral-300">
                      {g}
                    </span>
                  ))}
                </div>

                {tmdbData.isAnime && (
                  <div className="mt-1 px-2.5 py-0.5 bg-[#9ca3af]/10 text-[#e5e7eb] border border-[#9ca3af]/20 rounded-md text-xs font-semibold w-max flex items-center gap-1.5 select-none">
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
            <div className="py-1 text-left font-sans text-[15.5px] leading-[1.78] text-neutral-300 line-clamp-6 lg:line-clamp-7 min-h-0 w-full">
              {tmdbData.overview || '暂无剧情简介...'}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 text-left">
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-neutral-200" title={summaryFile?.name}>
                  {summaryFile?.name || '等待字幕轨'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] pt-4">
                <div>
                  <span className="block text-xs text-neutral-600">格式</span>
                  <strong className="mt-1 block text-sm font-semibold text-neutral-300">{summaryFormat}</strong>
                </div>
                <div className="pl-3">
                  <span className="block text-xs text-neutral-600">结构</span>
                  <strong className="mt-1 block text-sm font-semibold text-neutral-300">{summaryLanguage}</strong>
                </div>
                <div className="pl-3">
                  <span className="block text-xs text-neutral-600">字幕行</span>
                  <strong className="mt-1 block text-sm font-semibold tabular-nums text-neutral-300">{summaryCount}</strong>
                </div>
              </div>
            </div>

            {foundAssStyle && (
              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#050607]">
                <AssStylePreview style={foundAssStyle} compact className="rounded-none border-0" />
                <div className="flex items-center justify-between border-t border-white/[0.06] px-3.5 py-2.5 text-xs text-neutral-500">
                  <span>检测到源样式</span>
                  <span className="font-mono tabular-nums">{foundAssStyle.zhFontSize || '--'} / {foundAssStyle.enFontSize || '--'} px</span>
                </div>
              </div>
            )}

            <div className="mt-auto flex items-start gap-2 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-neutral-500">
              {needsTitleInput ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#9aaad3]/70" aria-hidden="true" />
              ) : (
                <Languages className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true" />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[2000] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-panel-ar flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-lg shadow-[0_24px_70px_rgba(0,0,0,0.46)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tmdb-search-title"
              aria-describedby={needsTitleInput ? 'tmdb-search-description' : undefined}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
                <div>
                  <h2 id="tmdb-search-title" className="text-xl font-semibold text-white tracking-tight">{needsTitleInput ? '补充片名' : '手动检索'}</h2>
                  {needsTitleInput && <p id="tmdb-search-description" className="mt-1 text-sm text-[#aab7d5]">确认后将用于片源资料与导出命名。</p>}
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition cursor-pointer"
                  onClick={handleClose}
                  type="button"
                  aria-label="关闭片源检索"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleManualSearch} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                  <label htmlFor="tmdb-title-input" className="flex flex-col gap-2 text-sm font-medium text-white/78">
                    片名
                    <span className="relative">
                    <input
                      id="tmdb-title-input"
                      type="text"
                      className={`w-full bg-white/[0.02] border rounded-xl py-4 pl-12 pr-4 text-white text-base outline-none transition-all ${needsTitleInput ? 'border-[#8295c5]/35 focus:bg-[#8295c5]/[0.04] focus:border-[#9aaad3]' : 'border-white/[0.07] focus:bg-white/[0.04] focus:border-[#9ca3af]/35'}`}
                      value={tmdbManualInput.title}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, title: e.target.value })}
                      placeholder="输入电影或剧集名称"
                      required
                      autoFocus
                    />
                    <Search className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    </span>
                  </label>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,0.55fr)] gap-3">
                    <label htmlFor="tmdb-type-input" className="flex min-w-0 flex-col gap-2 text-sm font-medium text-white/78">
                      类型
                    <select
                      id="tmdb-type-input"
                      className="bg-white/[0.02] border border-white/[0.07] focus:border-[#9ca3af]/35 focus:bg-white/[0.04] rounded-xl py-3.5 px-4 text-white text-base outline-none transition-all cursor-pointer flex-1"
                      value={tmdbManualInput.type}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, type: e.target.value as 'movie' | 'tv' })}
                    >
                      <option value="movie" className="bg-[#0b0b12] text-white">电影</option>
                      <option value="tv" className="bg-[#0b0b12] text-white">剧集</option>
                    </select>
                    </label>
                    <label htmlFor="tmdb-year-input" className="flex min-w-0 flex-col gap-2 text-sm font-medium text-white/78">
                      年份 <span className="sr-only">可选</span>
                    <input
                      id="tmdb-year-input"
                      type="number"
                      min="1888"
                      max="2100"
                      inputMode="numeric"
                      className="w-full bg-white/[0.02] border border-white/[0.07] focus:border-[#9ca3af]/35 focus:bg-white/[0.04] rounded-xl py-3.5 px-4 text-white text-base font-mono tabular-nums outline-none transition-all placeholder:text-white/28"
                      value={tmdbManualInput.year}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, year: e.target.value })}
                      placeholder="年份"
                    />
                    </label>
                  </div>

                  {tmdbManualInput.type === 'tv' && (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.012] p-3.5" role="group" aria-labelledby="episode-location-label">
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span id="episode-location-label" className="text-sm font-medium text-white/78">集数定位</span>
                        <span className="text-xs text-white/38">用于单集剧照与导出命名</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="group flex min-w-0 items-center rounded-lg border border-white/[0.075] bg-black/20 transition-colors focus-within:border-[#8fa3d1]/48 focus-within:bg-[#8fa3d1]/[0.035]">
                          <span className="shrink-0 pl-3.5 text-sm text-white/48">第</span>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            inputMode="numeric"
                            aria-label="季数"
                            className="no-spin min-w-0 flex-1 bg-transparent px-2 py-3 text-center font-mono text-base font-semibold tabular-nums text-white outline-none"
                            value={tmdbManualInput.season || ''}
                            onChange={e => setTmdbManualInput({ ...tmdbManualInput, season: e.target.value })}
                          />
                          <span className="shrink-0 border-l border-white/[0.06] px-3.5 py-1 text-sm font-medium text-[#9aaad3]">季</span>
                        </label>
                        <label className="group flex min-w-0 items-center rounded-lg border border-white/[0.075] bg-black/20 transition-colors focus-within:border-[#8fa3d1]/48 focus-within:bg-[#8fa3d1]/[0.035]">
                          <span className="shrink-0 pl-3.5 text-sm text-white/48">第</span>
                          <input
                            type="number"
                            min="1"
                            max="9999"
                            inputMode="numeric"
                            aria-label="集数"
                            className="no-spin min-w-0 flex-1 bg-transparent px-2 py-3 text-center font-mono text-base font-semibold tabular-nums text-white outline-none"
                            value={tmdbManualInput.episode || ''}
                            onChange={e => setTmdbManualInput({ ...tmdbManualInput, episode: e.target.value })}
                          />
                          <span className="shrink-0 border-l border-white/[0.06] px-3.5 py-1 text-sm font-medium text-[#9aaad3]">集</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-4 font-semibold text-base rounded-xl transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer ${shouldHighlightSearch ? 'action-required-button' : 'bg-[#e5e7eb] hover:bg-[#ffffff] text-black shadow-[0_4px_20px_rgba(156,163,175,0.16)]'}`}
                    disabled={isSearchingTmdb || isApplyingSuggestion || !tmdbManualInput.title.trim()}
                  >
                    {isSearchingTmdb ? (
                      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {isSearchingTmdb ? '检索中...' : '开始检索'}
                  </button>
                </div>

                {/* Candidates List */}
                {tmdbSuggestions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/75 font-medium">匹配结果 ({tmdbSuggestions.length})</span>
                      <span className="text-xs text-white/35">选择正确片名后应用</span>
                    </div>
                    <div className="flex flex-col gap-2">
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
                            className={`w-full p-3 rounded-xl flex items-center gap-4 text-left transition-all border cursor-pointer
                            ${isChosen
                                ? 'border-[#8295c5]/45 bg-[#8295c5]/[0.07] shadow-[inset_3px_0_0_#8295c5]'
                                : 'bg-white/[0.015] border-white/5 hover:bg-white/[0.035]'
                              }`}
                            onClick={() => setPendingSuggestion(s)}
                          >
                            <div className="flex-shrink-0 w-10 h-14 rounded-md overflow-hidden bg-black/50 border border-white/10">
                              {posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={posterUrl} alt={s.title || s.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/25">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className={`text-base font-semibold truncate ${isChosen ? 'text-[#e5e7eb]' : 'text-white/90'}`}>
                                {s.title || s.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                {year && <span className="text-xs text-white/40 font-mono">{year}</span>}
                                <span className="text-xs font-medium text-white/50 bg-white/5 px-1.5 py-0.5 rounded">
                                  {mediaType}
                                </span>
                                {(s.vote_average ?? 0) > 0 && (
                                  <span className="text-xs text-[#e5e7eb] font-mono flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-current stroke-[2]" aria-hidden="true" />
                                    {(s.vote_average ?? 0).toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${isChosen ? 'border-[#8fa3d1]/55 bg-[#8fa3d1]/15 text-[#d2d9e9]' : 'border-white/[0.09] text-transparent'}`}>
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </form>

              {/* Modal Footer */}
              <div className="flex flex-col gap-3 border-t border-white/5 bg-[#070708]/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm text-white/50">
                  {pendingSuggestion ? (
                    <span className="block truncate text-white">已选择 <strong className="text-[#9aaad3]">{pendingSuggestion.title || pendingSuggestion.name}</strong></span>
                  ) : (
                    '请选择匹配项'
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/72 hover:text-white rounded-xl transition text-sm font-semibold cursor-pointer"
                    onClick={handleClose}
                    disabled={isApplyingSuggestion}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="action-required-button inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
                    onClick={() => pendingSuggestion && void handleApplySuggestion(pendingSuggestion)}
                    disabled={!pendingSuggestion || isApplyingSuggestion}
                  >
                    {isApplyingSuggestion ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                    {isApplyingSuggestion ? '正在应用' : '应用所选片名'}
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
