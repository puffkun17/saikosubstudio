'use client';

import { secondaryTermFor } from '@/core/trackTerms';
import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { mintFileId } from '@/core/identity';
import { runRecognitionJob } from '@/core/recognitionClient';
import { useStudioStore, Subfile } from '@/store/useStudioStore';
import { Check, CircleAlert, GripVertical, Info, Paintbrush, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { parseSrt, decodeBuffer, detectSubtitleLanguage, StyleSettings } from '@/utils/subtitleCore';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_S, springNoBounce } from '@/core/motion';
import { STAGE_HANDOFF_WINDOW_MS, stageSharedHandoffEnabled } from '@/core/stageFlags';
import { useIngestStage } from '@/store/useIngestStage';
import { TrackSelect } from '@/components/Ingest/TrackSelect';
import { InfoHint } from '@/components/ui/InfoHint';
import { FileFormatIcon, LanguageMark } from '@/components/ui/FileFormatIcon';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { useWorkflowChrome, WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import { getSubtitleTermHint } from '@/utils/subtitleTerminology';
import { getClientBatchIssue, getClientFileIssue } from '@/utils/importSafety';
import { AssStylePreview } from '@/components/Ingest/AssStylePreview';


const isChineseFamilyLang = (lang?: string | null, name?: string | null): boolean => {
  const code = (lang || '').trim().toLowerCase();
  if (
    code === 'zh'
    || code === 'zh-cn'
    || code === 'zh-tw'
    || code === 'zh-hans'
    || code === 'zh-hant'
    || code === 'cmn'
    || code === 'yue'
    || code === 'chinese'
    || code === 'chs'
    || code === 'cht'
  ) {
    return true;
  }
  const hay = `${lang || ''} ${name || ''}`.toLowerCase();
  if (/(简体|簡體|简中|簡中|繁体|繁體|繁中|chinese)/i.test(hay)) return true;
  if (/(^|[._\s\-\[\(])(chs|cht|sc|tc|zh[-_.]?cn|zh[-_.]?tw|zh[-_.]?hans|zh[-_.]?hant|cmn|yue)([._\s\-\]\)]|$)/i.test(hay)) {
    return true;
  }
  return false;
};

const isEnglishLikeLang = (lang?: string | null, name?: string | null): boolean => {
  const code = (lang || '').trim().toLowerCase();
  if (code === 'en' || code === 'eng' || code === 'english') return true;
  const hay = `${lang || ''} ${name || ''}`.toLowerCase();
  return /(^|[._\s\-\[\(])(en|eng|english)([._\s\-\]\)]|$)/i.test(hay)
    || /英语|英語|英文/.test(hay);
};

const HANDOFF_MOVE = springNoBounce(MOTION_S.longMove);

export const TaskList: React.FC = () => {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // 第 1 页 → 第 2 页交接：放行后马上挂载的这一次，轨道行带上来源 objectId 作 layoutId，
  // 从清单里的位置移过来；窗口过了就去掉，换轨 / 对调时不再飞。
  const reduceMotion = useReducedMotion();
  const [handoffWindow, setHandoffWindow] = useState(() => {
    const at = useIngestStage.getState().handoffAt;
    return stageSharedHandoffEnabled() && at !== null && Date.now() - at < STAGE_HANDOFF_WINDOW_MS;
  });
  useEffect(() => {
    if (!handoffWindow) return;
    const timer = window.setTimeout(() => setHandoffWindow(false), STAGE_HANDOFF_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [handoffWindow]);
  const handoffObjects = handoffWindow && !reduceMotion;
  const [pendingCancelUpload, setPendingCancelUpload] = useState(false);
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
  const { setForwardAction, setInfoBar } = useWorkflowChrome();
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
    isProcessing,
    runSubtitleMerge,
    foundAssStyle,
    customStyle,
    alignmentMode,
    setAlignmentMode,
    setTmdbManualOpen,
    isOfficialSubtitle,
    setStatusNotice,
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
    addLog: state.addLog,
    alignmentMode: state.alignmentMode,
    setAlignmentMode: state.setAlignmentMode,
    setTmdbManualOpen: state.setTmdbManualOpen,
    isOfficialSubtitle: state.isOfficialSubtitle,
    setStatusNotice: state.setStatusNotice,
  })));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAndDecodeFile = (file: File): Promise<ReturnType<typeof decodeBuffer>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(decodeBuffer(reader.result as ArrayBuffer));
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
          const decoded = await readAndDecodeFile(file);
          const detected = detectSubtitleLanguage(file.name, decoded.text);

          detectedFiles.push({
            id: mintFileId(file.name, decoded.text),
            name: file.name,
            text: decoded.text,
            lang: detected.lang,
            languagePair: detected.languagePair,
            isBilingual: detected.isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: decoded.text.length,
            importSource: 'file',
            encoding: decoded.encoding,
            encodingConfidence: decoded.confidence,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          addLog(`读取文件 ${file.name} 失败: ${msg}`, "error");
        }
      }
    }

    if (detectedFiles.length > 0) {
      const recognized = await runRecognitionJob(detectedFiles);
      processFiles(recognized.files as Subfile[], { recognized: true });
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

    // 上下槽位等高衔接：中线以上归主字幕槽，以下归原文槽
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

  const primaryFile = activeTask?.zh ?? null;
  const secondaryFile = activeTask?.en ?? null;
  const secondaryLooksEnglish = Boolean(
    secondaryFile && isEnglishLikeLang(secondaryFile.lang, secondaryFile.name),
  );
  const secondaryLabel = secondaryTermFor(secondaryFile?.lang);
  const secondaryPlaceholder = secondaryLooksEnglish ? '选择副字幕 · 英语（可选）' : '选择副字幕（可选）';
  const secondaryHint = '副字幕通常为英语，也支持西语、法语、葡语、德语、意语和日语、韩语等与主语言不同的对白轨；与主字幕同语种（含简繁互为）不能作为合轴对。';

  const sameScriptPairBound = Boolean(
    activeTask
    && !activeTask.isBilingualSingle
    && primaryFile
    && secondaryFile
    && isChineseFamilyLang(primaryFile.lang, primaryFile.name)
    && isChineseFamilyLang(secondaryFile.lang, secondaryFile.name),
  );

  const unboundSameScriptOnly = Boolean(
    activeTask
    && !activeTask.isBilingualSingle
    && primaryFile
    && !secondaryFile
    && isChineseFamilyLang(primaryFile.lang, primaryFile.name)
    && (() => {
      const unbound = uploadedFiles.filter((f) => (
        f.id !== primaryFile.id
        && f.id !== activeTask.commentary?.id
      ));
      if (unbound.length === 0) return false;
      const hasEnglishLike = unbound.some((f) => isEnglishLikeLang(f.lang, f.name));
      if (hasEnglishLike) return false;
      return unbound.every((f) => isChineseFamilyLang(f.lang, f.name));
    })(),
  );

  const showSameScriptWarning = sameScriptPairBound || unboundSameScriptOnly;

  /**
   * Derek (PR #39 #2): Chinese only, no second language bound → a light, non-blocking hint to look for
   * one. Without it nothing changes: the Chinese line keeps its usual position (no moving down).
   */
  const showChineseOnlyHint = Boolean(
    activeTask
    && !activeTask.isBilingualSingle
    && primaryFile
    && !secondaryFile
    && !showSameScriptWarning
    && isChineseFamilyLang(primaryFile.lang, primaryFile.name),
  );
  // Single-language fast path (R-10): one track only → skip alignment, gentle note, continue as-is.
  const isSingleLanguage = Boolean(activeTask && !activeTask.isBilingualSingle && primaryFile && !secondaryFile && !showSameScriptWarning);

  const edgeLabel = isProcessing
    ? '正在准备…'
    : needsTitleInput
      ? '跳过匹配'
      : '开始合轴';

  useEffect(() => {
    if (!activeTask) {
      setForwardAction(null);
      return;
    }
    setForwardAction({
      label: edgeLabel,
      disabled: !canProceed,
      ready: canProceed && !isProcessing && !sameScriptPairBound,
      disabledReason: sameScriptPairBound
        ? '当前像是两套中文主语言字幕，请补上副字幕或取消副字幕后再继续。'
        : '请先为当前任务绑定至少一条主字幕轨。',
      onClick: () => {
        if (!canProceed) return;
        if (sameScriptPairBound) {
          setStatusNotice({
            id: 'same-script-pair-blocked',
            tone: 'warning',
            title: '无法按双语合轴继续',
            message: '当前像是两套中文主语言字幕，不是双语对。请补上英语等副字幕再合轴；或取消副字幕，按单语整理/导出。',
            channel: 'inline',
          });
          return;
        }
        void runSubtitleMerge();
      },
    });
    return () => setForwardAction(null);
  }, [activeTask, canProceed, edgeLabel, isProcessing, runSubtitleMerge, sameScriptPairBound, setForwardAction, setStatusNotice]);

  /**
   * Task bar is task-scoped only (counts / source / actions).
   * Show title, year, and episode live on SourceIdentityStrip (work card).
   */
  const taskBarTitle = '本次导入';

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

  const taskBarMeta = [
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
      title: taskBarTitle,
      localChips: taskBarMeta,
      actions: (
        <>
          {pendingCancelUpload ? (
            <>
              <button
                type="button"
                className="ui-action ui-action--danger"
                onClick={() => { cancelCurrentUpload(); setPendingCancelUpload(false); }}
              >
                清空本次导入
              </button>
              <button
                type="button"
                className="ui-action ui-action--quiet"
                onClick={() => setPendingCancelUpload(false)}
              >
                返回
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ui-action ui-action--quiet"
              onClick={() => setPendingCancelUpload(true)}
              title="取消导入并返回上传入口"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">取消导入</span>
              <span className="sm:hidden">取消</span>
            </button>
          )}
          <button
            type="button"
            className="ui-action ui-action--secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-4 w-4" />
            继续添加
          </button>
          <span data-testid="ingest-primary-cta" className="inline-flex">
            <WorkflowContinueInFlow className="min-w-[8.5rem] justify-center" />
          </span>
          {pendingDeleteId === activeTask.id ? (
            <>
              <button
                type="button"
                className="ui-action ui-action--danger"
                onClick={() => { deleteTask(activeTask.id); setPendingDeleteId(null); }}
              >
                确认移除
              </button>
              <button
                type="button"
                className="ui-action ui-action--quiet"
                onClick={() => setPendingDeleteId(null)}
              >
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ui-action ui-action--quiet"
              onClick={() => setPendingDeleteId(activeTask.id)}
              aria-label="移除当前字幕任务"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">移除</span>
            </button>
          )}
        </>
      ),
    });
    return () => setInfoBar(null);
  }, [
    activeTask,
    taskBarMeta,
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
    <div className="v4-panel ds-card relative flex h-full min-h-0 w-full max-w-[760px] flex-col gap-[var(--ds-gap-group)] lg:max-w-none">

      {/* Task tab switcher (if multiple tasks exist) */}
      {tasks.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--v4-line)] pb-2 scrollbar-none">
          {tasks.map(t => {
            const isActive = t.id === activeTask.id;
            return (
              <button
                key={t.id}
                className={`max-w-[220px] cursor-pointer truncate rounded-md border px-4 py-2 font-sans text-sm transition-all
                  ${isActive
                    ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] font-semibold text-[var(--v4-accent-strong)]'
                    : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)]'}`}
                onClick={() => selectTask(t.id)}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Inner pane scrolls; primary CTA lives in the task info bar */}
      <motion.div layoutScroll className="relative flex min-h-0 flex-1 flex-col gap-[var(--ds-gap-group)] overflow-x-visible overflow-y-auto pr-1 select-none scrollbar-thin">

        {needsTitleInput && (
          <div className="relative flex flex-shrink-0 items-center gap-2.5 rounded-lg border border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] px-3 py-2.5">
            <CircleAlert className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--v4-text)]">
              片名待确认，请补充后再命名
            </span>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--v4-accent)] px-2.5 text-xs font-semibold text-[var(--v4-accent-ink)]"
              onClick={() => setTmdbManualOpen(true)}
            >
              <Search className="h-4 w-4" />
              补充片名
            </button>
          </div>
        )}

        {/* Track bindings first — primary decision before naming/credits */}
        <div className="flex min-h-0 flex-col gap-[var(--ds-gap-section)] overflow-visible">
          <div className="ds-section relative overflow-visible">
            <div className="flex items-center gap-2">
              <h4 className="ds-head select-none">
                字幕序列
              </h4>
              <InfoHint label="字幕序列说明">
                选择要处理的字幕文件。双语单文件会自动识别；分开的主字幕与副字幕将按时间轴合并。同语种（含简繁）不能作为合轴对。
              </InfoHint>
              {activeTask.isBilingualSingle && (
                <span className="rd-chip rd-chip--tight text-[var(--v4-text-muted)]">
                  双语 · {zhCount} 行
                </span>
              )}
              {!activeTask.isBilingualSingle && activeTask.zh && activeTask.en && (
                <span className="ml-auto text-xs font-normal text-[var(--v4-text-faint)]">
                  拖动行尾手柄可对调主字幕与副字幕
                </span>
              )}
            </div>
            <div className="ds-well relative flex flex-col gap-[var(--ds-gap-item)] overflow-visible bg-[var(--v4-panel-muted)]">
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
                      className={`grid grid-cols-[7.25rem_minmax(0,1fr)_2rem] items-center gap-2 overflow-visible rounded-xl ${
                        isDropTarget ? 'bg-[var(--v4-accent-soft)] ring-1 ring-[var(--v4-accent)]/40' : ''
                      }`}
                    >
                      <span className="flex min-w-0 flex-col justify-center gap-0.5">
                        {label}
                      </span>
                      <motion.div
                        className="min-w-0"
                        {...(handoffObjects && file?.sourceObjectId
                          ? { layoutId: file.sourceObjectId, layout: 'position' as const, transition: { layout: HANDOFF_MOVE } }
                          : {})}
                        data-handoff-object={file?.sourceObjectId}
                      >
                        <TrackSelect
                          value={file?.id || ''}
                          options={trackOptions}
                          onChange={(id) => bindTrack(activeTask.id, trackKey, id)}
                          countLabel={file ? getSubTitleCount(file) : null}
                          placeholder={placeholder}
                        />
                      </motion.div>
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
                        aria-label={canReorderTracks ? `拖动以对调${trackKey === 'zh' ? '主字幕' : '副字幕'}顺序` : undefined}
                        title={canReorderTracks ? '按住拖动，对调主字幕与副字幕' : undefined}
                        className={`grid h-11 w-8 shrink-0 place-items-center rounded-md text-[var(--v4-text-muted)] transition-colors touch-none ${
                          canReorderTracks
                            ? 'cursor-grab hover:bg-[var(--v4-accent-soft)] hover:text-[var(--v4-text)] active:cursor-grabbing'
                            : 'cursor-default opacity-25'
                        }`}
                      >
                        <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
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
                        <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-[var(--v4-text-muted)]">
                          主字幕
                          <InfoHint label="主字幕说明" side="right">
                            主字幕默认使用简体或繁体中文（或中英双语单文件）。后续可选指定简中 / 繁中。
                          </InfoHint>
                        </span>
                        <span className="truncate text-[10px] font-normal leading-tight text-[var(--v4-text-faint)]">
                          默认中文
                        </span>
                      </>,
                      '选择中文或双语字幕',
                      zhRowRef,
                    )}

                    {!activeTask.isBilingualSingle ? (
                      <>
                        {renderPrimaryRow(
                          'en',
                          <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-[var(--v4-text-muted)]">
                            {secondaryLabel}
                            <InfoHint label="副字幕说明" side="right">
                              {secondaryHint}
                            </InfoHint>
                          </span>,
                          secondaryPlaceholder,
                          enRowRef,
                        )}

                        <div className="grid grid-cols-[7.25rem_minmax(0,1fr)_2rem] items-center gap-2 overflow-visible">
                          <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-[var(--v4-text-muted)]">
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
                            className="flex items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--v4-accent)]/40 bg-[var(--v4-panel-raised)] px-3 py-2.5 shadow-[var(--pt-elev-float)]"
                            style={{ height: dragCardSize.h }}
                          >
                            <FileFormatIcon name={dragFile.name} size="md" />
                            <LanguageMark lang={dragFile.lang} languagePair={dragFile.languagePair} />
                            <span className="min-w-0 flex-1 truncate font-mono text-sm text-[var(--v4-text)]">
                              {dragFile.name}
                            </span>
                            <span className="ui-meta shrink-0 font-mono text-xs">
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

          {showSameScriptWarning && (
            <div
              role="status"
              className="rounded-lg border border-[var(--v4-warning)]/30 bg-[var(--v4-warning)]/10 px-3 py-2.5 text-xs leading-5 text-[var(--v4-warning)]"
            >
              <p className="inline-flex items-start gap-1.5 font-semibold">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                当前像是两套中文主语言字幕，不是双语对
              </p>
              <p className="mt-1 text-[var(--v4-text-muted)]">
                请补上英语等副字幕再合轴；或取消副字幕，按单语整理/导出。简繁中文互为同语种，不能作为合轴对。
              </p>
            </div>
          )}

          {showChineseOnlyHint && (
            <p
              role="note"
              data-testid="chinese-only-hint"
              className="ds-meta inline-flex items-start gap-1.5 px-1"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                目前只有中文。想做双语，可以再拖入同一集的英语等字幕；不加也可以直接继续。
              </span>
            </p>
          )}
          {isSingleLanguage && !showChineseOnlyHint && (
            <p role="note" data-testid="single-language-hint" className="ds-meta inline-flex items-start gap-1.5 px-1">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>仅检测到一种语言，将按单语处理。如需双语，请添加同集另一语言的字幕。</span>
            </p>
          )}

          {/* 对齐方式：紧挨字幕序列，全宽双栏说明 */}
          {!activeTask.isBilingualSingle && !isSingleLanguage && (
            <div className="ds-section">
              <div className="flex items-center gap-1.5">
                <h4 className="ds-head">对齐方式</h4>
                <InfoHint label="对齐方式说明">
                  智能：按时间就近配对，孤立行多时自动改用精校。精校：完整对齐搜索，处理插入、删减与断句不一致，耗时更长。仅在两条分轨时生效。
                </InfoHint>
              </div>
              <div className="align-choice grid gap-[var(--ds-gap-item)] sm:grid-cols-2" role="radiogroup" aria-label="对齐方式">
                {([
                  { id: 'standard', label: '智能', hint: '速度快，适用于多数双语字幕' },
                  { id: 'industrial', label: '精校', hint: '耗时较长，适用于断句差异较大的字幕' },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={alignmentMode === option.id}
                    onClick={() => setAlignmentMode(option.id)}
                    className="align-choice__item v4-focus-ring"
                  >
                    <span className="ds-body font-semibold">{option.label}</span>
                    <span className="ds-meta">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Configuration & Process Dock — sticky when ASS style decision is present */}
          {foundAssStyle && (
          <div className="sticky bottom-0 z-10 flex flex-col gap-[var(--ds-gap-item)] overflow-visible border-t border-[var(--v4-line)] bg-[var(--v4-panel)] pt-[var(--ds-gap-group)]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--v4-line)] bg-[var(--v4-panel-muted)]"
            >
              <div className="grid gap-0 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)]">
                <AssStylePreview style={foundAssStyle} className="min-h-36 rounded-none border-0 border-b border-[var(--v4-line)] md:border-b-0 md:border-r" />
                <div className="flex min-w-0 flex-col justify-between gap-[var(--ds-gap-group)] p-[var(--ds-pad-card)]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Paintbrush className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />
                      <h5 className="text-sm font-semibold text-[var(--v4-text)]">源文件内嵌样式</h5>
                      {isFoundAssStyleApplied && (
                        <span className="ui-meta ui-meta--key gap-1">
                          <Check className="h-3 w-3" />
                          已用于导出
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--v4-text-muted)]">
                      预览来自当前 ASS 文件。字体按当前设备可用版本近似呈现。
                    </p>
                    <p className="ui-meta-row mt-3">
                      主字幕 {foundAssStyle.zhFontSize || '--'} px
                      <span aria-hidden="true"> · </span>
                      副字幕 {foundAssStyle.enFontSize || '--'} px
                    </p>
                  </div>

                  <p className="ds-meta">可在预览「样式」中选用「源文件内嵌样式」。</p>
                </div>
              </div>
            </motion.div>
          </div>
          )}

        </div>

      </motion.div>

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
