import { NextResponse } from 'next/server';

/**
 * Security headers for next-on-pages.
 * public/_headers only applies to static assets; HTML / Function responses
 * need headers set here (or in next.config) or CSP never updates for the app shell.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // wasm-unsafe-eval: modern browsers (Chrome 97+ / Safari 16+)
  // unsafe-eval: fallback for engines that still gate WASM on unsafe-eval
  // cloudflareinsights: Pages Web Analytics beacon
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' https://static.cloudflareinsights.com",
  "worker-src 'self' blob:",
  "connect-src 'self' https://cloudflareinsights.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

export function middleware() {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Apply to all app routes except Next internals and common static files.
     * Static assets under /libarchive still get CSP from public/_headers.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico|wasm)$).*)',
  ],
};
