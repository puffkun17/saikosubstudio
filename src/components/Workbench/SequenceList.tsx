'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { isLyricText } from '@/utils/subtitleCore';
import type { SubRow } from '@/utils/subtitleCore';
import { ChevronDown, Music2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { TimelineControls } from '@/components/Workbench/TimelineControls';

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
    <div className="flex-1 overflow-hidden bg-white/[0.01] border border-white/[0.055] rounded-xl flex flex-col backdrop-blur-md">
      {total > 0 && (
        <div className="flex flex-col gap-3 px-5 md:px-6 py-3.5 border-b border-white/[0.055] bg-white/[0.008] flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <span className="text-[15px] tracking-[-0.01em] text-neutral-100 font-semibold whitespace-nowrap">
                时间轴
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-xs tabular-nums text-neutral-400">
                {isOverlimit && !showAllSubs ? `${LIMIT} / ${total} 行` : `${total} 行`}
              </span>
              {isOverlimit && !showAllSubs && (
                <span className="hidden sm:inline text-xs text-neutral-500 truncate">
                  当前只显示前 {LIMIT} 行，拖动进度时会自动展开
                </span>
              )}
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAllSubs(true)}
                className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/[0.045] transition cursor-pointer font-medium shrink-0"
              >
                <ChevronDown className="w-3 h-3" />
                显示全部
              </button>
            )}
          </div>
          <TimelineControls />
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {visibleSubs.length > 0 ? (
          <div className="flex flex-col relative">
            <div className="sticky top-0 z-20 grid grid-cols-[170px_minmax(0,1fr)_96px] items-center border-b border-white/[0.055] bg-[#08080a]/95 backdrop-blur-md px-7 py-2.5 text-xs font-medium text-white/42 select-none">
              <div className="pl-2">时间轴</div>
              <div>字幕内容</div>
              <div className="text-right pr-2">行号</div>
            </div>
            {visibleSubs.map((sub) => {
              const isActive = previewIndex === (sub.index - 1);
              const normalizedText = sub.text.replace(/\\N/gi, '\n');
              const parts = normalizedText.split('\n');
              const zhText = parts[0] || '';
              const enText = parts[1] || '';
              const isLyric = isLyricText(sub.text);
              const isExpandedDialogue = sub.alignment === 'expanded-dialogue';

              const startTime = sub.ts.split(' --> ')[0]?.replace(',', '.').trim() || '';
              const endTime = sub.ts.split(' --> ')[1]?.replace(',', '.').trim() || '';

              const rowClass = `relative grid grid-cols-[170px_minmax(0,1fr)_96px] gap-5 py-4 px-7 border-b border-white/[0.04] cursor-pointer text-left overflow-hidden transition-all duration-400
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
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#9ddacb] shadow-[0_0_12px_rgba(157,218,203,0.5)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  <div className="font-mono text-xs text-neutral-300 self-center flex items-center gap-3 select-none">
                    <div className="relative flex flex-col items-center self-stretch">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full border ${isActive ? 'bg-[#c3eee3] border-[#c3eee3] shadow-[0_0_10px_rgba(157,218,203,0.4)]' : 'bg-[#9ddacb]/12 border-[#9ddacb]/25'}`} />
                      <span className="mt-1 flex-1 w-px bg-white/[0.08]" />
                    </div>
                    {isLyric && (
                      <motion.span
                        animate={{ y: [0, -2, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        className="inline-flex select-none text-[#9ddacb]"
                      >
                        <Music2 className="w-3 h-3" />
                      </motion.span>
                    )}
                    <div className={`flex flex-col leading-tight tabular-nums ${isActive ? 'text-[#e5e7eb] font-semibold' : 'text-neutral-500'}`}>
                      <span>{startTime}</span>
                      <span className="mt-1 text-white/22">{endTime}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pr-6 min-w-0">
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
                          className="bg-white/[0.02] border border-white/[0.08] text-sm font-medium leading-relaxed text-neutral-100 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#9ddacb]/55 focus:bg-[#9ddacb]/[0.04] transition-all"
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
                            className="bg-white/[0.015] border border-white/[0.06] text-xs font-normal leading-relaxed text-[#e5e7eb]/90 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#9ddacb]/55 focus:bg-[#9ddacb]/[0.035] transition-all"
                            placeholder="第二语言字幕文本"
                          />
                        )}
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            type="button"
                            className="px-3 py-1 bg-[#9ddacb]/15 hover:bg-[#9ddacb]/25 text-[#d9f5ef] border border-[#9ddacb]/30 rounded-lg text-xs font-bold transition cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isExpandedDialogue && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-[#9ddacb]/20 bg-[#9ddacb]/[0.055] px-2 py-0.5 text-[11px] font-medium text-[#cdece5]">
                            对话组
                          </span>
                        )}
                        {sub.cueKind === 'screen_text' && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-[#a8b7a3]/20 bg-[#a8b7a3]/[0.055] px-2 py-0.5 text-[11px] font-medium text-[#cbd6c7]">
                            画面文字
                          </span>
                        )}
                        <div className={`text-[15px] font-medium leading-6 break-words ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                          {zhText}
                        </div>
                        {enText && (
                          <div className={`text-[13px] mt-0.5 font-normal leading-5 break-words ${isActive ? 'text-[#e5e7eb]/90' : 'text-neutral-400'}`}>
                            {enText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 self-center select-none text-xs">
                    {isActive && editingIndex !== sub.index && (
                      <span className="text-white/72 font-medium select-none whitespace-nowrap text-xs bg-white/[0.04] border border-white/[0.10] px-2 py-1 rounded-md">
                        双击编辑
                      </span>
                    )}
                    <span className={`font-mono tabular-nums ${isActive ? 'text-[#e5e7eb] font-semibold' : 'text-neutral-600'}`}>
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
                className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-neutral-300 hover:text-white transition-colors border-t border-white/[0.06] bg-white/[0.005] backdrop-blur-md cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
                显示剩余 {total - LIMIT} 行
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
