import { create } from 'zustand';
import { buildExportBaseFromMeta, type NamingMode } from '../core/taskModel';
import { executeRecognitionJob } from '../core/recognitionJob';
import { reviewTaskKey } from '../core/reviewKey';
import { historyIdFor } from '../core/identity';
import { mergeWorkerAvailable, runMergeJob, runMergeJobInThread } from '../core/mergeClient';
import type { MergeJobEvent, MergeJobInput, MergeJobResult } from '../core/mergeJob';
import type { AlignmentFallbackInfo } from '../utils/subtitleCore';
import { SubRow, StyleSettings, SubtitleAttribution, SubtitleLanguagePair, smartDetectTitle, mergeSubtitles, alignSubtitlesIndustrial, extractStylesFromAss, extractSubtitleAttributions, cleanFilename, normalizeSingleBilingualRows, parseMediaFilename, buildTmdbSearchQueries, assessMediaIdentity, isMainPathSecondaryLanguage, measureMergeOrphanRate } from '../utils/subtitleCore';
import { assessTvYearFit, parseSeasonNumber, parseYearToken } from '../utils/tmdbCandidateFit';
import { tmdbFetch } from '../services/tmdb';
import {
  compareTmdbRank,
  isHighConfidenceTmdbPick,
  rankTmdbCandidates,
} from '../utils/tmdbSearchRank';
import {
  evaluateCandidate,
  getConfirmationMessage,
  resolveDisambiguation,
  sortScoredCandidates,
  type TmdbMatchContext,
} from '../core/tmdbMatch';
import {
  mergeResults,
  prepareCleanQuery,
  runSearch,
  scriptPartsFromQuery,
  uniqueQueries,
} from '../core/tmdbSearch';
import { groupAndBindFiles } from '../core/taskGrouping';
import type {
  StudioState,
  Subfile,
  TmdbDetails,
  TmdbImages,
  TmdbMediaType,
  TmdbMetadata,
  TmdbSuggestion,
} from './types';
import { createFeedbackSlice } from './slices/feedback';
import { createCreditSlice } from './slices/credit';
import { createStyleSlice } from './slices/style';
import { createTheaterSlice } from './slices/theater';
import { createHistorySlice } from './slices/history';
import { createWorkbenchSlice } from './slices/workbench';

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

let tmdbSearchRequestId = 0;
let tmdbSelectionRequestId = 0;

const normalizeMediaIdentityTitle = (value: string) => cleanFilename(value).toLowerCase().replace(/\s+/g, ' ').trim();

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

