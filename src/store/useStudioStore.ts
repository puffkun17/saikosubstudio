import { create } from 'zustand';
import { buildExportBaseFromMeta } from '../core/taskModel';
import type { StudioState } from './types';
import { createFeedbackSlice } from './slices/feedback';
import { createCreditSlice } from './slices/credit';
import { createStyleSlice } from './slices/style';
import { createTheaterSlice } from './slices/theater';
import { createHistorySlice } from './slices/history';
import { createWorkbenchSlice } from './slices/workbench';
import { createMediaTmdbSlice, taskDisplayTitle } from './slices/mediaTmdb';
import { createIngestSlice } from './slices/ingest';
import { createSessionSlice } from './session';

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
  ...createSessionSlice(set, get, api),
}));
