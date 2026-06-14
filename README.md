# SaikoSubStudio

Standalone bilingual subtitle alignment, merging, styling, and preview tool.

SaikoSubStudio focuses on three steps:

- **Ingest**: load SRT / ASS / ZIP files, classify tracks, and bind subtitle sources.
- **Workbench**: review aligned subtitle lines, edit text, tune styles, and export ASS / SRT.
- **Theater**: preview subtitles in a cinema-style simulator with scene backdrops, TV masks, aspect ratio controls, and guide overlays.

## Key Features

- Drag and drop SRT / ASS, folders, and ZIP archives.
- Preflight hints for single-language subtitles, existing bilingual subtitles, ASS/SRT formats, unsupported files, and RAR/7Z archives.
- Automatic language detection, bilingual track handling, commentary track support, and ASS style extraction.
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
- `scene_cinema.png`, `scene_nature.png`, `scene_night.png`
- `tv-crt.png`, `tv-crt_v2.png`, `tv-modern.png`, `tv-modern_v2.png`
- `tmdb_logo_blue_square.svg`

These assets keep Theater preview usable even without TMDB data.

## Version

Current app version: `v2.0.1`.

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
