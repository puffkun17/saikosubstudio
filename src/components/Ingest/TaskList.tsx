'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
  /** 两行布局顶距，用于让位时完美盖住空位（不在 render 里读 ref） */
  const [slotShiftPx, setSlotShiftPx] = useState(56);
  const zhRowRef = useRef<HTMLDivElement>(null);
  const enRowRef = useRef<HTMLDivElement>(null);
  const draggingTrackRef = useRef<'zh' | 'en' | null>(null);
  /** 拖拽开始时冻结的布局槽位（不含 transform），避免让位后命中区跟着跑造成横跳 */
  const trackSlotsRef = useRef<{ zh: { top: number; bottom: number; left: number; right: number }; en: { top: number; bottom: number; left: number; right: number } } | null>(null);
  const { setEdgeNext, setInfoBar } = useWorkflowChrome();
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
    setTmdbManualOpen,
    tmdbData,
    isSearchingTmdb,
    isOfficialSubtitle,
  } = useStudioStore(useShallow((state) => ({
    tasks: state.tasks,
    selectedTaskId: state.selectedTaskId,
    selectTask: state.selectTask,
    bindTrack: state.bindTrack,
    swapPrimaryTracks: state.swapPrimaryTracks,
    deleteTask: state.deleteTask,
    cancelCurrentUpload: state.cancelCurrentUpload,
    uploadedFiles: state.uploadedFiles,
    customFilename: state.customFilename,
    filenameSource: state.filenameSource,
    setCustomFilename: state.setCustomFilename,
    isProcessing: state.isProcessing,
    runSubtitleMerge: state.runSubtitleMerge,
    showAssHint: state.showAssHint,
    setShowAssHint: state.setShowAssHint,
    foundAssStyle: state.foundAssStyle,
    customStyle: state.customStyle,
    setCustomStyle: state.setCustomStyle,
    setActivePreset: state.setActivePreset,
    addLog: state.addLog,
    alignmentMode: state.alignmentMode,
    setAlignmentMode: state.setAlignmentMode,
    setTmdbManualOpen: state.setTmdbManualOpen,
    tmdbData: state.tmdbData,
    isSearchingTmdb: state.isSearchingTmdb,
    isOfficialSubtitle: state.isOfficialSubtitle,
  })));

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
            size: text.length,
            importSource: 'file',
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
        return '片源信息';
      case 'auto':
        return '原始文件名';
      case 'manual':
        return '手动输入';
      case 'library':
        return '历史存档';
      default:
        return '待填写';
    }
  };

  const stripSubtitleExt = (name: string) => name.replace(/\.(srt|ass)$/i, '').trim();

  const buildSourceFilename = () => {
    if (!tmdbData) return '';
    const parts = [tmdbData.title, tmdbData.year, activeTask?.epKey?.toUpperCase()].filter(Boolean);
    return parts.join('.');
  };

  const buildTrackFilename = () => {
    if (!activeTask) return '';
    const stems = [activeTask.zh?.name, activeTask.en?.name]
      .filter(Boolean)
      .map((name) => stripSubtitleExt(name as string));
    if (stems.length === 0) {
      const fallback = activeTask.title.replace(/待补充片名.*/g, '').trim();
      return fallback;
    }
    if (stems.length === 1) return stems[0];
    // Prefer shared prefix; otherwise keep primary stem.
    const [a, b] = stems;
    let i = 0;
    const limit = Math.min(a.length, b.length);
    while (i < limit && a[i] === b[i]) i += 1;
    const shared = a.slice(0, i).replace(/[.\-_\[\(]+$/g, '').trim();
    return shared.length >= 6 ? shared : a;
  };

  const applyFilenameFromSource = (source: 'tmdb' | 'auto') => {
    const next = source === 'tmdb' ? buildSourceFilename() : buildTrackFilename();
    if (!next) {
      addLog(source === 'tmdb' ? '暂无可用片源命名' : '暂无可用字幕文件名', 'info');
      return;
    }
    setCustomFilename(next, source);
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
    trackSlotsRef.current = null;
    setDraggingTrack(null);
    setDropTargetTrack(null);
    setDragPointer(null);
  };

  /**
   * 命中整行等高槽位：用拖拽开始时的布局矩形，不用变换后的 getBoundingClientRect。
   * 两行之间的空隙按中线归属，避免指针落在 gap 里时目标来回闪。
   */
  const hitTestTrackRow = (clientX: number, clientY: number): 'zh' | 'en' | null => {
    const slots = trackSlotsRef.current;
    if (!slots) return null;
    const { zh, en } = slots;
    const left = Math.min(zh.left, en.left);
    const right = Math.max(zh.right, en.right);
    const top = Math.min(zh.top, en.top);
    const bottom = Math.max(zh.bottom, en.bottom);
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) return null;

    // 上下槽位等高衔接：中线以上归主字幕槽，以下归第二语言槽
    const midY = (zh.bottom + en.top) / 2;
    return clientY < midY ? 'zh' : 'en';
  };

  const beginTrackDrag = (
    trackKey: 'zh' | 'en',
    event: React.PointerEvent<HTMLElement>,
    rowEl: HTMLDivElement | null,
  ) => {
    if (!canReorderTracks || !activeTask) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    // 在任何 transform 之前冻结布局槽位
    const zhBox = zhRowRef.current?.getBoundingClientRect();
    const enBox = enRowRef.current?.getBoundingClientRect();
    if (zhBox && enBox) {
      trackSlotsRef.current = {
        zh: { top: zhBox.top, bottom: zhBox.bottom, left: zhBox.left, right: zhBox.right },
        en: { top: enBox.top, bottom: enBox.bottom, left: enBox.left, right: enBox.right },
      };
      setSlotShiftPx(Math.max(1, Math.round(enBox.top - zhBox.top)));
    }

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
      ready: canProceed && !isProcessing,
      disabledReason: '请先为当前任务绑定至少一条主字幕轨。',
      onClick: () => {
        if (!canProceed) return;
        void runSubtitleMerge();
      },
    });
    return () => setEdgeNext(null);
  }, [activeTask, canProceed, edgeLabel, isProcessing, runSubtitleMerge, setEdgeNext]);

  const identityTitle = (() => {
    if (!activeTask) return '核对清单';
    if (tmdbData?.title) return tmdbData.title;
    if (needsTitleInput) return '片名待确认';
    const raw = activeTask.title.replace(/待补充片名.*/g, '').trim();
    if (activeTask.epKey) {
      const withoutEp = raw.replace(new RegExp(activeTask.epKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/[.\-_]+$/g, '').trim();
      if (withoutEp) return withoutEp;
    }
    return raw || '字幕任务';
  })();

  const identityYear = tmdbData?.year || undefined;
  const identityBadges = [
    activeTask?.epKey?.toUpperCase(),
  ].filter((item): item is string => Boolean(item));

  const trackFormatSummary = (() => {
    if (!activeTask) return '';
    const files = activeTask.files.length > 0
      ? activeTask.files
      : [activeTask.zh, activeTask.en, activeTask.commentary].filter(Boolean);
    let srt = 0;
    let ass = 0;
    for (const file of files) {
      if (!file) continue;
      if (file.name.toLowerCase().endsWith('.ass')) ass += 1;
      else srt += 1;
    }
    const parts: string[] = [];
    if (srt > 0) parts.push(`${srt} SRT`);
    if (ass > 0) parts.push(`${ass} ASS`);
    return parts.join(' · ');
  })();

  const trackSourceSummary = (() => {
    if (!activeTask) return '';
    const sources = new Set(
      (activeTask.files.length > 0
        ? activeTask.files
        : [activeTask.zh, activeTask.en, activeTask.commentary].filter(Boolean)
      ).map((file) => file?.importSource).filter(Boolean),
    );
    const parts: string[] = [];
    if (sources.has('zip') || sources.has('archive')) parts.push('来自压缩包');
    if (sources.has('folder')) parts.push('来自文件夹');
    if (sources.has('file') || sources.size === 0) {
      if (parts.length === 0) parts.push('本地文件');
    }
    if (isOfficialSubtitle) parts.unshift('官方字幕');
    return parts.join(' · ');
  })();

  const identityLocalChips = [
    // 过程态仍在本地层；成功匹配改由片源卡 Powered by TMDB 表达
    !tmdbData && isSearchingTmdb ? '匹配中' : null,
    !tmdbData && needsTitleInput ? '待补充片名' : null,
    !tmdbData && !isSearchingTmdb && !needsTitleInput ? '未匹配' : null,
    `${tasks.length} 个任务`,
    trackFormatSummary,
    ...trackSourceSummary.split(' · ').filter(Boolean),
  ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    if (!activeTask) {
      setInfoBar(null);
      return;
    }
    setInfoBar({
      title: identityTitle,
      year: identityYear,
      badges: identityBadges,
      localChips: identityLocalChips,
      actions: (
        <>
          {pendingCancelUpload ? (
            <>
              <button
                type="button"
                className="v4-focus-ring inline-flex h-9 items-center rounded-md border border-rose-500/25 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/18"
                onClick={() => { cancelCurrentUpload(); setPendingCancelUpload(false); }}
              >
                清空本次导入
              </button>
              <button
                type="button"
                className="v4-focus-ring inline-flex h-9 items-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-xs font-semibold text-[var(--v4-text-muted)] hover:text-[var(--v4-text)]"
                onClick={() => setPendingCancelUpload(false)}
              >
                返回
              </button>
            </>
          ) : (
            <button
              type="button"
              className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-xs font-semibold text-[var(--v4-text-muted)] transition-colors hover:bg-[var(--v4-panel)] hover:text-[var(--v4-text)]"
              onClick={() => setPendingCancelUpload(true)}
              title="取消本次导入并返回上传入口"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">取消本次导入</span>
              <span className="sm:hidden">取消</span>
            </button>
          )}
          <button
            type="button"
            className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-xs font-semibold text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-panel)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-3.5 w-3.5" />
            继续添加
          </button>
          {pendingDeleteId === activeTask.id ? (
            <>
              <button
                type="button"
                className="v4-focus-ring inline-flex h-9 items-center rounded-md border border-rose-500/25 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300"
                onClick={() => { deleteTask(activeTask.id); setPendingDeleteId(null); }}
              >
                确认移除
              </button>
              <button
                type="button"
                className="v4-focus-ring inline-flex h-9 items-center rounded-md border border-[var(--v4-line)] px-3 text-xs font-semibold text-[var(--v4-text-muted)]"
                onClick={() => setPendingDeleteId(null)}
              >
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 text-xs font-semibold text-[var(--v4-text-muted)] transition-colors hover:text-rose-300"
              onClick={() => setPendingDeleteId(activeTask.id)}
              aria-label="移除当前字幕任务"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">移除</span>
            </button>
          )}
        </>
      ),
    });
    return () => setInfoBar(null);
  }, [
    activeTask,
    identityTitle,
    identityYear,
    identityBadges,
    identityLocalChips,
    tasks.length,
    pendingCancelUpload,
    pendingDeleteId,
    cancelCurrentUpload,
    deleteTask,
    setInfoBar,
  ]);

  if (!activeTask) return null;

  const zhCount = getSubTitleCount(activeTask.zh);
  const isFoundAssStyleApplied = Boolean(foundAssStyle && Object.entries(foundAssStyle).every(
    ([key, value]) => customStyle[key as keyof StyleSettings] === value,
  ));

  return (
    <div className="v4-panel relative flex h-full w-full max-w-[760px] flex-col gap-4 rounded-lg p-5 md:p-6 lg:max-w-none">

      {/* Task tab switcher (if multiple tasks exist) */}
      {tasks.length > 1 && (
        <div className="flex gap-2 pb-2 border-b border-[var(--v4-line)] overflow-x-auto scrollbar-none flex-shrink-0">
          {tasks.map(t => {
            const isActive = t.id === activeTask.id;
            return (
              <button
                key={t.id}
                className={`max-w-[220px] cursor-pointer truncate rounded-xl border px-4 py-2 font-sans text-sm transition-all
                  ${isActive
                    ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] font-semibold text-[var(--v4-accent-strong)] shadow-[0_0_12px_color-mix(in_srgb,var(--v4-accent)_12%,transparent)]'
                    : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-faint)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]'}`}
                onClick={() => selectTask(t.id)}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Main workspace — hug content; sticky dock without stretching voids */}
      <div className="relative flex min-h-0 flex-col gap-4 overflow-x-visible overflow-y-auto pr-1 select-none scrollbar-thin">

        {needsTitleInput && (
          <div className="relative flex flex-shrink-0 items-center gap-2.5 rounded-lg border border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] px-3 py-2.5">
            <CircleAlert className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--v4-text)]">
              片名待确认，请先补充后再命名导出
            </span>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--v4-accent)] px-2.5 text-xs font-semibold text-[var(--v4-accent-ink)]"
              onClick={() => setTmdbManualOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              补充片名
            </button>
          </div>
        )}

        {/* Track bindings first — primary decision before naming/credits */}
        <div className="flex min-h-0 flex-col gap-3.5 overflow-visible">
          <div className="relative flex flex-col gap-3 overflow-visible">
            <div className="flex items-center gap-2">
              <h4 className="block select-none text-base font-semibold text-[var(--v4-text)]">
                字幕序列
              </h4>
              <InfoHint label="字幕序列说明">
                选择要处理的字幕文件。双语单文件会自动识别；分开的中文与第二语言轨将按时间轴合并。
              </InfoHint>
              {activeTask.isBilingualSingle && (
                <span className="rd-chip rd-chip--tight text-[var(--v4-text-muted)]">
                  双语 · {zhCount} 行
                </span>
              )}
              {!activeTask.isBilingualSingle && activeTask.zh && activeTask.en && (
                <span className="ml-auto text-xs font-normal text-[var(--v4-text-faint)]">
                  按住行尾六点拖动可对调主副轨
                </span>
              )}
            </div>
            <div className="relative flex flex-col gap-2.5 overflow-visible rounded-lg bg-[var(--v4-panel-muted)] p-3">
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
                  // 让位距离 = 两行布局顶距，刚好盖住被提起行的空位
                  const liveShiftY = (() => {
                    if (!draggingTrack || !dropTargetTrack || !isDropTarget || isDragging) return 0;
                    return draggingTrack === 'zh' ? -slotShiftPx : slotShiftPx;
                  })();
                  return (
                    <motion.div
                      ref={rowRef}
                      animate={{
                        y: liveShiftY,
                        opacity: isDragging ? 0.28 : 1,
                        scale: isDropTarget ? 1.01 : 1,
                      }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
                      className={`flex flex-row items-center gap-2 overflow-visible rounded-xl ${
                        isDropTarget ? 'bg-[var(--v4-accent-soft)] ring-1 ring-[var(--v4-accent)]/40' : ''
                      }`}
                    >
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-[var(--v4-text-muted)]">
                        {label}
                      </span>
                      <TrackSelect
                        value={file?.id || ''}
                        options={trackOptions}
                        onChange={(id) => bindTrack(activeTask.id, trackKey, id)}
                        countLabel={file ? getSubTitleCount(file) : null}
                        placeholder={placeholder}
                      />
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
                        className={`grid h-11 w-8 shrink-0 place-items-center rounded-md text-[var(--v4-text-faint)] transition-colors touch-none ${
                          canReorderTracks
                            ? 'cursor-grab hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] active:cursor-grabbing'
                            : 'cursor-default opacity-25'
                        }`}
                      >
                        <GripVertical className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                      </span>
                    </motion.div>
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
                          <>
                            第二语言
                            <InfoHint label="第二语言说明" side="right">
                              英语或其他语言轨，将与主字幕按时间轴合并。
                            </InfoHint>
                          </>,
                          '选择英语或其他语言（可选）',
                          enRowRef,
                        )}

                        <div className="flex flex-row items-center gap-2 overflow-visible">
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-[var(--v4-text-muted)]">
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
                          <span className="grid h-11 w-8 shrink-0 place-items-center opacity-0" aria-hidden="true" />
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
                            className="flex items-center gap-2 rounded-xl border border-[var(--v4-accent)]/40 bg-[var(--v4-panel-raised)] px-3 py-2.5 shadow-[0_18px_40px_rgba(26,61,55,0.12)] backdrop-blur-md"
                            style={{ height: dragCardSize.h }}
                          >
                            <FileFormatIcon name={dragFile.name} size="sm" />
                            <LanguageMark lang={dragFile.lang} languagePair={dragFile.languagePair} />
                            <span className="min-w-0 flex-1 truncate font-mono text-sm text-[var(--v4-text)]">
                              {dragFile.name}
                            </span>
                            <span className="shrink-0 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2 py-0.5 font-mono text-xs text-[var(--v4-text-muted)]">
                              {getSubTitleCount(dragFile)}行
                            </span>
                            <GripVertical className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                          </motion.div>
                        </div>
                      </OverlayPortal>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Credit first, then export name (blank + source checkboxes) */}
          <div className="flex flex-shrink-0 flex-col gap-3">
            <CreditTool />

            <div className="rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex select-none items-center gap-1.5 text-sm font-semibold text-[var(--v4-text)]">
                  导出选项
                  <InfoHint label="导出选项说明">
                    默认留空。可勾选从片源信息或原始文件名填充，也可直接输入。格式在导出时再选。
                  </InfoHint>
                </label>
                <span className="rd-chip rd-chip--tight shrink-0 text-[var(--v4-text-muted)]">
                  {getFilenameSourceLabel()}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <label className={`inline-flex items-center gap-2 text-xs ${tmdbData ? 'cursor-pointer text-[var(--v4-text-muted)]' : 'cursor-not-allowed text-[var(--v4-text-faint)]'}`}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                    disabled={!tmdbData}
                    checked={filenameSource === 'tmdb'}
                    onChange={(event) => {
                      if (event.target.checked) applyFilenameFromSource('tmdb');
                      else if (filenameSource === 'tmdb') setCustomFilename('', 'unknown');
                    }}
                  />
                  <span>使用片源</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--v4-text-muted)]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[var(--v4-accent)]"
                    checked={filenameSource === 'auto'}
                    onChange={(event) => {
                      if (event.target.checked) applyFilenameFromSource('auto');
                      else if (filenameSource === 'auto') setCustomFilename('', 'unknown');
                    }}
                  />
                  <span>使用原始文件名</span>
                </label>
              </div>

              <div className="relative mt-2.5">
                <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors ${
                  isFilenameFocused
                    ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)]'
                    : 'border-[var(--v4-line)] bg-[var(--v4-panel)]'
                }`}>
                  <input
                    type="text"
                    className="v4-focus-ring h-8 w-full min-w-0 border-0 bg-transparent font-mono text-[14px] font-medium text-[var(--v4-text)] outline-none placeholder:text-[var(--v4-text-faint)]"
                    value={customFilename}
                    onChange={e => setCustomFilename(e.target.value, 'manual')}
                    onFocus={() => setIsFilenameFocused(true)}
                    onBlur={() => setIsFilenameFocused(false)}
                    placeholder="输入导出文件名"
                    aria-label="导出文件名"
                  />
                  <span className="shrink-0 font-mono text-[11px] font-semibold tracking-wide text-[var(--v4-text-faint)]">
                    .ass / .srt
                  </span>
                </div>
                {customFilename.length > 42 && !isFilenameFocused && (
                  <div className="pointer-events-none absolute inset-y-px left-2.5 right-[4.75rem] flex items-center overflow-hidden bg-[var(--v4-panel)] font-mono text-[14px] font-medium text-[var(--v4-text)]">
                    {renderMarqueeText(customFilename, 'w-full')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration & Process Dock — sticky, no mt-auto void */}
          <div className="sticky bottom-0 z-10 mt-3 flex flex-col gap-3 overflow-visible border-t border-[var(--v4-line)] bg-[var(--v4-panel)]/95 pt-3 backdrop-blur-sm">

            {/* Source ASS style preview and explicit adoption decision. */}
            {foundAssStyle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-xl border border-[var(--v4-line)] bg-[var(--v4-panel-muted)]"
              >
                <div className="grid gap-0 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)]">
                  <AssStylePreview style={foundAssStyle} className="min-h-36 rounded-none border-0 border-b border-[var(--v4-line)] md:border-b-0 md:border-r" />
                  <div className="flex min-w-0 flex-col justify-between gap-4 p-4 md:p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Paintbrush className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                        <h5 className="text-sm font-semibold text-[var(--v4-text)]">文件内嵌样式</h5>
                        {isFoundAssStyleApplied && !showAssHint && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--v4-accent)]/20 bg-[var(--v4-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--v4-accent-strong)]">
                            <Check className="h-3 w-3" />
                            已用于导出
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--v4-text-muted)]">
                        预览来自当前 ASS 文件。字体按当前设备可用版本近似呈现。
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--v4-text-muted)]">
                        <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] px-2 py-1">
                          中文 {foundAssStyle.zhFontSize || '--'} px
                        </span>
                        <span className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] px-2 py-1">
                          第二语言 {foundAssStyle.enFontSize || '--'} px
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(showAssHint || !isFoundAssStyleApplied) && (
                        <button
                          type="button"
                          className="v4-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-[var(--v4-accent)]/25 bg-[var(--v4-accent-soft)] px-3 text-xs font-semibold text-[var(--v4-accent-strong)] transition hover:bg-[var(--v4-accent)] hover:text-[var(--v4-accent-ink)] active:translate-y-px"
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
                          className="v4-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel)] px-3 text-xs font-medium text-[var(--v4-text-muted)] transition hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] active:translate-y-px"
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
                  <label className="text-sm text-[var(--v4-text-muted)] font-semibold select-none inline-flex items-center gap-1.5">
                    对齐方式
                    <InfoHint label="对齐方式说明" side="left">
                      智能模式适合常规双语轨合并；细致模式会尝试处理插入、删减或断句不一致，但耗时略高。
                    </InfoHint>
                  </label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-xl bg-[var(--v4-panel-muted)] border border-[var(--v4-line)] relative h-12 items-center">
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'standard' ? 'text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-faint)] hover:text-[var(--v4-text-muted)]'}`}
                      onClick={() => setAlignmentMode('standard')}
                    >
                      {alignmentMode === 'standard' && (
                        <motion.div
                          layoutId="activeEngine"
                          className="absolute inset-0 bg-[var(--v4-accent-soft)] border border-[var(--v4-accent)]/25 rounded-md -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      智能
                    </button>
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'industrial' ? 'text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-faint)] hover:text-[var(--v4-text-muted)]'}`}
                      onClick={() => setAlignmentMode('industrial')}
                    >
                      {alignmentMode === 'industrial' && (
                        <motion.div
                          layoutId="activeEngine"
                          className="absolute inset-0 bg-[var(--v4-accent-soft)] border border-[var(--v4-accent)]/25 rounded-md -z-10"
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
