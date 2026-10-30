- `src/store/persistence.ts` ↔ `useStudioStore.ts`: `loadHistoryFromIdb` still calls `useStudioStore.getState().customStyle` (circular import; safe because access is deferred until call time).
- S6: colon-fallback + swapTmdbAlternate now dedupe by `media_type:id` (was bare `id`); candidate lists may keep both a movie and a TV hit that share a numeric id — order can change vs pre-S6 when the second type used to be dropped.
- SKIP S10 preview clock (motion value / TheaterStep): large UI+store clock redesign, not a small follow-up.
- SKIP persistence hardening (schema-validate + error boundary + e2e malformed storage): multi-surface, needs dedicated pass.
- SKIP Ingest DragZone local phase/queue → slice: large UI state move.
- SKIP PWA worker chunk precache e2e: large infra/e2e scope.
- subtitleCore split (`src/utils/subtitle/`): to keep `engine` free of `io`/`product` and avoid `analysis`↔`io` cycles, shared pure helpers live in `model` (`cleanSubtitleContent`, `sortCuesByTime`, `dedupeIdenticalCues`, `normalizeParsedCues`, `areTimeRangesNearEqual`); bilingual detect that calls `parseSubtitle` (`detectSubtitleLanguage`, `detectSubtitleLanguagePair`, `checkIsBilingual`) lives in `io`; `splitSingleBilingualText` / `isSentenceLevelLatinLine` stay in `analysis`.
- Oki follow-ups (subtitleCore split, non-blocking, do not fix in this PR): lost JSDoc on `stripMarkupForDetection`, `cleanSrt`/`parseSrt`/`extractAssStyles`, `SPARSE_SECONDARY_CUE_RATIO`, etc.; barrel re-exports 4 extra names (`LineKindRow`, `cleanAttributionValue`, `detectCueLanguage`, `isSentenceLikeDialogue` — see analysis.ts:~592) — retract if unused externally; `io.ts`:449 re-exports 4 model helpers redundantly.
- Oki follow-ups (rowId, non-blocking): (a) edit state still index-keyed (`workbench.ts` `updateSubtitleText`/`editSubtitleText`/`setLineKind`, undo records `{index}`, `previewIndex`) — safe today because store has no insert/delete and re-merge clears history (`ingest.ts`); must move to rowId when insert/delete lands. (b) occurrence suffix `#2/#3` shifts if an earlier exact duplicate is removed then re-merged — review-check on exact duplicates can be lost; minor. (c) rowId tests are mostly pure-function; insert/delete case hand-builds arrays (`rowId.test.mjs`) — add a test through `finalizeOutputRows` + store later.
- Switch B (Vite MPA): T8 TMDB proxy queue skipped — Rate Limiting binding (30/60s) is sufficient; no request queue added.
- Switch B: Worker HTML Cache-Control is `no-cache`; hashed `/assets/*` long-cache via `public/_headers`. Verified: client assets → `dist/client`, worker + generated wrangler → `dist/saikosubstudio/` (`assets.directory` rewritten to `../client`). MPA `rollupOptions.input` must live under `environments.client.build` (root-level inherits into Worker and breaks build).
- Switch B: eslint dropped `eslint-config-next` → flat `typescript-eslint` + `react-hooks`; `import/no-cycle` on subtitle dirs + `subtitleCore.ts` restored via `eslint-plugin-import-x` (plugin aliased as `import`).
- Switch B: PWA path migration — old SWs precached `/_next/static/*`; new build precaches `/assets/*`. Existing SW template is non-blocking; users get a refresh prompt when the new SW installs (no hard break).
- Oki follow-ups (Switch B, non-blocking): missing Rate Limiting binding silently skips limiting locally (`feedback.ts:30`, `tmdb.ts:147`) — add a warning later; feedback limit 1/60s is looser than old 3/15min by Nias's decision; trailing-slash pages return 200 (duplicate URLs) — consider 308 to no-slash; `/api/tmdb/...` with trailing slash returns 403; cleanup leftovers: `sw.template.js` `_rsc` branch (~29–31) and `/_next/static` branch (~146), unused `src/server/bindings.ts`; T8 TMDB proxy queue still skipped (Rate Limiting binding sufficient).
- Switch B CI/deploy: wrangler config path is `dist/saikosubstudio/wrangler.json` (not `dist/server/`). Legacy Cloudflare Pages project still uses `pages:build` → `.vercel/output/static`; auto preview/production Pages deploys disabled — live path is Workers via `deploy.yml`.

