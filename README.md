# SaikoSubStudio

Bilingual subtitle alignment, merging, and styling tool with cinema preview simulator.

Standalone bilingual subtitle alignment and cinema preview tool. Core SubStudio experience extracted and maintained independently.

## Branches

- **main**: Open-source, self-hostable / deployable version.
  - TMDB via server proxy (recommended) or client key (with guide).
  - Fixed public assets (scenes, TV bezels).
  - Full SubStudio feature set: Ingest (drag/zip/ASS), Workbench (timeline, styles), Theater (simulator with scenes/剧照, guides, export ASS/SRT).
  - Deployable to Vercel, CF Pages, self-host `next start`, etc.
  - See deployment section below.

- **cf-pages-hosted**: Hosted closed version for dualsubs.quest (pre-configured complete NAS-like experience).
  - TMDB fully integrated via Edge proxy using CF Pages secret (no user prompts, no client key).
  - Same lossless UI/logic + fixed scenes.
  - Version banner visible.
  - Auto deploys on push to this branch via Git integration.

The same core code powers both; hosted adds the always-on proxy + secret.

## Key Features

- **Ingest**: Drag & drop or folder/zip for SRT/ASS, auto language detect, bilingual/commentary handling, Tmdb search for metadata + 剧照 pool (random/shuffle).
- **Workbench**: Timeline editor, style presets (Netflix, classic, anime, etc.), advanced controls, ASS style extraction.
- **Theater**: Full preview simulator with TV bezels, cinematic scenes (fixed + dynamic), guides, lyric mode, real-time style.
- **Export**: ASS (with styles) / SRT.
- **Library**: Save/load projects with backdrop.
- No client-side TMDB key required in hosted; proxy handles it server-side.

## Deployment

### For main (OSS / self-host)

1. Clone `main`.
2. `npm ci --legacy-peer-deps`
3. For TMDB (proxy recommended):
   - Set `TMDB_API_KEY` (v4 JWT preferred) in `.env.local` or your host env.
   - The `/api/tmdb` proxy handles auth (v4 Bearer or v3 query).
4. `npm run build && npm start` (or deploy to Vercel/CF/etc.).
5. Public fixed assets (scene_*.png, tv-*.png) are included for preview when no TMDB data.

See `.env.example` and the proxy route for details.

### For cf-pages-hosted (hosted)

- Git integration on CF Pages project "saikosubstudio".
- Production branch: `cf-pages-hosted`.
- Build command: `npm ci --legacy-peer-deps && npm run pages:build`
- Build output directory: `.vercel/output/static`
- **Secret**: `TMDB_API_KEY` (your v4 token) set **only** via dashboard (as "机密"/Secret) or `wrangler pages secret put` (Production).
  - Do **not** declare it in wrangler.toml (that would register it as a plain-text var).
- Pushes to branch auto-build and deploy.
- Custom domain dualsubs.quest points to production deployment.

## Public Assets (Fixed for Preview)

`public/` includes:
- scene_cinema.png, scene_nature.png, scene_night.png (generated for consistent preview)
- tv-crt.png, tv-crt_v2.png, tv-modern.png, tv-modern_v2.png (bezels)
- tmdb_logo_blue_square.svg

These enable the "模拟场景" and full Theater without external deps.

## Version

Visible in bottom-right on hosted: `v2.0.1 (Ingest Lens redesign + history modal polish + cinematic UI refinements)`

## History / Credits

- Strict re-extraction from archived NAS code (SaikoBasement-NAS-static-only) per the principle document (dependency inventory first, no simplification, full parity for UI, animations, logic, subtitleCore engine, etc.).
- Git history cleaned on cf-pages-hosted to start from clean skeleton (configs + this extraction only).
- Original portal had multi-tool (sports + studio); this is standalone SubStudio focused.

For full details on extraction rules, see the referenced NAS principle doc.

## Local Dev

```bash
npm ci --legacy-peer-deps
npm run dev
```

For CF local preview:
```bash
npm run pages:build
npx wrangler pages dev .vercel/output/static
```

## License / Notes

Extracted for standalone use. TMDB data via their API (respect terms).

Fixed assets generated for consistency.
