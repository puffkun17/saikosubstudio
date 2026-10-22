/**
 * TMDB search client: shared cache, runSearch, and result-merge helpers.
 * Used by searchTmdb / searchTmdbManual in the studio store.
 */

import { tmdbFetch } from '../services/tmdb';
import type { TmdbSuggestion } from '../store/types';

export const TMDB_CLIENT_CACHE_TTL_MS = 5 * 60_000;

const tmdbClientCache = new Map<string, { expiresAt: number; results: TmdbSuggestion[] }>();

/** Test / restart helper — clears the in-memory client cache. */
export const clearTmdbClientCache = (): void => {
  tmdbClientCache.clear();
};

export type TmdbSearchEndpoint = 'multi' | 'tv' | 'movie';

export type RunTmdbSearchOptions = {
  query: string;
  endpoint?: TmdbSearchEndpoint;
  /** Applied only when endpoint is `movie`. */
  year?: string;
  /**
   * `auto` (default): stamp media_type from endpoint and keep movie/tv only.
   * `manual`: drop adult only; caller stamps media_type later.
   */
  mode?: 'auto' | 'manual';
  /** Override fetch (tests). Defaults to tmdbFetch. */
  fetchFn?: (url: string) => Promise<Response>;
  /** Override "browser" gate for cache (tests). */
  cacheEnabled?: boolean;
};

export const mergeResults = (target: TmdbSuggestion[], incoming: TmdbSuggestion[]): void => {
  const keys = new Set(target.map((item) => `${item.media_type}:${item.id}`));
  incoming.forEach((item) => {
    const key = `${item.media_type}:${item.id}`;
    if (!keys.has(key)) {
      target.push(item);
      keys.add(key);
    }
  });
};

/** Dedupe trimmed queries with length ≥ 2, preserving first-seen order. */
export const uniqueQueries = (...groups: Array<string | string[] | undefined | null>): string[] => {
  const flat = groups.flatMap((g) => (Array.isArray(g) ? g : g ? [g] : []));
  return flat
    .map((q) => q.trim())
    .filter((q, index, arr) => q.length >= 2 && arr.indexOf(q) === index);
};

/** Strip year token and SxxExx / EPxx so TMDB multi-search works for TV filenames. */
export const prepareCleanQuery = (raw: string, year?: string): string => {
  let cleanQuery = raw;
  if (year) cleanQuery = cleanQuery.replace(year, '');
  cleanQuery = cleanQuery.replace(/\bS\d{1,4}E\d{1,4}\b/gi, '').replace(/\bEP\d{1,4}\b/gi, '');
  return cleanQuery.replace(/[\s.\-_]+/g, ' ').trim();
};

export const scriptPartsFromQuery = (cleanQuery: string): { chnPart: string; engPart: string } => {
  const chnMatch = cleanQuery.match(/[\u4e00-\u9fff]+/g);
  const engMatch = cleanQuery.match(/[a-zA-Z]+/g);
  return {
    chnPart: chnMatch ? chnMatch.join(' ') : '',
    engPart: engMatch ? engMatch.join(' ') : '',
  };
};

export const runSearch = async (opts: RunTmdbSearchOptions): Promise<TmdbSuggestion[]> => {
  const endpoint = opts.endpoint ?? 'multi';
  const mode = opts.mode ?? 'auto';
  const year = opts.year || '';
  const yearParam = endpoint === 'movie' && year ? `&year=${year}` : '';
  const url = `search/${endpoint}?query=${encodeURIComponent(opts.query)}&language=zh-CN${yearParam}`;
  const cacheEnabled = opts.cacheEnabled ?? (typeof window !== 'undefined');
  if (cacheEnabled) {
    const cached = tmdbClientCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.results;
  }
  const fetchFn = opts.fetchFn ?? tmdbFetch;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const data = await res.json() as { results?: TmdbSuggestion[] };
  const searchResults = mode === 'manual'
    ? (data.results || []).filter((item) => !item.adult)
    : (data.results || [])
      .map((item) => ({
        ...item,
        media_type: item.media_type || (endpoint === 'multi' ? item.media_type : endpoint),
      }))
      .filter((item) => !item.adult && (item.media_type === 'movie' || item.media_type === 'tv'));
  if (cacheEnabled) {
    tmdbClientCache.set(url, { expiresAt: Date.now() + TMDB_CLIENT_CACHE_TTL_MS, results: searchResults });
  }
  return searchResults;
};
