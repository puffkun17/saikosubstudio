/**
 * Cloudflare Worker entry (Switch B): APIs + static via ASSETS.
 * No vinext — CSP / cache / redirects live here.
 */

const CANONICAL_HOST = "dualsubs.quest";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' https://static.cloudflareinsights.com",
  "worker-src 'self' blob:",
  "connect-src 'self' https://cloudflareinsights.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

export type RateLimiter = { limit: (opts: { key: string }) => Promise<{ success: boolean }> };

export type Env = {
  ASSETS: Fetcher;
  FEEDBACK_MAILER?: Fetcher;
  TMDB_API_KEY?: string;
  FEEDBACK_RATE_LIMITER?: RateLimiter;
  TMDB_RATE_LIMITER?: RateLimiter;
};

/** www.dualsubs.quest → https://dualsubs.quest, 301, path + query kept. */
export function canonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== `www.${CANONICAL_HOST}`) return null;
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return new Response(null, {
    status: 301,
    headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" },
  });
}

function withSecurityHeaders(response: Response, { html }: { html: boolean }): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  if (html) headers.set("Cache-Control", "no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Map /about and /feedback (and trailing-slash variants) to MPA HTML entries. */
function assetRequestFor(request: Request): Request {
  const url = new URL(request.url);
  let path = url.pathname;
  if (path === "/about") path = "/about/";
  else if (path === "/feedback") path = "/feedback/";
  else if (path === "") path = "/";
  if (path !== url.pathname) {
    url.pathname = path;
    return new Request(url.toString(), request);
  }
  return request;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const redirect = canonicalRedirect(request);
    if (redirect) return redirect;

    const url = new URL(request.url);

    // API routes are wired in a follow-up commit; stub 404 until then.
    if (url.pathname === "/api/feedback" || url.pathname.startsWith("/api/tmdb/")) {
      return new Response(JSON.stringify({ error: "API not yet wired" }), {
        status: 501,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const assetResponse = await env.ASSETS.fetch(assetRequestFor(request));
    const type = assetResponse.headers.get("content-type") || "";
    const isHtml = type.startsWith("text/html") || url.pathname === "/" || url.pathname.endsWith(".html")
      || url.pathname === "/about" || url.pathname === "/about/"
      || url.pathname === "/feedback" || url.pathname === "/feedback/";
    if (isHtml || assetResponse.status === 200) {
      // Always apply CSP on HTML; hashed assets get long-cache via public/_headers.
      if (type.startsWith("text/html") || url.pathname.endsWith("/") || url.pathname === "/"
        || url.pathname === "/about" || url.pathname === "/feedback") {
        return withSecurityHeaders(assetResponse, { html: true });
      }
    }
    void ctx;
    return assetResponse;
  },
};
