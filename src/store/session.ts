import type { StateCreator } from 'zustand';
import type { StudioState } from './types';
import { invalidateTmdbRequests } from './slices/mediaTmdb';

/**
 * Field resets used by cancelCurrentUpload.
 * Do not expand — pin tests lock this list (S3 cleanup later).
 */
export const CANCEL_UPLOAD_RESET = {
  workflowStep: 1,
  isIngestClearing: false,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown' as const,
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
  isLightsOff: false,
};

/**
 * Field resets used by restartSystem.
 * Do not expand — pin tests lock this list (S3 cleanup later).
 */
export const RESTART_SYSTEM_RESET = {
  workflowStep: 1,
  isIngestClearing: false,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown' as const,
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
  creditDeclaration: 'none' as const,
  creditPlacement: 'after-last' as const,
  creatorCredit: '',
  appendCreatorCredit: false,
};

export type SessionSlice = Pick<StudioState, 'cancelCurrentUpload' | 'restartSystem'>;

export const createSessionSlice: StateCreator<StudioState, [], [], SessionSlice> = (set, get) => ({
  cancelCurrentUpload: () => {
    invalidateTmdbRequests();
    set({ ...CANCEL_UPLOAD_RESET });
    get().addLog('已取消导入', 'info');
  },
  restartSystem: () => {
    invalidateTmdbRequests();
    set({ ...RESTART_SYSTEM_RESET });
    get().addLog('已重启工作流，准备新导入', 'info');
  },
});
