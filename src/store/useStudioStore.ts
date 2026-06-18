import { create } from 'zustand';
import { SubRow, StyleSettings, smartDetectTitle, mergeSubtitles, alignSubtitlesIndustrial, autoSignature, extractStylesFromAss, parseSubtitle, cleanFilename, normalizeSingleBilingualRows, parseMediaFilename, buildTmdbSearchQueries, assessMediaIdentity } from '../utils/subtitleCore';

export interface Subfile {
  id: string;
  name: string;
  text: string;
  lang: string;
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

type CustomTemplate = {
  id: string;
  name: string;
  styles: StyleSettings;
};

export interface StudioState {
  workflowStep: number;
  files: { zh: Subfile | null; en: Subfile | null; commentary: Subfile | null };
  customFilename: string;
  filenameSource: FilenameSource;
  uploadedFiles: Subfile[];
  tasks: TaskPair[];
  selectedTaskId: string | null;
  libraryList: LibraryItem[];
  tmdbData: TmdbMetadata | null;
  tmdbBackdrop: string | null;
  isSearchingTmdb: boolean;
  isTemplateLab: boolean;
  customStyle: StyleSettings;
  customTemplates: CustomTemplate[];
  logs: LogEntry[];
  previewIndex: number;
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

  // Actions
  setAlignmentMode: (mode: 'standard' | 'industrial') => void;
  setWorkflowStep: (step: number) => void;
  setLang: (lang: 'zh' | 'en') => void;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
  clearLogs: () => void;
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

export const useStudioStore = create<StudioState>((set, get) => ({
  workflowStep: 1,
  files: { zh: null, en: null, commentary: null },
  customFilename: '',
  filenameSource: 'unknown',
  uploadedFiles: [],
  tasks: [],
  selectedTaskId: null,
  libraryList: [],
  tmdbData: null,
  tmdbBackdrop: null,
  tmdbBackdropList: [],
  isTemplateLab: false,
  customStyle: {
    zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20, resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top',
    // 字体家族默认（系统级，跨平台较稳）
    zhFontFamily: 'system-ui, sans-serif',
    enFontFamily: 'Helvetica Neue, Arial, sans-serif'
  },
  customTemplates: [],
  logs: [],
  previewIndex: 0,
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

  setAlignmentMode: (alignmentMode) => set({ alignmentMode }),
  setWorkflowStep: (step) => set({ workflowStep: step }),
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
    }, 6200);
    setTimeout(() => {
      set(state => ({
        logs: state.logs.filter(l => l.id !== id)
      }));
    }, 7000);
  },
  clearLogs: () => set({ logs: [] }),
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
  setCustomStyle: (customStyle) => set({ customStyle }),
  saveCustomTemplate: (name) => set((state) => {
    const newTemplate = { id: `tpl_${Date.now()}`, name, styles: state.customStyle };
    const newTemplates = [...state.customTemplates, newTemplate];
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('nexus_subtitle_styles_v4') || '{}');
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({ ...stored, templates: newTemplates }));
    }
    return { customTemplates: newTemplates, activePreset: newTemplate.id };
  }),
  deleteCustomTemplate: (id) => set((state) => {
    const newTemplates = state.customTemplates.filter(t => t.id !== id);
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('nexus_subtitle_styles_v4') || '{}');
      localStorage.setItem('nexus_subtitle_styles_v4', JSON.stringify({ ...stored, templates: newTemplates }));
    }
    return { customTemplates: newTemplates, activePreset: state.activePreset === id ? 'classic' : state.activePreset };
  }),
  setActivePreset: (activePreset) => set({ activePreset }),
  setPreviewIndex: (previewIndex) => set({ previewIndex }),
  setSceneBackground: (sceneBackground) => set({ sceneBackground }),
  setTheaterAspect: (theaterAspect) => set({ theaterAspect }),
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
        if (!silent) get().addLog(`已识别为 ${episodeKey}，请补充剧名以关联片源信息`, 'info');
      } else {
        set({ tmdbSuggestions: [], tmdbManualOpen: !silent });
        if (!silent) get().addLog('文件名信息不足，请补充片名后再关联片源信息', 'info');
      }
      return;
    }

    set({ isSearchingTmdb: true });
    if (!silent) get().addLog(`正在匹配片源信息`, 'info');
    
    try {
      const yearMatch = isEpisodeQuery ? null : searchStr.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : '';
      const searchQueries = buildTmdbSearchQueries(searchStr, 12);
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

      const runSearch = async (q: string, endpoint: 'multi' | 'tv' | 'movie' = 'multi') => {
        const url = `/api/tmdb/search/${endpoint}?query=${encodeURIComponent(q)}&language=zh-CN`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { results?: TmdbSuggestion[] };
        return (data.results || [])
          .map((item) => ({ ...item, media_type: item.media_type || (endpoint === 'multi' ? item.media_type : endpoint) }))
          .filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
      };

      const candidateQueries = [...searchQueries, cleanQuery, chnPart, engPart]
        .map(q => q.trim())
        .filter((q, index, arr) => q.length >= 2 && arr.indexOf(q) === index);
      const scoringQueries = candidateQueries.length > 0 ? candidateQueries : [cleanQuery];

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
          mergeResults(results, await runSearch(q, 'multi'));
        }
        if (q !== candidateQueries[0] && results.length > previousCount) break;
        if (results.length >= 8) break;
      }

      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizeLoose = (str: string) => str.toLowerCase().replace(/[\s._\-:：'"“”‘’（）()[\]【】]/g, '');

      // Helper function to calculate score for a single item
      const calculateItemScore = (item: TmdbSuggestion) => {
        let score = 0;
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        if (isEpisodeQuery) {
          score += item.media_type === 'tv' ? 180 : -180;
        }
        if (year && itemYear === year) {
          score += 100;
        }
        const normTitle = normalize(item.title || item.name || '');
        const normOrigTitle = normalize(item.original_title || item.original_name || '');
        const looseTitle = normalizeLoose(item.title || item.name || '');
        const looseOrigTitle = normalizeLoose(item.original_title || item.original_name || '');
        const queryScores = scoringQueries.map((query) => {
          const normQ = normalize(query);
          const looseQ = normalizeLoose(query);
          if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) {
            return isEpisodeQuery ? 180 : 60;
          }
          if (looseQ && (looseTitle === looseQ || looseOrigTitle === looseQ)) {
            return isEpisodeQuery ? 170 : 55;
          }
          if (normTitle && normQ && (normTitle.includes(normQ) || normOrigTitle.includes(normQ) || normQ.includes(normTitle) || normQ.includes(normOrigTitle))) {
            return 20;
          }
          if (looseQ && (looseTitle.includes(looseQ) || looseOrigTitle.includes(looseQ) || looseQ.includes(looseTitle) || looseQ.includes(looseOrigTitle))) {
            return 24;
          }
          return 0;
        });
        score += Math.max(0, ...queryScores);
        return score;
      };

      const hasExactMatch = results.some((item) => calculateItemScore(item) >= 50);

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
        let score = 0;
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        if (isEpisodeQuery) {
          score += item.media_type === 'tv' ? 180 : -180;
        }
        if (year && itemYear === year) {
          score += 100;
        }
        
        const normTitle = normalize(item.title || item.name || '');
        const normOrigTitle = normalize(item.original_title || item.original_name || '');
        const looseTitle = normalizeLoose(item.title || item.name || '');
        const looseOrigTitle = normalizeLoose(item.original_title || item.original_name || '');
        const queryScores = scoringQueries.map((query) => {
          const normQ = normalize(query);
          const looseQ = normalizeLoose(query);
          if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) {
            return isEpisodeQuery ? 180 : 60;
          }
          if (looseQ && (looseTitle === looseQ || looseOrigTitle === looseQ)) {
            return isEpisodeQuery ? 170 : 55;
          }
          if (normTitle && normQ && (normTitle.includes(normQ) || normOrigTitle.includes(normQ) || normQ.includes(normTitle) || normQ.includes(normOrigTitle))) {
            return 20;
          }
          if (looseQ && (looseTitle.includes(looseQ) || looseOrigTitle.includes(looseQ) || looseQ.includes(looseTitle) || looseQ.includes(looseOrigTitle))) {
            return 24;
          }
          return 0;
        });
        score += Math.max(0, ...queryScores);

        if (isEpisodeQuery && item.media_type !== 'tv') {
          score -= 120;
        }
        
        const displayTitle = item.title || item.name || '';
        const displayYear = itemYear ? ` (${itemYear})` : '';
        if (!silent) get().addLog(`[候选] ${displayTitle}${displayYear}`, 'info');
        
        return { item, score };
      });

      scored.sort((a: { item: TmdbSuggestion; score: number }, b: { item: TmdbSuggestion; score: number }) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0));
      const sortedResults = scored.map((s: { item: TmdbSuggestion; score: number }) => s.item).slice(0, 5);

      set({ tmdbSuggestions: sortedResults });

      if (sortedResults.length > 0) {
        if (!silent) get().addLog(`已找到候选片源，正在选择最匹配项`, "success");
        const best = sortedResults[0];
        if (isEpisodeQuery && best.media_type !== 'tv') {
          if (!silent) get().addLog(`已识别为剧集片源，需手动确认候选`, 'info');
          set({ tmdbManualOpen: !silent });
        } else {
          await get().selectTmdbSuggestion(best, { silent });
        }
      } else {
        const hasExistingMetadata = Boolean(get().tmdbData);
        if (!hasExistingMetadata) {
          set({ tmdbData: null, tmdbBackdrop: null });
        }
        if (!silent) get().addLog("暂未自动确认片源，可手动选择候选", "error");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (!silent) get().addLog(`片源匹配异常: ${message}`, "error");
    } finally {
      set({ isSearchingTmdb: false });
    }
  },

  searchTmdbManual: async (query, type, year) => {
    const rawSearchStr = query.trim();
    if (!rawSearchStr) return;
    
    const searchStr = cleanFilename(rawSearchStr);
    if (!searchStr) return;

    set({ isSearchingTmdb: true });
    get().addLog(`正在手动检索 ${type === 'movie' ? '电影' : '剧集'}: ${searchStr}...`, 'info');
    
    try {
      const runSearchManual = async (q: string) => {
        const url = `/api/tmdb/search/${type}?query=${encodeURIComponent(q)}&language=zh-CN${year ? `&year=${year}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { results?: TmdbSuggestion[] };
        return data.results || [];
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
      set({ tmdbSuggestions: sortedResults });
      
      sortedResults.forEach((item) => {
        const title = item.title || item.name || '';
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        const displayYear = itemYear ? ` (${itemYear})` : '';
        get().addLog(`[手动候选] ${title}${displayYear}`, 'info');
      });
      
      if (sortedResults.length > 0) {
        get().addLog(`手动检索到 ${sortedResults.length} 个候选匹配项，请点选确认`, "success");
      } else {
        get().addLog("未找到任何匹配候选！", "error");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      get().addLog(`手动搜索异常: ${message}`, "error");
    } finally {
      set({ isSearchingTmdb: false });
    }
  },

  selectTmdbSuggestion: async (s, options) => {
    const silent = options?.silent ?? false;
    set({ selectedSuggestion: s });
    const { selectedTaskId, tmdbManualInput } = get();
    if (!silent) get().addLog(`正在补全片源资料`, 'info');
    try {
      let type = s.media_type;
      if (!type) {
        type = (s.first_air_date || s.name || s.original_name) ? 'tv' : 'movie';
      }
      const detailRes = await fetch(
        `/api/tmdb/${type}/${s.id}?language=zh-CN&append_to_response=alternative_titles`
      );
      if (!detailRes.ok) throw new Error("获取详情失败");
      const details = await detailRes.json() as TmdbDetails;

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
        let imagesUrl = `/api/tmdb/${type}/${s.id}/images`;
        const activeTaskForEp = get().tasks.find(t => t.id === selectedTaskId);
        if (type === 'tv' && activeTaskForEp?.epKey) {
          const epMatch = activeTaskForEp.epKey.match(/S(\d+)E(\d+)/i);
          if (epMatch) {
            const seasonNum = parseInt(epMatch[1]);
            const episodeNum = parseInt(epMatch[2]);
            imagesUrl = `/api/tmdb/tv/${s.id}/season/${seasonNum}/episode/${episodeNum}/images`;
          }
        }
        const imgRes = await fetch(imagesUrl);
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

      set({ tmdbData: meta, tmdbBackdrop: chosenBackdrop, tmdbBackdropList: backdrops });

      let formattedName = meta.title;
      if (meta.year) {
        formattedName += `.${meta.year}`;
      }

      const activeTask = get().tasks.find(t => t.id === selectedTaskId);
      const epKey = activeTask?.epKey;

      if (type === 'tv' || epKey) {
        let seasonStr = String(tmdbManualInput.season).padStart(2, '0');
        let episodeStr = String(tmdbManualInput.episode).padStart(2, '0');
        if (epKey) {
          const match = epKey.match(/S(\d+)E(\d+)/i);
          if (match) {
            seasonStr = match[1];
            episodeStr = match[2];
          } else {
            const epMatch = epKey.match(/E(\d+)/i);
            if (epMatch) {
              episodeStr = epMatch[1];
            }
          }
        }
        formattedName += `.S${seasonStr}E${episodeStr}`;
      }
      set({ customFilename: formattedName, filenameSource: 'tmdb' });

      if (selectedTaskId) {
        set(state => ({
          tasks: state.tasks.map(t => t.id === selectedTaskId ? { ...t, title: formattedName, tmdbData: meta, tmdbBackdrop: chosenBackdrop, tmdbBackdropList: backdrops } : t)
        }));
      }

      if (!silent) get().addLog(`已关联片源：${meta.title}`, 'success');
      set({ tmdbManualOpen: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!silent) get().addLog(`片源资料获取失败: ${message}`, 'error');
    }
  },

  initializeLibrary: () => {
    if (typeof window === 'undefined') return;
    const savedLib = localStorage.getItem('nexus_subtitle_library');
    if (savedLib) {
      try { set({ libraryList: JSON.parse(savedLib) }); } catch {}
    }
    const savedStyles = localStorage.getItem('nexus_subtitle_styles_v4');
    if (savedStyles) {
      try {
        const { preset, style, templates } = JSON.parse(savedStyles);
        if (preset) set({ activePreset: preset });
        if (style) set({ customStyle: { resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', ...style } });
        if (templates) set({ customTemplates: templates });
      } catch {}
    }
    // TMDB key is now handled server-side via /api/tmdb proxy (no client-side key required).
    // Old localStorage key 'saiko_tmdb_api_key' is no longer used.
  },

  selectTask: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    set({
      selectedTaskId: taskId,
      files: { zh: task.zh, en: task.en, commentary: task.commentary },
      tmdbData: task.tmdbData || null,
      tmdbBackdrop: task.tmdbBackdrop || null,
      tmdbBackdropList: task.tmdbBackdropList || []
    });
    
    const detectTitle = smartDetectTitle(
      task.zh?.name || '',
      task.en?.name || '',
      task.zh?.text || '',
      task.en?.text || ''
    );
    const parsedFiles = task.files.map(file => parseMediaFilename(file.name));
    const parsedTitle = parsedFiles.find(item => item.hasUsableTitle);
    const displayTitle = parsedTitle?.title || detectTitle || task.title;
    set({ customFilename: displayTitle, filenameSource: 'auto' });

    const cleanName = (parsedTitle?.title || detectTitle).replace(/\.[^/.]+$/, "").trim();
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

    if (!task.tmdbData && !get().tmdbData) {
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
          activePreset: 'ass_native',
          customStyle: { ...get().customStyle, ...minedStyle } 
        });
        get().addLog('✅ 已自动应用文件内嵌 ASS 样式', 'success');
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
    set({
      workflowStep: 1,
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
      isProcessing: false
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
    const updatedLib = [newItem, ...libraryList];
    set({ libraryList: updatedLib });
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_subtitle_library', JSON.stringify(updatedLib));
    }
    get().addLog(`[存入] 已成功存入系统字幕库: ${name}`, "success");
  },

  deleteFromLibrary: (id) => {
    set(state => {
      const updatedLib = state.libraryList.filter(item => item.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexus_subtitle_library', JSON.stringify(updatedLib));
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
      workflowStep: 2
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

      const parsedByName = new Map(
        newFiles.map(file => [file.name, parseMediaFilename(file.name)])
      );
      const fallbackBatchTitle = [...parsedByName.values()]
        .filter(item => item.hasUsableTitle)
        .sort((a, b) => b.title.length - a.title.length)[0]?.title || '';

      const parseEpisodeKey = (name: string): string | undefined => parsedByName.get(name)?.episodeKey || parseMediaFilename(name).episodeKey;
      const getBaseTitle = (name: string): string => {
        const parsed = parsedByName.get(name) || parseMediaFilename(name);
        return parsed.hasUsableTitle ? parsed.title : fallbackBatchTitle;
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
            title: fileEpKey ? `${baseName || '待补充剧名'} ${fileEpKey}` : (baseName || '待补充片源'),
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
        const enFiles = normalFiles.filter(f => f.lang === 'en');
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
        const bestEn = getBestFile(enFiles);
        const bestBilingual = getBestFile(bilingualFiles);
        const bestCommentary = getBestFile(commentaryFiles);

        task.commentary = bestCommentary;

        if (bestZh && bestEn) {
          task.zh = bestZh;
          task.en = bestEn;
          task.isBilingualSingle = false;
        } else if (bestBilingual) {
          task.zh = bestBilingual;
          task.en = null;
          task.isBilingualSingle = true;
        } else if (bestZh) {
          task.zh = bestZh;
          task.en = null;
          task.isBilingualSingle = false;
        } else if (bestEn) {
          task.zh = null;
          task.en = bestEn;
          task.isBilingualSingle = false;
        } else {
          const bestAny = getBestFile(normalFiles);
          if (bestAny) {
            if (bestAny.lang === 'bilingual') {
              task.zh = bestAny;
              task.en = null;
              task.isBilingualSingle = true;
            } else if (bestAny.lang === 'en') {
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
        
        const finalSubs = autoSignature(parsed);
        set({ processedSubs: finalSubs, previewIndex: 0, workflowStep: 2 });
        get().addLog(`已成功加载原生双语字幕，共包含 ${finalSubs.length} 行流数据，并自动完成中英拆轨`, 'success');
      } else {
        // Standard double merge
        const zhParsed = parseSubtitle(files.zh?.text || '');
        const enParsed = parseSubtitle(files.en?.text || '');
        const commParsed = parseSubtitle(files.commentary?.text || '');

        const { alignmentMode } = get();
        const merged = alignmentMode === 'industrial'
          ? alignSubtitlesIndustrial(zhParsed, enParsed, commParsed, (m, t) => get().addLog(m, t))
          : mergeSubtitles(zhParsed, enParsed, commParsed, (m, t) => get().addLog(m, t));
        const finalSubs = autoSignature(merged);
        set({ processedSubs: finalSubs, previewIndex: 0, workflowStep: 2 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      get().addLog(`[异常] 合并失败: ${msg}`, 'error');
    } finally {
      set({ isProcessing: false });
    }
  },

  restartSystem: () => {
    set({
      workflowStep: 1,
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
      previewIndex: 0,
      processedSubs: null,
      showAllSubs: false
    });
    get().addLog("已重启工作流，准备新导入", "info");
  }
}));