## Paper tokens wiring (design/paper-tokens)

- `--wb-cat-*` kept as-is (workbench category = data encoding, not brand accent). `--wb-cat-review: #B8433C` sits close to `--state-danger` (`#B0361C`); not merged in this PR — revisit together with `--state-*` later. Only `--wb-done` now points to `var(--state-success)`.
- `workbench-b7.css` still hardcodes `#8f3530` text in three places (review-category labels); left untouched with `--wb-cat-*`.
- `[data-paper="chrome"]` does not redefine `--accent` or `--state-*`. Wine (`#7A2233`) on the green tray is low contrast, so tray text/dots use `--accent-text` and the active step uses `--chrome-active-bg/ink`. Any future state badge inside the tray needs a chrome-specific state colour first.
- `BrandMark.tsx` keeps its own hex (`#1a3d37` / `#ef8d5f`) — it is the logo artwork, not UI chrome.
- `--v4-*` / `--v5-*` remain as aliases in `globals.css` (`:root, [data-paper]`); the rename sweep is a follow-up. `--glow-*` and `--elevation-*-dim` resolve to `none`/neutral and can be deleted once nothing references them.
- `.ingest-halo-root` class is still applied in `QueueTree.tsx` but no longer has styles (glow removed); harmless, can be dropped.
- `--lang-*` / `--fmt-*` (subtitle identity colours) intentionally not touched.
- Mobile workbench info bar (390px): the title is truncated to "S." because `.workflow-info-bar` is a fixed single row (`--info-bar-h`) holding back + title + `OutputModeControl` + 「打开预览」. Already present on 98730de (cf-pages-hosted), not introduced by paper tokens. A fix needs a layout change (two-row info bar on narrow screens, or moving the output switch out of the bar), so it is left for a separate pass.
- ~~`/feedback` top tray still highlights 「导入」 as the current step~~ — **done in `design/no-green`**: real cause was the trailing slash (`/feedback/` is served by Workers assets auto-trailing-slash, so `isInfoPage` missed it). `SystemTray` now strips trailing slashes before matching `/about` / `/feedback`, so no step is marked current on info pages.
- Tray step indicator (top + mobile bottom) now marks only the current step (cream sheet slides under it); the old "steps passed" progress fill is gone, so a non-current step never looks selected. The old fill behaviour was already on 98730de (orange fill for steps ≤ current).

## Act 1 icons (feat/act1-icons)

- `AGENTS.md` still says local dark surfaces use `data-paper="chrome"` (green tray); after `design/no-green` (9e0a5a7) the tray is plain paper and `[data-paper="chrome"]` no longer exists. Root `DESIGN.md` §3.7 is correct; AGENTS.md wording needs a follow-up. Not changed here.
- `--fmt-*` / `--lang-*` identity tokens in `globals.css` are kept untouched (DESIGN.md §9), but after A1 no component references them any more. Decide later whether subtitle-style UI should use them or whether they can be removed.

## Act 1 ceremony (feat/act1-ceremony)

- A4 minimal slice only: `runSearch` now throws `TmdbRequestError` on 429 (with `Retry-After`) and on ≥500, so the ceremony can tell "no answer yet" from "answered, no match". Other 4xx still return `[]` as before. Starting TMDB at 0 ms (in parallel with parsing) is not done here — follow-up for A4.
- Patience (`TMDB_PATIENCE_MS`, 8 s) is counted from the start of each match attempt (`runMatch` / `retry`), not from ceremony start.
- Not touched (pre-existing): BottomStatusDeck motion durations 0.42 s / 0.32 s exceed the motion cap in DESIGN.md.
- Not touched (pre-existing, `TmdbPanel.tsx`): in 「手动检索」 on 390 px the search glyph in the 片名 field overlaps the first letter of the prefilled title.

