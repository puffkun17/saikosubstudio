import type { StateCreator } from 'zustand';
import {
  evaluateCandidate,
  getConfirmationMessage,
  resolveDisambiguation,
  sortScoredCandidates,
  type TmdbMatchContext,
} from '../../core/tmdbMatch';
import {
  mergeResults,
  prepareCleanQuery,
  runSearch,
  scriptPartsFromQuery,
  uniqueQueries,
} from '../../core/tmdbSearch';
import { tmdbFetch } from '../../services/tmdb';
import {
  assessMediaIdentity,
  buildTmdbSearchQueries,
  cleanFilename,
  parseMediaFilename,
} from '../../utils/subtitleCore';
import { assessTvYearFit, parseSeasonNumber, parseYearToken } from '../../utils/tmdbCandidateFit';
import {
  compareTmdbRank,
  isHighConfidenceTmdbPick,
  rankTmdbCandidates,
} from '../../utils/tmdbSearchRank';
import type {
  StudioState,
  TmdbDetails,
  TmdbImages,
  TmdbMediaType,
  TmdbMetadata,
  TmdbSuggestion,
} from '../types';

let tmdbSearchRequestId = 0;
let tmdbSelectionRequestId = 0;

/** Bump both gates so in-flight TMDB search/selection results are ignored. */
export function invalidateTmdbRequests() {
  tmdbSearchRequestId += 1;
  tmdbSelectionRequestId += 1;
}

/** Bump selection gate only (e.g. on selectTask). */
export function bumpTmdbSelectionRequestId() {
  tmdbSelectionRequestId += 1;
}

/** 任务显示名（第二幕底栏、标签）：中文片名 + 集号，例如「幸运女神 S01E01」。不是文件名。 */
export const taskDisplayTitle = (meta: { title: string; originalTitle?: string } | null | undefined, episodeKey?: string): string =>
  [meta?.title || meta?.originalTitle || '', (episodeKey || '').toUpperCase()].filter(Boolean).join(' ');

export type MediaTmdbSlice = Pick<
  StudioState,
  | 'tmdbData'
  | 'tmdbBackdrop'
  | 'tmdbBackdropList'
  | 'isSearchingTmdb'
  | 'tmdbManualOpen'
  | 'tmdbManualInput'
  | 'tmdbSuggestions'
  | 'tmdbAlternateSuggestion'
  | 'selectedSuggestion'
  | 'setTmdbData'
  | 'setTmdbBackdrop'
  | 'shuffleBackdrop'
  | 'setTmdbManualOpen'
  | 'setTmdbManualInput'
  | 'setTmdbSuggestions'
  | 'setSelectedSuggestion'
  | 'swapTmdbAlternate'
  | 'searchTmdb'
  | 'searchTmdbManual'
  | 'selectTmdbSuggestion'
>;

/** Per-slice reset partial for cancelCurrentUpload / restartSystem (S3). */
export function resetMediaTmdb(_kind: 'cancel' | 'restart'): Partial<StudioState> {
  return {
    tmdbData: null,
    tmdbBackdrop: null,
    tmdbBackdropList: [],
    tmdbSuggestions: [],
    tmdbAlternateSuggestion: null,
    selectedSuggestion: null,
    tmdbManualOpen: false,
    isSearchingTmdb: false,
  };
}

export const createMediaTmdbSlice: StateCreator<StudioState, [], [], MediaTmdbSlice> = (set, get) => ({
  tmdbData: null,
  tmdbBackdrop: null,
  tmdbBackdropList: [],
  isSearchingTmdb: false,
  tmdbManualOpen: false,
  tmdbManualInput: { title: '', year: '', type: 'movie', season: '1', episode: '1' },
  tmdbSuggestions: [],
  tmdbAlternateSuggestion: null,
  selectedSuggestion: null,
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
      // Clear spinner if we still own the search slot, even after a task switch (S8).
      // Result application still uses isCurrentRequest() (request id + selected task).
      if (requestId === tmdbSearchRequestId) set({ isSearchingTmdb: false });
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
});
