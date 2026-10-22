import { create } from 'zustand';
import { buildExportBaseFromMeta } from '../core/taskModel';
import type { StudioState } from './types';
import { createFeedbackSlice } from './slices/feedback';
import { createCreditSlice } from './slices/credit';
import { createStyleSlice } from './slices/style';
import { createTheaterSlice } from './slices/theater';
import { createHistorySlice } from './slices/history';
import { createWorkbenchSlice } from './slices/workbench';
import {
  createMediaTmdbSlice,
  invalidateTmdbRequests,
  taskDisplayTitle,
} from './slices/mediaTmdb';
import { createIngestSlice } from './slices/ingest';

export {
  CONTEXTUAL_NOTICE_IDS,
  INLINE_NOTICE_IDS,
  resolveNoticeChannel,
  type FeedbackAction,
  type FeedbackTone,
  type NoticeChannel,
  type StatusNotice,
} from '../core/noticeChannel';

export type {
  CreditDeclaration,
  LibraryItem,
  LogEntry,
  StudioState,
  Subfile,
  TaskPair,
  TmdbMetadata,
  TmdbSuggestion,
} from './types';

export { taskDisplayTitle };

/**
 * 导出文件名的唯一来源：手动名 > 视频文件名 > TMDB 原文名（+ 命名模式）> 字幕文件名。
 * 第二幕、导出面板、下载名、ASS Title 都读它。
 */
export function resolveExportBase(state: Pick<StudioState, 'customFilename' | 'filenameSource' | 'tmdbData' | 'filenameEpKey' | 'exportNameMode' | 'borrowedVideoName' | 'files'>): string {
  if (state.filenameSource === 'manual' && state.customFilename.trim()) return state.customFilename.trim();
  const trackStem = (state.files?.zh?.name || state.files?.en?.name || '').replace(/\.(srt|ass|ssa|vtt)$/i, '');
  return buildExportBaseFromMeta(state.tmdbData, state.filenameEpKey, state.exportNameMode, {
    videoName: state.borrowedVideoName,
    fallback: trackStem || 'subtitles',
  });
}

export const useStudioStore = create<StudioState>()((set, get, api) => ({
  ...createFeedbackSlice(set, get, api),
  ...createCreditSlice(set, get, api),
  ...createStyleSlice(set, get, api),
  ...createTheaterSlice(set, get, api),
  ...createHistorySlice(set, get, api),
  ...createWorkbenchSlice(set, get, api),
  ...createMediaTmdbSlice(set, get, api),
  ...createIngestSlice(set, get, api),
  cancelCurrentUpload: () => {
    invalidateTmdbRequests();
    set({
      workflowStep: 1,
      isIngestClearing: false,
      files: { zh: null, en: null, commentary: null },
      customFilename: '',
      filenameSource: 'unknown',
      uploadedFiles: [],
      tasks: [],
      selectedTaskId: null,
      tmdbData: null,
      tmdbBackdrop: null,
      tmdbBackdropList: [],
      tmdbSuggestions: [],
      tmdbAlternateSuggestion: null,
      selectedSuggestion: null,
      tmdbManualOpen: false,
      isSearchingTmdb: false,
      processedSubs: null,
      previewIndex: 0,
      showAllSubs: false,
      showAssHint: false,
      foundAssStyle: null,
      isProcessing: false,
      statusNotices: [],
      detectedAttributions: [],
      editHistory: [],
      editFuture: [],
      mergeReviewCheckedByTask: {},
      isLightsOff: false
    });
    get().addLog("已取消导入", "info");
  },
  restartSystem: () => {
    invalidateTmdbRequests();
    set({
      workflowStep: 1,
      isIngestClearing: false,
      files: { zh: null, en: null, commentary: null },
      customFilename: '',
      filenameSource: 'unknown',
      uploadedFiles: [],
      tasks: [],
      selectedTaskId: null,
      tmdbData: null,
      tmdbBackdrop: null,
      tmdbBackdropList: [],
      isTemplateLab: false,
      logs: [],
      statusNotices: [],
      previewIndex: 0,
      processedSubs: null,
      showAllSubs: false,
      detectedAttributions: [],
      editHistory: [],
      editFuture: [],
      mergeReviewCheckedByTask: {},
      isLightsOff: false,
      isOfficialSubtitle: false,
      isOriginalWork: false,
      creditDeclaration: 'none',
      creditPlacement: 'after-last',
      creatorCredit: '',
      appendCreatorCredit: false,
    });
    get().addLog("已重启工作流，准备新导入", "info");
  },
}));
