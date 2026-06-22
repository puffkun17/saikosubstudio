import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const SEARCH_PATH = /^search\/(multi|movie|tv)$/;
const MEDIA_PATH = /^(movie|tv)\/([1-9]\d*)$/;
const IMAGE_PATH = /^(movie|tv)\/([1-9]\d*)\/images$/;
const EPISODE_IMAGE_PATH = /^tv\/([1-9]\d*)\/season\/([1-9]\d*)\/episode\/([1-9]\d*)\/images$/;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 30;
const MAX_RATE_BUCKETS = 1_000;

type RequestKind = 'search' | 'media' | 'images' | 'episode-images';
type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-site',
};

const json = (body: Record<string, unknown>, status: number, headers: HeadersInit = {}) =>
  NextResponse.json(body, { status, headers: { ...securityHeaders, ...headers } });

const resolveRequestKind = (path: string): RequestKind | null => {
  if (SEARCH_PATH.test(path)) return 'search';
  if (MEDIA_PATH.test(path)) return 'media';
  if (IMAGE_PATH.test(path)) return 'images';
  if (EPISODE_IMAGE_PATH.test(path)) return 'episode-images';
  return null;
};

const getClientAddress = (request: NextRequest) =>
  request.headers.get('cf-connecting-ip')
  ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? 'unknown';

const getRetryAfterSeconds = (clientAddress: string) => {
  const now = Date.now();
  const current = rateBuckets.get(clientAddress);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(clientAddress, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > RATE_LIMIT_PER_WINDOW) {
      return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.startedAt)) / 1_000));
    }
  }

  if (rateBuckets.size > MAX_RATE_BUCKETS) {
    for (const [address, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(address);
      if (rateBuckets.size <= MAX_RATE_BUCKETS) break;
    }
  }

  return 0;
};

const isValidLanguage = (value: string) => /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value);

const copySearchParams = (incoming: URLSearchParams, kind: RequestKind) => {
  const sanitized = new URLSearchParams();
  const language = incoming.get('language');
  if (language && isValidLanguage(language)) sanitized.set('language', language);

  if (kind === 'search') {
    const query = incoming.get('query')?.trim() ?? '';
    if (!query || query.length > 160) return null;
    sanitized.set('query', query);

    const year = incoming.get('year');
    if (year && /^\d{4}$/.test(year)) sanitized.set('year', year);
  }

  if (kind === 'media' && incoming.get('append_to_response') === 'alternative_titles') {
    sanitized.set('append_to_response', 'alternative_titles');
  }

  return sanitized;
};

const cacheControlFor = (kind: RequestKind) =>
  kind === 'search'
    ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    : 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';

// Server-side TMDB proxy.
// Keeps metadata and backdrop lookup server-side so no client key is required.
// TMDB_API_KEY must be set in CF Pages dashboard as a Secret (机密) for Production.
// Never declare real secrets in wrangler.toml — it would make the key a plain-text var.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  const requestKind = resolveRequestKind(path);
  if (!requestKind) return json({ error: 'Endpoint not allowed' }, 403, { 'Cache-Control': 'no-store' });

  const retryAfter = getRetryAfterSeconds(getClientAddress(request));
  if (retryAfter > 0) {
    return json(
      { error: 'Too many metadata requests. Please retry shortly.' },
      429,
      { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) }
    );
  }

  const incomingUrl = new URL(request.url);
  const searchParams = copySearchParams(incomingUrl.searchParams, requestKind);
  if (!searchParams) return json({ error: 'A valid search query is required' }, 400, { 'Cache-Control': 'no-store' });

  const tmdbUrl = new URL(`${TMDB_BASE}/${path}`);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('TMDB proxy is missing TMDB_API_KEY');
    return json({ error: 'Metadata service is unavailable' }, 503, { 'Cache-Control': 'no-store' });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    tmdbUrl.searchParams.set('api_key', apiKey);
  }

  for (const [key, value] of searchParams.entries()) {
    tmdbUrl.searchParams.set(key, value);
  }

  try {
    const tmdbRes = await fetch(tmdbUrl.toString(), { headers, signal: AbortSignal.timeout(8_000) });
    const data = await tmdbRes.json().catch(() => null);
    if (!tmdbRes.ok || !data) {
      const status = tmdbRes.status >= 400 && tmdbRes.status < 500 ? tmdbRes.status : 502;
      return json({ error: 'Metadata request failed' }, status, { 'Cache-Control': 'no-store' });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { ...securityHeaders, 'Cache-Control': cacheControlFor(requestKind) },
    });
  } catch (err) {
    console.error('TMDB proxy error:', err);
    return json({ error: 'Metadata service is temporarily unavailable' }, 502, { 'Cache-Control': 'no-store' });
  }
}
