'use client';

import React, { useEffect, useRef, useState } from 'react';
import { OriginalConfirmDialog } from '@/components/Ingest/OriginalConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import {
  ChevronDown,
  FilePlus,
  FolderPlus,
  HardDrive,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { summarizeImportForChip } from '@/utils/importSummary';
import { FileFormatIcon, LanguageMark, resolveFileFormat } from '@/components/ui/FileFormatIcon';
import { DeleteButton } from '@/components/ui/delete-button';
import { WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import {
  MAX_DROPPED_ENTRIES,
  collectEntryFiles,
  buildRenderNodes,
  formatBytes,
  languagesForItem,
  leafDelayMs,
  sleep,
  summarizeQueue,
  type IncomingFile,
  type PreflightItem,
} from '@/components/Ingest/dragzone/preflight';
import {
  FOLDER_UNSUPPORTED_HINT,
  useFolderPickSupported,
  useTapFirstIngest,
} from '@/components/Ingest/dragzone/environment';
import { useIngestPipeline } from '@/components/Ingest/dragzone/useIngestPipeline';

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

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [addMenuOpen]);

  const {
    isParsing,
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
          <span className="ingest-local-spinner" aria-hidden="true" />
          <p className="text-base font-semibold tracking-tight text-[var(--v4-text)]">
            文件仅在本地处理
          </p>
        </div>
      </div>
    );
  }

  const { rejectedItems, queueStatsLine } = summarizeQueue(queuedItems, { isOfficialSubtitle, isOriginalWork });

  const renderNodes = buildRenderNodes(queuedItems);

  /**
   * 生产线「轨单元」：单独字幕 / 包内字幕 / 文件夹内字幕共用同一视觉规格。
   * 壳（7z、文件夹）用更大的根行；轨用 lg 图标 + 语种标，桌面再加一档字号。
   */
  const renderTrackUnit = ({
    keyName,
    name,
    title,
    accepted,
    note,
    languageLabels,
    onRemove,
  }: {
    keyName: string;
    name: string;
    title?: string;
    accepted: boolean;
    note?: string;
    languageLabels: string[];
    onRemove?: () => void;
  }) => (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 md:gap-3.5">
      <FileFormatIcon name={name} size="md" />
      <div className="min-w-0">
        <p
          className={`truncate text-[15px] font-medium leading-snug md:text-[16px] lg:text-[17px] ${accepted ? 'text-[var(--v4-text)]' : 'text-[var(--v4-danger)]'}`}
          title={title || name}
        >
          {name}
        </p>
        {note && !accepted && (
          <p className="mt-0.5 text-xs font-normal text-[var(--v4-danger)] md:text-sm">{note}</p>
        )}
      </div>
      {languageLabels.length > 0 ? (
        <span className="inline-flex flex-wrap items-center justify-end gap-1 md:gap-1.5">
          {languageLabels.map((label) => (
            <LanguageMark key={`${keyName}:${label}`} label={label} size="md" />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
          aria-label={`移除 ${name}`}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : (
        <span className="h-9 w-9" aria-hidden="true" />
      )}
    </div>
  );

  /** 压缩包子文件树（顶层与文件夹内嵌套共用）。 */
  const renderArchiveSubtree = (item: PreflightItem) => {
    if (item.kind !== 'zip' && item.kind !== 'archive') return null;
    if (item.archivePeekStatus !== 'error' && !(item.archiveEntries && item.archiveEntries.length > 0)) return null;
    return (
      <div className="ingest-halo-tree mt-2.5 md:mt-3">
        {item.archivePeekStatus === 'error' && (
          <p className="mb-1.5 text-xs font-normal text-[var(--v4-danger)] md:text-sm">{item.archivePeekError || item.note}</p>
        )}
        {item.archiveEntries?.map((entry, entryIndex) => (
          <motion.div
            key={`${item.key}:${entry.name}`}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.26,
              delay: shouldReduceMotion ? 0 : leafDelayMs(entryIndex) / 1000,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
            style={{ '--leaf-delay': `${leafDelayMs(entryIndex)}ms` } as React.CSSProperties}
          >
            {renderTrackUnit({
              keyName: `${item.key}:${entry.name}`,
              name: entry.name,
              title: entry.name,
              accepted: true,
              languageLabels: [entry.languageLabel],
            })}
          </motion.div>
        ))}
      </div>
    );
  };

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
                      className="mt-2 inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{ background: '#ef8d5f', color: '#1a3d37' }}
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
                  <div className="relative" ref={addMenuRef}>
                    <button
                      type="button"
                      onClick={() => setAddMenuOpen((open) => !open)}
                      className="ui-action ui-action--secondary ui-action--lg"
                      aria-expanded={addMenuOpen}
                    >
                      <Plus className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                      添加
                      <ChevronDown className={`h-4 w-4 opacity-70 transition-transform md:h-4 md:w-4 ${addMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {addMenuOpen && (
                      <div className="ui-menu absolute right-0 top-full z-20 mt-1.5">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)] md:text-[15px]"
                          onClick={() => { setAddMenuOpen(false); fileInputRef.current?.click(); }}
                        >
                          <FilePlus className="h-4 w-4 text-[var(--v4-accent-strong)]" />
                          文件 / 压缩包
                        </button>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 border-t border-[var(--v4-line)] px-3.5 py-3 text-left text-sm font-normal md:text-[15px] ${
                            folderPickSupported
                              ? 'text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]'
                              : 'cursor-help text-[var(--v4-text-faint)]'
                          }`}
                          title={folderPickSupported ? undefined : FOLDER_UNSUPPORTED_HINT}
                          aria-disabled={!folderPickSupported || undefined}
                          onClick={() => {
                            setAddMenuOpen(false);
                            handleFolderPick();
                          }}
                        >
                          <FolderPlus className="h-4 w-4 text-[var(--v4-accent-strong)]" />
                          {folderPickSupported ? '文件夹' : '文件夹（不可用）'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="text-xs text-[var(--v4-text-faint)]">清空队列</span>
                    <DeleteButton
                      aria-label="清空导入队列"
                      onConfirm={() => { setQueuedItems([]); setQueueIssue(null); }}
                    />
                  </div>
                </div>
              </header>

              <div className="max-h-[min(480px,56vh)] space-y-3 overflow-y-auto px-1 pb-1 md:max-h-[min(620px,62vh)] md:space-y-4">
                {renderNodes.map((node, nodeIndex) => {
                  // 文件「落桌」：从上方轻降 + 微缩回位，像放到桌面上
                  const landing = {
                    initial: shouldReduceMotion ? false : { opacity: 0, y: -14, scale: 1.03 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    transition: {
                      duration: shouldReduceMotion ? 0 : 0.34,
                      delay: shouldReduceMotion ? 0 : Math.min(nodeIndex * 0.05, 0.2),
                      ease: [0.16, 1, 0.3, 1] as const,
                    },
                  };

                  if (node.type === 'folder') {
                    const folderBytes = node.items.reduce((sum, row) => sum + row.file.size, 0);
                    const folderSrt = node.items.filter((row) => row.kind === 'subtitle' && row.extension !== 'ass').length
                      + node.items.reduce((sum, row) => sum + (row.archiveEntries || []).filter((entry) => !/\.ass$/i.test(entry.name)).length, 0);
                    const folderAss = node.items.filter((row) => row.kind === 'subtitle' && row.extension === 'ass').length
                      + node.items.reduce((sum, row) => sum + (row.archiveEntries || []).filter((entry) => /\.ass$/i.test(entry.name)).length, 0);
                    const folderFormat = [
                      folderSrt > 0 ? `${folderSrt} SRT` : null,
                      folderAss > 0 ? `${folderAss} ASS` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <motion.div key={`folder:${node.folder}`} {...landing} className="min-w-0">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
                          <div className="ingest-halo-root">
                            <FileFormatIcon format="folder" size="md" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[16px] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[17px] lg:text-[18px]" title={node.folder}>
                              {node.folder}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                              本地文件夹 · {node.items.length} 个文件
                              {folderFormat ? ` · ${folderFormat}` : ''} · {formatBytes(folderBytes)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFolderGroup(node.folder)}
                            className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
                            aria-label={`移除文件夹 ${node.folder}`}
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>

                        <div className="ingest-halo-tree mt-2.5 md:mt-3">
                          {node.items.map((item, leafIndex) => {
                            const langs = languagesForItem(item);
                            // 去掉顶层目录名，保留剩余相对路径（如 S01/xx.srt）
                            const subPath = item.relativePath
                              ? item.relativePath.split('/').slice(1).join('/')
                              : item.name;
                            return (
                              <motion.div
                                key={item.key}
                                initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: shouldReduceMotion ? 0 : 0.26,
                                  delay: shouldReduceMotion ? 0 : leafDelayMs(leafIndex) / 1000,
                                  ease: [0.16, 1, 0.3, 1],
                                }}
                                className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
                                style={{ '--leaf-delay': `${leafDelayMs(leafIndex)}ms` } as React.CSSProperties}
                              >
                                {renderTrackUnit({
                                  keyName: item.key,
                                  name: subPath,
                                  title: item.relativePath || item.name,
                                  accepted: item.accepted,
                                  note: item.accepted ? undefined : item.note,
                                  languageLabels: langs,
                                  onRemove: () => removeQueuedFile(item.key),
                                })}
                                {renderArchiveSubtree(item)}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  }

                  const item = node.item;
                  const langs = languagesForItem(item);
                  const isArchive = item.kind === 'zip' || item.kind === 'archive';

                  // 单独字幕文件：与包内轨同级的「轨单元」，不升格成壳
                  if (!isArchive && item.kind === 'subtitle') {
                    return (
                      <motion.div key={item.key} {...landing} className="min-w-0 rounded-md px-0.5 py-1 md:py-1.5">
                        {renderTrackUnit({
                          keyName: item.key,
                          name: item.name,
                          title: item.name,
                          accepted: item.accepted,
                          note: item.accepted ? undefined : item.note,
                          languageLabels: langs,
                          onRemove: () => removeQueuedFile(item.key),
                        })}
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div key={item.key} {...landing} className="min-w-0">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
                        <div className="ingest-halo-root">
                          <FileFormatIcon format={resolveFileFormat(item.name)} size="md" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[17px] lg:text-[18px]" title={item.name}>
                            {item.name}
                          </p>
                          {isArchive && item.archivePeekStatus === 'loading' && (
                            <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                              {item.note && item.note !== '正在查看包内字幕…'
                                ? item.note
                                : '正在读取包内字幕…'}
                            </p>
                          )}
                          {isArchive && item.archivePeekStatus === 'ready' && item.archiveEntries && (
                            <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                              {[
                                '压缩包',
                                (() => {
                                  const srt = item.archiveEntries.filter((entry) => !/\.ass$/i.test(entry.name)).length;
                                  const ass = item.archiveEntries.filter((entry) => /\.ass$/i.test(entry.name)).length;
                                  return [srt > 0 ? `${srt} SRT` : null, ass > 0 ? `${ass} ASS` : null].filter(Boolean).join(' · ');
                                })(),
                                formatBytes(item.file.size),
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {!item.accepted && (
                            <p className="mt-1 text-xs font-medium text-[var(--v4-danger)] md:text-sm">{item.note}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQueuedFile(item.key)}
                          className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
                          aria-label={`移除 ${item.name}`}
                        >
                          <X className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>

                      {renderArchiveSubtree(item)}
                    </motion.div>
                  );
                })}
              </div>

              <footer className="mt-6 flex flex-col gap-4 px-1 md:mt-7">
                {(queueIssue || rejectedItems.length > 0) && (
                  <p className="text-sm leading-5 text-[var(--v4-warning)] md:text-[15px]">
                    {queueIssue || `${rejectedItems.length} 项无法处理，可移除后继续。`}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--v4-text-muted)] md:text-[15px]">
                    <HardDrive className="h-4 w-4" aria-hidden="true" />
                    仅在本地读取，不上传
                  </span>
                  <WorkflowContinueInFlow className="min-w-[8.5rem] justify-center" />
                </div>
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
