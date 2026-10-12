#!/usr/bin/env node
/**
 * Generates dist/client/sw.js after `vite build` (vinext). Runs inside `npm run build`.
 * public/ has already been copied into dist/client, so sw.js is written there directly.
 *
 * Precache list = app shell + every file in dist/client/_next/static (all hashed chunks, including the
 * ones only loaded lazily, e.g. libarchive.js) + the local assets the
 * import → merge/align → review → export flow needs offline.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, 'dist/client');
const staticDir = join(outDir, '_next/static');
const publicDir = join(root, 'public');

if (!existsSync(staticDir)) {
  console.error('[build-sw] dist/client/_next/static not found — run `vite build` first.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const nextStatic = walk(staticDir)
  .filter((p) => !p.endsWith('.map'))
  // Server-only route handlers still emit tiny client stubs; they are never loaded by the UI.
  .filter((p) => !relative(staticDir, p).split(sep).join('/').includes('/app/api/'))
  .map((p) => `/_next/static/${relative(staticDir, p).split(sep).join('/')}`)
  .sort();

const mustExist = (url) => {
  const clean = url.split('?')[0];
  if (clean.endsWith('/')) return true;
  return existsSync(join(publicDir, clean));
};

const required = [
  '/',
  '/manifest.webmanifest',
  '/fonts/noto-serif-sc/noto-serif-sc.css',
  // Local archive import (zip/7z/rar) — worker + wasm are fetched at runtime.
  '/libarchive/worker-bundle.v3.js',
  '/libarchive/libarchive.wasm',
  ...nextStatic,
];

const fontFiles = readdirSync(join(publicDir, 'fonts/noto-serif-sc'))
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => `/fonts/noto-serif-sc/${f}`);

const optional = [
  '/about',
  ...fontFiles,
  // icons (exact URLs referenced from <head>, incl. cache-busting query)
  '/brand-mark.svg',
  '/favicon.ico?v=5',
  '/favicon-32.png?v=5',
  '/favicon-16.png?v=5',
  '/apple-touch-icon.png?v=5',
  '/icon-192.png?v=5',
  '/icon-512.png?v=5',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/tmdb_logo_blue_square.svg',
  // Theater (review) step backdrops / TV masks
  '/scene_nature.png',
  '/scene_night.png',
  '/scene_portrait.png',
  '/tv-crt_v2.png',
  '/tv-modern_v2.png',
];

const missing = [...required, ...optional].filter((u) => !u.startsWith('/_next/') && !mustExist(u) && u !== '/about');
if (missing.length) {
  console.error(`[build-sw] missing public assets: ${missing.join(', ')}`);
  process.exit(1);
}

const template = readFileSync(join(root, 'scripts/pwa/sw.template.js'), 'utf8');
// vinext has no BUILD_ID file; the hashed chunk list identifies the build.
const buildId = nextStatic.join('\n');
const version = createHash('sha256')
  .update(buildId)
  .update(JSON.stringify([required, optional]))
  .update(template)
  .digest('hex')
  .slice(0, 12);

const out = template
  .replace('__SW_VERSION__', JSON.stringify(version))
  .replace('__PRECACHE_REQUIRED__', JSON.stringify(required, null, 0))
  .replace('__PRECACHE_OPTIONAL__', JSON.stringify(optional, null, 0));

writeFileSync(join(outDir, 'sw.js'), out);
const bytes = nextStatic.reduce((n, u) => n + statSync(join(staticDir, u.slice('/_next/static/'.length))).size, 0);
console.log(`[build-sw] dist/client/sw.js version ${version}: ${required.length} required (${nextStatic.length} Next static, ${(bytes / 1024 / 1024).toFixed(2)} MB) + ${optional.length} optional`);
