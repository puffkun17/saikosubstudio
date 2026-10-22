import type { NamingMode } from '../core/taskModel';
import type { StatusNotice } from '../core/noticeChannel';
import type { ExportPresetId } from '../utils/exportPresets';
import type { HdrLevelId } from '../utils/hdrPresets';
import type { StyleTemplateRecord } from '../utils/styleLibrary';
import type {
  LineKind,
  StyleSettings,
  SubRow,
  SubtitleAttribution,
  SubtitleLanguagePair,
} from '../utils/subtitleCore';

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

export type TmdbMediaType = 'movie' | 'tv';

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

export type TmdbDetails = {
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

export type TmdbImages = {
  backdrops?: Array<{ file_path?: string }>;
  stills?: Array<{ file_path?: string }>;
};

export type TmdbManualInput = { title: string; year: string; type: TmdbMediaType; season: string; episode: string };
export type FilenameSource = 'auto' | 'tmdb' | 'manual' | 'library' | 'unknown';
/** 署名声明：导出 ASS 时写入 Script Info。 */
export type CreditDeclaration = 'none' | 'original' | 'ai-assisted' | 'translated';
export type TmdbConfirmationAction = 'auto_apply' | 'require_confirmation' | 'reject';

export type TmdbConfirmationDecision = {
  action: TmdbConfirmationAction;
  score: number;
  reasons: string[];
};

export type CustomTemplate = StyleTemplateRecord;

export type SubtitleEditRecord = {
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
