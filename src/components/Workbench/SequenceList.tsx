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
            <span className="text-xs text-neutral-300 tracking-wide pl-0.5 font-semibold whitespace-nowrap">
              {isOverlimit
                ? (showAllSubs ? `全部 ${total} 行` : `显示 ${LIMIT} / ${total} 行`)
                : `字幕序列 · ${total} 行`
              }
            </span>
            {isOverlimit && !showAllSubs && (
              <span className="hidden sm:inline text-xs text-[#d7cec3]/75 truncate">
                已启用轻量预览，展开后显示完整时间轴
              </span>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAllSubs(true)}
              className="flex items-center gap-1 text-xs text-[#e5e7eb] hover:text-[#ffffff] transition cursor-pointer font-bold shrink-0"
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
                ${isLyric && !isActive ? 'bg-[#9ca3af]/[0.01]' : ''}`;

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
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#e5e7eb] shadow-[0_0_12px_rgba(156,163,175,0.55)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  <div className="w-40 font-mono text-xs text-neutral-300 self-center tracking-wide flex items-center gap-2 select-none">
                    {isLyric && (
                      <motion.span
                        animate={{ y: [0, -2, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        className="inline-flex select-none text-[#e5e7eb]"
                      >
                        <Music2 className="w-3 h-3" />
                      </motion.span>
                    )}
                    <span className={isActive ? 'text-[#e5e7eb] font-semibold' : ''}>
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
                          className="bg-white/[0.02] border border-white/[0.08] text-sm font-medium leading-relaxed text-neutral-100 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#9ca3af]/50 focus:bg-white/[0.04] transition-all"
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
                            className="bg-white/[0.015] border border-white/[0.06] text-xs font-normal leading-relaxed text-[#e5e7eb]/90 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#9ca3af]/50 focus:bg-white/[0.035] transition-all"
                            placeholder="英文字幕文本"
                          />
                        )}
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            type="button"
                            className="px-3 py-1 bg-[#9ca3af]/15 hover:bg-[#9ca3af]/25 text-[#ffffff] border border-[#9ca3af]/25 rounded-lg text-xs font-bold transition cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`text-sm font-medium leading-relaxed break-words ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                          {zhText}
                        </div>
                        {enText && (
                          <div className={`text-xs mt-0.5 font-normal leading-relaxed break-words ${isActive ? 'text-[#e5e7eb]/90' : 'text-neutral-400'}`}>
                            {enText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="w-24 flex items-center justify-end gap-3 self-center select-none text-xs">
                    {isActive && editingIndex !== sub.index && (
                      <motion.span
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-[#e5e7eb] font-medium select-none whitespace-nowrap text-xs bg-[#9ca3af]/5 border border-[#9ca3af]/15 px-1.5 py-0.5 rounded"
                      >
                        双击编辑
                      </motion.span>
                    )}
                    <span className={`font-mono tabular-nums ${isActive ? 'text-[#e5e7eb] font-semibold' : 'text-neutral-700'}`}>
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
                className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-[#e5e7eb] hover:text-[#ffffff] transition-colors border-t border-white/[0.06] bg-white/[0.005] backdrop-blur-md cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
                还有 {total - LIMIT} 行未展示，点击全量加载
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-400 text-xs tracking-wide py-24 select-none">
            暂无可预览字幕序列
          </div>
        )}
      </div>
    </div>
  );
};
