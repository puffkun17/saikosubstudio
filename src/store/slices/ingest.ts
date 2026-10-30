import type { StateCreator } from 'zustand';
import type { NamingMode } from '../../core/taskModel';
import { executeRecognitionJob } from '../../core/recognitionJob';
import { reviewTaskKey } from '../../core/reviewKey';
import { historyIdFor } from '../../core/identity';
import { mergeWorkerAvailable, runMergeJob, runMergeJobInThread } from '../../core/mergeClient';
import type { MergeJobEvent, MergeJobInput, MergeJobResult } from '../../core/mergeJob';
import { groupAndBindFiles } from '../../core/taskGrouping';
import { enterWorkbenchTransition } from '../../core/stageFlags';
import type { AlignmentFallbackInfo } from '../../utils/subtitleCore';
import {
  assessMediaIdentity,
  cleanFilename,
  extractStylesFromAss,
  extractSubtitleAttributions,
  parseMediaFilename,
  smartDetectTitle,
  isMainPathSecondaryLanguage,
} from '../../utils/subtitleCore';
import type { StudioState, Subfile, TmdbSearchOutcome } from '../types';
import { bumpTmdbSelectionRequestId, taskDisplayTitle } from './mediaTmdb';

const normalizeMediaIdentityTitle = (value: string) => cleanFilename(value).toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Auto TMDB match prepared by selectTask({ deferAutoMatch }) for the import ceremony.
 * Kept (not consumed) so the ceremony can retry; replaced on every selectTask.
 */
let deferredAutoMatch: {
  taskId: string;
  run: (options?: { ceremony?: boolean }) => Promise<TmdbSearchOutcome>;
} | null = null;

/** Bumped on each runSubtitleMerge so a slower earlier job cannot overwrite within the same task (S9). */
let mergeRequestId = 0;

const readStoredNameMode = (): NamingMode => {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('saiko_export_name_mode') : null;
    return v === 'zh+original' ? 'zh+original' : 'original';
  } catch { return 'original'; }
};

export type IngestSlice = Pick<
  StudioState,
  | 'workflowStep'
  | 'isIngestClearing'
  | 'files'
  | 'customFilename'
  | 'filenameSource'
  | 'filenameEpKey'
  | 'borrowedVideoName'
  | 'setBorrowedVideoName'
  | 'uploadedFiles'
  | 'tasks'
  | 'selectedTaskId'
  | 'isDragging'
  | 'isProcessing'
  | 'alignmentMode'
  | 'setAlignmentMode'
  | 'setWorkflowStep'
  | 'setIngestClearing'
  | 'setIsDragging'
  | 'setCustomFilename'
  | 'exportNameMode'
  | 'setExportNameMode'
  | 'setSelectedTaskId'
  | 'setTasks'
  | 'selectTask'
  | 'autoMatchTask'
  | 'bindTrack'
  | 'swapPrimaryTracks'
  | 'removeFileFromTask'
  | 'deleteTask'
  | 'processFiles'
  | 'switchEpisode'
  | 'runSubtitleMerge'
>;

/** Per-slice reset partial for cancelCurrentUpload / restartSystem (S3). */
export function resetIngest(_kind: 'cancel' | 'restart'): Partial<StudioState> {
  return {
    workflowStep: 1,
    isIngestClearing: false,
    files: { zh: null, en: null, commentary: null },
    customFilename: '',
    filenameSource: 'unknown',
    filenameEpKey: '',
    borrowedVideoName: null,
    uploadedFiles: [],
    tasks: [],
    selectedTaskId: null,
    isProcessing: false,
  };
}

