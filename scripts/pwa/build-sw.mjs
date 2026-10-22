#!/usr/bin/env node
/**
 * Generates sw.js after `vite build` (Switch B / Cloudflare Vite plugin).
 * Precache = app shell HTML + every hashed file under dist/client/assets +
 * local assets the offline import flow needs.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const publicDir = join(root, "public");
const outDir = join(root, "dist/client");
const assetsDir = join(outDir, "assets");

if (!existsSync(assetsDir)) {
  console.error(`[build-sw] ${assetsDir} not found — run \`vite build\` first.`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const hashedAssets = walk(assetsDir)
  .filter((p) => !p.endsWith(".map"))
  .map((p) => `/assets/${relative(assetsDir, p).split(sep).join("/")}`)
  .sort();

const mustExist = (url) => {
  const clean = url.split("?")[0];
  if (clean.endsWith("/")) return true;
  if (clean === "/about" || clean === "/feedback") return true;
  return existsSync(join(publicDir, clean));
};

const required = [
  "/",
  "/about",
  "/feedback",
  "/manifest.webmanifest",
  "/fonts/noto-serif-sc/noto-serif-sc.css",
  "/fonts/geist/geist.css",
  // Local archive import (zip/7z/rar) — worker + wasm are fetched at runtime.
  "/libarchive/worker-bundle.v3.js",
  "/libarchive/libarchive.wasm",
  ...hashedAssets,
];

const fontFiles = [
  ...readdirSync(join(publicDir, "fonts/noto-serif-sc"))
    .filter((f) => f.endsWith(".woff2"))
    .map((f) => `/fonts/noto-serif-sc/${f}`),
  ...readdirSync(join(publicDir, "fonts/geist"))
    .filter((f) => f.endsWith(".woff2"))
    .map((f) => `/fonts/geist/${f}`),
];

const optional = [
  ...fontFiles,
  "/brand-mark.svg",
  "/favicon.ico?v=5",
  "/favicon-32.png?v=5",
  "/favicon-16.png?v=5",
  "/apple-touch-icon.png?v=5",
  "/icon-192.png?v=5",
  "/icon-512.png?v=5",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/tmdb_logo_blue_square.svg",
  "/scene_nature.png",
  "/scene_night.png",
  "/scene_portrait.png",
  "/tv-crt_v2.png",
  "/tv-modern_v2.png",
];

const missing = [...required, ...optional].filter(
  (u) => !u.startsWith("/assets/") && !mustExist(u),
);
if (missing.length) {
  console.error(`[build-sw] missing public assets: ${missing.join(", ")}`);
  process.exit(1);
}

const template = readFileSync(join(root, "scripts/pwa/sw.template.js"), "utf8");
const buildId = hashedAssets.join("\n");
const version = createHash("sha256")
  .update(buildId)
  .update(JSON.stringify([required, optional]))
  .update(template)
  .digest("hex")
  .slice(0, 12);

const out = template
  .replace("__SW_VERSION__", JSON.stringify(version))
  .replace("__PRECACHE_REQUIRED__", JSON.stringify(required, null, 0))
  .replace("__PRECACHE_OPTIONAL__", JSON.stringify(optional, null, 0));

writeFileSync(join(outDir, "sw.js"), out);
const bytes = hashedAssets.reduce(
  (n, u) => n + statSync(join(assetsDir, u.slice("/assets/".length))).size,
  0,
);
console.log(
  `[build-sw] ${outDir}/sw.js version ${version}: ${required.length} required (${hashedAssets.length} Vite assets, ${(bytes / 1024 / 1024).toFixed(2)} MB) + ${optional.length} optional`,
);
