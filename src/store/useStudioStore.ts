import { create } from 'zustand';
import { parseEpisodeRef, episodeKeyOf } from '../core/episode';
import { cueTimesFromRows } from '../core/timelineAgreement';
import { buildExportBaseFromMeta, type NamingMode, type Task } from '../core/taskModel';
import { ERROR_CODES, codeErrorMessage, rememberErrorCode } from '../core/errorCodes';
import { DEFAULT_EXPORT_PRESET_ID, getExportPreset, type ExportPresetId } from '../utils/exportPresets';
import { DEFAULT_HDR_LEVEL, isHdrLevelId, type HdrLevelId } from '../utils/hdrPresets';
import { clearAllLocalData, deleteTask, listMerged, listTasks, purgeExpiredSources, purgeExpiredTasks, putHistoryEntry } from '../core/taskStore';
import { decideSameEpisode, type EpisodeCandidate } from '../core/sameEpisode';
import { historyIdFor, identityFromStorageKey, mintTaskId, workIdentityFromFileName } from '../core/identity';
import { titleKeyOf } from '../core/recognition';
import { executeRecognitionJob } from '../core/recognitionJob';
import { reviewTaskKey } from '../core/reviewKey';
import { classifyLineKind } from '../core/lineKinds';
import { applyLineKindOverride } from '../core/workbenchReview';
import type { LineKind } from '../utils/subtitleCore';
import { mergeWorkerAvailable, runMergeJob, runMergeJobInThread } from '../core/mergeClient';
import type { MergeJobEvent, MergeJobInput, MergeJobResult } from '../core/mergeJob';
import type { AlignmentFallbackInfo } from '../utils/subtitleCore';
import { entryTarget, listStyleEntries, snapshotForSave, stripContent, type StyleTemplateRecord } from '../utils/styleLibrary';
import { SubRow, StyleSettings, SubtitleAttribution, SubtitleLanguagePair, smartDetectTitle, mergeSubtitles, alignSubtitlesIndustrial, extractStylesFromAss, extractSubtitleAttributions, parseSubtitle, cleanFilename, normalizeSingleBilingualRows, parseMediaFilename, buildTmdbSearchQueries, assessMediaIdentity, isMainPathSecondaryLanguage, isEnglishSecondaryLanguage, isLatinSecondaryLanguage, mainPathPrimaryRank, mainPathSecondaryRank, estimateSubtitleCueCount, isSparseSecondaryTrack, measureMergeOrphanRate, isSdhOrCcSubtitleFilename } from '../utils/subtitleCore';
import { assessTvYearFit, parseSeasonNumber, parseYearToken, shouldDemoteBySeasonSpan } from '../utils/tmdbCandidateFit';
import { readJsonStorage, writeJsonStorage } from '../utils/localPersistence';
import { tmdbFetch } from '../services/tmdb';
import {
  compareTmdbRank,
  isHighConfidenceTmdbPick,
  popularityBoost,
  rankTmdbCandidates,
} from '../utils/tmdbSearchRank';

/** Stale keys from pre-downtime builds — cleared on boot, never hydrated. */
const STALE_LOCAL_KEYS = [
  'nexus_subtitle_library',
  'saiko_tmdb_api_key',
] as const;
const STYLE_STORAGE_KEY = 'nexus_subtitle_styles_v4';

