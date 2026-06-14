import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const TMDB_BASE = 'https://api.themoviedb.org/3';

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

  const allowedPrefixes = ['search/', 'movie/', 'tv/'];
  const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Endpoint not allowed' }, { status: 403 });
  }

  const incomingUrl = new URL(request.url);
  const searchParams = new URLSearchParams(incomingUrl.searchParams);
  searchParams.delete('api_key');

  const tmdbUrl = new URL(`${TMDB_BASE}/${path}`);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TMDB_API_KEY is not configured on the server' },
      { status: 500 }
    );
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
    const tmdbRes = await fetch(tmdbUrl.toString(), { headers });
    const data = await tmdbRes.json();
    return NextResponse.json(data, { status: tmdbRes.status });
  } catch (err) {
    console.error('TMDB proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 502 });
  }
}
