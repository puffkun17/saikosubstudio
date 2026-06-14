'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { isLyricText } from '@/utils/subtitleCore';
import type { SubRow } from '@/utils/subtitleCore';
import { ChevronDown, Music2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const SequenceList: React.FC = () => {
  const { processedSubs, previewIndex, setPreviewIndex, setJumpLineVal, showAllSubs, setShowAllSubs, updateSubtitleText } = useStudioStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef<number>(-1);

  const THRESHOLD = 500;
  const LIMIT = 100;

  useEffect(() => {
    if (previewIndex >= LIMIT && !showAllSubs) {
      setShowAllSubs(true);
    }
  }, [previewIndex, showAllSubs, setShowAllSubs]);

  useEffect(() => {
    if (processedSubs && processedSubs.length > 0) {
      if (prevIndexRef.current === -1 || prevIndexRef.current >= processedSubs.length) {
        prevIndexRef.current = previewIndex;
      }
    }

    if (previewIndex === prevIndexRef.current && showAllSubs) return;
    prevIndexRef.current = previewIndex;

    const timer = setTimeout(() => {
      const el = document.getElementById(`wb-row-${previewIndex}`);
      const container = listRef.current;
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);

        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [previewIndex, showAllSubs, processedSubs]);

  const handleRowClick = (sub: SubRow) => {
    setPreviewIndex(sub.index - 1);
    setJumpLineVal(String(sub.index));
  };

  const total = processedSubs?.length ?? 0;
  const isOverlimit = total > THRESHOLD;

  const visibleSubs = processedSubs
    ? (isOverlimit
        ? (showAllSubs ? processedSubs : processedSubs.slice(0, LIMIT))
        : processedSubs)
    : [];

  const hasMore = isOverlimit && !showAllSubs && total > LIMIT;
  const hasActiveRow = previewIndex >= 0 && previewIndex < total;

  return (
    <div className="flex-1 overflow-hidden bg-white/[0.01] border border-white/[0.06] rounded-xl flex flex-col backdrop-blur-md">
      {total > 0 && (
        <div className="flex items-center justify-between gap-4 px-8 py-3 border-b border-white/[0.06] bg-white/[0.005] flex-shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            <span className="text-[0.625rem] font-mono text-neutral-500 uppercase tracking-widest pl-0.5 font-bold whitespace-nowrap">
              {isOverlimit
                ? (showAllSubs ? `all ${total} lines` : `showing ${LIMIT} / ${total} lines`)
                : `sequence // ${total} lines`
              }
            </span>
            {isOverlimit && !showAllSubs && (
              <span className="hidden sm:inline text-[0.625rem] text-amber-200/45 font-mono truncate">
                已启用轻量预览，展开后显示完整时间轴
              </span>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAllSubs(true)}
              className="flex items-center gap-1 text-[0.625rem] text-violet-400 hover:text-violet-300 transition font-mono uppercase tracking-wider cursor-pointer font-bold shrink-0"
            >
              <ChevronDown className="w-3 h-3" />
              展开全部
            </button>
          )}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {visibleSubs.length > 0 ? (
          <div className="flex flex-col relative">
            {visibleSubs.map((sub) => {
              const isActive = previewIndex === (sub.index - 1);
              const normalizedText = sub.text.replace(/\\N/gi, '\n');
              const parts = normalizedText.split('\n');
              const zhText = parts[0] || '';
              const enText = parts[1] || '';
              const isLyric = isLyricText(sub.text);

              const rowClass = `relative flex gap-6 py-4 px-8 border-b border-white/[0.04] cursor-pointer text-left overflow-hidden transition-all duration-400
                ${isActive ? 'glass-lens-active' : 'bg-transparent hover:bg-white/[0.015]'}
                ${(!isActive && hasActiveRow) ? 'glass-blur-inactive' : ''}
                ${isLyric && !isActive ? 'bg-violet-500/[0.005]' : ''}`;

              return (
                <div
                  key={sub.index}
                  id={`wb-row-${sub.index - 1}`}
                  onClick={() => handleRowClick(sub)}
                  onDoubleClick={() => setEditingIndex(sub.index)}
                  className={rowClass}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSubIndicator"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400 shadow-[0_0_12px_rgba(168,85,247,0.7)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  <div className="w-40 font-mono text-[0.6875rem] text-neutral-500 self-center tracking-wider flex items-center gap-2 select-none">
                    {isLyric && (
                      <motion.span
                        animate={{ y: [0, -2, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        className="inline-flex select-none text-violet-300"
                      >
                        <Music2 className="w-3 h-3" />
                      </motion.span>
                    )}
                    <span className={isActive ? 'text-violet-400 font-bold' : ''}>
                      {sub.ts.replace(' --> ', ' - ')}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5 pr-6 min-w-0">
                    {editingIndex === sub.index ? (
                      <div className="flex flex-col gap-2 w-full z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={zhText}
                          onChange={(e) => {
                            const combined = enText ? `${e.target.value}\n${enText}` : e.target.value;
                            updateSubtitleText(sub.index, combined);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              setEditingIndex(null);
                            }
                          }}
                          className="bg-white/[0.02] border border-white/[0.08] text-[0.8125rem] font-medium leading-relaxed text-neutral-100 rounded-lg px-3 py-1.5 w-full outline-none focus:border-violet-500/50 focus:bg-white/[0.04] transition-all"
                          placeholder="中文字幕文本"
                          autoFocus
                        />
                        {enText && (
                          <input
                            type="text"
                            value={enText}
                            onChange={(e) => {
                              const combined = `${zhText}\n${e.target.value}`;
                              updateSubtitleText(sub.index, combined);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingIndex(null);
                              }
                            }}
                            className="bg-white/[0.015] border border-white/[0.06] text-[0.6875rem] font-light leading-relaxed text-violet-300 rounded-lg px-3 py-1.5 w-full outline-none focus:border-violet-500/50 focus:bg-white/[0.035] transition-all"
                            placeholder="英文字幕文本"
                          />
                        )}
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            type="button"
                            className="px-3 py-1 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 border border-violet-500/25 rounded-lg text-[0.625rem] font-mono uppercase tracking-wider transition cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`text-[0.8125rem] font-medium leading-relaxed break-words ${isActive ? 'text-white' : 'text-neutral-350'}`}>
                          {zhText}
                        </div>
                        {enText && (
                          <div className={`text-[0.6875rem] mt-0.5 font-light leading-relaxed break-words ${isActive ? 'text-violet-300' : 'text-neutral-500'}`}>
                            {enText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="w-24 flex items-center justify-end gap-3 self-center select-none font-mono text-[0.625rem]">
                    {isActive && editingIndex !== sub.index && (
                      <motion.span
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-violet-400 font-bold select-none whitespace-nowrap text-[0.5625rem] bg-violet-500/5 border border-violet-500/15 px-1.5 py-0.5 rounded"
                      >
                        双击编辑
                      </motion.span>
                    )}
                    <span className={isActive ? 'text-violet-400 font-bold' : 'text-neutral-700'}>
                      #{sub.index}
                    </span>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAllSubs(true)}
                className="flex items-center justify-center gap-2 py-4 text-xs font-mono uppercase tracking-wider text-violet-400 hover:text-violet-300 transition-colors border-t border-white/[0.06] bg-white/[0.005] backdrop-blur-md cursor-pointer font-bold"
              >
                <ChevronDown className="w-4 h-4 animate-bounce" />
                还有 {total - LIMIT} 行未展示，点击全量加载
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 font-mono text-[0.6875rem] uppercase tracking-wider py-24 select-none">
            no active subtitle sequence loaded
          </div>
        )}
      </div>
    </div>
  );
};
