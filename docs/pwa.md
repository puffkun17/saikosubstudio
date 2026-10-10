# PWA / 离线

- **Manifest**: `public/manifest.webmanifest`（`Content-Type: application/manifest+json`，见 `public/_headers`），`<link rel="manifest">`、`theme-color`、`apple-mobile-web-app-*` 由 `app/layout.tsx` 的 metadata 输出。图标：`icon-192/512`（any）+ `icon-maskable-192/512`（maskable，品牌图形缩到 80% 安全区）。
- **Service Worker**: `scripts/pwa/sw.template.js` → `npm run build` 末尾由 `scripts/pwa/build-sw.mjs` 生成 `public/sw.js`（gitignored）。`pages:build`（next-on-pages → vercel build → `npm run build`）同样会生成并带进 `.vercel/output/static/sw.js`。
  - 预缓存：`/`、manifest、Noto Serif SC CSS、libarchive worker + wasm、`.next/static` 下全部文件（含按需加载的 chunk，排除 `.map` 和 API 路由占位 chunk）；字体 woff2、图标、预览场景图为 best-effort。
  - 策略：`/_next/static/*` cache-first；页面导航 network-first（4 s 超时）→ 离线回落到缓存页面 / 应用壳；其他同源静态资源 stale-while-revalidate。
  - **从不拦截/缓存**：非 GET、跨域请求（TMDB 图片 / API、Cloudflare beacon）、`/api/*`（含 `/api/tmdb/*` 代理、反馈）、RSC 请求、Range 请求、`blob:`/`data:`；用户字幕文件只在本地读取，从不经过网络。
  - 更新：新 SW 安装后进入 waiting，不自动 `skipWaiting`；页面右下角提示「有新版本，刷新即可更新」，用户点「刷新」才切换并刷新。
- **Headers**: `/sw.js` `Cache-Control: no-cache, no-store, must-revalidate`；CSP 未改（已有 `worker-src 'self' blob:`，`manifest-src` 回落到 `default-src 'self'`）。
- 开发模式（`next dev`）不注册 SW。
