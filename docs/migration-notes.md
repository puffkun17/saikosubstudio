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
- `.ingest-queue-footer` is `position: sticky` on < 768 px, stuck to `.ingest-shell` (the scroll container, which ends above the bottom tray). Since v4 it uses `bottom: calc(-1 * var(--ds-gap-section))`: Chromium deflates the sticky rect by the container's padding, so with `bottom: 0` a list row peeked out under the bar once the list overflowed. If that container or its padding changes, re-check the sticky bar.

## DragZone list v3 / 方案 B 骨架（feat/dragzone-list-v2）

- 双语文件名尾缀：新增 `src/core/filenameLanguagePair.ts`，`EN&CHS`、`EN&CHT`、`CHS&EN`、`chs_eng`、`简英` 等相邻配对识别为双语（简+En / 繁+En），不再落到「待识别」。zh+zh、zh+ja/ko、非相邻 token 不算配对；裸 `de/it/es` 不作为第二语言。`utils/subtitle/io.ts` 的 `detectSubtitleLanguagePair` 在文件名有配对时补 primary 并打开 hint。corpus 基线 0 差异（sample-a、sample-b）。
- 稳定 objectId：`src/core/stageObjects.ts`。队列项 `obj:<hash12>`，压缩包条目 `<parent>/<hash8>`（按条目路径），`Subfile.sourceObjectId` 贯通到处理结果。
- 舞台：`useIngestStage`（内存 zustand）持有 `queuedItems / stagedItems`。行为变化：清单在 DragZone 卸载后保留，只有「整理文件」成功后才清空。`IngestStep` 包在 `LayoutGroup id="act1-stage"`，区域标记 `data-stage-zone=intake|current|staging|ledger`。
- 动效：跨区域长距离移动 0.35 s（`MOTION_S.longMove`，springNoBounce），其余保持 0.25 s；reduced motion 下只做 0.15 s 透明度。
- 多作品提示 + 暂存区：按片名分组（`core/workGrouping.ts`），≥2 部时在清单顶部提示；选一部后其余进入暂存区。暂存区在清单非空时位于清单顶部，清单空时位于拖放井上方并提示「继续整理？」。「整理文件」行为不变（提示打开时仍整理当前全部清单）。
- 已知遗留：Act1→Act2 共享元素 / ViewTransition（仍是 `AnimatePresence mode="wait"`）；layoutStage 坐标函数；混合压缩包按条目拆分；第 2 页「更多文件」入口；仪式 token 编排；压缩包内同路径重名条目 objectId 冲突。

## DragZone v4 checkpoint（feat/dragzone-list-v2）

- 多作品提示按文件计数：`WorkUnit.fileCount`（压缩包按条目数），Ted Lasso 压缩包显示「9 个文件」；「另有 N 个文件认不出片名」。`queueStatsLine` 也改为「N 个文件」。
- 暂存区按作品分组：组头「片名 · N 个文件」+ 一行「文件名前缀」，行内只显示尾部（MiddleTruncate，title 保留全名）。
- 「整理文件」行为变化（仅此一处）：多作品提示未处理时，第一次点只把提示滚到眼前、描一圈酒红（`data-multi-work-pulse`，1.1 s；reduced motion 为静态描边）并出现「再点一次」说明；同一组提示下第二次点照常整理。逻辑在 `core/workGrouping.ts` 的 `shouldNudgeBeforeProcess`，状态在 `useIngestStage.multiWork*`。e2e：`e2e/ingest.multi-work-nudge.spec.ts`。
- 共享元素交接（第 1 页 → 第 2 页），开关在 `core/stageFlags.ts`（`STAGE_SHARED_HANDOFF`，URL `?handoff=off` 关闭）：
  - 仪式期间清单不卸载，顶部换成仪式状态，暂存区和底栏隐藏，清单只读（`data-queue-readonly`）。**行为变化：仪式期间拖入被忽略。**
  - 放行时 `markHandoff()`；第 2 页 `TaskList` 在 900 ms 窗口内给每条轨道包装 `layoutId = sourceObjectId`，0.35 s 无回弹 spring 移动；窗口外不挂 layoutId，避免换轨 / 重新绑定时再次飞行。reduced motion 不做移动，只做 0.15 s 淡入淡出。
  - DragZone 退场时用 `useIsPresent` 冻结最后一帧清单，避免 store 清空后闪出空拖放井。
  - `IngestStep` 在开关打开时用 `AnimatePresence mode="popLayout"`（否则仍为 `wait`）。`gate-notice-dedupe` 的源码断言已同步。
- 进入工作台（Act 1 → Act 2）的 ViewTransition：`enterWorkbenchTransition`（`ACT_VIEW_TRANSITION`，URL `?vt=off` 关闭；不支持 / 页面隐藏时直接更新）。只用于合轴完成进入工作台、和顶部「工作台」从第 1 步点入两处。root 交叉淡化 0.25 s，reduced motion 0.15 s。
- 4x CPU 降速（Playwright + CDP，headless Chromium，Ted 压缩包 9 条，每种 3 次；rAF 间隔，t0 起 600 ms 窗口）：
  - 交接开：p50 16.7 / p95 33.4 / max 66.7 ms，>25 ms 7.5%，>33 ms 6.5%（93 帧）
  - `?handoff=off`：p50 16.7 / p95 33.3 / max 33.4 ms，>25 ms 5.2%，>33 ms 1.0%（96 帧）
  - 进入工作台（VT 开）：p50 16.7 / p95 33.3 / max 33.4 ms，>33 ms 0%；VT 从开始到结束 377–403 ms
  - 进入工作台（`?vt=off`）：p95 33.5 / max 116.7 ms，>33 ms 6.6%
  - 结论：交接每次约多掉 2 帧（>33 ms），没有长卡顿；先保留开关默认打开。若真机更差，方案 C = 关 `STAGE_SHARED_HANDOFF`。
- 既有问题（与本轮无关，只记录）：单元测试 `A3: deferred auto match` 偶发失败（`selectTask must not start its own search` 1 !== 0），在未改动的代码上 3 次也会失败 1 次。

### 下周从这里开始
1. 交接掉帧：先在真机 / 4x 下看是哪一帧长（首帧测量？），试只给可见行挂 layoutId；不行就走方案 C（关开关）。
2. 混合压缩包按条目拆分（现在整包归入多数片名，多作品提示里压缩包不可拆）。
3. layoutStage 坐标函数（方案 B 剩余）。
4. 第 2 页「更多文件」入口。
5. 仪式 token 编排。
6. 压缩包内同路径重名条目的 objectId 冲突。
7. 修 `A3` 偶发失败的单元测试。
8. ViewTransition 实测 377–403 ms，比 0.25 s 动画长（含快照和一次 setTimeout）；看能否去掉 setTimeout。

