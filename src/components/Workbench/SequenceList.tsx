'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { isLyricText } from '@/utils/subtitleCore';
import type { SubRow } from '@/utils/subtitleCore';
import { Check, Captions, ChevronDown, Music2, Pencil, Redo2, Undo2, Volume2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { TimelineControls } from '@/components/Workbench/TimelineControls';

interface SequenceListProps {
  timelineDurationMs?: number;
}

export const SequenceList: React.FC<SequenceListProps> = ({ timelineDurationMs }) => {
  const { processedSubs, previewIndex, setPreviewIndex, setJumpLineVal, showAllSubs, setShowAllSubs, updateSubtitleText } = useStudioStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftZh, setDraftZh] = useState('');
  const [draftSecondary, setDraftSecondary] = useState('');
  const [undoStack, setUndoStack] = useState<Array<{ index: number; before: string; after: string }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ index: number; before: string; after: string }>>([]);
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

  const beginEditing = (sub: SubRow) => {
    const parts = sub.text.replace(/\\N/gi, '\n').split('\n');
    setDraftZh(parts[0] || '');
    setDraftSecondary(parts.slice(1).join('\n'));
    setEditingIndex(sub.index);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setDraftZh('');
    setDraftSecondary('');
  };

  const commitEditing = () => {
    if (editingIndex === null || !processedSubs) return;
    const row = processedSubs.find(item => item.index === editingIndex);
    if (!row) return;
    const nextText = draftSecondary.trim().length > 0 ? `${draftZh}\n${draftSecondary}` : draftZh;
    if (nextText !== row.text) {
      updateSubtitleText(editingIndex, nextText);
      setUndoStack(current => [...current, { index: editingIndex, before: row.text, after: nextText }].slice(-50));
      setRedoStack([]);
    }
    cancelEditing();
  };

  const undoEdit = () => {
    const record = undoStack[undoStack.length - 1];
    if (!record) return;
    updateSubtitleText(record.index, record.before);
    setUndoStack(current => current.slice(0, -1));
    setRedoStack(current => [...current, record]);
    cancelEditing();
  };

  const redoEdit = () => {
    const record = redoStack[redoStack.length - 1];
    if (!record) return;
    updateSubtitleText(record.index, record.after);
    setRedoStack(current => current.slice(0, -1));
    setUndoStack(current => [...current, record]);
    cancelEditing();
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey) redoEdit();
      else undoEdit();
    };
    document.addEventListener('keydown', handleHistoryShortcut);
    return () => document.removeEventListener('keydown', handleHistoryShortcut);
  });

  const total = processedSubs?.length ?? 0;
  const isOverlimit = total > THRESHOLD;

  const visibleSubs = processedSubs
    ? (isOverlimit
        ? (showAllSubs ? processedSubs : processedSubs.slice(0, LIMIT))
        : processedSubs)
    : [];

  const hasMore = isOverlimit && !showAllSubs && total > LIMIT;
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel)]">
      {total > 0 && (
        <div className="flex flex-col gap-3 px-5 md:px-6 py-3.5 border-b border-white/[0.055] bg-white/[0.008] flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <span className="text-sm tracking-normal text-neutral-100 font-semibold whitespace-nowrap">
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
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={undoEdit} disabled={undoStack.length === 0} className="v4-focus-ring grid h-9 w-9 place-items-center rounded-md text-[var(--v4-text-muted)] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="撤销字幕文本修改" title="撤销">
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={redoEdit} disabled={redoStack.length === 0} className="v4-focus-ring grid h-9 w-9 place-items-center rounded-md text-[var(--v4-text-muted)] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="重做字幕文本修改" title="重做">
                  <Redo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShowAllSubs(true)}
                    className="v4-focus-ring flex h-9 items-center gap-1 rounded-md border border-[var(--v4-line)] px-2.5 text-sm font-medium text-[var(--v4-text-muted)] hover:bg-white/[0.045] hover:text-white"
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    显示全部
                  </button>
                )}
              </div>
          </div>
          <TimelineControls timelineDurationMs={timelineDurationMs} />
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {visibleSubs.length > 0 ? (
          <div className="flex flex-col relative">
            <div className="sticky top-0 z-20 grid grid-cols-[7.25rem_minmax(0,1fr)_3.5rem] items-center border-b border-[var(--v4-line)] bg-[var(--v4-canvas-raised)] px-4 py-2.5 text-xs font-medium text-[var(--v4-text-faint)] select-none md:grid-cols-[170px_minmax(0,1fr)_96px] md:px-7">
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
              const isSoundCaption = sub.cueKind === 'sound_caption' || sub.auxiliary?.category === 'ambient_sdh';
              const isAuxiliarySemantic = sub.auxiliary?.category === 'semantic_sdh' || sub.auxiliary?.category === 'speech_context';

              const startTime = sub.ts.split(' --> ')[0]?.replace(',', '.').trim() || '';
              const endTime = sub.ts.split(' --> ')[1]?.replace(',', '.').trim() || '';

              const rowClass = `relative grid grid-cols-[7.25rem_minmax(0,1fr)_3.5rem] md:grid-cols-[170px_minmax(0,1fr)_96px] gap-3 md:gap-5 py-4 px-4 md:px-7 border-b border-white/[0.04] cursor-pointer text-left overflow-hidden transition-colors duration-200
                ${isActive ? 'glass-lens-active' : 'bg-transparent hover:bg-white/[0.015]'}
                ${isLyric && !isActive ? 'bg-[#9ca3af]/[0.01]' : ''}
                ${sub.index > 30 ? 'timeline-row-deferred' : ''}`;

              return (
                <div
                  key={sub.index}
                  id={`wb-row-${sub.index - 1}`}
                  onClick={() => handleRowClick(sub)}
                  onDoubleClick={() => beginEditing(sub)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleRowClick(sub);
                    }
                    if (event.key === 'F2') {
                      event.preventDefault();
                      beginEditing(sub);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`第 ${sub.index} 行字幕，按 F2 编辑`}
                  className={rowClass}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSubIndicator"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#8fa3d1] shadow-[0_0_12px_rgba(143, 163, 209,0.5)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  <div className="font-mono text-xs text-neutral-300 self-center flex items-center gap-3 select-none">
                    <div className="relative flex flex-col items-center self-stretch">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full border ${isActive ? 'bg-[#c2cce3] border-[#c2cce3] shadow-[0_0_10px_rgba(143, 163, 209,0.4)]' : 'bg-[#8fa3d1]/12 border-[#8fa3d1]/25'}`} />
                      <span className="mt-1 flex-1 w-px bg-white/[0.08]" />
                    </div>
                    {isLyric && (
                      <span className="inline-flex select-none text-[#8fa3d1]">
                        <Music2 className="w-3 h-3" />
                      </span>
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
                          value={draftZh}
                          onChange={(e) => setDraftZh(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="bg-white/[0.02] border border-white/[0.08] text-sm font-medium leading-relaxed text-neutral-100 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#8fa3d1]/55 focus:bg-[#8fa3d1]/[0.04] transition-all"
                          placeholder="中文字幕文本"
                          autoFocus
                        />
                        {enText && (
                          <input
                            type="text"
                            value={draftSecondary}
                            onChange={(e) => setDraftSecondary(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEditing();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            className="bg-white/[0.015] border border-white/[0.06] text-xs font-normal leading-relaxed text-[#e5e7eb]/90 rounded-lg px-3 py-1.5 w-full outline-none focus:border-[#8fa3d1]/55 focus:bg-[#8fa3d1]/[0.035] transition-all"
                            placeholder="第二语言字幕文本"
                          />
                        )}
                        <div className="flex justify-end gap-2 mt-1">
                          <button type="button" className="v4-focus-ring inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-[var(--v4-text-muted)] hover:bg-white/[0.05] hover:text-white" onClick={(e) => { e.stopPropagation(); cancelEditing(); }}>
                            <X className="h-3.5 w-3.5" aria-hidden="true" />取消
                          </button>
                          <button
                            type="button"
                            className="v4-focus-ring inline-flex h-8 items-center gap-1 rounded-md bg-[var(--v4-accent-soft)] px-2.5 text-sm font-semibold text-[var(--v4-accent-strong)] hover:bg-[var(--v4-accent)] hover:text-[var(--v4-canvas)]"
                            onClick={(e) => { e.stopPropagation(); commitEditing(); }}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isExpandedDialogue && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-[#8fa3d1]/20 bg-[#8fa3d1]/[0.055] px-2 py-0.5 text-xs font-medium text-[#d2d9e9]">
                            对话组
                          </span>
                        )}
                        {sub.cueKind === 'screen_text' && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-[#a8b7a3]/20 bg-[#a8b7a3]/[0.055] px-2 py-0.5 text-xs font-medium text-[#cbd6c7]">
                            <Captions className="mr-1 h-3 w-3" />
                            画面文字
                          </span>
                        )}
                        {isSoundCaption && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-0.5 text-xs font-medium text-neutral-400">
                            <Volume2 className="mr-1 h-3 w-3" />
                            声音说明
                          </span>
                        )}
                        {isAuxiliarySemantic && (
                          <span className="mb-0.5 inline-flex w-fit items-center rounded-md border border-[#9aaad3]/20 bg-[#9aaad3]/[0.055] px-2 py-0.5 text-xs font-medium text-[#d2d9e9]">
                            <Captions className="mr-1 h-3 w-3" />
                            辅助信息
                          </span>
                        )}
                        <div className={`font-sans text-sm font-medium leading-6 break-words ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                          {zhText}
                        </div>
                        {enText && (
                          <div
                            className={`mt-0.5 text-xs font-normal leading-5 break-words tracking-[0.01em] ${isActive ? 'text-[#e5e7eb]/90' : 'text-neutral-400'}`}
                            style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
                          >
                            {enText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 self-center select-none text-xs">
                    {editingIndex !== sub.index && (
                      <button
                        type="button"
                        className={`v4-focus-ring inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm transition-colors ${isActive ? 'text-[var(--v4-text)] hover:bg-white/[0.07]' : 'text-[var(--v4-text-faint)] hover:bg-white/[0.05] hover:text-[var(--v4-text)]'}`}
                        onClick={(event) => { event.stopPropagation(); beginEditing(sub); }}
                        aria-label={`编辑第 ${sub.index} 行`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden md:inline">编辑</span>
                      </button>
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
                className="flex cursor-pointer items-center justify-center gap-2 border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)] py-4 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-panel)] hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
                显示剩余 {total - LIMIT} 行
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-400 text-xs tracking-wide py-24 select-none">
            当前没有可预览的字幕
          </div>
        )}
      </div>
    </div>
  );
};
