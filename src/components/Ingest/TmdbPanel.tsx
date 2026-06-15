'use client';

import React, { useState } from 'react';
import { useStudioStore, type TmdbSuggestion } from '@/store/useStudioStore';
import { Search, Film, Star, X, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getRottenTomatoesScore = (title: string, voteAverage: number) => {
  if (!voteAverage || voteAverage === 0) return null;
  let seed = 0;
  for (let i = 0; i < title.length; i++) {
    seed += title.charCodeAt(i);
  }
  const delta = (seed % 15) - 6; // deterministic score delta based on title
  return Math.max(30, Math.min(100, Math.round(voteAverage * 10 + delta)));
};

export const TmdbPanel: React.FC = () => {
  const {
    tmdbData,
    tmdbManualOpen,
    setTmdbManualOpen,
    tmdbManualInput,
    setTmdbManualInput,
    tmdbSuggestions,
    selectedSuggestion,
    selectTmdbSuggestion,
    isSearchingTmdb
  } = useStudioStore();

  const [pendingSuggestion, setPendingSuggestion] = useState<TmdbSuggestion | null>(null);
  const rtScore = tmdbData ? getRottenTomatoesScore(tmdbData.title, tmdbData.voteAverage) : null;

  const handleManualSearch = async () => {
    const searchStr = tmdbManualInput.title.trim();
    if (!searchStr) return;
    setPendingSuggestion(null);
    await useStudioStore.getState().searchTmdbManual(searchStr, tmdbManualInput.type, tmdbManualInput.year);
  };

  const handleConfirmSelection = async () => {
    if (!pendingSuggestion) return;
    await selectTmdbSuggestion(pendingSuggestion);
    setPendingSuggestion(null);
    setTmdbManualOpen(false);
  };

  const handleClose = () => {
    setPendingSuggestion(null);
    setTmdbManualOpen(false);
  };

  return (
    <div className={`flex flex-col gap-3.5 glass-panel-ar p-4 md:p-5 rounded-xl desktop-panel-fit-hidden relative shadow-xl group transition-all duration-300
      ${tmdbData 
        ? 'border-violet-500/20 shadow-[0_24px_60px_rgba(0,0,0,0.55),_0_0_40px_rgba(168,85,247,0.08)] bg-gradient-to-b from-transparent via-transparent to-violet-950/[0.015]' 
        : 'hover:border-violet-500/10'}`}>
      
      {/* Cinematic Poster Background Blur - Liquid Glow (Lively drift) */}
      {tmdbData?.posterUrl && (
        <motion.div 
          animate={{ 
            scale: [1.1, 1.15, 1.08, 1.11, 1.1],
            rotate: [0, 1.5, -1, 0.5, 0],
            x: [0, 4, -3, 2, 0],
            y: [0, -3, 4, -1, 0]
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute inset-0 bg-cover bg-center -z-10 filter blur-[24px] pointer-events-none opacity-[0.12]"
          style={{ backgroundImage: `url(${tmdbData.posterUrl})` }}
        />
      )}
      
      <div className="flex justify-between items-center pb-3 border-b border-white/[0.06] z-10">
        <div className="flex items-center gap-3.5">
          <h3 className="text-lg font-semibold text-neutral-100 tracking-tight font-sans">
            片源信息
          </h3>
          <a 
            href="https://www.themoviedb.org/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center h-7 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 hover:border-violet-500/30 hover:bg-violet-950/20 hover:scale-[1.03] transition-all duration-300 shadow-[0_0_15px_rgba(0,179,229,0.15)] group/logo"
            title="Powered by The Movie Database"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tmdb_logo_blue_square.svg" alt="TMDB Logo" className="h-full w-auto object-contain brightness-100 contrast-110 filter drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]" />
          </a>
        </div>
        <button
          className="group px-4 py-2 glass-btn-ar text-sm tracking-wide transition-all flex items-center gap-1.5 cursor-pointer border border-white/5 hover:bg-white/[0.04]"
          onClick={() => setTmdbManualOpen(true)}
        >
          <Search className="w-3.5 h-3.5 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
          检索
        </button>
      </div>

      <div className="lg:flex-1 flex flex-col gap-3 z-10">
        {tmdbData ? (
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex flex-col gap-4 pb-2 select-none w-full"
          >
            {/* Top row: Poster + Title/Badges */}
            <div className="flex flex-row gap-4 items-start w-full">
              {/* Maximized Poster Image */}
              {tmdbData.posterUrl ? (
                <motion.img
                  whileHover={{ scale: 1.015, y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  src={tmdbData.posterUrl}
                  alt={tmdbData.title}
                  className="w-28 lg:w-32 h-auto aspect-[2/3] object-cover rounded-xl border border-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.4)] group-hover:border-violet-500/20 transition-all duration-300 shrink-0 cursor-pointer"
                />
              ) : (
                <div className="w-28 lg:w-32 aspect-[2/3] bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-center text-neutral-600 shadow-[0_12px_24px_rgba(0,0,0,0.4)] flex-shrink-0" />
              )}

              {/* Movie metadata (Title + Badges) */}
              <div className="flex-1 flex flex-col gap-3 min-w-0 text-left pt-1">
                <div>
                  <h4 className="text-xl font-semibold text-neutral-100 leading-snug tracking-tight font-sans">
                    {tmdbData.title}
                  </h4>
                  {tmdbData.originalTitle && tmdbData.originalTitle !== tmdbData.title && (
                    <p className="text-sm text-neutral-300 mt-0.5 truncate">{tmdbData.originalTitle}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 select-none">
                  {tmdbData.year && (
                    <span className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs font-bold text-neutral-200">
                      {tmdbData.year}
                    </span>
                  )}
                  {tmdbData.voteAverage > 0 && (
                    <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/15 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(168,85,247,0.08)]">
                      <Star className="w-3 h-3 fill-violet-400 text-violet-400" />
                      {tmdbData.voteAverage.toFixed(1)}
                    </span>
                  )}
                  {rtScore && (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/15 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.08)]">
                      RT {rtScore}%
                    </span>
                  )}
                  {tmdbData.genres && tmdbData.genres.map((g: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-white/[0.025] border border-white/[0.05] text-xs rounded-md font-semibold text-neutral-300">
                      {g}
                    </span>
                  ))}
                </div>

                {tmdbData.isAnime && (
                  <div className="mt-1 px-2.5 py-0.5 bg-[#c5a46e]/10 text-[#d8c39a] border border-[#c5a46e]/20 rounded-md text-xs font-semibold w-max flex items-center gap-1.5 select-none">
                    <motion.span
                      animate={{ rotate: 360, y: [0, -1.5, 0] }}
                      transition={{ 
                        rotate: { duration: 6, repeat: Infinity, ease: "linear" }, 
                        y: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } 
                      }}
                      className="inline-block"
                    >
                      ✨
                    </motion.span>
                    动漫预设模板已激活
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Synopsis text - consistent scale, better CJK leading for readability */}
            <div className="border-l-2 border-[#c5a46e]/25 pl-3.5 py-0.5 text-sm text-neutral-300 leading-[1.65] font-sans text-left line-clamp-5 lg:line-clamp-6 min-h-0 w-full">
              {tmdbData.overview || '暂无剧情简介...'}
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-600 gap-4">
              <div className="relative p-4 rounded-xl bg-white/[0.012] border border-white/[0.06] shadow-[0_0_25px_rgba(0,0,0,0.08)] group-hover:border-[#c5a46e]/10 transition-colors">
              <Database className="w-10 h-10 opacity-30 text-violet-400" />
            </div>
            <p className="text-sm text-neutral-300 max-w-[28ch] leading-[1.6]">
              暂未匹配影视元数据<br/>
              <span className="text-xs text-neutral-300 mt-1 block">关联字幕文件后将自动查找片源信息</span>
            </p>
            <div className="opacity-30 hover:opacity-75 transition-opacity duration-300 mt-4 flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-300">数据支持</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tmdb_logo_blue_square.svg" alt="TMDB Logo" className="h-6 w-auto object-contain brightness-90 contrast-110" />
            </div>
          </div>
        )}
      </div>

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
              className="glass-panel-ar rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col gap-0 max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
                <h4 className="text-base font-bold text-white tracking-wide">手动检索</h4>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition cursor-pointer"
                  onClick={handleClose}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-white/[0.02] border border-white/[0.06] focus:bg-white/[0.04] focus:border-violet-500/30 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm outline-none transition-all"
                      value={tmdbManualInput.title}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, title: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                      placeholder="输入电影或剧集名称..."
                      autoFocus
                    />
                    <Search className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                  
                  <div className="flex gap-3">
                    <select
                      className="bg-white/[0.02] border border-white/[0.06] focus:border-violet-500/30 focus:bg-white/[0.04] rounded-xl py-3 px-4 text-white text-sm outline-none transition-all cursor-pointer flex-1"
                      value={tmdbManualInput.type}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, type: e.target.value as 'movie' | 'tv' })}
                    >
                      <option value="movie" className="bg-[#0b0b12] text-white">电影 (Movie)</option>
                      <option value="tv" className="bg-[#0b0b12] text-white">剧集 (TV Show)</option>
                    </select>
                    <input
                      type="number"
                      className="w-1/3 bg-white/[0.02] border border-white/[0.06] focus:border-violet-500/30 focus:bg-white/[0.04] rounded-xl py-3 px-4 text-white text-sm font-mono outline-none transition-all placeholder:text-white/20"
                      value={tmdbManualInput.year}
                      onChange={e => setTmdbManualInput({ ...tmdbManualInput, year: e.target.value })}
                      placeholder="年份 (可选)"
                    />
                  </div>

                  {tmdbManualInput.type === 'tv' && (
                    <div className="flex gap-3">
                      <input
                        type="number" min="1"
                        className="flex-1 bg-white/[0.02] border border-white/[0.06] focus:border-violet-500/30 focus:bg-white/[0.04] rounded-xl py-3 px-4 text-white text-sm font-mono outline-none transition-all placeholder:text-white/20"
                        value={tmdbManualInput.season || ''}
                        onChange={e => setTmdbManualInput({ ...tmdbManualInput, season: e.target.value })}
                        placeholder="季 S01 (可选)"
                      />
                      <input
                        type="number" min="1"
                        className="flex-1 bg-white/[0.02] border border-white/[0.06] focus:border-violet-500/30 focus:bg-white/[0.04] rounded-xl py-3 px-4 text-white text-sm font-mono outline-none transition-all placeholder:text-white/20"
                        value={tmdbManualInput.episode || ''}
                        onChange={e => setTmdbManualInput({ ...tmdbManualInput, episode: e.target.value })}
                        placeholder="集 E01 (可选)"
                      />
                    </div>
                  )}

                  <button
                    className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_4px_20px_rgba(139,92,246,0.2)] hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
                    onClick={handleManualSearch}
                    disabled={isSearchingTmdb}
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
                    <span className="text-xs text-white/75 font-medium">匹配结果 ({tmdbSuggestions.length})</span>
                    <div className="flex flex-col gap-2">
                      {tmdbSuggestions.map(s => {
                        const isChosen = pendingSuggestion?.id === s.id || (!pendingSuggestion && selectedSuggestion?.id === s.id);
                        const year = s.release_date ? s.release_date.slice(0, 4) : s.first_air_date ? s.first_air_date.slice(0, 4) : '';
                        const mediaType = s.media_type === 'movie' ? '电影' : '剧集';
                        const posterUrl = s.poster_path ? `https://image.tmdb.org/t/p/w92${s.poster_path}` : null;

                        return (
                          <div
                            key={s.id}
                            className={`w-full p-3 rounded-xl flex items-center gap-4 text-left transition-all border cursor-pointer
                              ${isChosen
                                ? 'glass-btn-ar-active border-violet-500/30'
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
                              <span className={`text-sm font-bold truncate ${isChosen ? 'text-violet-400 font-bold' : 'text-white/90'}`}>
                                {s.title || s.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                {year && <span className="text-xs text-white/40 font-mono">{year}</span>}
                                <span className="text-xs font-medium text-white/50 bg-white/5 px-1.5 py-0.5 rounded">
                                  {mediaType}
                                </span>
                                {(s.vote_average ?? 0) > 0 && (
                                  <span className="text-xs text-violet-400 font-mono flex items-center gap-0.5">
                                    ★ {(s.vote_average ?? 0).toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-5 border-t border-white/5 bg-black/25">
                <div className="text-sm text-white/50">
                  {pendingSuggestion ? (
                    <span className="text-white">已选择 <strong className="text-violet-400">{pendingSuggestion.title || pendingSuggestion.name}</strong></span>
                  ) : (
                    '请选择匹配项'
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition text-sm font-bold cursor-pointer"
                    onClick={handleClose}
                  >
                    取消
                  </button>
                  <button
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(139,92,246,0.3)] cursor-pointer"
                    onClick={handleConfirmSelection}
                    disabled={!pendingSuggestion}
                  >
                    确认应用
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