export const useStudioStore = create<StudioState>()((set, get, api) => ({
  ...createFeedbackSlice(set, get, api),
  ...createCreditSlice(set, get, api),
  ...createStyleSlice(set, get, api),
  ...createTheaterSlice(set, get, api),
  ...createHistorySlice(set, get, api),
  ...createWorkbenchSlice(set, get, api),
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
  tmdbData: null,
  tmdbBackdrop: null,
  tmdbBackdropList: [],
  isSearchingTmdb: false,
  tmdbManualOpen: false,
  tmdbManualInput: { title: '', year: '', type: 'movie', season: '1', episode: '1' },
  tmdbSuggestions: [],
  tmdbAlternateSuggestion: null,
  selectedSuggestion: null,
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
  setTasks: (tasks) => set(state => {
    const nextTasks = typeof tasks === 'function' ? tasks(state.tasks) : tasks;
    return { tasks: nextTasks };
  }),
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
      const cleanQuery = prepareCleanQuery(searchQueries[0] || searchStr, year);
      const { chnPart, engPart } = scriptPartsFromQuery(cleanQuery);

      const runAutoSearch = (q: string, endpoint: 'multi' | 'tv' | 'movie' = 'multi') =>
        runSearch({ query: q, endpoint, year, mode: 'auto' });

      const candidateQueries = uniqueQueries(searchQueries, cleanQuery, chnPart, engPart);
      const scoringQueries = uniqueQueries(
        parsed.hasUsableTitle ? parsed.title : '',
        fallbackParsed?.hasUsableTitle ? fallbackParsed.title : '',
        searchTitle,
        cleanQuery,
      );

      const results: TmdbSuggestion[] = [];
      for (const q of candidateQueries) {
        const previousCount = results.length;
        if (isEpisodeQuery) {
          mergeResults(results, await runAutoSearch(q, 'tv'));
          mergeResults(results, await runAutoSearch(q, 'multi'));
        } else {
          if (year) mergeResults(results, await runAutoSearch(q, 'movie'));
          if (!year || results.length === previousCount) {
            mergeResults(results, await runAutoSearch(q, 'multi'));
          }
        }
        if (!isEpisodeQuery && year && q === candidateQueries[0] && results.length > previousCount) break;
        if (q !== candidateQueries[0] && results.length > previousCount) break;
        if (results.length >= 8) break;
      }

      const expectedMediaType: TmdbMediaType | undefined = isEpisodeQuery
        ? 'tv'
        : year || parsed.mediaHint === 'movie' || fallbackParsed?.mediaHint === 'movie'
          ? 'movie'
          : undefined;
      const matchCtx: TmdbMatchContext = {
        isEpisodeQuery,
        year,
        seasonHint,
        scoringQueries,
        expectedMediaType,
      };

      const hasExactMatch = results.some((item) => evaluateCandidate(item, matchCtx).score >= 50);

      // Multi-split colon search fallback
      if (!hasExactMatch && cleanQuery.includes(' ') && !cleanQuery.includes(':')) {
        const spacesCount = (cleanQuery.match(/ /g) || []).length;
        if (spacesCount <= 3) {
          const words = cleanQuery.split(' ');
          for (let k = 1; k < words.length; k++) {
            const part1 = words.slice(0, k).join(' ');
            const part2 = words.slice(k).join(' ');
            const colonQuery = `${part1}: ${part2}`;
            const extraResults = await runAutoSearch(colonQuery, isEpisodeQuery ? 'tv' : 'multi');
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

      const scored = sortScoredCandidates(results.map((item) => {
        const decision = evaluateCandidate(item, matchCtx);
        const relDate = item.release_date || item.first_air_date || '';
        const itemYear = relDate.substring(0, 4);
        const displayTitle = item.title || item.name || '';
        const displayYear = itemYear ? ` (${itemYear})` : '';
        if (!silent) get().addLog(`[候选] ${displayTitle}${displayYear}`, 'info');
        return { item, score: decision.score, decision };
      }));

      const {
        needsYearDisambiguation,
        sortedResults,
        bestScored,
        luckyAlternate,
      } = resolveDisambiguation({
        scored,
        isEpisodeQuery,
        year,
        seasonHint,
      });

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
            message: getConfirmationMessage(decision, isEpisodeQuery),
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
      // 剧集年份只做客户端筛选：API 的 year 会按首播年硬过滤，会丢掉「发行年/观影年」软匹配。
      const runManualSearch = (q: string) =>
        runSearch({ query: q, endpoint: type, year, mode: 'manual' });

      const candidateQueries = buildTmdbSearchQueries(searchStr, 12);
      const scoringQueries = uniqueQueries(candidateQueries.length > 0 ? candidateQueries : [searchStr]);
      const results: TmdbSuggestion[] = [];

      for (const q of scoringQueries) {
        const incoming = await runManualSearch(q);
        mergeResults(results, incoming);
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
            const extraResults = await runManualSearch(colonQuery);
            const previousCount = results.length;
            mergeResults(results, extraResults);
            if (results.length > previousCount) break;
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
    set({ uploadedFiles, tasks });

    // Deferred notices (was setTimeout inside optimizeTaskBindings).
    notices.forEach((notice) => {
      setTimeout(() => get().setStatusNotice(notice), 0);
    });

    // Update selectedTaskId and workflow step if empty
    setTimeout(() => {
      if (tasks.length > 0) {
        const activeId = get().selectedTaskId || tasks[0].id;
        get().selectTask(activeId);
      }
    }, 50);

    get().addLog(`已加载/更新 ${newFiles.length} 个文件。当前文件总数: ${uploadedFiles.length}`, 'success');
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
