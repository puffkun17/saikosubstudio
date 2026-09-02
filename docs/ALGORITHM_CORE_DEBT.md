# 字幕核心算法债与 P0/P1 落地备忘

日期：2026-07-18

## 背景

`src/utils/subtitleCore.ts` 是双语合并与辅助轨分类的主引擎；编排入口在 `useStudioStore.runSubtitleMerge`。旁路报告见 `src/utils/timeline/alignmentDiff.ts`、`sourceMatch.ts`；回归主线为 `npm run test:core`（`scripts/regression-subtitle-core.mjs`）。

主链路：

1. 解码 / 解析 / 清洗
2. 语言与双语识别、文件名身份
3. 双轨合并：`mergeSubtitles`（快速）或 `alignSubtitlesIndustrial`（DP）
4. 单文件双语折叠、辅助轨过滤、导出

## 复盘结论（改前）

| 优先级 | 问题 | 风险 |
| --- | --- | --- |
| P0 | 快速合并与工业对齐各自硬编码同一套时间匹配阈值，易漂移 | 两路径行为悄悄不一致 |
| P0 | `getExpandedDialogueRows` 只看 path 的「下一步」；尾部或中间插入导致 path 下一步不是对侧未配对句时，密排双人对话不展开 | 对话行粘连、对侧句孤立 |
| P0 | 尾部展开 / 降级 / SDH 边界回归偏薄 | 修回归易漏 |
| P1 | 工业对齐在 `M*N > 8e6` 时静默降级为快速合并，仅写 log | 用户以为仍在工业对齐 |
| P1 | 类型含 `speech_context`，分类器实际写入 `semantic_sdh` | 死类型、过滤语义含糊 |
| P1 | 分类置信度魔法数散落 | 调参难追溯 |
| P2+ | 解析器阶段、巨石文件、置信度驱动复核等 | 后续迭代 |

## 本次落地（P0 / P1）

### P0

1. **共享 `CUE_MATCH_POLICY` + `isTemporalCueMatch`**  
   快速合并、工业 DP 打分、path 上「是否可合并」三处共用同一政策，避免阈值分叉。

2. **密排对话展开：path 下一步优先，数组邻接兜底**  
   - 仍优先消费 path 上「配对 + 对侧未配对」安全组合。  
   - path 结束、或下一步是另一轨插入时，回退到 `enIdx+1` / `zhIdx+1`，并用 skip 集合避免二次消费。  
   - 若邻接句稍后在 path 上已有正式配对，则不抢占。

3. **回归**  
   - 中间插入旁白时，工业对齐仍应展开密排双人对话。  
   - 矩阵过大时 `onFallback` 被调用（见 P1）。  
   - `speech_context` 分类断言随落地更新。

### P1

1. **降级可感知**  
   `alignSubtitlesIndustrial(..., options?: { onFallback })`；store 在降级时 `setStatusNotice`（语气 `notice`），日志文案保留。

2. **`speech_context` 落地**  
   原「语义发言语境」关键词分支改为写入 `category: 'speech_context'`（不再假借 `semantic_sdh`）。合并兼容与辅助模式仍把二者同等对待。

3. **分类阈值表 `AUXILIARY_CLASSIFY_SCORES`**  
   music / screenText / speechContext / ambient / bracket / unknownBase 集中命名，分类器只读表。

4. **带状 DP（Sakoe–Chiba）** — 2026-07-18 续  
   - `M*N > maxAlignmentCells`（现 16M）时不再默认快速合并，改为对角线附近带宽 `2*half+1`（半宽夹在 `minBandHalfWidth`…`maxBandHalfWidth`）的工业 DP。  
   - `onFallback.reason = 'banded'` → UI「已启用带状对齐」；仅极端体量（最小带宽仍超预算）才 `matrix_too_large` → 快速合并。  
   - 约 2000×2000 官方包可走完整工业矩阵；更大体积走带状。

## P2 落地（2026-07-18）

1. **`mediaIdentity.ts` 抽出**  
   `cleanFilename` / `parseMediaFilename` / `assessMediaIdentity` / `buildTmdbSearchQueries` / `smartDetectTitle` 迁出；`subtitleCore` re-export 保兼容。

2. **文件名身份加固**  
   - `cleanFilename` 只读 `parseMediaFilename`（电影保留年份），消灭双路径。  
   - `smartDetectTitle` 优先 `assessMediaIdentity` 强身份；噪声 token 的 common-join 降级；补回归。

3. **`OFFSET_DIAGNOSIS_POLICY` + `offsetDiagnosis.ts`**  
   阈值集中；`estimateGlobalOffsetFromStarts` 可单测；工业路径日志门控读政策表。

4. **对齐差异复核：`shifted-match`**  
   `analyzeAlignmentDiff` 将整体平移配对从「直接配对」拆出并分组；`AlignmentDiffPanel` 增加「平移配对」筛选与计数。

## 仍留后续（P2+/P3）

- 继续拆 `parse` / `classify` / `align` / `export` 模块
- ~~低置信度队列（非 shifted）~~ → 已用 `buildMergeReviewQueue` 落地（coverage / 展开 / 单轨 / 平移 / 其他存疑）；解析器多阶段仍待拆
- 分窗拼接（window stitch）作为带状之外的第二种大矩阵策略

## 验证

```bash
npm run test:core
npx tsc --noEmit
npm run lint
```

## 追溯索引

- 政策与展开：`src/utils/subtitleCore.ts`（`CUE_MATCH_POLICY`、`tryExpandPackedDialogueAtPath`、`classifyAuxiliaryCue`）
- 身份：`src/utils/mediaIdentity.ts`
- 偏移：`src/utils/timeline/offsetDiagnosis.ts`
- 差异复核 / 待复核队列：`src/utils/timeline/alignmentDiff.ts`（`analyzeAlignmentDiff` + `buildMergeReviewQueue`）、`AlignmentDiffPanel.tsx`、`WorkbenchStep.tsx`
- 降级通知：`src/store/useStudioStore.ts` → `runSubtitleMerge`
- 回归：`scripts/regression-subtitle-core.mjs`