const clearStaleLocalStorage = () => {
  if (typeof localStorage === 'undefined') return;
  for (const key of STALE_LOCAL_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};

/**
 * 样式持久化唯一出口：preset / style / templates 三者始终一起落盘，
 * 避免任何调用点单独覆盖（曾经 ControlDeck 写入 templates: [] 清空过用户模板）。
 */
const persistStyles = (state: {
  activePreset: string;
  customStyle: StyleSettings;
  customTemplates: CustomTemplate[];
}) => {
  if (typeof window === 'undefined') return;
  writeJsonStorage(STYLE_STORAGE_KEY, {
    preset: state.activePreset,
    style: state.customStyle,
    templates: state.customTemplates,
  });
};

export interface Subfile {
  id: string;
  name: string;
  text: string;
  lang: string;
  languagePair?: SubtitleLanguagePair;
  isBilingual: boolean;
  isCommentary: boolean;
  size: number;
  /** 导入来源：松散文件 / ZIP / RAR·7Z / 文件夹 */
  importSource?: 'file' | 'zip' | 'archive' | 'folder';
  /** Detected text encoding from decodeBuffer (e.g. gbk, utf-16le, utf-8). */
  encoding?: string;
  /** High = silent conversion; low = surface in import summary for review. */
  encodingConfidence?: 'high' | 'low';
  /** SDH detected from content ([sound] cues / SPEAKER: labels), not just the filename. */
  isSdh?: boolean;
  /** Virtual track split out of one bilingual ASS by style names (Dial_CH / Dial_JP). */
  derivedFrom?: { name: string; styles: string[] };
}

export interface TaskPair {
  id: string;
  title: string;
  epKey?: string;
  zh: Subfile | null;
  en: Subfile | null;
  commentary: Subfile | null;
  status: string;
  isBilingualSingle?: boolean;
  files: Subfile[];
  tmdbData?: TmdbMetadata | null;
  tmdbBackdrop?: string | null;
  tmdbBackdropList?: string[];
  /** Same-episode suggestion the user should confirm (core/sameEpisode). UI in PR #2. */
  mergeSuggestion?: { otherTaskId: string; score: number; reason: string };
}

export interface LibraryItem {
  id: string;
  name: string;
  date: string;
  subs: SubRow[];
  backdrop: string | null;
  backdropList?: string[] | null;
  customStyle: StyleSettings;
}

export interface LogEntry {
  id: number;
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error';
  fade: boolean;
}

export type FeedbackTone = 'message' | 'success' | 'notice' | 'warning' | 'alert';

export type FeedbackAction = 'openTmdbManual';

/** Toast = transient; inline = MessageBar in-step; contextual = owned by a surface. */
export type NoticeChannel = 'toast' | 'inline' | 'contextual';

export interface StatusNotice {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
  meta?: string;
  action?: FeedbackAction;
  actionLabel?: string;
  /** Override auto channel routing. */
  channel?: NoticeChannel;
  /** Toast auto-dismiss ms; ignored for inline/contextual. */
  durationMs?: number;
  createdAt: number;
}

/** Surface-owned notices — never also rendered in the toast dock or generic MessageBar. */
export const CONTEXTUAL_NOTICE_IDS = new Set([
  'media-match',
  'media-identity',
  'forward-action-blocked',
]);

/** Persistent in-step MessageBars (manual dismiss; errors assertive). */
export const INLINE_NOTICE_IDS = new Set([
  'import-attention',
  'same-script-pair-blocked',
]);

export function resolveNoticeChannel(notice: Pick<StatusNotice, 'id' | 'tone' | 'channel'>): NoticeChannel {
  if (notice.channel) return notice.channel;
  if (CONTEXTUAL_NOTICE_IDS.has(notice.id)) return 'contextual';
  if (INLINE_NOTICE_IDS.has(notice.id)) return 'inline';
  if (notice.id.startsWith('error-') || notice.tone === 'alert') return 'inline';
  return 'toast';
}

export interface TmdbMetadata {
  title: string;
  originalTitle: string;
  year: string;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  isAnime: boolean;
}

type TmdbMediaType = 'movie' | 'tv';

export type TmdbSuggestion = {
  id: number;
  media_type?: TmdbMediaType;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  overview?: string;
  known_for_department?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
};

type TmdbDetails = {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  genres?: Array<{ name: string }>;
  alternative_titles?: {
    results?: Array<{ iso_3166_1?: string; title?: string }>;
    titles?: Array<{ iso_3166_1?: string; title?: string }>;
  };
};

type TmdbImages = {
  backdrops?: Array<{ file_path?: string }>;
  stills?: Array<{ file_path?: string }>;
};

type TmdbManualInput = { title: string; year: string; type: TmdbMediaType; season: string; episode: string };
type FilenameSource = 'auto' | 'tmdb' | 'manual' | 'library' | 'unknown';
/** 署名声明：导出 ASS 时写入 Script Info。 */
export type CreditDeclaration = 'none' | 'original' | 'ai-assisted' | 'translated';
type TmdbConfirmationAction = 'auto_apply' | 'require_confirmation' | 'reject';

type TmdbConfirmationDecision = {
  action: TmdbConfirmationAction;
  score: number;
  reasons: string[];
};

type CustomTemplate = StyleTemplateRecord;

type SubtitleEditRecord = {
  index: number;
  before: string;
  after: string;
};

export interface StudioState {
  workflowStep: number;
  isIngestClearing: boolean;
  files: { zh: Subfile | null; en: Subfile | null; commentary: Subfile | null };
  customFilename: string;
  filenameSource: FilenameSource;
  /** SxxEyy of the current task, for export naming. */
  filenameEpKey: string;
  /** Video dropped in Act 1: only its filename is borrowed for export naming. */
  borrowedVideoName: string | null;
  setBorrowedVideoName: (name: string | null) => void;
  uploadedFiles: Subfile[];
  tasks: TaskPair[];
  selectedTaskId: string | null;
  libraryList: LibraryItem[];
  isLibraryOpen: boolean;
  tmdbData: TmdbMetadata | null;
  tmdbBackdrop: string | null;
  isSearchingTmdb: boolean;
  isTemplateLab: boolean;
  customStyle: StyleSettings;
  customTemplates: CustomTemplate[];
  logs: LogEntry[];
  statusNotices: StatusNotice[];
  previewIndex: number;
  /** 0-based row indexes highlighted as a locate group (review queue / coverage group). */
  locateGroupIndexes: number[];
  /** Continuous preview clock in ms (drives fade / playhead). */
  previewClockMs: number;
  isPreviewPlaying: boolean;
  sceneBackground: string;
  theaterAspect: string;
  showGuides: boolean;
  lang: 'zh' | 'en';
  jumpLineVal: string;
  tmdbManualOpen: boolean;
  tmdbManualInput: TmdbManualInput;
  tmdbSuggestions: TmdbSuggestion[];
  /** 同名季跨度优选后的另一候选（最多 1 条，供「更换候选」切换，不新增搜索）。 */
  tmdbAlternateSuggestion: TmdbSuggestion | null;
  selectedSuggestion: TmdbSuggestion | null;
  isSettingsOpen: boolean;
  activePreset: string;
  isProcessing: boolean;
  processedSubs: SubRow[] | null;
  showAllSubs: boolean;
  isDragging: boolean;
  tempShowGuides: boolean;
  showAssHint: boolean;
  foundAssStyle: Partial<StyleSettings> | null;
  refScreenshot: string | null;
  tmdbBackdropList: string[];
  alignmentMode: 'standard' | 'industrial';
  detectedAttributions: SubtitleAttribution[];
  creatorCredit: string;
  appendCreatorCredit: boolean;
  /** Formal credits (翻译：…) stay on the timeline. Deep switch only; off = moved to the end, still credited. */
  keepOriginalCredit: boolean;
  setKeepOriginalCredit: (keep: boolean) => void;
  /** 本批导入是否标记为官方字幕（写入 ASS 声明）。 */
  isOfficialSubtitle: boolean;
  /** 导入来源「原创」：默认关；只有开启时第二幕才能编辑署名（保留 / 改字）。与「官方」互斥。 */
  isOriginalWork: boolean;
  setIsOriginalWork: (on: boolean) => void;
  /** 制作声明：写入 ASS Script Info 前缀。 */
  creditDeclaration: CreditDeclaration;
  /** 字幕后署名时间位置。 */
  creditPlacement: 'after-last' | 'before-end';
  /** 放映厅关灯模式：压暗全局界面，只保留放映区。 */
  isLightsOff: boolean;
  /** 字幕文本编辑历史（跨组件持久，抽屉开关不丢栈）。 */
  editHistory: SubtitleEditRecord[];
  editFuture: SubtitleEditRecord[];
  /**
   * Session-scoped merge-review checked ids, keyed by taskId (or filename fallback).
   * Survives closing the detail panel; cleared on task clear / restart / remarge.
   */
  mergeReviewCheckedByTask: Record<string, string[]>;

  // Actions
  setAlignmentMode: (mode: 'standard' | 'industrial') => void;
  setCreatorCredit: (credit: string) => void;
  setAppendCreatorCredit: (enabled: boolean) => void;
  setIsOfficialSubtitle: (official: boolean) => void;
  setCreditDeclaration: (declaration: CreditDeclaration) => void;
  setCreditPlacement: (placement: 'after-last' | 'before-end') => void;
  setLibraryOpen: (open: boolean) => void;
  setWorkflowStep: (step: number) => void;
  setIngestClearing: (clearing: boolean) => void;
  setLang: (lang: 'zh' | 'en') => void;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
  clearLogs: () => void;
  setStatusNotice: (notice: Omit<StatusNotice, 'createdAt'>) => void;
  dismissStatusNotice: (id: string) => void;
  clearStatusNotices: () => void;
  setIsDragging: (isDragging: boolean) => void;
  setCustomFilename: (name: string, source?: FilenameSource) => void;
  /** 导出命名模式（原文名 / 中文 + 原文名），全局并持久化。 */
  exportNameMode: NamingMode;
  setExportNameMode: (mode: NamingMode) => void;
  setSelectedTaskId: (id: string | null) => void;
  setTmdbData: (data: TmdbMetadata | null) => void;
  setTmdbBackdrop: (url: string | null) => void;
  setIsTemplateLab: (val: boolean) => void;
  setCustomStyle: (style: StyleSettings) => void;
  saveCustomTemplate: (name: string, opts?: { styles: Partial<StyleSettings>; source?: StyleTemplateRecord['source'] }) => void;
  /** Select an entry of the unified 「样式」 list (fixed preset, saved, imported, source). Also used for 重置. */
  applyStyleEntry: (id: string) => void;
  deleteCustomTemplate: (id: string) => void;
  setPreviewIndex: (idx: number) => void;
  setLocateGroupIndexes: (indexes: number[]) => void;
  setPreviewClockMs: (ms: number) => void;
  setIsPreviewPlaying: (playing: boolean) => void;
  setSceneBackground: (bg: string) => void;
  setTheaterAspect: (aspect: string) => void;
  setShowGuides: (val: boolean) => void;
  setTempShowGuides: (val: boolean) => void;
  setJumpLineVal: (val: string) => void;
  setTmdbManualOpen: (val: boolean) => void;
  setTmdbManualInput: (input: TmdbManualInput) => void;
  setTmdbSuggestions: (list: TmdbSuggestion[]) => void;
  setSelectedSuggestion: (s: TmdbSuggestion | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setActivePreset: (preset: string) => void;
  setProcessedSubs: (subs: SubRow[] | null) => void;
  updateSubtitleText: (index: number, text: string) => void;
  /** 编辑并记录历史（供撤销/重做）。 */
  editSubtitleText: (index: number, text: string) => void;
  undoSubtitleEdit: () => void;
  redoSubtitleEdit: () => void;
  /** Override a row's line classification (工作台「类别待定」确认). */
  setLineKind: (index: number, kind: Exclude<LineKind, 'credit'>) => void;
  setMergeReviewChecked: (taskKey: string, ids: string[]) => void;
  toggleMergeReviewChecked: (taskKey: string, id: string) => void;
  markMergeReviewChecked: (taskKey: string, id: string) => void;
  clearMergeReviewChecked: (taskKey?: string) => void;
  setLightsOff: (on: boolean) => void;
  setShowAllSubs: (show: boolean) => void;
  setShowAssHint: (val: boolean) => void;
  setTasks: (tasks: TaskPair[] | ((prev: TaskPair[]) => TaskPair[])) => void;
  setRefScreenshot: (url: string | null) => void;
  triggerTempGuides: () => void;
  searchTmdb: (query: string, options?: { silent?: boolean; fallbackTitle?: string }) => Promise<void>;
  searchTmdbManual: (query: string, type: TmdbMediaType, year: string) => Promise<void>;
  selectTmdbSuggestion: (s: TmdbSuggestion, options?: { silent?: boolean }) => Promise<void>;
  /** 在当前片源与已缓存的同名备选之间切换（不重新搜索）。 */
  swapTmdbAlternate: () => Promise<void>;
  shuffleBackdrop: () => void;
  
  // Complex Workflows
  initializeLibrary: () => void;
  selectTask: (taskId: string) => void;
  bindTrack: (taskId: string, trackKey: 'zh' | 'en' | 'commentary', fileId: string) => void;
  swapPrimaryTracks: (taskId: string) => void;
  removeFileFromTask: (taskId: string, fileName: string) => void;
  deleteTask: (taskId: string) => void;
  cancelCurrentUpload: () => void;
  saveToLibrary: () => void;
  clearHistory: () => Promise<void>;
  historyReady: boolean;
  /** Unified preset (spec: preview == export). Shared by the preview toolbar and the export menu. */
  exportPresetId: ExportPresetId;
  setExportPresetId: (id: ExportPresetId) => void;
  /**
   * Edits made in 样式参数 while a fixed preset (libass / 深蓝描边) is selected. Layered on top of the
   * preset so sliders always take effect, in preview AND export. Cleared when another preset is picked.
   */
  styleOverrides: Partial<StyleSettings>;
  setStyleOverrides: (patch: Partial<StyleSettings>) => void;
  /** HDR copy: on/off + level; the preview dims fills the same way the HDR export does. */
  hdrEnabled: boolean;
  hdrLevel: HdrLevelId;
  setHdr: (enabled: boolean, level?: HdrLevelId) => void;
  deleteFromLibrary: (id: string) => void;
  loadFromLibrary: (item: LibraryItem) => void;
  /**
   * Group/bind imported files into tasks. Recognition (ASS split / SDH) is sync in-thread here;
   * UI callers should `await runRecognitionJob` then pass `{ recognized: true }` so the Worker
   * did the heavy work off the main thread (ceremony timing unchanged).
   */
  processFiles: (files: Subfile[], opts?: { recognized?: boolean }) => void;
  runSubtitleMerge: () => void;
  /** Workbench episode tabs: keep this episode's result, open the other one (saved result or fresh merge). */
  switchEpisode: (taskId: string) => void;
  restartSystem: () => void;
}

let tempShowTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tmdbSearchRequestId = 0;
let tmdbSelectionRequestId = 0;

const TMDB_CLIENT_CACHE_TTL_MS = 5 * 60_000;
const tmdbClientCache = new Map<string, { expiresAt: number; results: TmdbSuggestion[] }>();

const normalizeMediaIdentityTitle = (value: string) => cleanFilename(value).toLowerCase().replace(/\s+/g, ' ').trim();

const libraryItemToTask = (item: LibraryItem): Task => {
  const now = Date.now();
  return {
    id: item.id,
    createdAt: now,
    updatedAt: now,
    stage: 'merged',
    episode: { season: null, episode: null },
    name: { value: item.name, state: 'locked' },
    exportBaseName: { value: item.name.replace(/\s+/g, '.'), state: 'locked' },
    slots: [],
    singleLanguage: !item.subs.some((row) => row.text.includes('\n')),
    review: [],
  };
};

/** Load history from IndexedDB (purge first). Null when IndexedDB is unavailable. Schema upgrades wipe prior data. */
const loadHistoryFromIdb = async (): Promise<LibraryItem[] | null> => {
  try {
    await purgeExpiredTasks();
    await purgeExpiredSources();
    const [tasks, merged] = await Promise.all([listTasks(), listMerged()]);
    const byId = new Map(merged.map((m) => [m.taskId, m]));
    const list: LibraryItem[] = tasks.flatMap((task) => {
      const m = byId.get(task.id);
      if (!m || !Array.isArray(m.rows) || m.rows.length === 0) return [];
      const extra = (m.extra || {}) as { backdrop?: string | null; backdropList?: string[] | null; customStyle?: StyleSettings | null };
      return [{
        id: historyIdFor(task.id),
        name: task.name.value,
        date: new Date(task.updatedAt).toLocaleString('zh-CN', { hour12: false }),
        subs: m.rows as SubRow[],
        backdrop: extra.backdrop ?? null,
        backdropList: extra.backdropList ?? null,
        customStyle: (extra.customStyle ?? useStudioStore.getState().customStyle) as StyleSettings,
      }];
    });
    return list;
  } catch {
    return null;
  }
};


const episodeCandidateCache = new WeakMap<Subfile, EpisodeCandidate>();
/** Reuses the parsed timeline per file (first few dozen cues only). */
const episodeCandidateOf = (file: Subfile): EpisodeCandidate => {
  const hit = episodeCandidateCache.get(file);
  if (hit) return hit;
  const cand: EpisodeCandidate = {
    ep: parseEpisodeRef(file.name),
    titleKey: titleKeyOf(file.name),
    times: cueTimesFromRows(parseSubtitle(file.text).slice(0, 160)),
  };
  episodeCandidateCache.set(file, cand);
  return cand;
};

/** 任务显示名（第二幕底栏、标签）：中文片名 + 集号，例如「幸运女神 S01E01」。不是文件名。 */
export const taskDisplayTitle = (meta: { title: string; originalTitle?: string } | null | undefined, episodeKey?: string): string =>
  [meta?.title || meta?.originalTitle || '', (episodeKey || '').toUpperCase()].filter(Boolean).join(' ');

const readStoredNameMode = (): NamingMode => {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('saiko_export_name_mode') : null;
    return v === 'zh+original' ? 'zh+original' : 'original';
  } catch { return 'original'; }
};

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

export const useStudioStore = create<StudioState>((set, get) => ({
  workflowStep: 1,
  isIngestClearing: false,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown',
  filenameEpKey: '',
  borrowedVideoName: null,
  historyReady: false,
  exportPresetId: DEFAULT_EXPORT_PRESET_ID,
  setExportPresetId: (exportPresetId) => {
    set({ exportPresetId, styleOverrides: {} });
    try {
      localStorage.setItem('saiko_export_preset', exportPresetId);
      localStorage.removeItem('saiko_style_overrides');
    } catch { /* ignore */ }
  },
  styleOverrides: {},
  setStyleOverrides: (patch) => {
    const styleOverrides = { ...get().styleOverrides, ...patch };
    set({ styleOverrides });
    try { localStorage.setItem('saiko_style_overrides', JSON.stringify(styleOverrides)); } catch { /* ignore */ }
  },
  hdrEnabled: false,
  hdrLevel: DEFAULT_HDR_LEVEL,
  setHdr: (hdrEnabled, level) => {
    const hdrLevel = level ?? get().hdrLevel;
    set({ hdrEnabled, hdrLevel });
    try { localStorage.setItem('saiko_export_hdr', hdrEnabled ? hdrLevel : `off:${hdrLevel}`); } catch { /* ignore */ }
  },
  setBorrowedVideoName: (borrowedVideoName) => set({ borrowedVideoName }),
  uploadedFiles: [],
  tasks: [],
  selectedTaskId: null,
  libraryList: [],
  isLibraryOpen: false,
  tmdbData: null,
  tmdbBackdrop: null,
  tmdbBackdropList: [],
  isTemplateLab: false,
  customStyle: {
    zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20, resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', auxiliaryMode: 'keep',
    // 字体家族默认（系统级，跨平台较稳）
    zhFontFamily: 'system-ui, sans-serif',
    enFontFamily: 'Helvetica Neue, Arial, sans-serif'
  },
  customTemplates: [],
  logs: [],
  statusNotices: [],
  previewIndex: 0,
  locateGroupIndexes: [],
  previewClockMs: 0,
  isPreviewPlaying: false,
  sceneBackground: 'cinema',
  theaterAspect: '16:9',
  showGuides: false,
  lang: 'zh',
  jumpLineVal: '1',
  tmdbManualOpen: false,
  tmdbManualInput: { title: '', year: '', type: 'movie', season: '1', episode: '1' },
  tmdbSuggestions: [],
  tmdbAlternateSuggestion: null,
  selectedSuggestion: null,
  isSettingsOpen: false,
  activePreset: 'classic',
  isProcessing: false,
  processedSubs: null,
  showAllSubs: false,
  isDragging: false,
  tempShowGuides: false,
  showAssHint: false,
  foundAssStyle: null,
  refScreenshot: null,
  isSearchingTmdb: false,
  alignmentMode: 'standard',
  detectedAttributions: [],
  creatorCredit: '',
  appendCreatorCredit: false,
  keepOriginalCredit: true,
  setKeepOriginalCredit: (keepOriginalCredit) => set({ keepOriginalCredit }),
  isOfficialSubtitle: false,
  isOriginalWork: false,
  creditDeclaration: 'none',
  creditPlacement: 'after-last',
  isLightsOff: false,
  editHistory: [],
  editFuture: [],
  mergeReviewCheckedByTask: {},

  setAlignmentMode: (alignmentMode) => {
    // Mode switch must not wipe ingest; only the next merge consumes the new mode.
    set({ alignmentMode });
  },
  setCreatorCredit: (creatorCredit) => set({ creatorCredit }),
  setAppendCreatorCredit: (appendCreatorCredit) => set({ appendCreatorCredit }),
  setIsOfficialSubtitle: (isOfficialSubtitle) => set((state) => ({ isOfficialSubtitle, isOriginalWork: isOfficialSubtitle ? false : state.isOriginalWork })),
  setIsOriginalWork: (isOriginalWork) => set((state) => ({
    isOriginalWork,
    isOfficialSubtitle: isOriginalWork ? false : state.isOfficialSubtitle,
    // 原创关闭时，我的署名一并撤下（署名只在原创下可编辑）。
    appendCreatorCredit: isOriginalWork ? state.appendCreatorCredit : false,
    creditDeclaration: isOriginalWork ? 'original' : 'none',
  })),
  setCreditDeclaration: (creditDeclaration) => set({ creditDeclaration }),
  setCreditPlacement: (creditPlacement) => set({ creditPlacement }),
  setLibraryOpen: (isLibraryOpen) => set({ isLibraryOpen }),
  setWorkflowStep: (step) => set({ workflowStep: step }),
  setIngestClearing: (isIngestClearing) => set({ isIngestClearing }),
  setLang: (lang) => set({ lang }),
  addLog: (rawMsg, type = 'info') => {
    const msg = type === 'error' ? codeErrorMessage(rawMsg) : rawMsg;
    if (type === 'error') {
      // Errors stay until closed (decided A9): what happened + what to do + E-xx for feedback.
      const code = rememberErrorCode(msg);
      get().setStatusNotice({
        id: `error-${code ?? 'x'}`,
        tone: 'alert',
        title: code ? `${ERROR_CODES[code]}（${code}）` : '出错了',
        message: `${msg.replace(/^\[E-\d{2}\]\s*/, '')}${code ? ' · 反馈时可附上这个代码' : ''}`,
      });
    }
    const id = Date.now() + Math.random();
    const time = new Date().toLocaleTimeString();
    set(state => ({
      logs: [...state.logs.slice(-2), { id, time, msg, type, fade: false }]
    }));
    setTimeout(() => {
      set(state => ({
        logs: state.logs.map(l => l.id === id ? { ...l, fade: true } : l)
      }));
    }, 4200);
    setTimeout(() => {
      set(state => ({
        logs: state.logs.filter(l => l.id !== id)
      }));
    }, 5000);
  },
  clearLogs: () => set({ logs: [] }),
  setStatusNotice: (notice) => {
    set(state => {
      const nextNotice: StatusNotice = { ...notice, createdAt: Date.now() };
      const channel = resolveNoticeChannel(nextNotice);
      const existing = state.statusNotices.filter(item => item.id !== notice.id);
      // Cap toast stack at 3; inline/contextual are not stacked in the toaster.
      if (channel === 'toast') {
        const otherToasts = existing.filter((item) => resolveNoticeChannel(item) === 'toast');
        const nonToasts = existing.filter((item) => resolveNoticeChannel(item) !== 'toast');
        const toasts = [...otherToasts, nextNotice].slice(-3);
        return { statusNotices: [...nonToasts, ...toasts] };
      }
      return { statusNotices: [...existing, nextNotice] };
    });
  },
  dismissStatusNotice: (id) => set(state => ({
    statusNotices: state.statusNotices.filter(item => item.id !== id)
  })),
  clearStatusNotices: () => set({ statusNotices: [] }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setCustomFilename: (customFilename, source = 'manual') => set({ customFilename, filenameSource: source }),
  exportNameMode: readStoredNameMode(),
  setExportNameMode: (exportNameMode) => {
    set({ exportNameMode });
    try { localStorage.setItem('saiko_export_name_mode', exportNameMode); } catch { /* ignore */ }
  },
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setTmdbData: (tmdbData) => set({ tmdbData }),
  setTmdbBackdrop: (tmdbBackdrop) => set({ tmdbBackdrop }),

  shuffleBackdrop: () => {
    const { tmdbBackdropList, tmdbBackdrop, selectedTaskId } = get();
    if (!tmdbBackdropList || tmdbBackdropList.length <= 1) {
      get().addLog("当前影视没有其他备用剧照可选", "info");
      return;
    }
    let available = tmdbBackdropList.filter((url: string) => url !== tmdbBackdrop);
    if (available.length === 0) available = tmdbBackdropList;
    
    const randIdx = Math.floor(Math.random() * available.length);
    const nextBackdrop = available[randIdx];
    
    set({ tmdbBackdrop: nextBackdrop });
    if (selectedTaskId) {
      set(state => ({
        tasks: state.tasks.map(t => t.id === selectedTaskId ? { ...t, tmdbBackdrop: nextBackdrop } : t)
      }));
    }
    get().addLog("已更换背景图", "success");
  },
  setIsTemplateLab: (isTemplateLab) => set({ isTemplateLab }),
  setCustomStyle: (customStyle) => {
    set({ customStyle });
    persistStyles(get());
  },
  saveCustomTemplate: (name, opts) => {
    const state = get();
    const snap = opts
      ? { presetId: 'current' as ExportPresetId, styles: stripContent(opts.styles) }
      : snapshotForSave(state.customStyle, state.exportPresetId, state.styleOverrides);
    const newTemplate: CustomTemplate = { id: `tpl_${Date.now()}`, name, ...snap, source: opts?.source ?? 'saved' };
    set({ customTemplates: [...state.customTemplates, newTemplate] });
    get().applyStyleEntry(newTemplate.id);
  },
  applyStyleEntry: (id) => {
    const state = get();
    const entry = listStyleEntries(state.customTemplates, state.foundAssStyle).find((e) => e.id === id);
    if (!entry) return;
    const target = entryTarget(entry, state.customStyle);
    set({ ...target, activePreset: id });
    try {
      localStorage.setItem('saiko_export_preset', target.exportPresetId);
      localStorage.setItem('saiko_style_overrides', JSON.stringify(target.styleOverrides));
    } catch { /* ignore */ }
    persistStyles(get());
  },
  deleteCustomTemplate: (id) => {
    set((state) => {
      const newTemplates = state.customTemplates.filter(t => t.id !== id);
      return { customTemplates: newTemplates, activePreset: state.activePreset === id ? 'classic' : state.activePreset };
    });
    persistStyles(get());
  },
  setActivePreset: (activePreset) => {
    set({ activePreset });
    persistStyles(get());
  },
  setPreviewIndex: (previewIndex) => set({ previewIndex }),
  setLocateGroupIndexes: (locateGroupIndexes) => set({ locateGroupIndexes }),
  setPreviewClockMs: (previewClockMs) => set({ previewClockMs }),
  setIsPreviewPlaying: (isPreviewPlaying) => set({ isPreviewPlaying }),
  setSceneBackground: (sceneBackground) => set({ sceneBackground }),
  // 画幅只影响预览取景，不写入导出样式（导出画面规格由样式决定）。
  setTheaterAspect: (theaterAspect) => set({ theaterAspect }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setTempShowGuides: (tempShowGuides) => set({ tempShowGuides }),
  setJumpLineVal: (jumpLineVal) => set({ jumpLineVal }),
  setTmdbManualOpen: (tmdbManualOpen) => set({ tmdbManualOpen }),
  setTmdbManualInput: (tmdbManualInput) => set({ tmdbManualInput }),
  setTmdbSuggestions: (tmdbSuggestions) => set({ tmdbSuggestions }),
  setSelectedSuggestion: (selectedSuggestion) => set({ selectedSuggestion }),
  swapTmdbAlternate: async () => {
    const alternate = get().tmdbAlternateSuggestion;
    const current = get().selectedSuggestion;
    if (!alternate) {
      get().setStatusNotice({
        id: 'media-match',
        tone: 'notice',
        title: '没有可切换的候选',
        message: '当前没有缓存的同名备选，可打开手动检索查看更多结果。',
        action: 'openTmdbManual',
        actionLabel: '手动检索',
      });
      return;
    }
    // 互换：当前变为备选，备选上屏（仅详情拉取，不再 search）
    set({ tmdbAlternateSuggestion: current });
    get().addLog('正在切换同名备选片源', 'info');
    await get().selectTmdbSuggestion(alternate, { silent: false });
    const nextCurrent = get().selectedSuggestion;
    const nextAlt = get().tmdbAlternateSuggestion;
    const pair = [nextCurrent, nextAlt].filter(Boolean) as TmdbSuggestion[];
    const unique = pair.filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index).slice(0, 2);
    if (unique.length > 0) set({ tmdbSuggestions: unique });
  },
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
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

  setLightsOff: (isLightsOff) => set({ isLightsOff }),
  setShowAllSubs: (showAllSubs) => set({ showAllSubs }),
  setShowAssHint: (showAssHint) => set({ showAssHint }),
  setTasks: (tasks) => set(state => {
    const nextTasks = typeof tasks === 'function' ? tasks(state.tasks) : tasks;
    return { tasks: nextTasks };
  }),
  setRefScreenshot: (refScreenshot) => set({ refScreenshot }),

















  triggerTempGuides: () => {
    set({ tempShowGuides: true });
    if (tempShowTimeoutId) {
      clearTimeout(tempShowTimeoutId);
    }
    tempShowTimeoutId = setTimeout(() => {
      set({ tempShowGuides: false });
    }, 2000);
  },

  searchTmdb: async (query, options) => {
    const requestId = ++tmdbSearchRequestId;
    const taskIdAtStart = get().selectedTaskId;
    const isCurrentRequest = () => requestId === tmdbSearchRequestId && get().selectedTaskId === taskIdAtStart;
    const silent = options?.silent ?? false;
    const rawSearchStr = query.trim();
    if (!rawSearchStr) return;

    const parsed = parseMediaFilename(rawSearchStr);
    const fallbackParsed = options?.fallbackTitle ? parseMediaFilename(options.fallbackTitle) : null;
    const activeTask = get().tasks.find(t => t.id === get().selectedTaskId);
    const searchTitle =
      (parsed.hasUsableTitle ? parsed.title : '') ||
      (fallbackParsed?.hasUsableTitle ? fallbackParsed.title : '') ||
      (activeTask?.files || [])
        .map(file => parseMediaFilename(file.name))
        .find(item => item.hasUsableTitle)?.title ||
      '';

    const episodeKey = parsed.episodeKey || fallbackParsed?.episodeKey || activeTask?.epKey;
    const isEpisodeQuery = Boolean(episodeKey) || parsed.mediaHint === 'tv' || fallbackParsed?.mediaHint === 'tv';
    const identity = assessMediaIdentity(`${searchTitle || rawSearchStr} ${episodeKey || ''}`.trim(), options?.fallbackTitle || activeTask?.title || '');
    const searchStr = cleanFilename(identity.title || searchTitle);

    if (!identity.shouldAutoSearchTmdb || !searchStr) {
      if (episodeKey) {
        const epMatch = episodeKey.match(/S(\d+)E(\d+)/i);
        const season = epMatch ? parseInt(epMatch[1], 10).toString() : get().tmdbManualInput.season;
        const episode = epMatch ? parseInt(epMatch[2], 10).toString() : get().tmdbManualInput.episode;
        set(state => ({
          tmdbManualInput: {
            ...state.tmdbManualInput,
            title: '',
            type: 'tv',
            season,
            episode
          },
          tmdbSuggestions: [],
          tmdbManualOpen: !silent
        }));
        get().setStatusNotice({
          id: 'media-identity',
          tone: 'notice',
          title: '请补充片名',
          message: '已识别季集信息。输入片名以匹配影片资料。',
          meta: episodeKey,
          action: 'openTmdbManual',
          actionLabel: '补充片名',
        });
        if (!silent) get().addLog(`已识别为 ${episodeKey}，请补充片名以匹配影片资料`, 'info');
      } else {
        set({ tmdbSuggestions: [], tmdbManualOpen: !silent });
        get().setStatusNotice({
          id: 'media-identity',
          tone: 'warning',
          title: '未能识别片名',
          message: '文件名中没有可用片名，请手动输入后搜索。',
          meta: '片名信息不足',
          action: 'openTmdbManual',
          actionLabel: '输入片名',
        });
        if (!silent) get().addLog('文件名信息不足，请补充片名后再匹配影片资料', 'info');
      }
      return;
    }

    set({ isSearchingTmdb: true });
    if (!silent) get().addLog('正在匹配影片资料', 'info');
    
    try {
      const yearMatch = isEpisodeQuery ? null : searchStr.match(/\b(19\d\d|20\d\d)\b/);
      // 剧集 / 电影：优先文件名解析年，其次任务文件与手填。手填用于消歧或修正观影/发行印象年。
      const manualYear = parseYearToken(get().tmdbManualInput.year);
      const fileYear = (activeTask?.files || [])
        .map((file) => parseYearToken(parseMediaFilename(file.name).year))
        .find(Boolean) || '';
      const year = isEpisodeQuery
        ? (parseYearToken(parsed.year) || parseYearToken(fallbackParsed?.year) || fileYear || manualYear || '')
        : (parsed.year || fallbackParsed?.year || yearMatch?.[1] || manualYear || '');
      const seasonHint = parseSeasonNumber(parsed.season)
        || parseSeasonNumber(fallbackParsed?.season)
        || parseSeasonNumber(episodeKey?.match(/S(\d+)/i)?.[1])
        || parseSeasonNumber(get().tmdbManualInput.season);
      const querySource = parsed.hasUsableTitle ? rawSearchStr : (searchTitle || searchStr);
      const searchQueries = buildTmdbSearchQueries(querySource, 12);
      let cleanQuery = searchQueries[0] || searchStr;
      if (year) {
        cleanQuery = cleanQuery.replace(year, '');
      }
      // Strip episode patterns like S02E01 so TMDB multi-search works for TV shows
      cleanQuery = cleanQuery.replace(/\bS\d{1,4}E\d{1,4}\b/gi, '').replace(/\bEP\d{1,4}\b/gi, '');
      cleanQuery = cleanQuery.replace(/[\s.\-_]+/g, ' ').trim();

      const chnMatch = cleanQuery.match(/[\u4e00-\u9fff]+/g);
      const engMatch = cleanQuery.match(/[a-zA-Z]+/g);
      const chnPart = chnMatch ? chnMatch.join(' ') : '';
      const engPart = engMatch ? engMatch.join(' ') : '';

      const runSearch = async (
        q: string,
        endpoint: 'multi' | 'tv' | 'movie' = 'multi',
      ) => {
        const yearParam = endpoint === 'movie' && year ? `&year=${year}` : '';
        const url = `search/${endpoint}?query=${encodeURIComponent(q)}&language=zh-CN${yearParam}`;
        const cached = typeof window !== 'undefined' ? tmdbClientCache.get(url) : undefined;
        if (cached && cached.expiresAt > Date.now()) return cached.results;
        const res = await tmdbFetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { results?: TmdbSuggestion[] };
        const searchResults = (data.results || [])
          .map((item) => ({ ...item, media_type: item.media_type || (endpoint === 'multi' ? item.media_type : endpoint) }))
          .filter((item) => !item.adult && (item.media_type === 'movie' || item.media_type === 'tv'));
        if (typeof window !== 'undefined') {
          tmdbClientCache.set(url, { expiresAt: Date.now() + TMDB_CLIENT_CACHE_TTL_MS, results: searchResults });
        }
        return searchResults;
      };

      const candidateQueries = [...searchQueries, cleanQuery, chnPart, engPart]
        .map(q => q.trim())
        .filter((q, index, arr) => q.length >= 2 && arr.indexOf(q) === index);
      const scoringQueries = [
        parsed.hasUsableTitle ? parsed.title : '',
        fallbackParsed?.hasUsableTitle ? fallbackParsed.title : '',
        searchTitle,
        cleanQuery,
      ]
        .map(q => q.trim())
        .filter((q, index, arr) => q.length >= 2 && arr.indexOf(q) === index);

      const mergeResults = (target: TmdbSuggestion[], incoming: TmdbSuggestion[]) => {
        const keys = new Set(target.map(item => `${item.media_type}:${item.id}`));
        incoming.forEach(item => {
          const key = `${item.media_type}:${item.id}`;
          if (!keys.has(key)) {
            target.push(item);
            keys.add(key);
          }
        });
      };

      const results: TmdbSuggestion[] = [];
      for (const q of candidateQueries) {
        const previousCount = results.length;
        if (isEpisodeQuery) {
          mergeResults(results, await runSearch(q, 'tv'));
          mergeResults(results, await runSearch(q, 'multi'));
        } else {
          if (year) mergeResults(results, await runSearch(q, 'movie'));
          if (!year || results.length === previousCount) {
            mergeResults(results, await runSearch(q, 'multi'));
          }
        }
        if (!isEpisodeQuery && year && q === candidateQueries[0] && results.length > previousCount) break;
        if (q !== candidateQueries[0] && results.length > previousCount) break;
        if (results.length >= 8) break;
      }

      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizeLoose = (str: string) => str.toLowerCase().replace(/[\s._\-:：'"“”‘’（）()[\]【】]/g, '');
      const expectedMediaType: TmdbMediaType | undefined = isEpisodeQuery
        ? 'tv'
        : year || parsed.mediaHint === 'movie' || fallbackParsed?.mediaHint === 'movie'
          ? 'movie'
          : undefined;
      const isAncillaryMovieCandidate = (item: TmdbSuggestion): boolean => {
        const textBlob = `${item.title || ''} ${item.name || ''} ${item.original_title || ''} ${item.original_name || ''} ${item.overview || ''} ${item.known_for_department || ''}`;
        return /\b(making[-\s]?of|behind\s+the\s+scenes|documentary|docu|featurette|interview|special)\b/i.test(textBlob)
          || /(纪录片|紀錄片|幕后|幕後|花絮|特别篇|特別篇|特辑|特輯|访谈|訪談|采访|採訪|制作特辑|製作特輯)/.test(textBlob)
          || (item.genre_ids || []).includes(99);
      };

      const evaluateCandidate = (item: TmdbSuggestion): TmdbConfirmationDecision => {
        let score = 0;
        const reasons: string[] = [];
        let titleMatchStrength = 0;
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        if (isEpisodeQuery) {
          if (item.media_type === 'tv') {
            score += 180;
            reasons.push('type:tv');
          } else {
            score -= 180;
            reasons.push('type-mismatch');
          }
        }
        if (isEpisodeQuery && year) {
          const fit = assessTvYearFit({ userYear: year, itemYear, season: seasonHint });
          if (fit.match) {
            score += 100;
            reasons.push('year:match');
          } else if (fit.veto) {
            score -= 220;
            reasons.push(fit.veto);
          } else if (fit.soft) {
            score += 40;
            reasons.push('year:soft');
          } else if (!itemYear) {
            reasons.push('year:missing');
          }
        } else if (isEpisodeQuery && !year && itemYear && shouldDemoteBySeasonSpan({ itemYear, season: seasonHint })) {
          // 无年份：用「今天」估季跨度，本地降权撑不起 Sxx 的同名剧（不 reject，留给「更换候选」）
          score -= 200;
          reasons.push('season-span:demote');
        } else if (year && itemYear === year) {
          score += 100;
          reasons.push('year:match');
        } else if (year && itemYear && itemYear !== year) {
          score -= 120;
          reasons.push('year:mismatch');
        } else if (year && !itemYear) {
          reasons.push('year:missing');
        }
        const normTitle = normalize(item.title || item.name || '');
        const normOrigTitle = normalize(item.original_title || item.original_name || '');
        const looseTitle = normalizeLoose(item.title || item.name || '');
        const looseOrigTitle = normalizeLoose(item.original_title || item.original_name || '');
        // contains 方向：query⊂title 为系列名误吸（Elite Force→Lab Rats）；title⊂query 为后缀恢复（…XXX→正片名）。
        let queryContainedInTitle = false;
        let titleContainedInQuery = false;
        const noteContainsDirection = (titleHasQuery: boolean, queryHasTitle: boolean) => {
          if (titleHasQuery) queryContainedInTitle = true;
          if (queryHasTitle) titleContainedInQuery = true;
        };
        const directedContains = (title: string, orig: string, q: string) => {
          if (!q) return null;
          const titleHasQuery = (Boolean(title) && title.includes(q) && title !== q)
            || (Boolean(orig) && orig.includes(q) && orig !== q);
          const queryHasTitle = (Boolean(title) && q.includes(title) && q !== title)
            || (Boolean(orig) && q.includes(orig) && q !== orig);
          if (!titleHasQuery && !queryHasTitle) return null;
          return { titleHasQuery, queryHasTitle };
        };
        const queryScores = scoringQueries.map((query) => {
          const normQ = normalize(query);
          const looseQ = normalizeLoose(query);
          if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) {
            reasons.push('title:exact');
            titleMatchStrength = 2;
            return isEpisodeQuery ? 180 : 60;
          }
          if (looseQ && (looseTitle === looseQ || looseOrigTitle === looseQ)) {
            reasons.push('title:loose-exact');
            titleMatchStrength = 2;
            return isEpisodeQuery ? 170 : 55;
          }
          const strictContains = directedContains(normTitle, normOrigTitle, normQ);
          if (strictContains) {
            reasons.push('title:contains');
            noteContainsDirection(strictContains.titleHasQuery, strictContains.queryHasTitle);
            if (titleMatchStrength === 0) titleMatchStrength = 1;
            return 20;
          }
          const looseContains = directedContains(looseTitle, looseOrigTitle, looseQ);
          if (looseContains) {
            reasons.push('title:loose-contains');
            noteContainsDirection(looseContains.titleHasQuery, looseContains.queryHasTitle);
            if (titleMatchStrength === 0) titleMatchStrength = 1;
            return 24;
          }
          return 0;
        });
        score += Math.max(0, ...queryScores);
        // Prefer well-known titles when title scores are close (avoids parody/substring tops).
        score += Math.round(popularityBoost(item) * 0.85);

        const autoConfirmThreshold = isEpisodeQuery ? 100 : year ? 80 : 50;
        const vetoes: string[] = [];
        if (expectedMediaType && item.media_type && item.media_type !== expectedMediaType) {
          vetoes.push('veto:type');
        }
        if (isEpisodeQuery && year) {
          const fit = assessTvYearFit({ userYear: year, itemYear, season: seasonHint });
          if (fit.veto) vetoes.push(fit.veto);
          if (fit.soft) vetoes.push('veto:year-soft');
        } else if (year && itemYear && itemYear !== year) {
          vetoes.push('veto:year');
        }
        if (!isEpisodeQuery && isAncillaryMovieCandidate(item)) {
          vetoes.push('veto:ancillary');
        }
        // 仅「查询被片名包含」的 contains 禁止自动（系列/副标题误吸）。
        // 「片名被查询包含」保留自动（垃圾后缀恢复，如 Down Cemetery Road XXX）。
        if (titleMatchStrength === 1 && queryContainedInTitle && !titleContainedInQuery) {
          vetoes.push('veto:title-contains-only');
        }
        if (vetoes.includes('veto:type')) {
          return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
        }
        if (vetoes.includes('veto:year-after') || vetoes.includes('veto:season-span')) {
          return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
        }
        if (vetoes.includes('veto:year') && (vetoes.includes('veto:ancillary') || Math.abs(Number(itemYear) - Number(year)) >= 30)) {
          return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
        }
        if (vetoes.length > 0) {
          return { action: 'require_confirmation', score, reasons: [...reasons, ...vetoes] };
        }
        if (score < autoConfirmThreshold) {
          return { action: 'require_confirmation', score, reasons: [...reasons, 'below-threshold'] };
        }
        return { action: 'auto_apply', score, reasons };
      };

      const hasExactMatch = results.some((item) => evaluateCandidate(item).score >= 50);

      const getConfirmationMessage = (decision: TmdbConfirmationDecision | undefined): string => {
        const reasons = decision?.reasons || [];
        if (reasons.includes('veto:type')) return '结果类型与文件名判断不一致，请确认后应用。';
        if (reasons.includes('veto:year-after') || reasons.includes('veto:season-span')) {
          return '已按年份与季跨度排除不可能的同名剧，请确认剩余结果。';
        }
        if (reasons.includes('veto:year-soft')) {
          return '年份更像发行/观影印象而非首播年，已排除跨度不够的同名剧，请确认是否为目标片源。';
        }
        if (reasons.includes('veto:year')) return '结果年份与文件名年份不一致，请确认后应用。';
        if (reasons.includes('veto:ancillary')) return '结果可能是纪录片、花絮或特别篇，请确认是否为正片。';
        if (reasons.includes('veto:title-contains-only')) {
          return isEpisodeQuery
            ? '结果标题仅部分包含片名（非精确同名）。请确认，或补充首播年后再匹配。'
            : '结果标题仅部分包含片名，请确认后应用。';
        }
        if (reasons.includes('need-year')) return '存在多个同名片名，补充年份可排除错误结果。';
        if (reasons.includes('close-score')) return '前列候选分数接近，请确认正确片源；补充年份可减少歧义。';
        return '已找到相近结果，但片名或年份不够吻合，请确认后应用。';
      };

      // Multi-split colon search fallback
      if (!hasExactMatch && cleanQuery.includes(' ') && !cleanQuery.includes(':')) {
        const spacesCount = (cleanQuery.match(/ /g) || []).length;
        if (spacesCount <= 3) {
          const words = cleanQuery.split(' ');
          for (let k = 1; k < words.length; k++) {
            const part1 = words.slice(0, k).join(' ');
            const part2 = words.slice(k).join(' ');
            const colonQuery = `${part1}: ${part2}`;
            const extraResults = await runSearch(colonQuery, isEpisodeQuery ? 'tv' : 'multi');
            if (extraResults.length > 0) {
              const existingIds = new Set(results.map((r) => r.id));
              let addedCount = 0;
              extraResults.forEach((r) => {
                if (!existingIds.has(r.id)) {
                  results.push(r);
                  addedCount++;
                }
              });
              if (addedCount > 0) {
                break;
              }
            }
          }
        }
      }

      const scored = results.map((item) => {
        const decision = evaluateCandidate(item);
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        const displayTitle = item.title || item.name || '';
        const displayYear = itemYear ? ` (${itemYear})` : '';
        if (!silent) get().addLog(`[候选] ${displayTitle}${displayYear}`, 'info');
        
        return { item, score: decision.score, decision };
      });

      scored.sort((a, b) => {
        const aExact = a.decision.reasons.some((r) => r === 'title:exact' || r === 'title:loose-exact');
        const bExact = b.decision.reasons.some((r) => r === 'title:exact' || r === 'title:loose-exact');
        const aSub = a.decision.reasons.includes('veto:title-contains-only')
          || (a.decision.reasons.includes('title:contains') && !aExact);
        const bSub = b.decision.reasons.includes('veto:title-contains-only')
          || (b.decision.reasons.includes('title:contains') && !bExact);
        if (aExact !== bExact) return aExact ? -1 : 1;
        if (aSub !== bSub) return aSub ? 1 : -1;
        return b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0) || (b.item.vote_count || 0) - (a.item.vote_count || 0);
      });

      // 前列分数接近时，禁止仅靠 popularity 自动采纳（本轮结果内分差，而非全局热度）。
      if (scored.length >= 2) {
        const top = scored[0];
        const runnerUp = scored[1];
        if (
          top.decision.action === 'auto_apply'
          && runnerUp.decision.action !== 'reject'
          && top.score - runnerUp.score < 30
        ) {
          top.decision = {
            action: 'require_confirmation',
            score: top.score,
            reasons: [...top.decision.reasons, 'close-score'],
          };
        }
      }

      // 剧集无年 + 多个精确同名：若季跨度已能分出胜负 → 上屏高分项并缓存另一候选；否则再请补年份
      const exactTitleTv = scored.filter((entry) =>
        entry.item.media_type === 'tv'
        && entry.decision.action !== 'reject'
        && (entry.decision.reasons.includes('title:exact') || entry.decision.reasons.includes('title:loose-exact')),
      );
      const spanPlausibleExact = exactTitleTv.filter((entry) => !entry.decision.reasons.includes('season-span:demote'));
      const spanDemotedExact = exactTitleTv.filter((entry) => entry.decision.reasons.includes('season-span:demote'));
      const canLuckyDisambiguate = isEpisodeQuery
        && !year
        && Boolean(seasonHint && seasonHint > 1)
        && spanPlausibleExact.length === 1
        && spanDemotedExact.length >= 1;
      const needsYearDisambiguation = isEpisodeQuery
        && !year
        && exactTitleTv.length >= 2
        && !canLuckyDisambiguate;

      if (needsYearDisambiguation) {
        for (const entry of scored) {
          if (entry.decision.action === 'auto_apply') {
            entry.decision = {
              action: 'require_confirmation',
              score: entry.score,
              reasons: [...entry.decision.reasons, 'need-year'],
            };
          }
        }
      }

      // 有年时：硬否决的同名剧仍可展示在列表末尾，但不参与自动采纳
      // 运气路径：最多保留 2 条（上屏 + 备用），不扩缓存
      const rankedNonReject = scored.filter((entry) => entry.decision.action !== 'reject');
      const rankedReject = scored.filter((entry) => entry.decision.action === 'reject');
      const luckyPair = canLuckyDisambiguate
        ? [spanPlausibleExact[0], spanDemotedExact[0]].filter(Boolean)
        : null;
      const sortedResults = (
        luckyPair
          ? luckyPair.map((entry) => entry.item)
          : [...rankedNonReject, ...rankedReject].map((s) => s.item)
      ).slice(0, luckyPair ? 2 : 5);
      const bestScored = luckyPair?.[0]
        || scored.find((entry) => entry.item.id === sortedResults[0]?.id)
        || scored[0];
      const luckyAlternate = luckyPair?.[1]?.item || null;

      if (!isCurrentRequest()) return;
      set({
        tmdbSuggestions: sortedResults,
        tmdbAlternateSuggestion: luckyAlternate,
      });

      if (needsYearDisambiguation) {
        const epMatch = episodeKey?.match(/S(\d+)E(\d+)/i);
        set((state) => ({
          tmdbManualInput: {
            ...state.tmdbManualInput,
            title: searchTitle || cleanQuery || state.tmdbManualInput.title,
            type: 'tv',
            year: year || state.tmdbManualInput.year,
            season: epMatch ? String(parseInt(epMatch[1], 10)) : (seasonHint ? String(seasonHint) : state.tmdbManualInput.season),
            episode: epMatch ? String(parseInt(epMatch[2], 10)) : state.tmdbManualInput.episode,
          },
          tmdbManualOpen: !silent,
          tmdbAlternateSuggestion: null,
        }));
        if (!silent) get().addLog('多个同名剧集，请补充年份以确认片源', 'info');
        get().setStatusNotice({
          id: 'media-match',
          tone: 'notice',
          title: '请补充年份',
          message: '存在多个同名片名且未能从文件名得到可用年份。填写首播年可精确匹配；填写发行或观看年份时，将排除跨度不符的结果并请求确认。',
          meta: episodeKey || searchStr,
          action: 'openTmdbManual',
          actionLabel: '补充年份',
        });
        return;
      }

      if (sortedResults.length > 0) {
        const best = sortedResults[0];
        const decision = bestScored?.decision;
        if (!decision || decision.action !== 'auto_apply') {
          if (!silent) get().addLog('已找到相近结果，请确认是否正确', 'info');
          get().setStatusNotice({
            id: 'media-match',
            tone: 'notice',
            title: decision?.reasons.includes('veto:year-soft') ? '请确认片源年份' : '请确认影片信息',
            message: getConfirmationMessage(decision),
            meta: best.title || best.name || searchStr,
            action: 'openTmdbManual',
            actionLabel: '查看结果',
          });
          set({ tmdbManualOpen: !silent });
          return;
        }

        if (!silent) {
          get().addLog(
            luckyAlternate
              ? '已按季跨度优先匹配，若不对应可点「更换候选」'
              : '已找到匹配结果，正在应用',
            'success',
          );
        }
        if (isEpisodeQuery && best.media_type !== 'tv') {
          if (!silent) get().addLog('已找到剧集结果，请确认后应用', 'info');
          get().setStatusNotice({
            id: 'media-match',
            tone: 'notice',
            title: '请确认影片信息',
            message: '已找到剧集结果，请确认后应用。',
            meta: best.name || best.title || searchStr,
            action: 'openTmdbManual',
            actionLabel: '查看结果',
          });
          set({ tmdbManualOpen: !silent });
        } else {
          await get().selectTmdbSuggestion(best, { silent });
          if (luckyAlternate && !silent) {
            get().setStatusNotice({
              id: 'media-match',
              tone: 'success',
              title: '已按季跨度优选',
              message: '同名剧已按开播跨度排序。若不对，可点「更换候选」切换另一候选（不再搜索）。',
              meta: best.title || best.name || searchStr,
            });
          }
        }
      } else {
        const hasExistingMetadata = Boolean(get().tmdbData);
        if (!hasExistingMetadata) {
          set({ tmdbData: null, tmdbBackdrop: null });
        }
        get().setStatusNotice({
          id: 'media-match',
          tone: 'warning',
          title: '未匹配到影片信息',
          message: '按当前片名没有找到可靠结果，可修改后重试。',
          meta: searchStr,
          action: 'openTmdbManual',
          actionLabel: '修改片名',
        });
        if (!silent) get().addLog('未能自动匹配影片信息，可手动选择结果', 'error');
      }
    } catch (e: unknown) {
      if (!isCurrentRequest()) return;
      const message = e instanceof Error ? e.message : String(e);
      get().setStatusNotice({
        id: 'media-match',
        tone: 'alert',
        title: '影片信息匹配失败',
        message,
        meta: '影片资料检索',
        action: 'openTmdbManual',
        actionLabel: '重新搜索',
      });
      if (!silent) get().addLog(`影片信息匹配失败: ${message}`, 'error');
    } finally {
      if (isCurrentRequest()) set({ isSearchingTmdb: false });
    }
  },

  searchTmdbManual: async (query, type, year) => {
    const requestId = ++tmdbSearchRequestId;
    const taskIdAtStart = get().selectedTaskId;
    const isCurrentRequest = () => requestId === tmdbSearchRequestId && get().selectedTaskId === taskIdAtStart;
    const rawSearchStr = query.trim();
    if (!rawSearchStr) return;
    
    const searchStr = cleanFilename(rawSearchStr);
    if (!searchStr) return;

    set({ isSearchingTmdb: true });
    get().addLog(`正在手动检索 ${type === 'movie' ? '电影' : '剧集'}: ${searchStr}...`, 'info');
    
    try {
      const runSearchManual = async (q: string) => {
        // 剧集年份只做客户端筛选：API 的 year 会按首播年硬过滤，会丢掉「发行年/观影年」软匹配。
        const yearParam = type === 'movie' && year ? `&year=${year}` : '';
        const url = `search/${type}?query=${encodeURIComponent(q)}&language=zh-CN${yearParam}`;
        const cached = typeof window !== 'undefined' ? tmdbClientCache.get(url) : undefined;
        if (cached && cached.expiresAt > Date.now()) return cached.results;
        const res = await tmdbFetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { results?: TmdbSuggestion[] };
        const searchResults = (data.results || []).filter((item) => !item.adult);
        if (typeof window !== 'undefined') {
          tmdbClientCache.set(url, { expiresAt: Date.now() + TMDB_CLIENT_CACHE_TTL_MS, results: searchResults });
        }
        return searchResults;
      };

      const candidateQueries = buildTmdbSearchQueries(searchStr, 12);
      const scoringQueries = candidateQueries.length > 0 ? candidateQueries : [searchStr];
      const results: TmdbSuggestion[] = [];
      const seen = new Set<number>();

      for (const q of scoringQueries) {
        const incoming = await runSearchManual(q);
        incoming.forEach((item) => {
          if (!seen.has(item.id)) {
            results.push(item);
            seen.add(item.id);
          }
        });
        if (q !== scoringQueries[0] && incoming.length > 0) break;
        if (results.length >= 10) break;
      }

      const hasExactMatch = rankTmdbCandidates(results, scoringQueries).some((entry) => entry.exactTitle);

      // Multi-split colon search fallback for manual search
      if (!hasExactMatch && searchStr.includes(' ') && !searchStr.includes(':')) {
        const spacesCount = (searchStr.match(/ /g) || []).length;
        if (spacesCount <= 3) {
          const words = searchStr.split(' ');
          for (let k = 1; k < words.length; k++) {
            const part1 = words.slice(0, k).join(' ');
            const part2 = words.slice(k).join(' ');
            const colonQuery = `${part1}: ${part2}`;
            const extraResults = await runSearchManual(colonQuery);
            if (extraResults.length > 0) {
              let addedCount = 0;
              extraResults.forEach((r) => {
                if (!seen.has(r.id)) {
                  results.push(r);
                  seen.add(r.id);
                  addedCount++;
                }
              });
              if (addedCount > 0) {
                break;
              }
            }
          }
        }
      }

      const seasonHint = parseSeasonNumber(get().tmdbManualInput.season);
      const userYear = parseYearToken(year);
      const scored = rankTmdbCandidates(
        results.map((item) => ({ ...item, media_type: type })),
        scoringQueries,
        {
          year: userYear,
          yearScore: (item, y) => {
            const itemYear = (item.release_date || item.first_air_date || '').substring(0, 4);
            if (type === 'tv') {
              const fit = assessTvYearFit({ userYear: y, itemYear, season: seasonHint });
              if (fit.match) return { delta: 100, rejected: false };
              if (fit.veto) return { delta: -220, rejected: true };
              if (fit.soft) return { delta: 40, rejected: false };
              return { delta: 0, rejected: false };
            }
            if (itemYear === y) return { delta: 100, rejected: false };
            if (itemYear && itemYear !== y) return { delta: -120, rejected: false };
            return { delta: 0, rejected: false };
          },
        },
      ).map((entry) => ({
        ...entry,
        item: { ...entry.item, media_type: type } as TmdbSuggestion,
      }));

      scored.sort(compareTmdbRank);
      const sortedResults = scored.map((s) => s.item).slice(0, 10);
      if (!isCurrentRequest()) return;
      set({ tmdbSuggestions: sortedResults });
      
      sortedResults.forEach((item) => {
        const title = item.title || item.name || '';
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        const displayYear = itemYear ? ` (${itemYear})` : '';
        get().addLog(`[手动候选] ${title}${displayYear}`, 'info');
      });

      const viable = scored.filter((entry) => !entry.rejected);
      const softOnly = type === 'tv' && Boolean(userYear)
        && viable.length > 0
        && !viable.some((entry) => {
          const itemYear = (entry.item.release_date || entry.item.first_air_date || '').substring(0, 4);
          return assessTvYearFit({
            userYear,
            itemYear,
            season: seasonHint,
          }).match;
        });
      const topRank = scored.find((entry) => !entry.rejected) || null;
      const needsConfirm = !isHighConfidenceTmdbPick(topRank);
      
      if (sortedResults.length > 0) {
        get().setStatusNotice({
          id: 'media-match',
          tone: 'notice',
          title: softOnly ? '请确认片源年份' : needsConfirm ? '请确认匹配结果' : '请选择匹配结果',
          message: softOnly
            ? '已按季跨度排除不可能的同名剧；年份更像发行/观影印象，请确认是否为目标片源。'
            : needsConfirm
              ? `已找到 ${sortedResults.length} 个结果。首位置信度不足，请点选确认后再应用。`
              : `已找到 ${sortedResults.length} 个结果，请选择正确的一项。`,
          meta: searchStr,
          action: 'openTmdbManual',
          actionLabel: '查看结果',
        });
        get().addLog(`找到 ${sortedResults.length} 个匹配结果，请选择确认`, 'success');
      } else {
        get().setStatusNotice({
          id: 'media-match',
          tone: 'warning',
          title: '未找到匹配结果',
          message: '可尝试原片名、去掉集标题，或补充年份后再搜索。',
          meta: searchStr,
          action: 'openTmdbManual',
          actionLabel: '修改搜索',
        });
        get().addLog('未找到匹配结果', 'error');
      }
    } catch (e: unknown) {
      if (!isCurrentRequest()) return;
      const message = e instanceof Error ? e.message : String(e);
      get().setStatusNotice({
        id: 'media-match',
        tone: 'alert',
        title: '搜索失败',
        message,
        meta: searchStr,
        action: 'openTmdbManual',
        actionLabel: '重新搜索',
      });
      get().addLog(`搜索失败: ${message}`, 'error');
    } finally {
      if (isCurrentRequest()) set({ isSearchingTmdb: false });
    }
  },

  selectTmdbSuggestion: async (s, options) => {
    const requestId = ++tmdbSelectionRequestId;
    const silent = options?.silent ?? false;
    set({ selectedSuggestion: s });
    const { selectedTaskId, tmdbManualInput } = get();
    const isCurrentSelection = () => requestId === tmdbSelectionRequestId && get().selectedTaskId === selectedTaskId;
    if (!silent) get().addLog('正在获取影片资料', 'info');
    try {
      let type = s.media_type;
      if (!type) {
        type = (s.first_air_date || s.name || s.original_name) ? 'tv' : 'movie';
      }
      const detailRes = await tmdbFetch(
        `${type}/${s.id}?language=zh-CN&append_to_response=alternative_titles`
      );
      if (!detailRes.ok) throw new Error("获取详情失败");
      const details = await detailRes.json() as TmdbDetails;
      if (!isCurrentSelection()) return;

      const genres = (details.genres || []).map((g) => g.name);
      const backdropUrl = s.backdrop_path ? `https://image.tmdb.org/t/p/w1280${s.backdrop_path}` : null;
      const posterUrl = s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null;

      let mainTitle = details.title || details.name || s.title || s.name || '';
      if (!/[\u4e00-\u9fff]/.test(mainTitle) && details.alternative_titles) {
        const altList = details.alternative_titles.results || details.alternative_titles.titles || [];
        const zhTitle = altList.find((t) => t.iso_3166_1 === 'CN' || t.iso_3166_1 === 'TW');
        if (zhTitle && zhTitle.title) {
          mainTitle = zhTitle.title;
        }
      }

      // Fetch images list (stills if TV episode, backdrops if movie) for random immersive selection
      let backdrops: string[] = [];
      try {
        let imagesUrl = `${type}/${s.id}/images`;
        const activeTaskForEp = get().tasks.find(t => t.id === selectedTaskId);
        if (type === 'tv' && activeTaskForEp?.epKey) {
          const epMatch = activeTaskForEp.epKey.match(/S(\d+)E(\d+)/i);
          if (epMatch) {
            const seasonNum = parseInt(epMatch[1]);
            const episodeNum = parseInt(epMatch[2]);
            imagesUrl = `tv/${s.id}/season/${seasonNum}/episode/${episodeNum}/images`;
          }
        }
        const imgRes = await tmdbFetch(imagesUrl);
        if (!isCurrentSelection()) return;
        if (imgRes.ok) {
          const imgData = await imgRes.json() as TmdbImages;
          const hasEpisodeStills = type === 'tv' && activeTaskForEp?.epKey;
          const list = hasEpisodeStills ? (imgData.stills || []) : (imgData.backdrops || []);
          backdrops = list.map((img) => img.file_path ? `https://image.tmdb.org/t/p/w1280${img.file_path}` : '').filter(Boolean);
        }
      } catch (e) {
        console.error("Failed to fetch TMDB images list:", e);
      }

      // Fallback to suggestion backdrop if no images list
      if (backdrops.length === 0 && s.backdrop_path) {
        backdrops = [`https://image.tmdb.org/t/p/w1280${s.backdrop_path}`];
      }

      // Randomly select one, skipping top promo images for better immersion.
      let chosenBackdrop = backdrops[0] || backdropUrl || null;
      if (backdrops.length > 0) {
        const skipCount = backdrops.length > 4 ? 3 : 0;
        const candidates = backdrops.slice(skipCount);
        const randIdx = Math.floor(Math.random() * candidates.length);
        chosenBackdrop = candidates[randIdx];
        if (!silent) get().addLog(`[剧照] 已准备预览画面`, 'info');
      }

      const meta: TmdbMetadata = {
        title: mainTitle,
        originalTitle: details.original_title || details.original_name || '',
        year: (details.release_date || details.first_air_date || '').substring(0, 4),
        genres,
        posterUrl,
        backdropUrl: chosenBackdrop,
        overview: details.overview || '暂无剧情简介。',
        voteAverage: details.vote_average || 0,
        isAnime: genres.includes('动画') || genres.includes('Animation')
      };

      if (!isCurrentSelection()) return;

      const activeTask = get().tasks.find(t => t.id === selectedTaskId);
      const epKey = activeTask?.epKey;
      const manualEpisodeKey = type === 'tv' && !epKey
        ? `S${String(tmdbManualInput.season).padStart(2, '0')}E${String(tmdbManualInput.episode).padStart(2, '0')}`
        : undefined;
      // TMDB 不写 customFilename（只存手动名）；导出名统一由 resolveExportBase 派生。
      set((state) => ({
        tmdbData: meta,
        tmdbBackdrop: chosenBackdrop,
        tmdbBackdropList: backdrops,
        filenameEpKey: (epKey || manualEpisodeKey || '').toUpperCase(),
        tasks: selectedTaskId
          ? state.tasks.map((t) => (
            t.id === selectedTaskId
              ? {
                  ...t,
                  title: taskDisplayTitle(meta, epKey || manualEpisodeKey),
                  tmdbData: meta,
                  tmdbBackdrop: chosenBackdrop,
                  tmdbBackdropList: backdrops,
                }
              : t
          ))
          : state.tasks,
      }));

      if (!silent) get().addLog(`已匹配影片信息：${meta.title}`, 'success');
      get().setStatusNotice({
        id: 'media-match',
        tone: 'success',
        title: '已匹配影片信息',
        message: meta.originalTitle && meta.originalTitle !== meta.title ? meta.originalTitle : undefined,
        meta: [meta.title, meta.year].filter(Boolean).join(' · '),
      });
      set({ tmdbManualOpen: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      get().setStatusNotice({
        id: 'media-match',
        tone: 'alert',
        title: '影片资料获取失败',
        message,
        meta: s.title || s.name || '影片资料',
        action: 'openTmdbManual',
        actionLabel: '重试',
      });
      if (!silent) get().addLog(`影片资料获取失败: ${message}`, 'error');
    }
  },

  initializeLibrary: () => {
    if (typeof window === 'undefined') return;
    clearStaleLocalStorage();
    try {
      const storedPreset = getExportPreset(localStorage.getItem('saiko_export_preset'));
      const storedHdr = localStorage.getItem('saiko_export_hdr') || '';
      const level = storedHdr.replace(/^off:/, '');
      set({
        exportPresetId: storedPreset.formats.includes('ass') ? storedPreset.id : DEFAULT_EXPORT_PRESET_ID,
        hdrEnabled: Boolean(storedHdr) && !storedHdr.startsWith('off:') && isHdrLevelId(level),
        ...(isHdrLevelId(level) ? { hdrLevel: level } : {}),
      });
      const storedOverrides = readJsonStorage<unknown>('saiko_style_overrides', {});
      if (storedOverrides && typeof storedOverrides === 'object' && !Array.isArray(storedOverrides)) {
        set({ styleOverrides: storedOverrides as Partial<StyleSettings> });
      }
    } catch { /* ignore */ }
    // History lives in IndexedDB (taskStore). Prior schema versions are discarded on open.
    void loadHistoryFromIdb().then((list) => {
      if (list) set({ libraryList: list, historyReady: true });
      else set({ libraryList: [], historyReady: true });
    });
    const savedStyles = readJsonStorage<{ preset?: string; style?: Partial<StyleSettings>; templates?: CustomTemplate[] }>(STYLE_STORAGE_KEY, {});
    if (savedStyles.preset) set({ activePreset: savedStyles.preset });
    if (savedStyles.style) set({ customStyle: { resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', ...savedStyles.style } as StyleSettings });
    if (Array.isArray(savedStyles.templates)) set({ customTemplates: savedStyles.templates });
    // TMDB key is now handled server-side via /api/tmdb proxy (no client-side key required).
    // Old localStorage key 'saiko_tmdb_api_key' is no longer used.
  },

  selectTask: (taskId) => {
    tmdbSelectionRequestId += 1;
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
    set({
      selectedTaskId: taskId,
      files: { zh: task.zh, en: task.en, commentary: task.commentary },
      tmdbData: resolvedMeta,
      tmdbBackdrop: task.tmdbBackdrop || inheritedBackdrop,
      tmdbBackdropList: task.tmdbBackdropList || inheritedBackdrops,
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

    if (!task.tmdbData && !inheritedMetadata && !get().tmdbData) {
      setTimeout(() => {
        // Prefer the raw identity filename so Title.Year.SxxExx keeps its year in search.
        if (identitySourceName) {
          get().searchTmdb(identitySourceName, { fallbackTitle: task.title });
        } else if (cleanName) {
          get().searchTmdb(`${cleanName} ${task.epKey || ''}`.trim(), { fallbackTitle: task.title });
        } else if (task.epKey) {
          set({ tmdbManualOpen: true });
          get().addLog(`已识别为 ${task.epKey}，请补充剧名以关联片源信息`, 'info');
        }
      }, 50);
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
    set(state => {
      const nextTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          const selectedFile = state.uploadedFiles.find(f => f.id === fileId) || null;
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
              const blockedName = selectedFile.name;
              const blockedLang = selectedFile.lang;
              setTimeout(() => {
                get().setStatusNotice({
                  id: 'secondary-bind-blocked',
                  tone: 'notice',
                  title: '副字幕未绑定',
                  message: `「${blockedName}」语种为 ${blockedLang}，自动合轴副字幕支持英语、西语、法语、葡语、德语、意语、日语、韩语。请改选文件，或先纠正语种标签。`,
                });
              }, 0);
              updated.en = null;
            }
          }

          updated.status = (updated.isBilingualSingle && updated.zh) || (updated.zh && updated.en) ? 'paired' : 'unpaired';
          
          if (t.id === state.selectedTaskId) {
            setTimeout(() => {
              set({
                files: { zh: updated.zh, en: updated.en, commentary: updated.commentary }
              });
            }, 0);
          }
          return updated;
        }
        return t;
      });
      return { tasks: nextTasks };
    });
  },

  swapPrimaryTracks: (taskId) => {
    set(state => {
      const nextTasks = state.tasks.map(task => {
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
          setTimeout(() => {
            set({
              files: { zh: updated.zh, en: updated.en, commentary: updated.commentary },
            });
          }, 0);
        }
        return updated;
      });
      return { tasks: nextTasks };
    });
    get().addLog('已对调主字幕与副字幕', 'info');
  },

  removeFileFromTask: (taskId, fileName) => {
    set(state => {
      const nextFiles = state.uploadedFiles.filter(f => f.name !== fileName);
      // Let us update matching task
      const nextTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          const zh = t.zh?.name === fileName ? null : t.zh;
          const en = t.en?.name === fileName ? null : t.en;
          const comm = t.commentary?.name === fileName ? null : t.commentary;
          const updated = { ...t, zh, en, commentary: comm, files: t.files.filter(f => f.name !== fileName) };
          updated.status = (updated.isBilingualSingle && updated.zh) || (updated.zh && updated.en) ? 'paired' : 'unpaired';
          return updated;
        }
        return t;
      }).filter(t => t.zh || t.en || t.commentary);

      setTimeout(() => {
        if (nextTasks.length > 0) {
          const active = nextTasks.find(t => t.id === state.selectedTaskId) || nextTasks[0];
          get().selectTask(active.id);
        } else {
          set({ selectedTaskId: null, files: { zh: null, en: null, commentary: null }, customFilename: '', filenameSource: 'unknown', borrowedVideoName: null, filenameEpKey: '' });
        }
      }, 0);

      get().addLog(`已移除文件: ${fileName}`, 'info');
      return { uploadedFiles: nextFiles, tasks: nextTasks };
    });
  },

  deleteTask: (taskId) => {
    set(state => {
      const taskToDelete = state.tasks.find(t => t.id === taskId);
      if (!taskToDelete) return {};
      const fileNamesToRemove = (taskToDelete.files || []).map(f => f.name);
      
      const nextFiles = state.uploadedFiles.filter(f => !fileNamesToRemove.includes(f.name));
      const nextTasks = state.tasks.filter(t => t.id !== taskId);
      
      setTimeout(() => {
        if (nextTasks.length > 0) {
          const active = nextTasks[0];
          get().selectTask(active.id);
        } else {
          set({ selectedTaskId: null, files: { zh: null, en: null, commentary: null }, customFilename: '', filenameSource: 'unknown', borrowedVideoName: null, filenameEpKey: '' });
        }
      }, 0);

      get().addLog(`已删除任务: ${taskToDelete.title}`, 'info');
      return { uploadedFiles: nextFiles, tasks: nextTasks };
    });
  },

  cancelCurrentUpload: () => {
    tmdbSearchRequestId += 1;
    tmdbSelectionRequestId += 1;
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

  clearHistory: async () => {
    try {
      await clearAllLocalData();
    } catch {
      /* fall through: still clear the legacy key */
    }
    clearStaleLocalStorage();
    set({ libraryList: [] });
    get().addLog('已清空本机历史（任务、合并结果与源字幕）', 'success');
  },

  saveToLibrary: () => {
    const { processedSubs, customFilename, tmdbData, tmdbBackdrop, tmdbBackdropList, customStyle, libraryList, selectedTaskId } = get();
    if (!processedSubs || processedSubs.length === 0) return;
    const name = customFilename
      || (tmdbData ? [tmdbData.title, tmdbData.year].filter(Boolean).join('.') : '')
      || '未命名字幕';
    // One entry per task (re-merging the same task replaces it instead of piling up duplicates).
    // LibraryItem.id is a storage key; IndexedDB Task.id stays the identity.
    const taskIdentity = selectedTaskId || mintTaskId(workIdentityFromFileName(name));
    const historyId = historyIdFor(taskIdentity);
    const newItem: LibraryItem = {
      id: historyId,
      name: name,
      date: new Date().toLocaleString('zh-CN', { hour12: false }),
      subs: processedSubs,
      backdrop: tmdbBackdrop,
      backdropList: tmdbBackdropList,
      customStyle: customStyle
    };
    set({ libraryList: [newItem, ...libraryList.filter((item) => item.id !== historyId)] });
    void putHistoryEntry({ ...libraryItemToTask(newItem), id: taskIdentity }, processedSubs, {
      backdrop: tmdbBackdrop, backdropList: tmdbBackdropList, customStyle,
    }).then(
      () => get().addLog(`[历史] 已保存到本机：${name}`, 'success'),
      (error: unknown) => get().addLog(`本机历史保存失败：${error instanceof Error ? error.message : String(error)}`, 'error'),
    );
  },

  deleteFromLibrary: (id) => {
    set(state => ({ libraryList: state.libraryList.filter(item => item.id !== id) }));
    const taskIdentity = identityFromStorageKey(id, 'history') || id;
    void deleteTask(taskIdentity).catch(() => undefined);
    get().addLog('已删除这条历史', 'info');
  },

  loadFromLibrary: (item) => {
    set({
      processedSubs: item.subs,
      customFilename: item.name,
      filenameSource: 'library',
      tmdbBackdrop: item.backdrop,
      tmdbBackdropList: item.backdropList || (item.backdrop ? [item.backdrop] : []),
      customStyle: item.customStyle,
      previewIndex: 0,
      workflowStep: 2,
      editHistory: [],
      editFuture: []
    });
    get().addLog(`已载入字幕库项目: ${item.name}`, "success");
  },

  processFiles: (incomingFiles, opts) => {
    // Recognition pre-pass (ASS style-split + SDH). Prefer Worker via runRecognitionJob in UI,
    // then pass { recognized: true }. In-thread path keeps Node regression / tests sync.
    const newFiles = opts?.recognized
      ? incomingFiles
      : executeRecognitionJob(incomingFiles).files as Subfile[];
    set(state => {
      // 1. Add new files to uploadedFiles list, checking for duplicates
      const updatedUploadedFiles = [...state.uploadedFiles];
      newFiles.forEach(nf => {
        const idx = updatedUploadedFiles.findIndex(u => u.name === nf.name);
        if (idx !== -1) {
          updatedUploadedFiles[idx] = nf;
        } else {
          updatedUploadedFiles.push(nf);
        }
      });

      const parsedByName = new Map(newFiles.map(file => [file.name, parseMediaFilename(file.name)]));
      const identityByName = new Map(newFiles.map(file => [file.name, assessMediaIdentity(file.name)]));
      const fallbackBatchTitle = [...identityByName.values()]
        .filter(item => item.shouldAutoSearchTmdb)
        .sort((a, b) => b.title.length - a.title.length)[0]?.title || '';

      const parseEpisodeKey = (name: string): string | undefined => {
        const legacy = parsedByName.get(name)?.episodeKey || parseMediaFilename(name).episodeKey;
        // Legacy parser misses #02 / 1x01; E-only keys get season 1 so naming never falls back to S01E01.
        if (legacy && /^S\d+E\d+$/i.test(legacy)) return legacy;
        return episodeKeyOf(parseEpisodeRef(name), 1) || legacy;
      };
      const getBaseTitle = (name: string): string => {
        // Prefer cleanFilename so trailing lang tags (简中/繁中/eng) do not split one episode into multiple tasks.
        const cleaned = cleanFilename(name);
        if (cleaned) return cleaned;
        const identity = identityByName.get(name) || assessMediaIdentity(name);
        return identity.shouldAutoSearchTmdb ? identity.title : fallbackBatchTitle;
      };

      const currentTasks = state.tasks.map(task => ({
        ...task,
        files: [...task.files]
      }));
      newFiles.forEach(file => {
        const fileEpKey = parseEpisodeKey(file.name);
        const fileBase = getBaseTitle(file.name).toLowerCase();
        const work = workIdentityFromFileName(file.name, fileEpKey);
        const taskId = mintTaskId(work);

        // Same-episode grouping (core/sameEpisode): episode number + timeline agreement.
        // Never merges differing episodes; uncertain pairs become a suggestion, not a merge.
        let suggestion: TaskPair['mergeSuggestion'];
        const fileCand = episodeCandidateOf(file);
        const matchedTask = currentTasks.find((t) => t.id === taskId) || currentTasks.find(t => {
          const sameBase = fileBase
            ? t.files.some(f => getBaseTitle(f.name).toLowerCase() === fileBase)
            : true;
          if (sameBase && (fileEpKey || t.epKey) && fileEpKey === t.epKey) return true;
          if (sameBase && !fileEpKey && !t.epKey) return true;
          const decisions = t.files.map(f => decideSameEpisode(fileCand, episodeCandidateOf(f)));
          if (decisions.some(d => d.kind === 'separate' && d.reason === 'episode-different')) return false;
          if (decisions.some(d => d.kind === 'merge')) return true;
          const hint = decisions.find(d => d.kind === 'suggest');
          if (hint && !suggestion) suggestion = { otherTaskId: t.id, score: hint.score, reason: hint.reason };
          return false;
        });

        if (matchedTask) {
          const fileExists = matchedTask.files.some(f => f.name === file.name);
          if (!fileExists) {
            matchedTask.files = [...matchedTask.files, file];
          } else {
            matchedTask.files = matchedTask.files.map(f => f.name === file.name ? file : f);
          }
        } else {
          const baseName = getBaseTitle(file.name);
          currentTasks.push({
            id: taskId,
            title: fileEpKey ? `${baseName || '待补充片名'} ${fileEpKey}` : (baseName || '待补充片名'),
            epKey: fileEpKey,
            zh: null,
            en: null,
            commentary: null,
            files: [file],
            status: "unpaired",
            ...(suggestion ? { mergeSuggestion: suggestion } : {}),
          });
        }
      });

      const optimizeTaskBindings = (task: TaskPair) => {
        const files = task.files;
        const commentaryFiles = files.filter(f =>
          f.isCommentary ||
          f.lang === 'commentary' ||
          /(commentary|comment|director|解说|导轨)/i.test(f.name)
        );
        const normalFiles = files.filter(f => !commentaryFiles.includes(f));

        // Main path: primary = 简中优先 / 繁中回退；
        // secondary = 真实英语对白优先（普通 eng 优于 SDH）；英语缺失或明显非对白时回退：
        // 西语 > 法语 > 葡/德/意 > 日 > 韩（Derek：拉丁字母语言可作第二语言，西语优先）。
        const zhFiles = normalFiles.filter(f => f.lang === 'zh' || f.lang === 'zh-CN' || f.lang === 'zh-TW');
        const enFiles = normalFiles.filter(f => isEnglishSecondaryLanguage(f.lang));
        const sourceLangFiles = normalFiles.filter(f => f.lang === 'ja' || f.lang === 'ko' || isLatinSecondaryLanguage(f.lang));
        const bilingualFiles = normalFiles.filter(f => f.lang === 'bilingual');

        const getBestFile = (list: Subfile[]): Subfile | null => {
          if (list.length === 0) return null;
          return [...list].sort((a, b) => {
            const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            if (aAss !== bAss) return bAss - aAss;
            return b.size - a.size;
          })[0];
        };

        const getBestPrimary = (list: Subfile[]): Subfile | null => {
          if (list.length === 0) return null;
          return [...list].sort((a, b) => {
            const rankDiff = mainPathPrimaryRank(b.lang) - mainPathPrimaryRank(a.lang);
            if (rankDiff !== 0) return rankDiff;
            const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            if (aAss !== bAss) return bAss - aAss;
            return b.size - a.size;
          })[0];
        };

        // 原文轨：普通 en 优先于 SDH/CC（后者常更大，旧逻辑会误绑）。勿改回纯体积优先。
        const bestZh = getBestPrimary(zhFiles);
        const primaryCueCount = bestZh ? estimateSubtitleCueCount(bestZh.text) : 0;

        const pickDialogueEnglish = (): Subfile | null => {
          if (enFiles.length === 0) return null;
          const ranked = [...enFiles].sort((a, b) => {
            const rankDiff = mainPathSecondaryRank(b.name, b.lang) - mainPathSecondaryRank(a.name, a.lang);
            if (rankDiff !== 0) return rankDiff;
            const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
            if (aAss !== bAss) return bAss - aAss;
            return b.size - a.size;
          });
          // Prefer a non-SDH English track whose cue count looks like dialogue vs primary.
          const nonSdh = ranked.filter((file) => !isSdhOrCcSubtitleFilename(file.name) && !file.isSdh);
          const dialoguePool = (nonSdh.length > 0 ? nonSdh : ranked).filter((file) => {
            if (primaryCueCount <= 0) return true;
            return !isSparseSecondaryTrack(primaryCueCount, estimateSubtitleCueCount(file.text));
          });
          if (dialoguePool.length > 0) return dialoguePool[0];
          // Only SDH remains and is not sparse → still usable (Stuart-only-SDH case).
          const sdhFallback = ranked.find((file) => {
            if (primaryCueCount <= 0) return true;
            return !isSparseSecondaryTrack(primaryCueCount, estimateSubtitleCueCount(file.text));
          });
          return sdhFallback || null;
        };

        const pickSourceLanguageFallback = (): Subfile | null => {
          if (sourceLangFiles.length === 0) return null;
          return [...sourceLangFiles].sort((a, b) => {
            const rankDiff = mainPathSecondaryRank(b.name, b.lang) - mainPathSecondaryRank(a.name, a.lang);
            if (rankDiff !== 0) return rankDiff;
            if (primaryCueCount > 0) {
              const aCount = estimateSubtitleCueCount(a.text);
              const bCount = estimateSubtitleCueCount(b.text);
              const aSparse = isSparseSecondaryTrack(primaryCueCount, aCount) ? 1 : 0;
              const bSparse = isSparseSecondaryTrack(primaryCueCount, bCount) ? 1 : 0;
              if (aSparse !== bSparse) return aSparse - bSparse;
              const aDelta = Math.abs(aCount - primaryCueCount);
              const bDelta = Math.abs(bCount - primaryCueCount);
              if (aDelta !== bDelta) return aDelta - bDelta;
            }
            return b.size - a.size;
          })[0];
        };

        const bestEnDialogue = pickDialogueEnglish();
        const bestSourceFallback = !bestEnDialogue ? pickSourceLanguageFallback() : null;
        const bestSecondary = bestEnDialogue || bestSourceFallback;
        const bestBilingual = getBestFile(bilingualFiles);
        const bestCommentary = getBestFile(commentaryFiles);

        task.commentary = bestCommentary;

        if (bestZh && bestSecondary) {
          task.zh = bestZh;
          task.en = bestSecondary;
          task.isBilingualSingle = false;
          if (!bestEnDialogue && bestSourceFallback) {
            // Toast only once per optimize pass via deferred notice from processFiles caller path.
            setTimeout(() => {
              get().setStatusNotice({
                id: 'secondary-source-fallback',
                tone: 'notice',
                title: isLatinSecondaryLanguage(bestSourceFallback.lang) ? '第二语言已绑定' : '副字幕已回退到源语言轨',
                message: `未找到可用的英语对白轨（缺失或行数过少），已绑定「${bestSourceFallback.name}」。可手动改绑。`,
              });
            }, 0);
          }
        } else if (bestBilingual) {
          task.zh = bestBilingual;
          task.en = null;
          task.isBilingualSingle = true;
        } else if (bestZh) {
          task.zh = bestZh;
          task.en = null;
          task.isBilingualSingle = false;
          if (enFiles.length > 0 && !bestEnDialogue) {
            setTimeout(() => {
              get().setStatusNotice({
                id: 'secondary-en-sparse',
                tone: 'notice',
                title: '英语轨未自动绑定',
                message: '检测到的英语文件行数远少于主字幕，更像屏显/稀疏字幕；可手动指定副字幕，或改用西语、法语、日语等其他语言轨。',
              });
            }, 0);
          }
        } else if (bestSecondary) {
          task.zh = null;
          task.en = bestSecondary;
          task.isBilingualSingle = false;
        } else {
          const bestAny = getBestFile(normalFiles);
          if (bestAny) {
            if (bestAny.lang === 'bilingual') {
              task.zh = bestAny;
              task.en = null;
              task.isBilingualSingle = true;
            } else if (isMainPathSecondaryLanguage(bestAny.lang)) {
              task.zh = null;
              task.en = bestAny;
              task.isBilingualSingle = false;
            } else if (mainPathPrimaryRank(bestAny.lang) > 0) {
              task.zh = bestAny;
              task.en = null;
              task.isBilingualSingle = false;
            } else {
              // 未识别出具体语种的拉丁文字（'latin'）等：不自动进原文槽；用户可手动绑定。
              task.zh = null;
              task.en = null;
              task.isBilingualSingle = false;
            }
          } else {
            task.zh = null;
            task.en = null;
            task.isBilingualSingle = false;
          }
        }

        task.status = task.isBilingualSingle || (task.zh && task.en) ? 'paired' : 'unpaired';
      };

      currentTasks.forEach(optimizeTaskBindings);

      // Update selectedTaskId and workflow step if empty
      setTimeout(() => {
        if (currentTasks.length > 0) {
          const activeId = get().selectedTaskId || currentTasks[0].id;
          get().selectTask(activeId);
        }
      }, 50);

      get().addLog(`已加载/更新 ${newFiles.length} 个文件。当前文件总数: ${updatedUploadedFiles.length}`, 'success');
      return { uploadedFiles: updatedUploadedFiles, tasks: currentTasks };
    });
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
    const { files, selectedTaskId, tasks, customFilename } = get();
    const currentTask = tasks.find(t => t.id === selectedTaskId);
    if (!files.zh && !files.en) return;

    const taskKey = reviewTaskKey(selectedTaskId, get().processedSubs);
    get().clearMergeReviewChecked(taskKey);
    set({ isProcessing: true, processedSubs: null });
    
    const notice = (info: AlignmentFallbackInfo, phase: 'primary' | 'auto-upgrade') => {
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
      // Ignore stale results if the user switched task while the worker ran.
      if (get().selectedTaskId !== selectedTaskId) return;
      set({ processedSubs: result.rows, previewIndex: 0, workflowStep: 2, editHistory: [], editFuture: [] });
      // Clear save point: a finished merge is restorable from 存档 after reload / leaving /.
      get().saveToLibrary();
    };
    const fail = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      get().addLog(`[异常] 合并失败: ${msg}`, 'error');
    };
    if (!mergeWorkerAvailable()) {
      try { apply(runMergeJobInThread(input, onEvent)); } catch (err) { fail(err); } finally { set({ isProcessing: false }); }
      return;
    }
    void runMergeJob(input, onEvent).then(apply).catch(fail).finally(() => {
      set({ isProcessing: false });
    });
  },

  restartSystem: () => {
    tmdbSearchRequestId += 1;
    tmdbSelectionRequestId += 1;
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
  }
}));
