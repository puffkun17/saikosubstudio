import type { StateCreator } from 'zustand';
import { classifyLineKind } from '../../core/lineKinds';
import { applyLineKindOverride } from '../../core/workbenchReview';
import type { StudioState } from '../types';

export type WorkbenchSlice = Pick<
  StudioState,
  | 'previewIndex'
  | 'locateGroupIndexes'
  | 'jumpLineVal'
  | 'processedSubs'
  | 'showAllSubs'
  | 'showAssHint'
  | 'foundAssStyle'
  | 'refScreenshot'
  | 'detectedAttributions'
  | 'editHistory'
  | 'editFuture'
  | 'mergeReviewCheckedByTask'
  | 'setPreviewIndex'
  | 'setLocateGroupIndexes'
  | 'setJumpLineVal'
  | 'setProcessedSubs'
  | 'updateSubtitleText'
  | 'editSubtitleText'
  | 'undoSubtitleEdit'
  | 'redoSubtitleEdit'
  | 'setLineKind'
  | 'setMergeReviewChecked'
  | 'toggleMergeReviewChecked'
  | 'markMergeReviewChecked'
  | 'clearMergeReviewChecked'
  | 'setShowAllSubs'
  | 'setShowAssHint'
  | 'setRefScreenshot'
>;

/** Per-slice reset partial for cancelCurrentUpload / restartSystem (S3). */
export function resetWorkbench(kind: 'cancel' | 'restart'): Partial<StudioState> {
  const shared: Partial<StudioState> = {
    previewIndex: 0,
    locateGroupIndexes: [],
    processedSubs: null,
    showAllSubs: false,
    detectedAttributions: [],
    editHistory: [],
    editFuture: [],
    mergeReviewCheckedByTask: {},
  };
  // cancel also clears ASS hint state; restart historically left it alone.
  if (kind === 'cancel') {
    return { ...shared, showAssHint: false, foundAssStyle: null };
  }
  return shared;
}

export const createWorkbenchSlice: StateCreator<StudioState, [], [], WorkbenchSlice> = (set, get) => ({
  previewIndex: 0,
  locateGroupIndexes: [],
  jumpLineVal: '1',
  processedSubs: null,
  showAllSubs: false,
  showAssHint: false,
  foundAssStyle: null,
  refScreenshot: null,
  detectedAttributions: [],
  editHistory: [],
  editFuture: [],
  mergeReviewCheckedByTask: {},
  setPreviewIndex: (previewIndex) => set({ previewIndex }),
  setLocateGroupIndexes: (locateGroupIndexes) => set({ locateGroupIndexes }),
  setJumpLineVal: (jumpLineVal) => set({ jumpLineVal }),
  setProcessedSubs: (processedSubs) => {
    const currentPreview = get().previewIndex;
    let nextPreview = currentPreview;

    if (!processedSubs || processedSubs.length === 0) {
      nextPreview = 0;
    } else if (currentPreview < 0 || currentPreview >= processedSubs.length) {
      nextPreview = 0;
    }

    set({ 
      processedSubs, 
      previewIndex: nextPreview,
      jumpLineVal: String(nextPreview + 1)
    });
  },

  // 支持直接修改字幕文本
  updateSubtitleText: (index: number, text: string) => {
    const { processedSubs, previewIndex, addLog } = get();
    if (!processedSubs) {
      addLog("无法修改字幕：processedSubs 为空", "error");
      return;
    }

    const updated = processedSubs.map(s => 
      s.index === index ? { ...s, text } : s
    );

    // 如果修改的是当前预览的字幕，记录日志
    if (index - 1 === previewIndex) {
      addLog(`已更新第 ${index} 行字幕内容`, "success");
    }

    set({ processedSubs: updated });
  },

  editSubtitleText: (index, text) => {
    const { processedSubs } = get();
    const row = processedSubs?.find(s => s.index === index);
    if (!row || row.text === text) return;
    // 署名是内容：只有导入来源为「原创」时才可改（官方 / 转载锁定）。
    if (classifyLineKind(row) === 'credit' && !get().isOriginalWork) return;
    get().updateSubtitleText(index, text);
    set(state => ({
      editHistory: [...state.editHistory, { index, before: row.text, after: text }].slice(-50),
      editFuture: [],
    }));
  },

  setLineKind: (index, kind) => {
    const { processedSubs } = get();
    if (!processedSubs) return;
    const row = processedSubs.find((s) => s.index === index);
    if (!row) return;
    const next = applyLineKindOverride(row, kind);
    if (next === row) return;
    set({
      processedSubs: processedSubs.map((s) => (s.index === index ? next : s)),
    });
  },

  undoSubtitleEdit: () => {
    const { editHistory } = get();
    const record = editHistory[editHistory.length - 1];
    if (!record) return;
    get().updateSubtitleText(record.index, record.before);
    set(state => ({
      editHistory: state.editHistory.slice(0, -1),
      editFuture: [...state.editFuture, record],
    }));
  },

  redoSubtitleEdit: () => {
    const { editFuture } = get();
    const record = editFuture[editFuture.length - 1];
    if (!record) return;
    get().updateSubtitleText(record.index, record.after);
    set(state => ({
      editFuture: state.editFuture.slice(0, -1),
      editHistory: [...state.editHistory, record],
    }));
  },

  setMergeReviewChecked: (taskKey, ids) => {
    if (!taskKey) return;
    const unique = Array.from(new Set(ids));
    set(state => ({
      mergeReviewCheckedByTask: {
        ...state.mergeReviewCheckedByTask,
        [taskKey]: unique,
      },
    }));
  },

  toggleMergeReviewChecked: (taskKey, id) => {
    if (!taskKey || !id) return;
    set(state => {
      const current = state.mergeReviewCheckedByTask[taskKey] ?? [];
      const next = current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id];
      return {
        mergeReviewCheckedByTask: {
          ...state.mergeReviewCheckedByTask,
          [taskKey]: next,
        },
      };
    });
  },

  markMergeReviewChecked: (taskKey, id) => {
    if (!taskKey || !id) return;
    set(state => {
      const current = state.mergeReviewCheckedByTask[taskKey] ?? [];
      if (current.includes(id)) return state;
      return {
        mergeReviewCheckedByTask: {
          ...state.mergeReviewCheckedByTask,
          [taskKey]: [...current, id],
        },
      };
    });
  },

  clearMergeReviewChecked: (taskKey) => {
    if (!taskKey) {
      set({ mergeReviewCheckedByTask: {} });
      return;
    }
    set(state => {
      if (!(taskKey in state.mergeReviewCheckedByTask)) return state;
      const next = { ...state.mergeReviewCheckedByTask };
      delete next[taskKey];
      return { mergeReviewCheckedByTask: next };
    });
  },

  setShowAllSubs: (showAllSubs) => set({ showAllSubs }),
  setShowAssHint: (showAssHint) => set({ showAssHint }),
  setRefScreenshot: (refScreenshot) => set({ refScreenshot }),
});
