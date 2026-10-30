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

/**
 * TMDB 请求失败（429 限流 / 5xx 代理或上游故障）。
 * 以前 `!res.ok` 一律当成「没有结果」，限流和故障会被伪装成「未匹配到」；
 * 仪式需要区分「有答复」与「没答复」，所以这两类改为抛出。其余 4xx 仍按空结果处理。
 */
export class TmdbRequestError extends Error {
  readonly status: number;
  /** 仅 429：Retry-After 换算成毫秒；缺失或无法解析为 null。 */
  readonly retryAfterMs: number | null;
  constructor(status: number, retryAfterMs: number | null = null) {
    super(status === 429 ? '影片资料请求过于频繁，稍后自动重试' : `影片资料服务暂不可用（${status}）`);
    this.name = 'TmdbRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Retry-After: delta-seconds or HTTP-date → ms (null when absent / unparsable). */
export const parseRetryAfterMs = (value: string | null | undefined, now = Date.now()): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now);
};

export const isTmdbRateLimitError = (error: unknown): error is TmdbRequestError =>
  error instanceof TmdbRequestError && error.status === 429;

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
  if (res.status === 429) {
    throw new TmdbRequestError(429, parseRetryAfterMs(res.headers?.get?.('Retry-After')));
  }
  if (res.status >= 500) throw new TmdbRequestError(res.status);
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
