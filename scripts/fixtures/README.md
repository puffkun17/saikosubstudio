# Test fixtures (`npm run test:core`)

All fixtures are **short excerpts** used only to exercise parsing, alignment, wrapping and export.
Full episode files / release archives are never committed.

| Path | Source | Trim |
|---|---|---|
| `golden/the-pitt-s02e15/{zh,en}.srt` | The Pitt S02E15 WEB release, separate CHS + EN tracks | cues starting in the first 4 min (58 cues each), renumbered |
| `golden/only-murders-s05e08/{zh,en}.srt` | Only Murders in the Building S05E08, separate 简体 + 英文 tracks | first 4 min (71 / 66 cues) |
| `golden/lanterns-s01e08/{zh,en}.srt` | Lanterns S01E08, separate CHS + EN tracks | first 4 min (34 cues each) |
| `golden/ticking-clock-gbk/{zh,en}.srt` | Ticking Clock (2011) pack: `chs.ANSI` (**GBK bytes kept as-is**) + `eng` | first 5 min, CRLF kept |
| `golden/tony-2026-ass-bilingual/bilingual.ass` | Tony (2026) styled bilingual ASS (EN.CN, source notes "AI 校对 / 翻译:Gemini") | 0:00–3:00 + three styled windows (11:23, 1:40:26, 1:41:17–1:41:40); 67 events |
| `ass/tony-2026.cn.ass` | Same release, CN-only ASS (`\pos`, `\fad`, `\an5/7`, `\rTarget`, multi-line `\N` cards) | same windows |
| `encoding/ticking-clock.*` | Ticking Clock `chs.ANSI` (GBK), `chs.utf8`, `cht` (Traditional characters **stored as GBK**) | first 5 min, original bytes/encoding |

The Ticking Clock pack's French / Spanish / Portuguese / Thai / Korean tracks only exist as a VobSub
`.idx/.sub` (images, 33 MB) — no text tracks, so they are not usable here.

## Golden snapshots

`golden/<sample>/` holds either `zh.* + en.*` (two tracks → `alignSubtitlesIndustrial`) or
`bilingual.*` (single bilingual file → `normalizeSingleBilingualRows`). Tracks are decoded with the
app's `decodeBuffer`, so any encoding works. For every export preset the runner writes
`expected/<preset>.<ass|srt>` plus `expected/summary.json` (rows, rewrapped / overflow counts).

- Check: `npm run test:core`
- Re-record after an intentional change: `UPDATE_GOLDEN=1 npm run test:core`, then review the diff.
- New edge case (ASS effects, MT output, ja/ko, …): add a `golden/<name>/` directory and re-record.