## Ceremony polish (fix/ceremony-polish)

- 8 s patience (`TMDB_PATIENCE_MS`) is per request: it starts at `runMatch` and restarts when the user clicks 「重试」. Automatic retries (429 queue, 5xx silent retry) do **not** restart it, so the user sees 「重试 / 手动搜索」 at most 8 s after the request they started.
- 5xx: one silent retry after 800 ms (`SERVER_ERROR_SILENT_RETRIES` / `SERVER_ERROR_RETRY_DELAY_MS`); the snapshot stays `pending`. Network errors and non-HTTP failures are not retried silently.
- While the ceremony runs, a TMDB failure no longer adds an error banner (E-05) and log toasts behind 「重试 / 手动搜索」 (was visible on e1b1e41 when TMDB returned 5xx). Outside the ceremony, behaviour is unchanged.

## DragZone list v2 (feat/dragzone-list-v2)

- Scope of this draft: B-ready list component only (fixed language column, shared filename prefix + middle truncation, new SRT/ASS/archive silhouettes, single bottom action bar) plus motion tokens in `src/core/motion.ts` and the DESIGN.md §7 long-move exception (≤350 ms, spring bounce 0, transform only).
- Plan B pieces **not** in this draft: persistent stage shell / `layoutStage` coordinates; cross-zone long-move animation (`MOTION_S.longMove` is defined but unused); multi-work grouping + hint + staging area (暂存区); 「更多文件」 picker on page 2; post-merge prompt.
- Pre-existing (not changed here): filename-only language detection (`archive.ts` → `detectLanguageByFilename`) returns 待识别 for bilingual tags such as `EN&CHS` / `EN&CHT`. Already the case on e1b1e41.
- `.ingest-queue-footer` is `position: sticky; bottom: 0` on < 768 px. It works because `.ingest-shell` is the scroll container and ends above the bottom tray; if that container changes, re-check the sticky bar.

## DragZone list v3 / 方案 B 骨架（feat/dragzone-list-v2）

- 双语文件名尾缀：新增 `src/core/filenameLanguagePair.ts`，`EN&CHS`、`EN&CHT`、`CHS&EN`、`chs_eng`、`简英` 等相邻配对识别为双语（简+En / 繁+En），不再落到「待识别」。zh+zh、zh+ja/ko、非相邻 token 不算配对；裸 `de/it/es` 不作为第二语言。`utils/subtitle/io.ts` 的 `detectSubtitleLanguagePair` 在文件名有配对时补 primary 并打开 hint。corpus 基线 0 差异（sample-a、sample-b）。
- 稳定 objectId：`src/core/stageObjects.ts`。队列项 `obj:<hash12>`，压缩包条目 `<parent>/<hash8>`（按条目路径），`Subfile.sourceObjectId` 贯通到处理结果。
- 舞台：`useIngestStage`（内存 zustand）持有 `queuedItems / stagedItems`。行为变化：清单在 DragZone 卸载后保留，只有「整理文件」成功后才清空。`IngestStep` 包在 `LayoutGroup id="act1-stage"`，区域标记 `data-stage-zone=intake|current|staging|ledger`。
- 动效：跨区域长距离移动 0.35 s（`MOTION_S.longMove`，springNoBounce），其余保持 0.25 s；reduced motion 下只做 0.15 s 透明度。
- 多作品提示 + 暂存区：按片名分组（`core/workGrouping.ts`），≥2 部时在清单顶部提示；选一部后其余进入暂存区。暂存区在清单非空时位于清单顶部，清单空时位于拖放井上方并提示「继续整理？」。「整理文件」行为不变（提示打开时仍整理当前全部清单）。
- 已知遗留：Act1→Act2 共享元素 / ViewTransition（仍是 `AnimatePresence mode="wait"`）；layoutStage 坐标函数；混合压缩包按条目拆分；第 2 页「更多文件」入口；仪式 token 编排；压缩包内同路径重名条目 objectId 冲突。
