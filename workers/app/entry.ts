/**
 * Worker entry: vinext's fetch handler + www→apex redirect + one response rule.
 * vinext marks rendered pages `no-store`; the app shell only needs `no-cache`
 * (always revalidate, but allow bfcache / conditional reuse). Hashed /_next/static
 * stays immutable via public/_headers; sw.js keeps its own no-cache/no-store.
 */
import handler from 'vinext/server/fetch-handler';

export * from 'vinext/server/fetch-handler';

const CANONICAL_HOST = 'dualsubs.quest';

/** www.dualsubs.quest → https://dualsubs.quest, 301, path + query kept. */
export function canonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== `www.${CANONICAL_HOST}`) return null;
  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  url.port = '';
  return new Response(null, { status: 301, headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=3600' } });
}

type Fetchable = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response };

export default {
  ...(handler as object),
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const redirect = canonicalRedirect(request);
    if (redirect) return redirect;
    const response = await (handler as Fetchable).fetch(request, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('text/html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-cache');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
