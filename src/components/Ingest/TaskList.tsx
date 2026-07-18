'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStudioStore, Subfile } from '@/store/useStudioStore';
import { Check, CircleAlert, GripVertical, Paintbrush, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { parseSrt, decodeBuffer, detectSubtitleLanguage, StyleSettings } from '@/utils/subtitleCore';
import { motion } from 'framer-motion';
import { TrackSelect } from '@/components/Ingest/TrackSelect';
import { CreditTool } from '@/components/Ingest/CreditTool';
import { InfoHint } from '@/components/ui/InfoHint';
import { FileFormatIcon, LanguageMark } from '@/components/ui/FileFormatIcon';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { useWorkflowChrome } from '@/components/Global/WorkflowChrome';
import { getSubtitleTermHint } from '@/utils/subtitleTerminology';
import { getClientBatchIssue, getClientFileIssue } from '@/utils/importSafety';
import { AssStylePreview } from '@/components/Ingest/AssStylePreview';

export const TaskList: React.FC = () => {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingCancelUpload, setPendingCancelUpload] = useState(false);
  const [isFilenameFocused, setIsFilenameFocused] = useState(false);
  const [draggingTrack, setDraggingTrack] = useState<'zh' | 'en' | null>(null);
  const [dropTargetTrack, setDropTargetTrack] = useState<'zh' | 'en' | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [dragCardSize, setDragCardSize] = useState<{ w: number; h: number }>({ w: 320, h: 52 });
  const [dragOffset, setDragOffset] = useState({ x: 16, y: 20 });
  const zhRowRef = useRef<HTMLDivElement>(null);
  const enRowRef = useRef<HTMLDivElement>(null);
  const draggingTrackRef = useRef<'zh' | 'en' | null>(null);
  const { setEdgeNext } = useWorkflowChrome();
  const {
    tasks,
    selectedTaskId,
    selectTask,
    bindTrack,
    swapPrimaryTracks,
    // removeFileFromTask,
    deleteTask,
    cancelCurrentUpload,
    uploadedFiles,
    customFilename,
    filenameSource,
    setCustomFilename,
    isProcessing,
    runSubtitleMerge,
    showAssHint,
    setShowAssHint,
    foundAssStyle,
    customStyle,
    setCustomStyle,
    setActivePreset,
    addLog,
    alignmentMode,
    setAlignmentMode,
    setTmdbManualOpen
  } = useStudioStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAndDecodeFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const decoded = decodeBuffer(reader.result as ArrayBuffer);
          resolve(decoded.text);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFilesProcess = async (filesList: File[]) => {
    if (filesList.length === 0) return;
    const detectedFiles: Subfile[] = [];
    const { processFiles, addLog } = useStudioStore.getState();
    const batchIssue = getClientBatchIssue(filesList);
    if (batchIssue) {
      addLog(batchIssue, 'error');
      return;
    }

    for (const file of filesList) {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.srt') || nameLower.endsWith('.ass')) {
        const fileIssue = getClientFileIssue(file);
        if (fileIssue) {
          addLog(`${file.name}：${fileIssue}`, 'error');
          continue;
        }
        try {
          const text = await readAndDecodeFile(file);
          const detected = detectSubtitleLanguage(file.name, text);

          detectedFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            name: file.name,
            text,
            lang: detected.lang,
            languagePair: detected.languagePair,
            isBilingual: detected.isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: text.length
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          addLog(`读取文件 ${file.name} 失败: ${msg}`, "error");
        }
      }
    }

    if (detectedFiles.length > 0) {
      processFiles(detectedFiles);
    }
  };

  const getSubTitleCount = (file: Subfile | null | undefined) => {
    if (!file || !file.text) return 0;
    try {
      if (file.text.includes('[Events]') && file.text.includes('Dialogue:')) {
        return file.text.split('\n').filter((l: string) => l.trim().startsWith('Dialogue:')).length;
      }
      return parseSrt(file.text).length;
    } catch {
      return 0;
    }
  };

  const getFilenameSourceLabel = () => {
    switch (filenameSource) {
      case 'tmdb':
        return '影片资料';
      case 'auto':
        return '自动识别';
      case 'manual':
        return '手动编辑';
      case 'library':
        return '历史存档';
      default:
        return '待命名';
    }
  };

  const renderMarqueeText = (text: string, className = '') => {
    const shouldScroll = text.length > 38;
    return (
      <span className={`hover-marquee ${className}`} title={text}>
        <span className={shouldScroll ? 'hover-marquee-content' : 'truncate'}>
          {text}
        </span>
      </span>
    );
  };

  // Find active task or default to first
  const activeTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  const canReorderTracks = Boolean(
    activeTask && !activeTask.isBilingualSingle && activeTask.zh && activeTask.en,
  );

  const endTrackDrag = () => {
    draggingTrackRef.current = null;
    setDraggingTrack(null);
    setDropTargetTrack(null);
    setDragPointer(null);
  };

  const hitTestTrackRow = (clientX: number, clientY: number): 'zh' | 'en' | null => {
    const zhBox = zhRowRef.current?.getBoundingClientRect();
    const enBox = enRowRef.current?.getBoundingClientRect();
    if (zhBox && clientX >= zhBox.left && clientX <= zhBox.right && clientY >= zhBox.top && clientY <= zhBox.bottom) {
      return 'zh';
    }
    if (enBox && clientX >= enBox.left && clientX <= enBox.right && clientY >= enBox.top && clientY <= enBox.bottom) {
      return 'en';
    }
    return null;
  };

  const beginTrackDrag = (
    trackKey: 'zh' | 'en',
    event: React.PointerEvent<HTMLElement>,
    rowEl: HTMLDivElement | null,
  ) => {
    if (!canReorderTracks || !activeTask) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = rowEl?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      setDragCardSize({ w: Math.max(240, Math.round(rect.width)), h: Math.round(rect.height) });
    } else {
      setDragOffset({ x: 16, y: 20 });
    }
    draggingTrackRef.current = trackKey;
    setDraggingTrack(trackKey);
    setDragPointer({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!draggingTrack) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (event: PointerEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
      const hit = hitTestTrackRow(event.clientX, event.clientY);
      const from = draggingTrackRef.current;
      setDropTargetTrack(hit && from && hit !== from ? hit : null);
    };

    const onUp = (event: PointerEvent) => {
      const from = draggingTrackRef.current;
      const hit = hitTestTrackRow(event.clientX, event.clientY);
      if (from && hit && hit !== from && activeTask) {
        swapPrimaryTracks(activeTask.id);
      }
      endTrackDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingTrack, activeTask, swapPrimaryTracks]);

  const needsTitleInput = Boolean(activeTask?.title.includes('待补充片名'));
  const canProceed = Boolean(activeTask && (activeTask.zh || activeTask.en) && !isProcessing);
  const edgeLabel = isProcessing
    ? '正在准备…'
    : needsTitleInput
      ? '跳过匹配'
      : '下一步';

  useEffect(() => {
    if (!activeTask) {
      setEdgeNext(null);
      return;
    }
    setEdgeNext({
      label: edgeLabel,
      disabled: !canProceed,
      onClick: () => {
        if (!canProceed) return;
        void runSubtitleMerge();
      },
    });
    return () => setEdgeNext(null);
  }, [activeTask, canProceed, edgeLabel, runSubtitleMerge, setEdgeNext]);

  if (!activeTask) return null;

  const zhCount = getSubTitleCount(activeTask.zh);
  const enCount = getSubTitleCount(activeTask.en);
  const isFoundAssStyleApplied = Boolean(foundAssStyle && Object.entries(foundAssStyle).every(
    ([key, value]) => customStyle[key as keyof StyleSettings] === value,
  ));
  let diffBadge = null;
  if (activeTask.zh && activeTask.en) {
    const max = Math.max(zhCount, enCount);
    const diffRatio = max > 0 ? Math.abs(zhCount - enCount) / max : 0;
    if (diffRatio <= 0.05) {
      diffBadge = <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold rounded flex-shrink-0 select-none shadow-[0_0_10px_rgba(16,185,129,0.15)]">已匹配</span>;
    } else if (diffRatio <= 0.15) {
      diffBadge = <span className="px-2 py-0.5 bg-[#9f897b]/16 text-[#eadfd8] border border-[#c0a89a]/25 text-xs font-semibold rounded flex-shrink-0 select-none">需检查</span>;
    } else {
      diffBadge = <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-semibold rounded flex-shrink-0 select-none">待确认</span>;
    }
  }

  return (
    <div className="v4-panel relative flex flex-col gap-4 rounded-lg p-5 md:p-6">

      {/* Header section */}
      <div className="flex flex-shrink-0 select-none items-center justify-between gap-3 border-b border-[var(--v4-line)] pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h3 className="whitespace-nowrap font-sans text-xl font-semibold tracking-tight text-neutral-100">字幕文件</h3>
          </div>
          <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-sm font-semibold text-[var(--v4-text)]">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCancelUpload ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/18 transition cursor-pointer"
                onClick={() => { cancelCurrentUpload(); setPendingCancelUpload(false); }}
              >
                清空本次导入
              </button>
              <button
                type="button"
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 bg-white/[0.025] border border-white/[0.06] hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
                onClick={() => setPendingCancelUpload(false)}
              >
                返回
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="v4-focus-ring group flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--v4-panel-raised)]"
              onClick={() => setPendingCancelUpload(true)}
              title="取消本次导入并返回上传入口"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-rose-300 transition-colors" />
              取消本次导入
            </button>
          )}
          <button
            className="v4-focus-ring group flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--v4-panel-raised)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-3.5 h-3.5 text-[#e5e7eb] group-hover:rotate-90 transition-transform duration-300" />
            继续添加
          </button>
        </div>
      </div>

      {/* Task tab switcher (if multiple tasks exist) */}
      {tasks.length > 1 && (
        <div className="flex gap-2 pb-2 border-b border-white/[0.04] overflow-x-auto scrollbar-none flex-shrink-0">
          {tasks.map(t => {
            const isActive = t.id === activeTask.id;
            return (
              <button
                key={t.id}
                className={`max-w-[220px] cursor-pointer truncate rounded-xl border px-4 py-2 font-sans text-sm transition-all
                  ${isActive
                    ? 'border-[#9ca3af]/30 bg-[#9ca3af]/10 font-semibold text-[#e5e7eb] shadow-[0_0_12px_rgba(156,163,175,0.12)]'
                    : 'border-white/[0.04] bg-white/[0.01] text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'}`}
                onClick={() => selectTask(t.id)}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Main workspace — hug content; sticky dock without stretching voids */}
      <div className="relative flex min-h-0 flex-col gap-4 overflow-x-visible overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-white/[0.03]">

        {/* Compact task row */}
        <div className={`relative flex flex-shrink-0 flex-col items-stretch justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors sm:flex-row sm:items-center ${needsTitleInput ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)]' : 'border-white/[0.07] bg-white/[0.018]'}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {needsTitleInput ? (
              <>
                <CircleAlert className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                <span className="truncate text-sm font-semibold text-[var(--v4-text)]">
                  片名待确认{activeTask.epKey ? ` · ${activeTask.epKey}` : ''}
                </span>
                <button
                  type="button"
                  className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--v4-accent)] px-2.5 text-xs font-semibold text-[var(--v4-accent-ink)]"
                  onClick={() => setTmdbManualOpen(true)}
                >
                  <Search className="h-3.5 w-3.5" />
                  补充片名
                </button>
              </>
            ) : (
              <>
                {renderMarqueeText(activeTask.title, 'min-w-0 flex-1 truncate font-sans text-sm font-semibold text-neutral-100')}
                {diffBadge}
              </>
            )}
          </div>

          {pendingDeleteId === activeTask.id ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                className="cursor-pointer rounded-md border border-rose-500/15 bg-rose-600/20 px-2.5 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-600/40"
                onClick={(e) => { e.stopPropagation(); deleteTask(activeTask.id); setPendingDeleteId(null); }}
              >
                删除
              </button>
              <button
                className="cursor-pointer rounded-md border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-rose-300"
              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(activeTask.id); }}
              aria-label="移除当前字幕任务"
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除
            </button>
          )}
        </div>

        {/* Track bindings first — primary decision before naming/credits */}
        <div className="flex min-h-0 flex-col gap-3.5 overflow-visible">
          <div className="relative flex flex-col gap-3 overflow-visible">
            <div className="flex items-center gap-2">
              <h4 className="block select-none text-base font-semibold text-neutral-100">
                字幕轨
              </h4>
              <InfoHint label="字幕轨说明">
                选择要处理的字幕文件。双语单文件会自动识别；分开的中文与第二语言轨将按时间轴合并。
              </InfoHint>
              {activeTask.isBilingualSingle && (
                <span className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-0.5 text-xs font-medium text-neutral-400">
                  双语 · {zhCount} 行
                </span>
              )}
              {!activeTask.isBilingualSingle && activeTask.zh && activeTask.en && (
                <span className="ml-auto text-xs font-normal text-neutral-500">
                  按住六点拖动可对调主副轨
                </span>
              )}
            </div>
            <div className="relative flex flex-col gap-2.5 overflow-visible rounded-lg bg-black/20 p-3">
              {(() => {
                const trackOptions = uploadedFiles.map(f => ({
                  id: f.id,
                  name: f.name,
                  count: getSubTitleCount(f),
                  lang: f.lang,
                  languagePair: f.languagePair,
                }));

                const renderPrimaryRow = (
                  trackKey: 'zh' | 'en',
                  label: React.ReactNode,
                  placeholder: string,
                  rowRef: React.RefObject<HTMLDivElement | null>,
                ) => {
                  const file = trackKey === 'zh' ? activeTask.zh : activeTask.en;
                  const isDropTarget = draggingTrack != null && draggingTrack !== trackKey && dropTargetTrack === trackKey;
                  const isDragging = draggingTrack === trackKey;
                  return (
                    <div
                      ref={rowRef}
                      className={`flex flex-row items-center gap-1.5 overflow-visible rounded-xl transition-[background-color,box-shadow,opacity,transform] duration-150 ${
                        isDropTarget ? 'bg-[var(--v4-accent-soft)] ring-1 ring-[var(--v4-accent)]/40 scale-[1.01]' : ''
                      } ${isDragging ? 'opacity-35' : ''}`}
                    >
                      <span
                        role="button"
                        tabIndex={canReorderTracks ? 0 : -1}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          beginTrackDrag(trackKey, e, rowRef.current);
                        }}
                        onKeyDown={(e) => {
                          if (!canReorderTracks) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            swapPrimaryTracks(activeTask.id);
                          }
                        }}
                        aria-label={canReorderTracks ? `拖动以对调${trackKey === 'zh' ? '主字幕' : '第二语言'}顺序` : undefined}
                        title={canReorderTracks ? '按住拖动，对调主副轨' : undefined}
                        className={`grid h-11 w-7 shrink-0 place-items-center rounded-md text-neutral-500 transition-colors touch-none ${
                          canReorderTracks
                            ? 'cursor-grab hover:bg-white/[0.05] hover:text-neutral-200 active:cursor-grabbing'
                            : 'cursor-default opacity-25'
                        }`}
                      >
                        <GripVertical className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                      </span>
                      <span className="inline-flex w-[4.75rem] shrink-0 items-center gap-1 text-left text-sm font-semibold text-neutral-200">
                        {label}
                      </span>
                      <TrackSelect
                        value={file?.id || ''}
                        options={trackOptions}
                        onChange={(id) => bindTrack(activeTask.id, trackKey, id)}
                        countLabel={file ? getSubTitleCount(file) : null}
                        placeholder={placeholder}
                      />
                    </div>
                  );
                };

                const dragFile = draggingTrack === 'zh' ? activeTask.zh : draggingTrack === 'en' ? activeTask.en : null;

                return (
                  <>
                    {renderPrimaryRow(
                      'zh',
                      <>
                        主字幕
                        <InfoHint label="主字幕说明" side="right">
                          主字幕优先使用中文或双语内容。
                        </InfoHint>
                      </>,
                      '选择中文或双语字幕',
                      zhRowRef,
                    )}

                    {!activeTask.isBilingualSingle ? (
                      <>
                        {renderPrimaryRow(
                          'en',
                          '第二语言',
                          '选择英语或其他语言（可选）',
                          enRowRef,
                        )}

                        <div className="flex flex-row items-center gap-1.5 overflow-visible pl-7">
                          <span className="inline-flex w-[4.75rem] shrink-0 items-center gap-1 text-left text-sm font-semibold text-neutral-200">
                            旁白导评
                            <InfoHint label="旁白与导评说明" side="right">
                              {getSubtitleTermHint('narration')} 导评通常不是正片对白。
                            </InfoHint>
                          </span>
                          <TrackSelect
                            value={activeTask.commentary?.id || ''}
                            options={uploadedFiles.map(f => ({ id: f.id, name: f.name, count: getSubTitleCount(f), lang: f.lang }))}
                            onChange={(id) => bindTrack(activeTask.id, 'commentary', id)}
                            placeholder="可选"
                          />
                        </div>
                      </>
                    ) : null}

                    {draggingTrack && dragPointer && dragFile && (
                      <OverlayPortal>
                        <div
                          className="pointer-events-none fixed z-[var(--z-overlay)]"
                          style={{
                            left: dragPointer.x - dragOffset.x,
                            top: dragPointer.y - dragOffset.y,
                            width: dragCardSize.w,
                          }}
                        >
                          <motion.div
                            initial={{ opacity: 0.85, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1.03 }}
                            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                            className="flex items-center gap-2 rounded-xl border border-[var(--v4-accent)]/40 bg-[#12100e]/95 px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
                            style={{ height: dragCardSize.h }}
                          >
                            <GripVertical className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                            <FileFormatIcon name={dragFile.name} size="sm" />
                            <LanguageMark lang={dragFile.lang} languagePair={dragFile.languagePair} />
                            <span className="min-w-0 flex-1 truncate font-mono text-sm text-neutral-100">
                              {dragFile.name}
                            </span>
                            <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 font-mono text-xs text-neutral-400">
                              {getSubTitleCount(dragFile)}行
                            </span>
                          </motion.div>
                        </div>
                      </OverlayPortal>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Output name + credits — compact, after tracks */}
          <div className="flex-shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.012] px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex select-none items-center gap-1.5 text-sm font-semibold text-neutral-200">
                  导出名称
                  <InfoHint label="导出文件名称说明">
                    可直接编辑。名称可来自影片资料、文件名识别或历史存档。
                  </InfoHint>
                </label>
                <span className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-0.5 text-xs font-medium text-neutral-400">
                  {getFilenameSourceLabel()}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="v4-focus-ring h-10 w-full rounded-lg border border-white/[0.09] bg-[#020204] px-3 font-mono text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[var(--v4-accent)]/45 focus:bg-white/[0.025]"
                  value={customFilename}
                  onChange={e => setCustomFilename(e.target.value, 'manual')}
                  onFocus={() => setIsFilenameFocused(true)}
                  onBlur={() => setIsFilenameFocused(false)}
                  placeholder="输入导出文件名"
                />
                {customFilename.length > 42 && !isFilenameFocused && (
                  <div className="pointer-events-none absolute inset-y-px left-px right-px flex items-center overflow-hidden rounded-lg bg-[#020204] px-3 font-mono text-sm text-white">
                    {renderMarqueeText(customFilename, 'w-full')}
                  </div>
                )}
              </div>
            </div>
            <CreditTool />
          </div>

          {/* Configuration & Process Dock — sticky, no mt-auto void */}
          <div className="sticky bottom-0 z-10 mt-3 flex flex-col gap-3 overflow-visible border-t border-white/[0.06] bg-[var(--v4-panel)]/95 pt-3 backdrop-blur-sm">

            {/* Source ASS style preview and explicit adoption decision. */}
            {foundAssStyle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.018]"
              >
                <div className="grid gap-0 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)]">
                  <AssStylePreview style={foundAssStyle} className="min-h-36 rounded-none border-0 border-b border-white/[0.07] md:border-b-0 md:border-r" />
                  <div className="flex min-w-0 flex-col justify-between gap-4 p-4 md:p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Paintbrush className="h-4 w-4 text-[#8fa3d1]" aria-hidden="true" />
                        <h5 className="text-sm font-semibold text-neutral-100">文件内嵌样式</h5>
                        {isFoundAssStyleApplied && !showAssHint && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#8fa3d1]/20 bg-[#8fa3d1]/[0.06] px-2 py-0.5 text-xs font-medium text-[#d2d9e9]">
                            <Check className="h-3 w-3" />
                            已用于导出
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                        预览来自当前 ASS 文件。字体按当前设备可用版本近似呈现。
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400">
                        <span className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1">
                          中文 {foundAssStyle.zhFontSize || '--'} px
                        </span>
                        <span className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1">
                          第二语言 {foundAssStyle.enFontSize || '--'} px
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(showAssHint || !isFoundAssStyleApplied) && (
                        <button
                          type="button"
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#8fa3d1]/25 bg-[#8fa3d1]/10 px-3 text-xs font-semibold text-[#d9efea] transition hover:bg-[#8fa3d1]/16 active:translate-y-px"
                          onClick={() => {
                            setCustomStyle({ ...customStyle, ...foundAssStyle } as StyleSettings);
                            setActivePreset('ass_native');
                            setShowAssHint(false);
                            addLog('已采用 ASS 文件内嵌样式', 'success');
                          }}
                        >
                          使用源样式
                        </button>
                      )}
                      {showAssHint && (
                        <button
                          type="button"
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.06] hover:text-white active:translate-y-px"
                          onClick={() => {
                            setShowAssHint(false);
                            addLog('已保留当前字幕样式', 'info');
                          }}
                        >
                          保留当前样式
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col justify-end gap-3.5 lg:flex-row lg:items-end">
              {/* Alignment Mode Selection */}
              {!activeTask.isBilingualSingle && (
                <div className="flex flex-col gap-1.5 w-full lg:w-60 shrink-0">
                  <label className="text-sm text-neutral-200 font-semibold select-none inline-flex items-center gap-1.5">
                    对齐方式
                    <InfoHint label="对齐方式说明" side="left">
                      智能模式适合常规双语轨合并；细致模式会尝试处理插入、删减或断句不一致，但耗时略高。
                    </InfoHint>
                  </label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-xl bg-[#020204] border border-white/[0.07] relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] h-12 items-center">
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'standard' ? 'text-white' : 'text-neutral-300 hover:text-neutral-100'}`}
                      onClick={() => setAlignmentMode('standard')}
                    >
                      {alignmentMode === 'standard' && (
                        <motion.div
                          layoutId="activeEngine"
                          className="absolute inset-0 bg-white/[0.05] border border-white/[0.08] shadow-[0_1.5px_3px_rgba(0,0,0,0.3)] rounded-md -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      智能
                    </button>
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'industrial' ? 'text-[#e5e7eb]' : 'text-neutral-300 hover:text-neutral-100'}`}
                      onClick={() => setAlignmentMode('industrial')}
                    >
                      {alignmentMode === 'industrial' && (
                        <motion.div
                          layoutId="activeEngine"
                          className="absolute inset-0 bg-[#9ca3af]/10 border border-[#9ca3af]/25 shadow-[0_1.5px_6px_rgba(156,163,175,0.14)] rounded-md -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      细致
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".srt,.ass"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFilesProcess(files);
        }}
      />
    </div>
  );
};
