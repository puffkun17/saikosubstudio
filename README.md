# SaikoSubStudio

Standalone bilingual subtitle alignment, merging, styling, and preview tool.

> [!IMPORTANT]
> **Which branch is which (read this before forking or opening a PR)**
>
> | Branch | What it is |
> | --- | --- |
> | **`cf-pages-hosted`** | **Production.** The live site [dualsubs.quest](https://dualsubs.quest) is built from this branch (Cloudflare Pages). All product work and PRs target it. |
> | `main` | **Open-source self-host line.** A trimmed snapshot of `cf-pages-hosted` without private APIs / keys. It has no shared history with `cf-pages-hosted` and lags behind it. |
>
> GitHub's default branch is still `main`, so a fork or clone checks out `main` unless you pick otherwise.
> **To work on or reproduce the live product, fork/clone `cf-pages-hosted`** (`git clone -b cf-pages-hosted …`,
> or untick "Copy the main branch only" when forking). Fork `main` only if you want the self-hosted build.
> 生产线上版本对应 `cf-pages-hosted` 分支；`main` 是开源自部署版。fork 时请选对分支。

SaikoSubStudio focuses on three steps:

- **Ingest**: load SRT / ASS files or ZIP / 7Z / RAR packages, classify tracks, and bind subtitle sources.
- **Workbench**: review aligned subtitle lines, edit text, tune styles, and export ASS / SRT.
- **Theater**: preview subtitles in a cinema-style simulator with scene backdrops, TV masks, aspect ratio controls, and guide overlays.

## Branches

- `cf-pages-hosted` — **production** (dualsubs.quest) / hosted source of truth (product + merge algorithms). PR base for product work.
- `main` — open-source self-host line (default branch on GitHub); derive behavior from hosted, then strip private APIs.

See [`docs/BRANCH_POLICY.md`](docs/BRANCH_POLICY.md). Current product scope: intelligent dual-track merge and human review assist — not translation.

## Key Features

- Drag and drop SRT / ASS, folders, and locally extracted ZIP / 7Z / RAR archives.
- Preflight hints for single-language subtitles, existing bilingual subtitles, supported formats, and unsafe or oversized imports.
- Automatic language detection, bilingual track handling, commentary track support, and ASS style extraction.
- Second language: English, Spanish, French (then Portuguese / German / Italian), Japanese or Korean next to Chinese; Latin diacritics (ñ ¿ ¡ é ç œ ß…) are covered by every preset's fonts (`python3 scripts/check-font-coverage.py`).
- TMDB metadata lookup through the server proxy route.
- Timeline controls, line preview, style presets, custom templates, and local project history.
- Theater preview with fixed scene assets, TMDB backdrops, TV bezels, aspect ratio switching, lyrics mode, and guide overlays.
- ASS export with styling and SRT export for plain subtitle output.

## Deployment

### Standard Next.js

```bash
npm ci --legacy-peer-deps
npm run build
npm start
```

### Cloudflare Pages

```bash
npm ci --legacy-peer-deps
npm run pages:build
```

Use `.vercel/output/static` as the Cloudflare Pages build output directory.

Set `TMDB_API_KEY` as a secret environment variable when metadata lookup is needed. The `/api/tmdb` proxy handles TMDB auth server-side.

## Public Assets (Fixed for Preview)

`public/` includes:
- `Background.jpg`, `scene_nature.png`, `scene_night.png`, `scene_portrait.png`
- `tv-crt_v2.png`, `tv-modern_v2.png`
- `tmdb_logo_blue_square.svg`

These assets keep Theater preview usable even without TMDB data.

## Version

Current app version: `v5.0.0-beta.1`.

- Design system: [`DESIGN.md`](DESIGN.md) (Paper Ledger tokens in `src/styles/paper-tokens.css`)
- Ridgeline (cream / forest / orange) design docs: [`docs/design-archive/`](docs/design-archive/)

- v4 tungsten gold palette: [`docs/V4_TUNGSTEN_ARCHIVE.md`](docs/V4_TUNGSTEN_ARCHIVE.md)
- v3 interface baseline: Git tag `v3.0.0-ui-archive`

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

TMDB data is provided through the TMDB API. Respect TMDB terms when deploying or distributing the app.
