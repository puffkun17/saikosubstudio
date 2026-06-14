'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { isLyricText } from '@/utils/subtitleCore';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export const SequenceList: React.FC = () => {
  const { processedSubs, previewIndex, setPreviewIndex, setJumpLineVal, showAllSubs, setShowAllSubs, updateSubtitleText } = useStudioStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef<number>(-1);

  const THRESHOLD = 500;
  const LIMIT = 100;

  // Auto-reveal hidden subtitles if active preview index is beyond the visible limit
  useEffect(() => {
    if (previewIndex >= LIMIT && !showAllSubs) {
      setShowAllSubs(true);
    }
  }, [previewIndex, showAllSubs, setShowAllSubs]);

  // Auto-scroll active row centered inside container with a safe delay
  // 改进版（上游修复）：同时监听 processedSubs 长度变化，避免新加载字幕后滚动失效
  useEffect(() => {
    // Reset ref when the subtitle list content changes significantly
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
  }, [previewIndex, showAllSubs]);

  const handleRowClick = (sub: any) => {
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
      {/* Row count & info header */}
      {total > 0 && (
        <div className="flex items-center justify-between px-8 py-3 border-b border-white/[0.06] bg-white/[0.005] flex-shrink-0">
          <span className="text-[0.625rem] font-mono text-neutral-500 uppercase tracking-widest pl-0.5 font-bold">
            {isOverlimit 
              ? (showAllSubs ? `all ${total} lines (full)` : `showing ${LIMIT} / ${total} lines (truncated)`)
              : `sequence // ${total} lines`
            }
          </span>
          {hasMore && (
            <button
              onClick={() => setShowAllSubs(true)}
              className="flex items-center gap-1 text-[0.625rem] text-violet-400 hover:text-violet-300 transition font-mono uppercase tracking-wider cursor-pointer font-bold"
            >
              <ChevronDown className="w-3 h-3 animate-bounce" />
              展开全部
            </button>
          )}
        </div>
      )}

      {/* Warning board for long subtitle overlimit files */}
      {isOverlimit && !showAllSubs && (
        <motion.div 
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-8 mt-4 mb-1 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3 text-left"
        >
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }} 
            transition={{ duration: 2, repeat: Infinity }}
            className="text-amber-450 mt-0.5 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
          </motion.div>
          <div className="flex-1 flex flex-col gap-0.5 text-[0.6875rem] text-neutral-400">
            <span className="font-bold text-neutral-200">超大字幕时间轴预警 (共 {total} 行)</span>
            <span>已自动截取前 {LIMIT} 行显示，避免性能问题。点击下方按钮展开全部。</span>
          </div>
        </motion.div>
      )}

      {/* Subtitle rows */}
      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-px custom-scrollbar"
      >
        {visibleSubs.map((sub: any, idx: number) => {
          const isActive = hasActiveRow && previewIndex === sub.index - 1;
          const isEditing = editingIndex === sub.index - 1;

          return (
            <div
              key={`${sub.index}-${idx}`}
              id={`wb-row-${sub.index - 1}`}
              onClick={() => handleRowClick(sub)}
              className={`group flex items-start gap-3 px-6 py-2.5 rounded-lg cursor-pointer transition-all duration-150 border-l-2
                ${isActive 
                  ? 'bg-white/[0.06] border-l-[#f2a900] shadow-inner' 
                  : 'border-l-transparent hover:bg-white/[0.025] hover:border-l-white/10'
                }`}
            >
              <div className={`font-mono text-[10px] pt-0.5 w-8 flex-shrink-0 text-right transition-colors ${isActive ? 'text-[#f2a900] font-bold' : 'text-neutral-500 group-hover:text-neutral-400'}`}>
                {sub.index}
              </div>

              <div className="flex-1 min-w-0 text-sm leading-snug text-white/90">
                {sub.text}
              </div>

              {sub.isBilingual && (
                <div className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono self-start mt-0.5">双语</div>
              )}
              {sub.isCommentary && (
                <div className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono self-start mt-0.5">解说</div>
              )}
            </div>
          );
        })}

        {hasMore && (
          <div className="px-8 py-4 text-center">
            <button 
              onClick={() => setShowAllSubs(true)}
              className="text-xs text-violet-400 hover:text-violet-300 font-mono tracking-wider"
            >
              还有 {total - LIMIT} 行未显示 → 点击展开全部
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
