# Engineering platform / 工程平台（2026-10-13 起）

## Stack
- Next.js **16** API surface, built and served by **vinext 1.1** (Vite 8) on **Cloudflare Workers**.
  - vinext targets Next 16.x only (vinext README, "Latest Next.js only"), hence the Next 16 bump first.
- Node **22** everywhere (vinext `engines >=22`, wrangler 4).
- `@cloudflare/next-on-pages` removed (repo archived, no Next 16 support).

## Scripts
| script | what |
|---|---|
| `npm run dev` | vinext dev server (Vite) |
| `npm run dev:next` | plain `next dev` fallback (no Workers bindings) |
| `npm run build` | `vite build` → `dist/` + `scripts/pwa/build-sw.mjs` → `dist/client/sw.js` |
| `npm run preview` | build + `wrangler dev` on the real Worker bundle (put `TMDB_API_KEY` in `.dev.vars`) |
| `npm run deploy` | manual deploy via `@vinext/cloudflare` (normally Workers Builds does it) |

## Server pieces
- `app/api/tmdb/[...path]` — TMDB proxy; key from Worker secret `TMDB_API_KEY` via `src/server/bindings.ts`.
- `app/api/feedback` — `FEEDBACK_MAILER` service binding (wrangler.jsonc `services`).
- `proxy.ts` (Next 16 name for middleware, at repo root next to `app/`) — CSP + security headers for every Worker response.
  `public/_headers` stays for static assets (Workers static assets honour `_headers`).

## Deploy / rollback
- Workers Builds Git integration: production branch `cf-pages-hosted`, preview builds for other branches.
- The legacy Pages project `saikosubstudio` is NOT deleted; it remains the rollback until `dualsubs.quest` is switched to the Worker.
- Switching the custom domain affects production — ask Derek first.
