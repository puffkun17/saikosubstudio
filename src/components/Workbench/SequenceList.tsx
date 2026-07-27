'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { isLyricText, isSubtitleCreditText } from '@/utils/subtitleCore';
import type { SubRow } from '@/utils/subtitleCore';
import { Check, ChevronDown, ChevronUp, Pencil, Redo2, Undo2, X } from 'lucide-react';
import { TimelineControls } from '@/components/Workbench/TimelineControls';
import { MARK_LABEL, InspectionMarkGlyph, type InspectionMarkKind } from '@/components/Workbench/inspectionMarks';

interface SequenceListProps {
  timelineDurationMs?: number;
}

const LONG_PRESS_MS = 450;

export const SequenceList: React.FC<SequenceListProps> = ({ timelineDurationMs }) => {
  const {
    processedSubs,
    previewIndex,
    setPreviewIndex,
    setJumpLineVal,
    showAllSubs,
    setShowAllSubs,
    editSubtitleText,
    undoSubtitleEdit,
    redoSubtitleEdit,
    canUndo,
    canRedo,
    lyricPosition,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    previewIndex: state.previewIndex,
    setPreviewIndex: state.setPreviewIndex,
    setJumpLineVal: state.setJumpLineVal,
    showAllSubs: state.showAllSubs,
    setShowAllSubs: state.setShowAllSubs,
    editSubtitleText: state.editSubtitleText,
    undoSubtitleEdit: state.undoSubtitleEdit,
    redoSubtitleEdit: state.redoSubtitleEdit,
    canUndo: state.editHistory.length > 0,
    canRedo: state.editFuture.length > 0,
    lyricPosition: state.customStyle.lyricPosition ?? 'top',
  })));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftZh, setDraftZh] = useState('');
  const [draftSecondary, setDraftSecondary] = useState('');
  /** 仅在多选时有内容；单选直接跟随 previewIndex，避免 effect 内 setState。 */
  const [multiSelectedIndexes, setMultiSelectedIndexes] = useState<Set<number>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef<number>(-1);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const selectedIndexes = multiSelectedIndexes.size > 1
    ? multiSelectedIndexes
    : new Set<number>([previewIndex]);

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

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const applyPreview = useCallback((rowIndex: number) => {
    setPreviewIndex(rowIndex);
    setJumpLineVal(String(rowIndex + 1));
  }, [setJumpLineVal, setPreviewIndex]);

  const handleRowSelect = useCallback((sub: SubRow, event: React.MouseEvent | React.KeyboardEvent) => {
    const idx = sub.index - 1;
    const shift = 'shiftKey' in event && event.shiftKey;
    const toggle = ('metaKey' in event && event.metaKey)
      || ('ctrlKey' in event && event.ctrlKey)
      || ('altKey' in event && event.altKey);

    if (shift) {
      const anchor = selectionAnchor ?? previewIndex;
      const from = Math.min(anchor, idx);
      const to = Math.max(anchor, idx);
      const next = new Set<number>();
      for (let i = from; i <= to; i += 1) next.add(i);
      setMultiSelectedIndexes(next);
      if (selectionAnchor == null) setSelectionAnchor(previewIndex);
    } else if (toggle) {
      setMultiSelectedIndexes((prev) => {
        const base = prev.size > 0 ? prev : new Set<number>([previewIndex]);
        const next = new Set(base);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        if (next.size === 0) next.add(idx);
        return next;
      });
      setSelectionAnchor(idx);
    } else {
      setMultiSelectedIndexes(new Set());
      setSelectionAnchor(idx);
    }
    applyPreview(idx);
  }, [applyPreview, previewIndex, selectionAnchor]);

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
    const nextText = draftSecondary.trim().length > 0 ? `${draftZh}\n${draftSecondary}` : draftZh;
    editSubtitleText(editingIndex, nextText);
    cancelEditing();
  };

  const undoEdit = () => {
    undoSubtitleEdit();
    cancelEditing();
  };

  const redoEdit = () => {
    redoSubtitleEdit();
    cancelEditing();
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      setEditingIndex(null);
      if (event.shiftKey) redoSubtitleEdit();
      else undoSubtitleEdit();
    };
    document.addEventListener('keydown', handleHistoryShortcut);
    return () => document.removeEventListener('keydown', handleHistoryShortcut);
  }, [redoSubtitleEdit, undoSubtitleEdit]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const total = processedSubs?.length ?? 0;
  const isOverlimit = total > THRESHOLD;

  const visibleSubs = processedSubs
    ? (isOverlimit
        ? (showAllSubs ? processedSubs : processedSubs.slice(0, LIMIT))
        : processedSubs)
    : [];

  const hasMore = isOverlimit && !showAllSubs && total > LIMIT;
  const canCollapse = isOverlimit && showAllSubs && total > LIMIT;

  const foldButton = canCollapse ? (
    <button
      type="button"
      onClick={() => setShowAllSubs(false)}
      className="ui-action ui-action--secondary"
      title="折叠回前 100 行"
    >
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
      折叠显示
    </button>
  ) : null;

  return (
    <div className="v4-panel flex flex-1 flex-col overflow-hidden">
      {total > 0 && (
        <div className="flex flex-col gap-3 px-5 md:px-6 py-3.5 border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)] flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <span className="text-sm tracking-normal text-[var(--v4-text)] font-semibold whitespace-nowrap">
                时间轴
              </span>
              <span className="ui-meta-row tabular-nums">
                {isOverlimit && !showAllSubs ? `${LIMIT} / ${total} 行` : `${total} 行`}
                {selectedIndexes.size > 1 ? ` · 已选 ${selectedIndexes.size}` : ''}
              </span>
              {isOverlimit && !showAllSubs && (
                <span className="hidden sm:inline text-xs text-[var(--v4-text-faint)] truncate">
                  当前只显示前 {LIMIT} 行，拖动进度时会自动展开
                </span>
              )}
              {canCollapse && (
                <span className="hidden sm:inline text-xs text-[var(--v4-text-faint)] truncate">
                  已展开全部 · Shift 连选 · ⌥/⌘/Ctrl 跳选 · 长按追加
                </span>
              )}
            </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={undoEdit} disabled={!canUndo} className="ui-action ui-action--quiet ui-action--icon" aria-label="撤销字幕文本修改" title="撤销 (Ctrl+Z)">
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={redoEdit} disabled={!canRedo} className="ui-action ui-action--quiet ui-action--icon" aria-label="重做字幕文本修改" title="重做 (Ctrl+Shift+Z)">
                  <Redo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShowAllSubs(true)}
                    className="ui-action ui-action--secondary"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    显示全部
                  </button>
                )}
                {foldButton}
              </div>
          </div>
          <TimelineControls timelineDurationMs={timelineDurationMs} />
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {visibleSubs.length > 0 ? (
          <div className="flex flex-col relative">
            <div className="sticky top-0 z-20 grid grid-cols-[3.75rem_minmax(7.75rem,auto)_minmax(0,1fr)_2rem] items-center gap-2 border-b border-[var(--v4-line)] bg-[var(--v4-canvas-raised)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--v4-text-muted)] select-none md:grid-cols-[4.25rem_minmax(9.5rem,auto)_minmax(0,1fr)_2.25rem] md:gap-3 md:px-5">
              <div className="pl-0.5">行号</div>
              <div>时间轴</div>
              <div>字幕内容</div>
              <div className="sr-only">编辑</div>
            </div>
            {visibleSubs.map((sub) => {
              const rowIndex = sub.index - 1;
              const isActive = previewIndex === rowIndex;
              const isSelected = selectedIndexes.has(rowIndex);
              const normalizedText = sub.text.replace(/\\N/gi, '\n');
              const parts = normalizedText.split('\n');
              const zhText = parts[0] || '';
              const enText = parts[1] || '';
              const isLyric = sub.type === 'lyrics' || sub.cueKind === 'lyrics' || isLyricText(sub.text);
              const isCredit = !isLyric && (
                sub.type === 'credit'
                || sub.cueKind === 'credit'
                || isSubtitleCreditText(sub.text)
              );
              const isExpandedDialogue = sub.alignment === 'expanded-dialogue';
              const isSoundCaption = !isLyric && !isCredit && sub.cueKind === 'sound_caption';
              const isScreenText = !isLyric && !isCredit && (
                sub.cueKind === 'screen_text' || sub.auxiliary?.category === 'screen_text'
              );
              const isAuxiliarySemantic = !isLyric && !isCredit && (
                sub.cueKind === 'narration'
                || sub.auxiliary?.category === 'semantic_sdh'
                || sub.auxiliary?.category === 'speech_context'
              );
              const lyricPosLabel = lyricPosition === 'bottom' ? '底部' : '顶部';
              const rowMarkKind: InspectionMarkKind | null = isCredit
                ? 'credit'
                : isLyric
                  ? 'lyrics'
                  : isSoundCaption
                    ? 'sound'
                    : isScreenText
                      ? 'screen'
                      : null;
              const rowMarkTitle = rowMarkKind === 'lyrics'
                ? `${MARK_LABEL.lyrics} · ${lyricPosLabel}`
                : rowMarkKind
                  ? MARK_LABEL[rowMarkKind]
                  : isAuxiliarySemantic
                    ? '辅助信息'
                    : isExpandedDialogue
                      ? '对话组'
                      : undefined;

              const startTime = sub.ts.split(' --> ')[0]?.replace(',', '.').trim() || '';
              const endTime = sub.ts.split(' --> ')[1]?.replace(',', '.').trim() || '';

              const rowClass = `group relative grid grid-cols-[3.75rem_minmax(7.75rem,auto)_minmax(0,1fr)_2rem] md:grid-cols-[4.25rem_minmax(9.5rem,auto)_minmax(0,1fr)_2.25rem] items-center gap-2 md:gap-3 py-2.5 px-3 md:px-5 border-b border-[var(--v4-line)] cursor-pointer select-none text-left overflow-hidden transition-colors duration-150
                ${isActive ? 'glass-lens-active' : isSelected ? 'bg-[var(--v4-accent-soft)]/55' : 'bg-transparent hover:bg-[var(--v4-panel-muted)]'}
                ${(isLyric || isCredit) && !isActive && !isSelected ? 'bg-[var(--v4-panel-muted)]/50' : ''}
                ${sub.index > 30 ? 'timeline-row-deferred' : ''}`;

              return (
                <div
                  key={sub.index}
                  id={`wb-row-${rowIndex}`}
                  onClick={(event) => {
                    if (longPressFiredRef.current) {
                      longPressFiredRef.current = false;
                      return;
                    }
                    handleRowSelect(sub, event);
                  }}
                  onDoubleClick={() => beginEditing(sub)}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
                    clearLongPress();
                    longPressFiredRef.current = false;
                    longPressTimerRef.current = window.setTimeout(() => {
                      longPressFiredRef.current = true;
                      setMultiSelectedIndexes((prev) => {
                        const base = prev.size > 0 ? prev : new Set<number>([previewIndex]);
                        const next = new Set(base);
                        next.add(rowIndex);
                        return next;
                      });
                      setSelectionAnchor(rowIndex);
                      applyPreview(rowIndex);
                    }, LONG_PRESS_MS);
                  }}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleRowSelect(sub, event);
                    }
                    if (event.key === 'F2') {
                      event.preventDefault();
                      beginEditing(sub);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`第 ${sub.index} 行字幕，按 F2 编辑；Shift 连选，⌥/⌘/Ctrl 跳选`}
                  className={rowClass}
                >
                  <div className={`flex min-w-0 items-center gap-1 self-center pl-0.5 font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap ${isActive ? 'text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-muted)]'}`}>
                    <span>#{sub.index}</span>
                    {/* 检查标记放在行号后的固定槽，不挤占时间轴列对齐 */}
                    <span
                      className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
                      title={rowMarkTitle}
                      aria-label={rowMarkKind || isAuxiliarySemantic || isExpandedDialogue ? rowMarkTitle : undefined}
                      aria-hidden={!rowMarkKind && !isAuxiliarySemantic && !isExpandedDialogue}
                    >
                      {rowMarkKind ? (
                        <InspectionMarkGlyph kind={rowMarkKind} size={10} />
                      ) : (isAuxiliarySemantic || isExpandedDialogue) ? (
                        <span className="inline-flex h-3 min-w-3 items-center justify-center rounded-[2px] border border-[var(--v4-line-strong)] px-0.5 font-mono text-[8px] font-semibold leading-none text-[var(--v4-text-faint)]">
                          {isExpandedDialogue ? '组' : '辅'}
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 self-center select-none">
                    <div className="relative flex flex-col items-center self-stretch py-0.5">
                      <span className={`mt-0.5 h-2 w-2 rounded-full border ${isActive ? 'bg-[var(--v4-accent-strong)] border-[var(--v4-accent-strong)] shadow-[var(--glow-accent)]' : 'bg-[var(--v4-accent-soft)] border-[var(--v4-line-strong)]'}`} />
                      <span className="mt-1 flex-1 w-px bg-[var(--v4-line)]" />
                    </div>
                    <div className={`flex min-w-0 flex-col whitespace-nowrap font-mono text-[13px] leading-tight tabular-nums tracking-tight ${isActive ? 'font-semibold text-[var(--v4-accent-strong)]' : 'font-medium text-[var(--v4-text-muted)]'}`}>
                      <span>{startTime}</span>
                      <span className="mt-0.5 opacity-80">{endTime}</span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1 pr-1">
                    {editingIndex === sub.index ? (
                      <div className="z-10 flex w-full cursor-auto select-text flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={draftZh}
                          onChange={(e) => setDraftZh(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="w-full rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-1.5 text-sm font-medium leading-relaxed text-[var(--v4-text)] outline-none transition-all focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]"
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
                            className="w-full rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-1.5 text-xs font-normal leading-relaxed text-[var(--v4-text-muted)] outline-none transition-all focus:border-[var(--v4-accent)] focus:bg-[var(--v4-accent-soft)]"
                            placeholder="第二语言字幕文本"
                          />
                        )}
                        <div className="mt-1 flex justify-end gap-2">
                          <button type="button" className="ui-action ui-action--quiet cursor-pointer" onClick={(e) => { e.stopPropagation(); cancelEditing(); }}>
                            <X className="h-4 w-4" aria-hidden="true" />取消
                          </button>
                          <button
                            type="button"
                            className="ui-action cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); commitEditing(); }}
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="break-words font-sans text-[15px] font-semibold leading-snug text-[var(--v4-text)]">
                          {zhText}
                        </div>
                        {enText && (
                          <div
                            className="mt-0.5 break-words text-[13px] font-medium leading-snug tracking-[0.01em] text-[var(--v4-text-muted)]"
                            style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
                          >
                            {enText}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end self-center">
                    {editingIndex !== sub.index && (
                      <button
                        type="button"
                        className={`v4-focus-ring inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--v4-text-muted)] transition-opacity hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto focus-visible:pointer-events-auto focus-visible:opacity-100 ${
                          isActive
                            ? 'opacity-70 group-hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(event) => { event.stopPropagation(); beginEditing(sub); }}
                        aria-label={`编辑第 ${sub.index} 行`}
                        title="编辑 (F2 / 双击)"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAllSubs(true)}
                className="flex cursor-pointer items-center justify-center gap-2 border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)] py-3.5 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]"
              >
                <ChevronDown className="w-4 h-4" />
                显示剩余 {total - LIMIT} 行
              </button>
            )}
            {canCollapse && (
              <button
                type="button"
                onClick={() => setShowAllSubs(false)}
                className="flex cursor-pointer items-center justify-center gap-2 border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)] py-3.5 text-sm font-medium text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]"
              >
                <ChevronUp className="w-4 h-4" />
                折叠显示
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--v4-text-muted)] text-xs tracking-wide py-24 select-none">
            当前没有可预览的字幕
          </div>
        )}
      </div>
    </div>
  );
};