export const createIngestSlice: StateCreator<StudioState, [], [], IngestSlice> = (set, get) => ({
  workflowStep: 1,
  isIngestClearing: false,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown',
  filenameEpKey: '',
  borrowedVideoName: null,
  setBorrowedVideoName: (borrowedVideoName) => set({ borrowedVideoName }),
  uploadedFiles: [],
  tasks: [],
  selectedTaskId: null,
  isDragging: false,
  isProcessing: false,
  alignmentMode: 'standard',
  setAlignmentMode: (alignmentMode) => {
    // Mode switch must not wipe ingest; only the next merge consumes the new mode.
    set({ alignmentMode });
  },
  setWorkflowStep: (step) => set({ workflowStep: step }),
  setIngestClearing: (isIngestClearing) => set({ isIngestClearing }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setCustomFilename: (customFilename, source = 'manual') => set({ customFilename, filenameSource: source }),
  exportNameMode: readStoredNameMode(),
  setExportNameMode: (exportNameMode) => {
    set({ exportNameMode });
    try { localStorage.setItem('saiko_export_name_mode', exportNameMode); } catch { /* ignore */ }
  },
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setTasks: (tasks) => set(state => {
    const nextTasks = typeof tasks === 'function' ? tasks(state.tasks) : tasks;
    return { tasks: nextTasks };
  }),
  autoMatchTask: async (taskId, options) => {
    const entry = deferredAutoMatch;
    if (!entry || entry.taskId !== taskId || get().selectedTaskId !== taskId) return { kind: 'skipped' };
    return entry.run(options);
  },
  selectTask: (taskId, opts) => {
    bumpTmdbSelectionRequestId();
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    const taskIdentityFile = task.files.find(file => assessMediaIdentity(file.name).shouldAutoSearchTmdb);
    const taskIdentity = taskIdentityFile ? assessMediaIdentity(taskIdentityFile.name) : null;
    const taskRelease = taskIdentityFile ? parseMediaFilename(taskIdentityFile.name) : null;
    const reusableTask = !task.tmdbData && taskIdentity?.title
      ? get().tasks.find(candidate => candidate.id !== task.id
        && candidate.tmdbData
        && candidate.files.some(file => {
          const candidateIdentity = assessMediaIdentity(file.name);
          const candidateRelease = parseMediaFilename(file.name);
          const sameTitle = normalizeMediaIdentityTitle(candidateIdentity.title) === normalizeMediaIdentityTitle(taskIdentity.title);
          const compatibleYear = !taskRelease?.year || !candidateRelease.year || taskRelease.year === candidateRelease.year;
          return sameTitle && compatibleYear;
        }))
      : undefined;
    const inheritedMetadata = reusableTask?.tmdbData || null;
    const inheritedBackdrop = reusableTask?.tmdbBackdrop || inheritedMetadata?.backdropUrl || null;
    const inheritedBackdrops = reusableTask?.tmdbBackdropList || (inheritedBackdrop ? [inheritedBackdrop] : []);
    const resolvedMeta = task.tmdbData || inheritedMetadata;
    // S8: drop in-flight search spinner on switch; deferred searchTmdb will re-arm if needed.
    set({
      selectedTaskId: taskId,
      files: { zh: task.zh, en: task.en, commentary: task.commentary },
      tmdbData: resolvedMeta,
      tmdbBackdrop: task.tmdbBackdrop || inheritedBackdrop,
      tmdbBackdropList: task.tmdbBackdropList || inheritedBackdrops,
      isSearchingTmdb: false,
      detectedAttributions: task.files.flatMap(file => extractSubtitleAttributions(file.text)).filter((item, index, all) =>
        all.findIndex(candidate => candidate.role === item.role && candidate.value.toLowerCase() === item.value.toLowerCase()) === index
      )
    });

    // 复用/已有片源时按当前集 epKey 重算导出名（手动填写过的不覆盖）
    if (resolvedMeta) {
      set((state) => {
        return {
          filenameEpKey: (task.epKey || '').toUpperCase(),
          tasks: state.tasks.map((candidate) =>
            candidate.id === taskId
              ? {
                  ...candidate,
                  title: taskDisplayTitle(resolvedMeta, task.epKey),
                  tmdbData: resolvedMeta,
                  tmdbBackdrop: candidate.tmdbBackdrop || inheritedBackdrop,
                  tmdbBackdropList: candidate.tmdbBackdropList?.length
                    ? candidate.tmdbBackdropList
                    : inheritedBackdrops,
                }
              : candidate,
          ),
        };
      });
    }
    
    const detectTitle = smartDetectTitle(
      task.zh?.name || '',
      task.en?.name || '',
      task.zh?.text || '',
      task.en?.text || ''
    );
    const fileIdentities = task.files.map(file => assessMediaIdentity(file.name));
    const identitySourceName = task.files.find(file => assessMediaIdentity(file.name).shouldAutoSearchTmdb)?.name
      || task.zh?.name
      || task.en?.name
      || task.files[0]?.name
      || '';
    const cleanedFromFiles = identitySourceName ? cleanFilename(identitySourceName) : '';
    const parsedTitle = fileIdentities.find(item => item.shouldAutoSearchTmdb);
    const detectedIdentity = detectTitle ? assessMediaIdentity(detectTitle) : null;
    const detectedTitle = detectedIdentity?.shouldAutoSearchTmdb ? cleanFilename(detectTitle) || detectedIdentity.title : '';
    // Export filename is filled via checklist checkboxes, not auto-seeded here.

    const cleanName = (cleanedFromFiles || detectedTitle || cleanFilename(parsedTitle?.title || '')).replace(/\.[^/.]+$/, "").trim();
    const identityParsed = identitySourceName ? parseMediaFilename(identitySourceName) : null;
    // Pre-fill type and season/episode if epKey exists
    let type = 'movie';
    let season = '1';
    let episode = '1';
    if (task.epKey) {
        type = 'tv';
        const match = task.epKey.match(/S(\d+)E(\d+)/i);
        if (match) {
            season = parseInt(match[1]).toString();
            episode = parseInt(match[2]).toString();
        } else {
            const sMatch = task.epKey.match(/S(\d+)/i);
            if (sMatch) season = parseInt(sMatch[1]).toString();
            // E-only keys (#02 anime releases) must keep their episode, never default to E01.
            const eMatch = task.epKey.match(/E(\d+)/i);
            if (eMatch) episode = parseInt(eMatch[1]).toString();
        }
    }
    set(state => ({
      tmdbManualInput: { 
         ...state.tmdbManualInput, 
         title: cleanName,
         type: type as 'tv' | 'movie',
         year: identityParsed?.year || state.tmdbManualInput.year,
         season,
         episode
      }
    }));

    deferredAutoMatch = null;
    if (!task.tmdbData && !inheritedMetadata && !get().tmdbData) {
      const runAutoMatch = async (options?: { ceremony?: boolean }): Promise<TmdbSearchOutcome> => {
        // Prefer the raw identity filename so Title.Year.SxxExx keeps its year in search.
        if (identitySourceName) {
          return get().searchTmdb(identitySourceName, { fallbackTitle: task.title, ceremony: options?.ceremony });
        }
        if (cleanName) {
          return get().searchTmdb(`${cleanName} ${task.epKey || ''}`.trim(), {
            fallbackTitle: task.title,
            ceremony: options?.ceremony,
          });
        }
        if (task.epKey) {
          set({ tmdbManualOpen: true });
          get().addLog(`已识别为 ${task.epKey}，请补充剧名以关联片源信息`, 'info');
        }
        return { kind: 'skipped' };
      };
      if (opts?.deferAutoMatch) {
        deferredAutoMatch = { taskId, run: runAutoMatch };
      } else {
        setTimeout(() => {
          void runAutoMatch();
        }, 50);
      }
    }

    const assFile = [task.zh, task.en].find(f => f && f.name.toLowerCase().endsWith('.ass'));
    if (assFile) {
      
      const minedStyle = extractStylesFromAss(assFile.text);
      if (minedStyle) {
        set({ 
          foundAssStyle: minedStyle, 
          showAssHint: true,
        });
        get().addLog('检测到文件内嵌 ASS 样式，可预览后决定是否采用', 'info');
      } else {
        set({ foundAssStyle: null, showAssHint: false });
      }
  } else {
      set({ foundAssStyle: null, showAssHint: false });
    }
  },
  bindTrack: (taskId, trackKey, fileId) => {
    const state = get();
    let blockedSecondary: { name: string; lang: string } | null = null;
    let syncFiles: StudioState['files'] | null = null;

    const nextTasks = state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const selectedFile = state.uploadedFiles.find((f) => f.id === fileId) || null;
      const updated = { ...t, [trackKey]: selectedFile };

      if (trackKey === 'zh') {
        updated.isBilingualSingle = selectedFile?.lang === 'bilingual';
        if (updated.isBilingualSingle) {
          updated.en = null;
        }
      } else if (trackKey === 'en') {
        updated.isBilingualSingle = false;
        // Manual 原文 bind: en, Latin-alphabet es/fr/pt/de/it, ja/ko. Do not silent-empty; explain others.
        if (selectedFile && !isMainPathSecondaryLanguage(selectedFile.lang)) {
          blockedSecondary = { name: selectedFile.name, lang: selectedFile.lang };
          updated.en = null;
        }
      }

      updated.status = (updated.isBilingualSingle && updated.zh) || (updated.zh && updated.en) ? 'paired' : 'unpaired';

      if (t.id === state.selectedTaskId) {
        syncFiles = { zh: updated.zh, en: updated.en, commentary: updated.commentary };
      }
      return updated;
    });

    set({ tasks: nextTasks });

    if (blockedSecondary) {
      const { name: blockedName, lang: blockedLang } = blockedSecondary;
      setTimeout(() => {
        get().setStatusNotice({
          id: 'secondary-bind-blocked',
          tone: 'notice',
          title: '副字幕未绑定',
          message: `「${blockedName}」语种为 ${blockedLang}，自动合轴副字幕支持英语、西语、法语、葡语、德语、意语、日语、韩语。请改选文件，或先纠正语种标签。`,
        });
      }, 0);
    }
    if (syncFiles) {
      const files = syncFiles;
      setTimeout(() => set({ files }), 0);
    }
  },
  swapPrimaryTracks: (taskId) => {
    const state = get();
    let syncFiles: StudioState['files'] | null = null;

    const nextTasks = state.tasks.map((task) => {
      if (task.id !== taskId || task.isBilingualSingle) return task;
      if (!task.zh || !task.en) return task;
      const updated = {
        ...task,
        zh: task.en,
        en: task.zh,
        isBilingualSingle: false,
        status: 'paired' as const,
      };
      if (task.id === state.selectedTaskId) {
        syncFiles = { zh: updated.zh, en: updated.en, commentary: updated.commentary };
      }
      return updated;
    });

    set({ tasks: nextTasks });
    if (syncFiles) {
      const files = syncFiles;
      setTimeout(() => set({ files }), 0);
    }
    get().addLog('已对调主字幕与副字幕', 'info');
  },
  removeFileFromTask: (taskId, fileIdOrName) => {
    const state = get();
    const matches = (f: { id: string; name: string }) => f.id === fileIdOrName || f.name === fileIdOrName;
    const removed = state.uploadedFiles.find(matches);
    const nextFiles = state.uploadedFiles.filter((f) => !matches(f));
    const nextTasks = state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const zh = t.zh && matches(t.zh) ? null : t.zh;
      const en = t.en && matches(t.en) ? null : t.en;
      const comm = t.commentary && matches(t.commentary) ? null : t.commentary;
      const updated = { ...t, zh, en, commentary: comm, files: t.files.filter((f) => !matches(f)) };
      updated.status = (updated.isBilingualSingle && updated.zh) || (updated.zh && updated.en) ? 'paired' : 'unpaired';
      return updated;
    }).filter((t) => t.zh || t.en || t.commentary);

    set({ uploadedFiles: nextFiles, tasks: nextTasks });
    get().addLog(`已移除文件: ${removed?.name || fileIdOrName}`, 'info');

    setTimeout(() => {
      if (nextTasks.length > 0) {
        const active = nextTasks.find((t) => t.id === state.selectedTaskId) || nextTasks[0];
        get().selectTask(active.id);
      } else {
        set({
          selectedTaskId: null,
          files: { zh: null, en: null, commentary: null },
          customFilename: '',
          filenameSource: 'unknown',
          borrowedVideoName: null,
          filenameEpKey: '',
        });
      }
    }, 0);
  },
  deleteTask: (taskId) => {
    const state = get();
    const taskToDelete = state.tasks.find((t) => t.id === taskId);
    if (!taskToDelete) return;
    const fileIdsToRemove = new Set((taskToDelete.files || []).map((f) => f.id));

    const nextFiles = state.uploadedFiles.filter((f) => !fileIdsToRemove.has(f.id));
    const nextTasks = state.tasks.filter((t) => t.id !== taskId);

    set({ uploadedFiles: nextFiles, tasks: nextTasks });
    get().addLog(`已删除任务: ${taskToDelete.title}`, 'info');

    setTimeout(() => {
      if (nextTasks.length > 0) {
        get().selectTask(nextTasks[0].id);
      } else {
        set({
          selectedTaskId: null,
          files: { zh: null, en: null, commentary: null },
          customFilename: '',
          filenameSource: 'unknown',
          borrowedVideoName: null,
          filenameEpKey: '',
        });
      }
    }, 0);
  },
  processFiles: (incomingFiles, opts) => {
    // Recognition pre-pass (ASS style-split + SDH). Prefer Worker via runRecognitionJob in UI,
    // then pass { recognized: true }. In-thread path keeps Node regression / tests sync.
    const newFiles = opts?.recognized
      ? incomingFiles
      : executeRecognitionJob(incomingFiles).files as Subfile[];
    const state = get();
    const { uploadedFiles, tasks, notices } = groupAndBindFiles({
      existingUploadedFiles: state.uploadedFiles,
      existingTasks: state.tasks,
      newFiles,
    });
    // Pure set() — notices / selectTask / addLog run after (S1).
    set({ uploadedFiles, tasks });

    notices.forEach((notice) => {
      setTimeout(() => get().setStatusNotice(notice), 0);
    });

    const selected = new Promise<string | null>((resolve) => {
      setTimeout(() => {
        if (tasks.length === 0) {
          resolve(null);
          return;
        }
        const activeId = get().selectedTaskId || tasks[0].id;
        get().selectTask(activeId, { deferAutoMatch: opts?.deferAutoMatch });
        resolve(activeId);
      }, 50);
    });

    get().addLog(`已加载/更新 ${newFiles.length} 个文件。当前文件总数: ${uploadedFiles.length}`, 'success');
    return selected;
  },
  switchEpisode: (taskId) => {
    const state = get();
    if (taskId === state.selectedTaskId) return;
    if (state.processedSubs && state.processedSubs.length > 0) state.saveToLibrary();
    state.selectTask(taskId);
    const saved = get().libraryList.find((item) => item.id === historyIdFor(taskId));
    if (saved) {
      set({ processedSubs: saved.subs, previewIndex: 0, workflowStep: 2, editHistory: [], editFuture: [] });
      return;
    }
    get().runSubtitleMerge();
  },
  runSubtitleMerge: () => {
    const { files, selectedTaskId, tasks } = get();
    const currentTask = tasks.find(t => t.id === selectedTaskId);
    if (!files.zh && !files.en) return;

    const requestId = ++mergeRequestId;
    const isCurrentMerge = () => requestId === mergeRequestId && get().selectedTaskId === selectedTaskId;

    const taskKey = reviewTaskKey(selectedTaskId, get().processedSubs);
    get().clearMergeReviewChecked(taskKey);
    set({ isProcessing: true, processedSubs: null });
    
    const notice = (info: AlignmentFallbackInfo, phase: 'primary' | 'auto-upgrade') => {
      if (!isCurrentMerge()) return;
      if (info.reason === 'banded') {
        get().setStatusNotice({
          id: 'alignment-banded',
          tone: 'notice',
          title: '已启用带状对齐',
          message: `字幕体量较大（约 ${Math.round(info.cells / 1_000_000)}M 对齐单元），使用带宽 ${((info.bandHalfWidth ?? 0) * 2) + 1} 的工业对齐以控制内存。`,
        });
        return;
      }
      if (phase === 'primary') {
        get().setStatusNotice({
          id: 'alignment-fallback',
          tone: 'notice',
          title: '已切换快速对齐',
          message: `字幕体量较大（约 ${Math.round(info.cells / 1_000_000)}M 对齐单元），已用低内存快速合并，建议人工复核时间轴。`,
        });
      }
    };
    // Parse + merge/alignment run in a native Web Worker (src/workers/merge.worker.ts);
    // the main thread only applies the result. In-thread (synchronous) when Workers are unavailable.
    const input: MergeJobInput = {
      zhText: files.zh?.text || '',
      enText: files.en?.text || '',
      commentaryText: files.commentary?.text || '',
      mode: get().alignmentMode,
      bilingualSingle: Boolean(currentTask?.isBilingualSingle && files.zh),
    };
    const onEvent = (event: MergeJobEvent) => {
      if (!isCurrentMerge()) return;
      if (event.type === 'log') get().addLog(event.msg, event.tone);
      else if (event.type === 'fallback') notice(event.info, event.phase);
      else if (event.type === 'auto-industrial') {
        get().setStatusNotice({
          id: 'alignment-auto-industrial',
          tone: 'notice',
          title: '已自动改用精校',
          message: '智能对齐出现较多未配对行，已在不重新导入的前提下改用精校对齐。',
        });
      }
    };
    const apply = (result: MergeJobResult) => {
      // Ignore stale results: task switch OR a newer merge started on the same task (S9).
      if (!isCurrentMerge()) return;
      const commit = () => {
        set({ processedSubs: result.rows, previewIndex: 0, workflowStep: 2, editHistory: [], editFuture: [] });
        // Clear save point: a finished merge is restorable from 存档 after reload / leaving /.
        get().saveToLibrary();
      };
      // Act 1 → Act 2（进入工作台）：只有这一处用 View Transition（plan B §5）。
      if (get().workflowStep === 1) enterWorkbenchTransition(commit);
      else commit();
    };
    const fail = (err: unknown) => {
      if (!isCurrentMerge()) return;
      const msg = err instanceof Error ? err.message : String(err);
      get().addLog(`[异常] 合并失败: ${msg}`, 'error');
    };
    if (!mergeWorkerAvailable()) {
      try { apply(runMergeJobInThread(input, onEvent)); } catch (err) { fail(err); } finally {
        if (requestId === mergeRequestId) set({ isProcessing: false });
      }
      return;
    }
    void runMergeJob(input, onEvent).then(apply).catch(fail).finally(() => {
      if (requestId === mergeRequestId) set({ isProcessing: false });
    });
  },
});
