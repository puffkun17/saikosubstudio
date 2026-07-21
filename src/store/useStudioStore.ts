import { create } from 'zustand';
import { SubRow, StyleSettings, SubtitleAttribution, SubtitleLanguagePair, smartDetectTitle, mergeSubtitles, alignSubtitlesIndustrial, extractStylesFromAss, extractSubtitleAttributions, parseSubtitle, cleanFilename, normalizeSingleBilingualRows, parseMediaFilename, buildTmdbSearchQueries, assessMediaIdentity } from '../utils/subtitleCore';
import { estimateJsonBytes, readJsonStorage, writeJsonStorage } from '../utils/localPersistence';
import { tmdbFetch } from '../services/tmdb';

const LIBRARY_STORAGE_KEY = 'nexus_subtitle_library';
const STYLE_STORAGE_KEY = 'nexus_subtitle_styles_v4';
const MAX_LIBRARY_ITEMS = 12;
const MAX_LIBRARY_BYTES = 4_000_000;

const fitLibraryToStorageBudget = (items: LibraryItem[]): LibraryItem[] => {
  const limited = items.slice(0, MAX_LIBRARY_ITEMS);
  while (limited.length > 1 && estimateJsonBytes(limited) > MAX_LIBRARY_BYTES) limited.pop();
  return limited;
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

export interface StatusNotice {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
  meta?: string;
  action?: FeedbackAction;
  actionLabel?: string;
  createdAt: number;
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
type TmdbConfirmationAction = 'auto_apply' | 'require_confirmation' | 'reject';

type TmdbConfirmationDecision = {
  action: TmdbConfirmationAction;
  score: number;
  reasons: string[];
};

type CustomTemplate = {
  id: string;
  name: string;
  styles: StyleSettings;
};

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
  /** 放映厅关灯模式：压暗全局界面，只保留放映区。 */
  isLightsOff: boolean;
  /** 字幕文本编辑历史（跨组件持久，抽屉开关不丢栈）。 */
  editHistory: SubtitleEditRecord[];
  editFuture: SubtitleEditRecord[];

  // Actions
  setAlignmentMode: (mode: 'standard' | 'industrial') => void;
  setCreatorCredit: (credit: string) => void;
  setAppendCreatorCredit: (enabled: boolean) => void;
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
  setSelectedTaskId: (id: string | null) => void;
  setTmdbData: (data: TmdbMetadata | null) => void;
  setTmdbBackdrop: (url: string | null) => void;
  setIsTemplateLab: (val: boolean) => void;
  setCustomStyle: (style: StyleSettings) => void;
  saveCustomTemplate: (name: string) => void;
  deleteCustomTemplate: (id: string) => void;
  setPreviewIndex: (idx: number) => void;
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
  setLightsOff: (on: boolean) => void;
  setShowAllSubs: (show: boolean) => void;
  setShowAssHint: (val: boolean) => void;
  setTasks: (tasks: TaskPair[] | ((prev: TaskPair[]) => TaskPair[])) => void;
  setRefScreenshot: (url: string | null) => void;
  triggerTempGuides: () => void;
  searchTmdb: (query: string, options?: { silent?: boolean; fallbackTitle?: string }) => Promise<void>;
  searchTmdbManual: (query: string, type: TmdbMediaType, year: string) => Promise<void>;
  selectTmdbSuggestion: (s: TmdbSuggestion, options?: { silent?: boolean }) => Promise<void>;
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
  deleteFromLibrary: (id: string) => void;
  loadFromLibrary: (item: LibraryItem) => void;
  processFiles: (files: Subfile[]) => void;
  runSubtitleMerge: () => void;
  restartSystem: () => void;
}

let tempShowTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tmdbSearchRequestId = 0;
let tmdbSelectionRequestId = 0;

const TMDB_CLIENT_CACHE_TTL_MS = 5 * 60_000;
const tmdbClientCache = new Map<string, { expiresAt: number; results: TmdbSuggestion[] }>();

const normalizeMediaIdentityTitle = (value: string) => cleanFilename(value).toLowerCase().replace(/\s+/g, ' ').trim();

const formatTmdbOutputName = (meta: TmdbMetadata, episodeKey?: string) => {
  const parts = [meta.title, meta.year].filter(Boolean);
  if (episodeKey) parts.push(episodeKey.toUpperCase());
  return parts.join('.');
};

export const useStudioStore = create<StudioState>((set, get) => ({
  workflowStep: 1,
  isIngestClearing: false,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown',
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
  isLightsOff: false,
  editHistory: [],
  editFuture: [],

  setAlignmentMode: (alignmentMode) => set({ alignmentMode }),
  setCreatorCredit: (creatorCredit) => set({ creatorCredit }),
  setAppendCreatorCredit: (appendCreatorCredit) => set({ appendCreatorCredit }),
  setLibraryOpen: (isLibraryOpen) => set({ isLibraryOpen }),
  setWorkflowStep: (step) => set({ workflowStep: step }),
  setIngestClearing: (isIngestClearing) => set({ isIngestClearing }),
  setLang: (lang) => set({ lang }),
  addLog: (msg, type = 'info') => {
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
      const existing = state.statusNotices.filter(item => item.id !== notice.id);
      return { statusNotices: [...existing, nextNotice].slice(-3) };
    });
  },
  dismissStatusNotice: (id) => set(state => ({
    statusNotices: state.statusNotices.filter(item => item.id !== id)
  })),
  clearStatusNotices: () => set({ statusNotices: [] }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setCustomFilename: (customFilename, source = 'manual') => set({ customFilename, filenameSource: source }),
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
  saveCustomTemplate: (name) => {
    set((state) => {
      const newTemplate = { id: `tpl_${Date.now()}`, name, styles: state.customStyle };
      const newTemplates = [...state.customTemplates, newTemplate];
      return { customTemplates: newTemplates, activePreset: newTemplate.id };
    });
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
  setPreviewClockMs: (previewClockMs) => set({ previewClockMs }),
  setIsPreviewPlaying: (isPreviewPlaying) => set({ isPreviewPlaying }),
  setSceneBackground: (sceneBackground) => set({ sceneBackground }),
  setTheaterAspect: (theaterAspect) => set((state) => ({
    theaterAspect,
    customStyle: {
      ...state.customStyle,
      aspectRatio: theaterAspect === '4:3' || theaterAspect === '2.39:1' || theaterAspect === '1.9:1'
        ? theaterAspect
        : '16:9',
    },
  })),
  setShowGuides: (showGuides) => set({ showGuides }),
  setTempShowGuides: (tempShowGuides) => set({ tempShowGuides }),
  setJumpLineVal: (jumpLineVal) => set({ jumpLineVal }),
  setTmdbManualOpen: (tmdbManualOpen) => set({ tmdbManualOpen }),
  setTmdbManualInput: (tmdbManualInput) => set({ tmdbManualInput }),
  setTmdbSuggestions: (tmdbSuggestions) => set({ tmdbSuggestions }),
  setSelectedSuggestion: (selectedSuggestion) => set({ selectedSuggestion }),
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
    get().updateSubtitleText(index, text);
    set(state => ({
      editHistory: [...state.editHistory, { index, before: row.text, after: text }].slice(-50),
      editFuture: [],
    }));
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
          message: '已识别季集信息，输入片名后即可匹配影片资料。',
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
      const year = !isEpisodeQuery ? (parsed.year || fallbackParsed?.year || yearMatch?.[1] || '') : '';
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
          .filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
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
        if (year && itemYear === year) {
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
          if (normTitle && normQ && (normTitle.includes(normQ) || normOrigTitle.includes(normQ) || normQ.includes(normTitle) || normQ.includes(normOrigTitle))) {
            reasons.push('title:contains');
            if (titleMatchStrength === 0) titleMatchStrength = 1;
            return 20;
          }
          if (looseQ && (looseTitle.includes(looseQ) || looseOrigTitle.includes(looseQ) || looseQ.includes(looseTitle) || looseQ.includes(looseOrigTitle))) {
            reasons.push('title:loose-contains');
            if (titleMatchStrength === 0) titleMatchStrength = 1;
            return 24;
          }
          return 0;
        });
        score += Math.max(0, ...queryScores);

        const autoConfirmThreshold = isEpisodeQuery ? 100 : year ? 80 : 50;
        const vetoes: string[] = [];
        if (expectedMediaType && item.media_type && item.media_type !== expectedMediaType) {
          vetoes.push('veto:type');
        }
        if (year && itemYear && itemYear !== year) {
          vetoes.push('veto:year');
        }
        if (!isEpisodeQuery && isAncillaryMovieCandidate(item)) {
          vetoes.push('veto:ancillary');
        }
        if (year && titleMatchStrength === 1) {
          vetoes.push('veto:title-contains-only');
        }
        if (vetoes.includes('veto:type')) {
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
        if (reasons.includes('veto:year')) return '结果年份与文件名年份不一致，请确认后应用。';
        if (reasons.includes('veto:ancillary')) return '结果可能是纪录片、花絮或特别篇，请确认是否为正片。';
        if (reasons.includes('veto:title-contains-only')) return '结果标题仅部分包含片名，请确认后应用。';
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

      scored.sort((a, b) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0));
      const sortedResults = scored.map((s) => s.item).slice(0, 5);
      const bestScored = scored[0];

      if (!isCurrentRequest()) return;
      set({ tmdbSuggestions: sortedResults });

      if (sortedResults.length > 0) {
        const best = sortedResults[0];
        const decision = bestScored?.decision;
        if (!decision || decision.action !== 'auto_apply') {
          if (!silent) get().addLog('已找到相近结果，请确认是否正确', 'info');
          get().setStatusNotice({
            id: 'media-match',
            tone: 'notice',
            title: '请确认影片信息',
            message: getConfirmationMessage(decision),
            meta: best.title || best.name || searchStr,
            action: 'openTmdbManual',
            actionLabel: '查看结果',
          });
          set({ tmdbManualOpen: !silent });
          return;
        }

        if (!silent) get().addLog('已找到匹配结果，正在应用', 'success');
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
        const url = `search/${type}?query=${encodeURIComponent(q)}&language=zh-CN${year ? `&year=${year}` : ''}`;
        const cached = typeof window !== 'undefined' ? tmdbClientCache.get(url) : undefined;
        if (cached && cached.expiresAt > Date.now()) return cached.results;
        const res = await tmdbFetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { results?: TmdbSuggestion[] };
        const searchResults = data.results || [];
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

      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const calculateItemScore = (item: TmdbSuggestion) => {
        const normTitle = normalize(item.title || item.name || '');
        const normOrigTitle = normalize(item.original_title || item.original_name || '');
        return Math.max(
          0,
          ...scoringQueries.map((query) => {
            const normQ = normalize(query);
            if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) return 50;
            if (normTitle && normQ && (normTitle.includes(normQ) || normOrigTitle.includes(normQ) || normQ.includes(normTitle) || normQ.includes(normOrigTitle))) return 20;
            return 0;
          })
        );
      };

      const hasExactMatch = results.some((item) => calculateItemScore(item) >= 50);

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

      const scored = results.map((item) => {
        let score = 0;
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        if (year && itemYear === year) {
          score += 100;
        }

        const normTitle = normalize(item.title || item.name || '');
        const normOrigTitle = normalize(item.original_title || item.original_name || '');
        const queryScores = scoringQueries.map((query) => {
          const normQ = normalize(query);
          if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) return 50;
          if (normTitle && normQ && (normTitle.includes(normQ) || normOrigTitle.includes(normQ) || normQ.includes(normTitle) || normQ.includes(normOrigTitle))) return 20;
          return 0;
        });
        score += Math.max(0, ...queryScores);

        return { item: { ...item, media_type: type }, score };
      });

      scored.sort((a: { item: TmdbSuggestion; score: number }, b: { item: TmdbSuggestion; score: number }) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0));
      const sortedResults = scored.map((s: { item: TmdbSuggestion; score: number }) => s.item).slice(0, 10);
      if (!isCurrentRequest()) return;
      set({ tmdbSuggestions: sortedResults });
      
      sortedResults.forEach((item) => {
        const title = item.title || item.name || '';
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        const displayYear = itemYear ? ` (${itemYear})` : '';
        get().addLog(`[手动候选] ${title}${displayYear}`, 'info');
      });
      
      if (sortedResults.length > 0) {
        get().setStatusNotice({
          id: 'media-match',
          tone: 'notice',
          title: '请选择匹配结果',
          message: `已找到 ${sortedResults.length} 个结果，请选择正确的一项。`,
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
          message: '可尝试原文片名、去掉集标题，或补充年份后再搜索。',
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
      set({ tmdbData: meta, tmdbBackdrop: chosenBackdrop, tmdbBackdropList: backdrops });

      const activeTask = get().tasks.find(t => t.id === selectedTaskId);
      const epKey = activeTask?.epKey;
      const manualEpisodeKey = type === 'tv' && !epKey
        ? `S${String(tmdbManualInput.season).padStart(2, '0')}E${String(tmdbManualInput.episode).padStart(2, '0')}`
        : undefined;
      const formattedName = formatTmdbOutputName(meta, epKey || manualEpisodeKey);
      // Export name stays blank until user opts in via checklist checkboxes.
      if (selectedTaskId) {
        set(state => ({
          tasks: state.tasks.map(t => t.id === selectedTaskId ? { ...t, title: formattedName, tmdbData: meta, tmdbBackdrop: chosenBackdrop, tmdbBackdropList: backdrops } : t)
        }));
      }

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
    const savedLibrary = readJsonStorage<unknown>(LIBRARY_STORAGE_KEY, []);
    if (Array.isArray(savedLibrary)) set({ libraryList: fitLibraryToStorageBudget(savedLibrary as LibraryItem[]) });
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
      const formattedName = formatTmdbOutputName(resolvedMeta, task.epKey);
      set((state) => {
        const keepManual = state.filenameSource === 'manual' && Boolean(state.customFilename.trim());
        return {
          customFilename: keepManual ? state.customFilename : formattedName,
          filenameSource: keepManual ? 'manual' : 'tmdb',
          tasks: state.tasks.map((candidate) =>
            candidate.id === taskId
              ? {
                  ...candidate,
                  title: keepManual ? candidate.title : formattedName,
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
        }
    }
    set(state => ({
      tmdbManualInput: { 
         ...state.tmdbManualInput, 
         title: cleanName,
         type: type as 'tv' | 'movie',
         season,
         episode
      }
    }));

    if (!task.tmdbData && !inheritedMetadata && !get().tmdbData) {
      setTimeout(() => {
        if (cleanName) {
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
          } else if (trackKey === 'en' && selectedFile) {
            updated.isBilingualSingle = false;
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
    get().addLog('已对调主字幕与第二语言字幕', 'info');
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
          set({ selectedTaskId: null, files: { zh: null, en: null, commentary: null }, customFilename: '', filenameSource: 'unknown' });
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
          set({ selectedTaskId: null, files: { zh: null, en: null, commentary: null }, customFilename: '', filenameSource: 'unknown' });
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
      isLightsOff: false
    });
    get().addLog("已取消本次导入", "info");
  },

  saveToLibrary: () => {
    const { processedSubs, customFilename, tmdbBackdrop, tmdbBackdropList, customStyle, libraryList } = get();
    if (!processedSubs || processedSubs.length === 0) return;
    const name = customFilename || '未命名字幕';
    const newItem: LibraryItem = {
      id: `lib_${Date.now()}`,
      name: name,
      date: new Date().toLocaleString(),
      subs: processedSubs,
      backdrop: tmdbBackdrop,
      backdropList: tmdbBackdropList,
      customStyle: customStyle
    };
    const updatedLib = fitLibraryToStorageBudget([newItem, ...libraryList]);
    if (estimateJsonBytes(updatedLib) > MAX_LIBRARY_BYTES) {
      get().addLog('当前字幕体积超过本地存档容量，请直接导出文件保存', 'error');
      return;
    }
    const persisted = writeJsonStorage(LIBRARY_STORAGE_KEY, updatedLib);
    if ('error' in persisted) {
      get().addLog(`本地存档失败: ${persisted.error}`, 'error');
      return;
    }
    set({ libraryList: updatedLib });
    get().addLog(`[存入] 已成功存入系统字幕库: ${name}`, "success");
  },

  deleteFromLibrary: (id) => {
    set(state => {
      const updatedLib = state.libraryList.filter(item => item.id !== id);
      if (typeof window !== 'undefined') {
        writeJsonStorage(LIBRARY_STORAGE_KEY, updatedLib);
      }
      get().addLog("已从系统字幕库中删除记录", "info");
      return { libraryList: updatedLib };
    });
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

  processFiles: (newFiles) => {
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

      const parseEpisodeKey = (name: string): string | undefined => parsedByName.get(name)?.episodeKey || parseMediaFilename(name).episodeKey;
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

        const matchedTask = currentTasks.find(t => {
          const sameBase = fileBase
            ? t.files.some(f => getBaseTitle(f.name).toLowerCase() === fileBase)
            : true;
          if (!sameBase) return false;
          if (fileEpKey || t.epKey) return fileEpKey === t.epKey;
          return true;
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
          const newTask = {
            id: `task_${fileEpKey ? "tv_" + fileEpKey : "movie_" + fileBase}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            title: fileEpKey ? `${baseName || '待补充片名'} ${fileEpKey}` : (baseName || '待补充片名'),
            epKey: fileEpKey,
            zh: null,
            en: null,
            commentary: null,
            files: [file],
            status: "unpaired"
          };
          currentTasks.push(newTask);
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

        const zhFiles = normalFiles.filter(f => f.lang === 'zh' || f.lang === 'zh-CN' || f.lang === 'zh-TW');
        const foreignFiles = normalFiles.filter(f => ['en', 'ja', 'ko', 'fr', 'es', 'latin'].includes(f.lang));
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

        const bestZh = getBestFile(zhFiles);
        const bestForeign = getBestFile(foreignFiles);
        const bestBilingual = getBestFile(bilingualFiles);
        const bestCommentary = getBestFile(commentaryFiles);

        task.commentary = bestCommentary;

        if (bestZh && bestForeign) {
          task.zh = bestZh;
          task.en = bestForeign;
          task.isBilingualSingle = false;
        } else if (bestBilingual) {
          task.zh = bestBilingual;
          task.en = null;
          task.isBilingualSingle = true;
        } else if (bestZh) {
          task.zh = bestZh;
          task.en = null;
          task.isBilingualSingle = false;
        } else if (bestForeign) {
          task.zh = null;
          task.en = bestForeign;
          task.isBilingualSingle = false;
        } else {
          const bestAny = getBestFile(normalFiles);
          if (bestAny) {
            if (bestAny.lang === 'bilingual') {
              task.zh = bestAny;
              task.en = null;
              task.isBilingualSingle = true;
            } else if (['en', 'ja', 'ko', 'fr', 'es', 'latin'].includes(bestAny.lang)) {
              task.zh = null;
              task.en = bestAny;
              task.isBilingualSingle = false;
            } else {
              task.zh = bestAny;
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

  runSubtitleMerge: () => {
    const { files, selectedTaskId, tasks } = get();
    const currentTask = tasks.find(t => t.id === selectedTaskId);
    if (!files.zh && !files.en) return;

    set({ isProcessing: true, processedSubs: null });
    
    try {
      if (currentTask?.isBilingualSingle && files.zh) {
        // Single bilingual srt/ass parsing
        const rawParsed = parseSubtitle(files.zh.text);
        const parsed: SubRow[] = normalizeSingleBilingualRows(rawParsed);
        
        set({ processedSubs: parsed, previewIndex: 0, workflowStep: 2, editHistory: [], editFuture: [] });
        get().addLog(`已成功加载原生双语字幕，共包含 ${parsed.length} 行流数据，并自动完成双语拆轨`, 'success');
      } else {
        // Standard double merge
        const zhParsed = parseSubtitle(files.zh?.text || '');
        const enParsed = parseSubtitle(files.en?.text || '');
        const commParsed = parseSubtitle(files.commentary?.text || '');

        const { alignmentMode } = get();
        const merged = alignmentMode === 'industrial'
          ? alignSubtitlesIndustrial(zhParsed, enParsed, commParsed, (m, t) => get().addLog(m, t), {
              onFallback: (info) => {
                if (info.reason === 'banded') {
                  get().setStatusNotice({
                    id: 'alignment-banded',
                    tone: 'notice',
                    title: '已启用带状对齐',
                    message: `字幕体量较大（约 ${Math.round(info.cells / 1_000_000)}M 对齐单元），使用带宽 ${((info.bandHalfWidth ?? 0) * 2) + 1} 的工业对齐以控制内存。`,
                  });
                  return;
                }
                get().setStatusNotice({
                  id: 'alignment-fallback',
                  tone: 'notice',
                  title: '已切换快速对齐',
                  message: `字幕体量较大（约 ${Math.round(info.cells / 1_000_000)}M 对齐单元），已用低内存快速合并，建议人工复核时间轴。`,
                });
              },
            })
          : mergeSubtitles(zhParsed, enParsed, commParsed, (m, t) => get().addLog(m, t));
        set({ processedSubs: merged, previewIndex: 0, workflowStep: 2, editHistory: [], editFuture: [] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      get().addLog(`[异常] 合并失败: ${msg}`, 'error');
    } finally {
      set({ isProcessing: false });
    }
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
      isLightsOff: false
    });
    get().addLog("已重启工作流，准备新导入", "info");
  }
}));
