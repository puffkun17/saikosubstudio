'use client';

import React, { useEffect, useRef, useState } from 'react';
import { OriginalConfirmDialog } from '@/components/Ingest/OriginalConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import {
  FilePlus,
  FolderPlus,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { summarizeImportForChip } from '@/utils/importSummary';
import {
  MAX_DROPPED_ENTRIES,
  collectEntryFiles,
  sleep,
  summarizeQueue,
  type IncomingFile,
} from '@/components/Ingest/dragzone/preflight';
import {
  FOLDER_UNSUPPORTED_HINT,
  useFolderPickSupported,
  useTapFirstIngest,
} from '@/components/Ingest/dragzone/environment';
import { useIngestPipeline } from '@/components/Ingest/dragzone/useIngestPipeline';
import { QueueTree } from '@/components/Ingest/dragzone/QueueTree';
import { QueueActionBar } from '@/components/Ingest/dragzone/QueueActionBar';

export const DragZone: React.FC = () => {
  const [confirmOriginal, setConfirmOriginal] = React.useState(false);
  const { isDragging, setIsDragging, addLog, isOfficialSubtitle, setIsOfficialSubtitle, isOriginalWork, setIsOriginalWork, setStatusNotice } = useStudioStore(useShallow((state) => ({
    isOriginalWork: state.isOriginalWork,
    setIsOriginalWork: state.setIsOriginalWork,
    isDragging: state.isDragging,
    setIsDragging: state.setIsDragging,
    addLog: state.addLog,
    isOfficialSubtitle: state.isOfficialSubtitle,
    setIsOfficialSubtitle: state.setIsOfficialSubtitle,
    setStatusNotice: state.setStatusNotice,
  })));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();
  const tapFirst = useTapFirstIngest();
  const folderPickSupported = useFolderPickSupported();

  const handleFolderPick = () => {
    if (!folderPickSupported) {
      setStatusNotice({
        id: 'folder-pick-unsupported',
        tone: 'notice',
        title: '无法选择文件夹',
        message: FOLDER_UNSUPPORTED_HINT,
      });
      return;
    }
    folderInputRef.current?.click();
  };

  const [isAccepting, setIsAccepting] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);


  const {
    isParsing,
    ceremony,
    retryMatch,
    chooseManualSearch,
    importSummary,
    queuedItems,
    setQueuedItems,
    queueIssue,
    setQueueIssue,
    addFilesToQueue,
    removeQueuedFile,
    removeFolderGroup,
  } = useIngestPipeline();


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    // 目录句柄必须在事件同步阶段取出（await 之后 dataTransfer 即失效）
    const droppedEntries: FileSystemEntry[] = [];
    const plainFiles: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          droppedEntries.push(entry);
        } else {
          const file = item.getAsFile();
          if (file) plainFiles.push(file);
        }
      }
    } else {
      const filesList = e.dataTransfer.files;
      for (let i = 0; i < filesList.length; i++) {
        plainFiles.push(filesList[i]);
      }
    }

    const incoming: IncomingFile[] = plainFiles.map((file) => ({ file }));
    if (droppedEntries.length > 0) {
      const budget = { remaining: MAX_DROPPED_ENTRIES };
      for (const entry of droppedEntries) {
        await collectEntryFiles(entry, incoming, budget);
      }
      if (budget.remaining <= 0) {
        addLog(`拖入内容过多，仅读取前 ${MAX_DROPPED_ENTRIES} 个文件`, 'info');
      }
    }

    if (incoming.length === 0) return;

    // Empty → queue: short accept flash (CSS only), then reveal tree.
    if (queuedItems.length === 0 && !shouldReduceMotion) {
      setIsAccepting(true);
      await sleep(180);
      addFilesToQueue(incoming);
      setIsAccepting(false);
      return;
    }
    addFilesToQueue(incoming);
  };

  if (isParsing) {
    return (
      <div className="relative mx-auto flex w-full max-w-lg min-h-[280px] flex-col items-center justify-center px-2">
        <div className="flex flex-col items-center gap-2.5 text-center">
          {ceremony?.needsChoice ? (
            <span className="ingest-local-static" aria-hidden="true" data-ingest-match-static>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="5.5" />
                <path d="M15 15l4.5 4.5" />
              </svg>
            </span>
          ) : (
            <span className="ingest-local-spinner" aria-hidden="true" />
          )}
          <p className="text-base font-semibold tracking-tight text-[var(--v4-text)]" data-ingest-parsing-title>
            {ceremony?.needsChoice ? '还没匹配到影片' : '文件仅在本地处理'}
          </p>
          {ceremony?.needsChoice ? (
            <div className="mt-2 flex flex-col items-center gap-2.5" data-ingest-match-choice>
              <p className="max-w-[22rem] px-4 text-center text-sm text-balance text-[var(--ink-muted)]">
                {ceremony.choiceReason === 'failed'
                  ? '影片资料没有取到。可以再试一次，或自己输入片名。'
                  : '影片资料还没回来。可以再试一次，或自己输入片名。'}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={retryMatch} className="ui-action">
                  重试
                </button>
                <button type="button" onClick={chooseManualSearch} className="ui-action ui-action--secondary">
                  手动搜索
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const { rejectedItems, queueStatsLine } = summarizeQueue(queuedItems, { isOfficialSubtitle, isOriginalWork });

  return (
    <div
      ref={dropZoneRef}
      data-ingest-drop-zone
      className={`ingest-drop-zone group/outer flex w-full flex-col ${
        queuedItems.length === 0 ? 'ingest-drop-zone--empty flex-1' : 'items-center py-1 md:py-2'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`ingest-stage relative z-10 select-none ${
          queuedItems.length > 0 ? 'has-queue px-3 py-4 md:px-4 md:py-6' : 'is-empty'
        } ${tapFirst ? 'ingest-stage--tap-first' : ''} ${isDragging && !tapFirst ? 'is-dragging' : ''} ${isAccepting ? 'is-accepting' : ''}`}
      >
        <AnimatePresence mode="wait">
          {queuedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={false}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, transition: { duration: 0.14 } }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="ingest-local-add"
            >
              <div className="ingest-local-add__copy">
                {!tapFirst && (
                  <span className="ingest-local-add__cue" aria-hidden="true">
                    <Upload className="ingest-local-add__cue-icon" size={28} strokeWidth={1.75} />
                  </span>
                )}
                <h2 className="ingest-local-add__title">
                  {!tapFirst && isDragging ? '松开以添加' : '添加本地字幕'}
                </h2>
                <p className="ingest-local-add__hint">
                  {tapFirst ? (
                    <>
                      <span className="ingest-local-add__hint-tap">从下方选择文件</span>
                      <span className="ingest-local-add__dot" aria-hidden="true">·</span>
                      <span className="ingest-local-add__privacy">仅在本地读取</span>
                    </>
                  ) : isDragging ? (
                    <>
                      文件会留在本机
                      <span className="ingest-local-add__dot" aria-hidden="true">·</span>
                      <span className="ingest-local-add__privacy">仅在本地读取</span>
                    </>
                  ) : (
                    <>
                      <span className="ingest-local-add__hint-lead">
                        <span className="ingest-local-add__hint-drag">拖入此处</span>
                        <span className="ingest-local-add__hint-click">，或从下方选择</span>
                      </span>
                      <span className="ingest-local-add__dot" aria-hidden="true">·</span>
                      <span className="ingest-local-add__privacy">仅在本地读取</span>
                    </>
                  )}
                </p>
              </div>
              <div
                className={`ingest-local-add__entries ${!tapFirst && isDragging ? 'is-dimmed' : ''}`}
                role="group"
                aria-label="从本机添加"
              >
                <button
                  type="button"
                  data-ingest-add-cta
                  onClick={() => fileInputRef.current?.click()}
                  className="ui-action ui-action--secondary ingest-local-add__entry"
                >
                  <FilePlus className="ingest-local-add__entry-icon" size={20} strokeWidth={2} aria-hidden="true" />
                  <span>选择文件</span>
                </button>
                <button
                  type="button"
                  data-ingest-add-cta
                  onClick={handleFolderPick}
                  aria-disabled={!folderPickSupported || undefined}
                  title={folderPickSupported ? '选择文件夹' : FOLDER_UNSUPPORTED_HINT}
                  className={`ui-action ui-action--secondary ingest-local-add__entry ${folderPickSupported ? '' : 'opacity-55'}`}
                >
                  <FolderPlus className="ingest-local-add__entry-icon" size={20} strokeWidth={2} aria-hidden="true" />
                  <span>选择文件夹</span>
                </button>
              </div>
              <p className="ingest-local-add__formats" aria-label="支持的格式">
                SRT · ASS · ZIP · RAR · 7Z
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="queue"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="ingest-queue flex flex-col text-left"
            >
              {!tapFirst && isDragging && (
                <p className="mb-4 px-1 text-sm font-medium text-[var(--v4-accent-strong)] md:text-base">
                  松开以继续添加
                </p>
              )}
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1 md:mb-6 md:gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-[var(--v4-text)] md:text-lg lg:text-[1.25rem]">
                    已添加
                  </h3>
                  <p className="mt-1 text-sm font-medium tabular-nums text-[var(--v4-text-muted)] md:text-[15px]">
                    {queueStatsLine}
                  </p>
                  {(importSummary.autoHandled.length > 0 || importSummary.needsAttention.length > 0) && (
                    <p
                      className="mt-2 inline-flex max-w-full items-center rounded-[var(--pt-radius-sm)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-text)]"
                      title={[
                        ...importSummary.autoHandled.map((i) => `自动：${i.name}`),
                        ...importSummary.needsAttention.map((i) => `待确认：${i.name}`),
                      ].slice(0, 8).join('\n')}
                    >
                      {summarizeImportForChip(importSummary)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-2.5">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 px-1 text-sm font-medium text-[var(--v4-text-muted)] md:h-11 md:text-[15px]">
                    <input
                      type="checkbox"
                      checked={isOfficialSubtitle}
                      onChange={(event) => setIsOfficialSubtitle(event.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                    />
                    官方字幕
                  </label>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 px-1 text-sm font-medium text-[var(--v4-text-muted)] md:h-11 md:text-[15px]" title="开启后可在工作台编辑署名">
                    <input
                      type="checkbox"
                      checked={isOriginalWork}
                      onChange={(event) => {
                        if (event.target.checked) setConfirmOriginal(true);
                        else setIsOriginalWork(false);
                      }}
                      className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                      data-testid="source-original"
                    />
                    原创
                  </label>
                  {confirmOriginal && (
                    <OriginalConfirmDialog
                      onCancel={() => setConfirmOriginal(false)}
                      onConfirm={() => { setIsOriginalWork(true); setConfirmOriginal(false); }}
                    />
                  )}
                </div>
              </header>

              <QueueTree
                queuedItems={queuedItems}
                shouldReduceMotion={shouldReduceMotion}
                removeQueuedFile={removeQueuedFile}
                removeFolderGroup={removeFolderGroup}
              />

              <footer className="ingest-queue-footer mt-6 flex flex-col gap-3 px-1 md:mt-7 md:gap-4">
                {(queueIssue || rejectedItems.length > 0) && (
                  <p className="text-sm leading-5 text-[var(--v4-warning)] md:text-[15px]">
                    {queueIssue || `${rejectedItems.length} 项无法处理，可移除后继续。`}
                  </p>
                )}
                <QueueActionBar
                  itemCount={queuedItems.length}
                  onClear={() => { setQueuedItems([]); setQueueIssue(null); }}
                  onPickFiles={() => fileInputRef.current?.click()}
                  onPickFolder={handleFolderPick}
                  folderPickSupported={folderPickSupported}
                />
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".srt,.ass,.zip,.rar,.7z,video/*,.mkv"
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(Array.from(e.target.files || []).map((file) => ({ file })));
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(e) => {
          // webkitRelativePath 携带「文件夹/子目录/文件」的本地路径
          addFilesToQueue(
            Array.from(e.target.files || []).map((file) => ({
              file,
              relativePath: file.webkitRelativePath || undefined,
            })),
          );
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
};
