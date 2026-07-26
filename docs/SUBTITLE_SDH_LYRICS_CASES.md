# 字幕现实案例经验备忘：歌词合并、SDH 取舍与类别边界

日期：2026-07-26  
样例来源：Lucky / 幸运女神 等实片字幕  
关联代码：`src/utils/subtitleCore.ts`（分类 / 合并）、`src/utils/subtitleTerminology.ts`（术语词典）、`src/utils/timeline/alignmentDiff.ts`（结构差异）、Workbench `SequenceList` 标签展示  
关联回归：`npm run test:core`

> 本文记录**可复现的现实形态**与**当下系统行为**，供查询与方案探讨。标注「现状」的不等于最终产品决策；标注「缺口」的优先进入后续分类/合并迭代。

---

## 0. 现有类型速查（实现层）

两套标签并存，不要混为一谈：

| 层 | 字段 | 主要取值 |
|----|------|----------|
| 行语义 `CueKind` | `cueKind` | `dialogue` / `lyrics` / `screen_text` / `sound_caption` / `narration` / … |
| 辅助细类 `AuxiliaryCueCategory` | `auxiliary.category` | `ambient_sdh` / `semantic_sdh` / `speech_context` / `music` / `screen_text` / `unknown` |
| 术语词典（偏产品文案） | `subtitleTerminology.ts` | 另有 `speaker_label`、`forced_narrative` 等，**尚未全部落到 CueKind** |

Workbench 展示近似映射：

- `cueKind === 'screen_text'` → **画面文字**
- `cueKind === 'sound_caption'` → **声音描述**
- `narration` / `semantic_sdh` / `speech_context` → **辅助信息**（兜底标签，语义偏宽）
- 含 `♪♫…` → 歌词行样式（音符图标）

---

## 1. 图1 — 歌词 + 译文如何合并

### 样例

同轴相邻两行（双文件或已拆轨）：

| # | 时间 | 内容 |
|---|------|------|
| 91 | `00:06:19.755 → 00:06:22.299` | 那是个糖果色的小丑 人们管他叫‘睡魔’ |
| 92 | 同上 | `♪ A candy-colored clown They call the sandman ♪`（歌词标记） |

### 期望语义

同一歌唱事件：一侧歌词原文，一侧译词。应合并为**一条双语行**（上译/下原或产品约定顺序），并保留 `lyrics` 属性，导出可走歌词斜体等规则。

### 现状

- `♪…♪` → `classifySubtitleCue` **优先**判为 `lyrics`（`lyric-symbol`），置信度高。
- **2026-07-26**：`lyrics↔dialogue` 已开合并白名单；同轴译词+原文合并为一条，`type/cueKind=lyrics`（详见 §10.13）。
- 合并后预览顶带按 `\n` 显示译/原；含 ` - ` 的唱句不再误走双人展开。
- 单文件「同时间相邻中英两块」可被双语折叠；双文件则靠 `mergeSubtitles` / 工业对齐。

### 探讨要点

1. **译词无 ♪ 时**：中文行可能是普通 `dialogue`，合并后 `combineCueKind` 应偏向保留 `lyrics`（歌唱事件优先于「看起来像对白」）。
2. **哼唱无词**（如后文 `Mmm.`）：是否并入歌词轨、是否单独 `sound_caption`，需产品规则，不能 silently 当对白差异。
3. **合并后排版**：歌词双语是否强制「译 / 原」顺序、是否保留两侧 ♪，属导出层问题，应与识别解耦。

---

## 2. 图2 — 歌词夹带 SDH 元素

### 样例

`[mouthing] ♪ I know when to go out ♪`

### 结构拆解

| 片段 | 性质 |
|------|------|
| `[mouthing]` | SDH **表演/发声方式**（口型、无声唱），不是环境音，也不是画面上的字 |
| `♪ … ♪` | 歌词正文 |

### 现状（实测分类）

- 整行因含音符 → **整行** `lyrics` + auxiliary `music`。
- **不会**单独抽出 `[mouthing]`；口型标记被歌词优先规则「盖住」。
- 若仅有 `[mouthing]`（无歌词）→ 落入括号默认 **`screen_text`**（`bracket-screen-text`），这是误归类。

### 取舍建议（探讨用）

| 策略 | 做法 | 适用 |
|------|------|------|
| A. 剥离 SDH、保留歌词 | 导出「干净歌词」；智能精简可丢 `[mouthing]` | 普通观看轨 |
| B. 保留复合行 | 识别为 `lyrics`，SDH 挂在 `auxiliary` / 行内注解 | SDH/无障碍轨 |
| C. 拆成两行 | 一行 manner，一行 lyrics | 少见，编辑成本高 |

**推荐默认探讨方向：A 为智能精简；B 为保留模式。** 关键点是先把 `[mouthing]` 从「画面文字」默认桶里挪出。

---

## 3. 图3 — 多角色同框 + 行内 SDH

### 样例

- 中：`好耶... - 就是啊`
- 英：`[normal] Yeah. Yeah. - [laughs] I know.`

### 结构拆解

| 标记 | 含义 | 是否「声音描述」 | 是否「画面文字」 |
|------|------|------------------|------------------|
| `-` 分隔 | 双人密排对白（同一 cue 两说话人） | 否 | 否 |
| `[normal]` | 语气/通道/说话状态标签 | 否（非事件音） | 否 |
| `[laughs]` | 笑声——可以是音效，也可以是说话方式 | 边界情况 | 否 |

### 现状

- 整行英文字幕 → `dialogue`（行内 `[]` **不**触发「全括号辅助句」规则）。
- 密排双人依赖 `-` / 换行展开逻辑（`expanded-dialogue`）；与对侧两条一一展开时才拆行。
- 独立一行的 `[laughs]` → `ambient_sdh` / `sound_caption`（可智能剥离）。
- 独立一行的 `[normal]` → 误判为 **`screen_text`**。

### 排版与处理探讨

1. **双人同 cue**：保留「一条时间内两说话人」是合法形态；展开仅在对侧已拆成两拍且时间包络吻合时进行（现有工业对齐已有此约束）。
2. **行内 SDH**：合并前可考虑「剥离方括号标签再对齐」，避免 `[normal]` 污染文本相似度；导出再按模式加回或丢弃。
3. **`[laughs]` 行内 vs 独占行**：独占行可当 ambient；行内更像 delivery，不宜整句降为 sound_caption。

---

## 4. SDH 中的角色名 / 发言人 —— 现有类别装不下

### 问题

SDH/CC 常见：

```text
[Amari] Don't.
Amari: Don't.
[Amari gasps]
[both] Wow.
```

这些是 **speaker_label / 发言人来源**，术语词典已有 `speaker_label`，但：

- `CueKind` **没有** `speaker_label`
- `AuxiliaryCueCategory` **没有** speaker 细类
- 括号默认回落是 `screen_text`（「非明确音效 → 画面文字」）

因此会出现：

- 角色名被当成「画面文字」
- 或剥皮后只剩动词才进入 `ambient_sdh`（`stripEnglishSdhSpeakerPrefix` 仅服务音效识别）

### 建议概念分层（探讨用，尚未落地）

| 概念 | 定义 | 示例 | 不宜归入 |
|------|------|------|----------|
| **speaker_label** | 谁在说 | `[Amari]`、`电台：` | 画面文字、环境音 |
| **delivery / manner** | 怎么说、口型、通道 | `[whispering]`、`[mouthing]`、`[normal]` | 画面文字 |
| **vocal_reaction** | 非词语发声事件 | `[laughs]`、`[gasps]`、`Mmm.` | 对白正文（可导出可选） |
| **ambient_sdh** | 环境/物体音事件 | `[phone ringing]`、`（脚步声）` | 画面文字 |
| **screen_text** | 画面里看得见的字 | 招牌、书名、短信 UI | 任何 SDH 括号 |

原则：**「括号」只是载体，不是类别。** 类别看括号**里面**的语义。

---

## 5. 图4 — 「辅助信息」与「画面文字」精确定义

### 样例（实片 UI）

| # | UI 标签 | 文本 | 解读 |
|---|---------|------|------|
| 48 | 辅助信息 | `《幸運女神》` | 片内标题卡 / 作品名提示，常顶置或样式强调 |
| 49 | 画面文字 | `(《無限風暴》, 麥可路易斯著)` | 画面中书封/引用的**可见文字**译文 |

### 精确定义（产品语义）

**画面文字（On-screen text / Forced narrative 的视觉侧）**

- 源是**画面上出现的字形**：招牌、短信、书名、文件名、海报、新闻条、UI 文案等。
- 观众「看见字」才需要读；不是耳朵听到的。
- 默认：**应保留**（尤其对听清对白但读不懂画面文字的观众）。

**辅助信息（当前 UI 的宽标签，建议收窄）**

现状 UI 把 `narration` / `speech_context` / `semantic_sdh` 都叫「辅助信息」，容易与画面文字混淆。建议讨论时拆开：

| 更窄概念 | 定义 | 图4 归属 |
|----------|------|----------|
| 标题卡 / 元信息 | 集标题、作品名、章节卡 | `《幸運女神》` 更接近此类（可视，但是「叙事卡片」而非道具文字） |
| 旁白 / 画外 | 解说、内心独白 | — |
| 语义 SDH | 「用外星语说」等理解性说明 | — |
| 技术/制作备注 | 字幕组署名等 | 通常应隐藏 |

**实用判别口诀**

1. 字是否画在场景物体/UI 上？ → **画面文字**  
2. 是否为听障服务的声音/说话说明？ → **SDH（再分子类）**  
3. 是否为叙事时间/章节/片名卡片？ → **标题卡**（可与画面文字同属「视觉保留」，但统计与滤镜可分开）  
4. 是否制作侧元数据？ → **非节目内容，默认不进观看轨**

### 现状缺口（实测）

- `《幸運女神》` 无括号、无 `\an8` 时，分类器可能落到 **`dialogue`**（短句 + 无强 screen 特征）。
- `(《無限風暴》, …)` 全括号 → 默认 **`screen_text`**（合理）。
- 因此图4 UI 若显示「辅助信息」，更可能来自 **ASS 样式/位置** 或上游已标 `narration`，而非纯文本规则稳定复现——迭代时应用样式信号 + 书名号/标题卡规则补强。

---

## 6. 图5 — 单侧语气词（如英 `Mmm.` / 中无「嗯」）与「结构差异」

### 样例（纠正后的真实形态）

- 英轨（或合并后仅一侧）有：`Mmm.`
- 中轨**没有**对应的「嗯……」/「唔」等译写

不是「两侧都是 Mmm. 的同文冗余」，而是 **语气/发声只有一轨写了**。

### 误判风险

时间轴上英侧单独占一行 → 容易进 `single-track` / 「结构差异」复核队列。  
但这类拟声、哼声、语气垫词：

- 往往**不要求**也不存在稳定中文译写；
- **不影响**对白理解与字幕表达完整性；
- 当成「缺译 / 结构破损」会制造噪音。

### 正确处理方向：补重成对（不是去重）

| 做法 | 说明 |
|------|------|
| **补重成对** | 将单侧 `Mmm.` 提升为一条双语结构行：保留有内容的一侧，另一侧留空（或可选软填「嗯」），在时间轴上仍算**已配对完成** |
| **不进结构差异** | 命中 `vocal_reaction` 词典的单侧行，不写入 `single-track` 结构差异计数 |
| **不去重** | 此处没有「双份相同文本要删一份」的问题；去重是另一类（真·双语同文） |

成对后的语义：

```text
（空或软填「嗯」）
Mmm.
```

或产品约定只显示有内容的一侧，但 **provenance / 行结构仍标记为 paired**，避免差异面板喊「单侧字轨」。

### 与「真同文」的区分

| 形态 | 处理 |
|------|------|
| 英 `Mmm.` + 中缺失 | **补重成对**；非结构缺陷 |
| 英 `Mmm.` + 中 `Mmm.`（少见） | 可合并展示；仍非结构缺陷 |
| 英对白 + 中缺失整句 | 仍可报单侧 / 结构差异（真缺译） |

判别启发：单侧文本经规范化后命中 vocal_reaction / 纯哼声词典（`mmm+`、`hmm+`、`ah+`、`oh+`、`嗯+`、`唔`…），且无可翻译实词 → 走补重成对，不走缺译告警。

---

## 7. 案例对照总表

| 案例 | 识别目标 | 现状摘要 | 主要缺口 |
|------|----------|----------|----------|
| 歌词 + 译词同轴 | 合并为 `lyrics` 双语行 | **已修**：白名单合并 + 强制 lyrics | 行内 SDH / layoutLane 仍待 |
| `[mouthing] ♪…♪` | lyrics + manner SDH | 整行 lyrics；manner 未建模 | mouthing 单独会变 screen_text |
| `A - B` + 行内 `[normal]`/`[laughs]` | 双人对话 + 可剥离标签 | 整行 dialogue；展开看对侧 | 行内 SDH 未剥离；`[normal]` 误类 |
| 角色名 `[Amari]` | speaker_label | 术语有、实现无；易落 screen_text | 类别空洞 |
| `《幸運女神》` vs 书名括号 | 标题卡 vs 画面文字 | 括号书名易对；裸书名号不稳 | 标题卡规则弱 |
| 英 `Mmm.` / 中无「嗯」 | **补重成对**，非结构差 | 易进 single-track | 缺 vocal 词典与成对补全 |

---

## 8. 后续迭代优先级（建议）

1. **P0 概念**：为 SDH 增加 `speaker_label` / `delivery`（manner），禁止再默认进 `screen_text`。  
2. ~~**P0 歌词合并**~~：**已落地（2026-07-26）** — 见 §10.13 验收。  
3. **P1**：`[SDH] ♪ lyrics ♪` 分解 manner；行内 `[]` 对齐前剥离。  
4. **P1 画面文字**：补强书名号/标题卡；与「辅助信息」UI 文案拆开。  
5. **P2 结构差异**：单侧 vocal（`Mmm.` 等）**补重成对**，不进 `single-track`；真缺译对白仍告警。

---

## 9. 回归样例清单（待补进 `test:core`）

```text
♪ A candy-colored clown They call the sandman ♪
那是个糖果色的小丑 人们管他叫‘睡魔’
[mouthing] ♪ I know when to go out ♪
[normal] Yeah. Yeah. - [laughs] I know.
好耶... - 就是啊
《幸運女神》
(《無限風暴》, 麥可路易斯著)
Mmm.            （仅英侧；中侧无「嗯」——应补重成对，非结构差）
[Amari gasps]
[normal]
[mouthing]
```

每条至少断言：`cueKind`、`auxiliary.category`、是否可合并、是否不得进入 `single-track`/`结构差异` 误报。

---

## 10. 算法与处理机制优化建议

目标：在**不破坏现有对白合并主路径**的前提下，把 SDH / 歌词 / 画面文字从「括号启发式」升级为「结构化注解 + 策略化导出」。

### 10.1 总架构：三层管道

```text
原始 cue
  → L1 注解抽取（Annotation Extract）   不改时间轴
  → L2 行分类与合并门禁（Classify + Merge Gate）
  → L3 导出策略（AuxiliaryMode / vocal 补对 / 滤镜）
```

| 层 | 职责 | 禁止事项 |
|----|------|----------|
| L1 | 抽出 speaker / delivery / ambient / lyric body / screen body | 不在此层决定删不删 |
| L2 | 给 `cueKind` + 合并兼容性打分 | 不把 delivery 默认打成 screen_text |
| L3 | smart/keep/clean 与 UI 滤镜 | 单侧 vocal 补重成对，不进结构差异 |

现状问题的根因：**L1 缺失**，括号内容直接在 L2 用「全包裹 → 非音效则 screen_text」一刀切。

---

### 10.2 L1：注解抽取（建议新增 `extractCueAnnotations`）

对单行文本输出结构化结果，例如：

```ts
type CueAnnotation = {
  speakers: string[];       // Amari / both / 电台
  deliveries: string[];     // mouthing / normal / whispering / laughs（manner 义）
  ambients: string[];       // phone ringing（事件义）
  lyricBody?: string;       // 去掉 ♪ 与前缀 SDH 后的歌词
  dialogueBody: string;     // 对齐/展示用净文本
  screenBody?: string;      // 确认的画面字
  packedTurns?: [string, string]; // 由 - 拆出的双人句（净文本）
};
```

**抽取规则（顺序固定，可测）：**

1. **歌词壳**：若含 `♪♫…`，先切出 `lyricBody`；行首/行尾的 `[…]` / `（…）` 若命中 delivery 词典，进 `deliveries`，不进 screen。  
2. **全包裹括号句**：整行只有一个括号块时：  
   - 音效词典 → `ambients`  
   - delivery 词典（mouthing/normal/whispering/in English/…）→ `deliveries`  
   - `Name:` / `Name verb` / `both|crowd` → speaker 剥皮后再判 ambient/delivery  
   - 标题卡/书名号/ON SCREEN 词 → `screenBody`  
   - 其余 unknown 保持 unknown，**禁止**默认 screen_text  
3. **行内多括号**（图3）：全局扫描 `[tag]`，tag 在 delivery/ambient 词典则剥离，剩余为 `dialogueBody`；`-` 双人切分在净文本上做。  
4. **中英不对称**：中文侧常无 SDH 括号——对齐必须用 `dialogueBody` / `lyricBody`，不能拿带 `[normal]` 的原文去比相似度。

词典建议独立成 `sdhLexicon.ts`（EN/ZH），与 `CONFIRMED_AMBIENT_*` 同源演进，避免再散落魔法正则。

---

### 10.3 L2a：分类器改造（替换「括号默认画面文字」）

**决策表（优先级从上到下）：**

| 条件 | cueKind | auxiliary.category | 说明 |
|------|---------|--------------------|------|
| 有 lyricBody / 音符 | `lyrics` | `music`（deliveries 可挂 side） | 图1/图2 |
| 仅 ambient、无对白 | `sound_caption` | `ambient_sdh` | 可 smart 剥离 |
| 仅 delivery、无对白 | `narration` 或新 kind | **新** `delivery` | 禁 screen_text |
| 仅 speaker 标签 | — | **新** `speaker_label` | 术语已有，需落地 |
| screenBody / `\an8` / 样式 top | `screen_text` | `screen_text` | 图4 书名等 |
| 书名号标题卡（`《…》` 且短、无句读） | `screen_text` 或 `narration` | 建议 `title_card`（可选） | 与道具文字同分保留、分滤镜 |
| 其余 | `dialogue` | 行内注解保留在 annotation | 图3 |

**关键打破点：** 删除或降级当前逻辑  

`category === unknown && fullyWrapped → screen_text`  

改为：`→ unknown + keep_auxiliary`，由 UI 标「待确认」，而不是假装认识。

`AuxiliaryCueCategory` 建议扩展：

```text
ambient_sdh | delivery | speaker_label | semantic_sdh | speech_context
| music | screen_text | title_card | unknown
```

`semantic_sdh` 与 `delivery` 分开：前者是「说了外星语」类理解说明，后者是「怎么说/口型」。

---

### 10.4 L2b：合并门禁与歌词/译词

现状 `getCueMergeCompatibility`：不同 `cueKind` 直接 `canMerge: false`。  
这会导致：**译词被标 dialogue、原文标 lyrics 时无法合并**（图1 高风险）。

**建议特例（显式白名单）：**

```text
lyrics ↔ dialogue（且对侧 dialogueBody 非空、时间高重叠）→ canMerge: true, boost +8
lyrics ↔ lyrics → canMerge: true, boost +10
screen_text ↔ screen_text → 维持
sound_caption ↔ dialogue → 禁止（现状正确）
delivery 独占行 ↔ dialogue → 禁止（避免 [mouthing] 贴到对白）
```

合并后合成：

- `cueKind = lyrics`（歌唱事件优先）  
- `annotation` 合并 deliveries/speakers  
- 展示文本：`译\n原` 或产品顺序；♪ 只保留一侧或按导出开关  

**对齐用文本：** 一律 `annotation.dialogueBody || lyricBody`，行内 SDH 不参与 edit-distance / token 分。

**预处理顺序建议：**

```text
parse → extractCueAnnotations → classify(annotation) → preprocessRows
→（可选）strip inline SDH for alignment copy
→ merge / industrial align
→ reattach annotation onto merged row
```

---

### 10.5 L2c：密排双人 + 行内 SDH

现状 `splitPackedDialogueTurns` 在含 `[laughs]` 时仍可能切出脏 turn。

优化：

1. 先 `extractCueAnnotations` 得 `dialogueBody`，再跑 `-` 切分。  
2. 每个 turn 可带自己的 delivery（`[normal] Yeah` / `[laughs] I know` → 两 turn 各带标签）。  
3. 展开条件不变（对侧两拍 + 时间包络）；**不要**因为一侧有 SDH 就拒绝展开。  
4. 展开后的 provenance 标记 `expanded-dialogue`，与歌词合并区分开。

---

### 10.6 L3：导出与智能精简策略

现状 `smart`：丢掉 `ambient_sdh` + `music`。  
问题：歌词 `music` 会被 smart 误杀；`[mouthing]` 又进不了可剥类别。

**建议模式矩阵：**

| mode | 丢弃 | 保留 |
|------|------|------|
| `clean` | ambient、delivery、speaker_label、music 注解 | dialogue / lyrics 正文、screen_text、title_card、semantic 必要说明 |
| `smart` | ambient；纯 delivery 独占行；单侧 vocal 可选藏 | lyrics 正文；screen_text；semantic_sdh；speaker 可选留 |
| `keep` | 无 | 全部（注解可保留在正文或 ASS comment） |

修正：`music` 且 `cueKind===lyrics` → **永不因 smart 删除整行**；只允许剥 delivery 前缀。

---

### 10.7 画面文字 vs 标题卡（图4）算法信号

加权特征（可累加过阈）：

| 信号 | 倾向 |
|------|------|
| `\an7-9` / ASS style 含 Title/Sign/Top | screen / title_card |
| 全括号 + 书名号/著者 | screen_text（道具/引用） |
| 裸书名号、极短、无动词句读 | title_card |
| ON SCREEN / 短信/邮件关键词 | screen_text |
| 仅引号作品名出现在片头片尾时间窗 | title_card 加权 |

UI：滤镜拆成「画面文字」「标题卡」，不再用含糊的「辅助信息」兜所有 narration。

---

### 10.8 单侧 vocal 补重成对 vs 结构差异（图5）

**问题本质：** 英侧有 `Mmm.`，中侧没有「嗯……」——不是双份同文要去重，而是单侧语气词被当成缺译/单轨破损。

在合并收尾 / `analyzeAlignmentDiff` 之前：

```text
一侧非空且命中 vocal_reaction 词典（mmm/hmm/ahh/嗯/唔…）
另一侧为空或缺失
→ 补重成对：生成 bilingual 行（有内容侧保留，对侧留空或软填）
→ alignment = 'vocal-pad-pair'（或等价标记）
→ 不进入 single-track 结构差异
```

| 步骤 | 行为 |
|------|------|
| 识别 | `isVocalReactionOnly(text)`：无实词、仅拟声/语气 |
| 补对 | 写入空对侧，保持时间码；可选软填中文「嗯」开关（默认关，只补结构） |
| 差异面板 | 排除；可选「单侧语气词已成对」信息级统计 |
| smart | 可整行隐藏（内容策略）；与是否成对无关 |

真对白单侧缺失仍走 `single-track`，避免把「缺译」误吞掉。

---

### 10.9 合并评分微调（工业对齐）

在现有时间重叠分之外加注解感知项：

| 条件 | 分 |
|------|----|
| 双方 lyricBody 非空 | +12 |
| 一方 lyrics、一方译词（无音符但同轴高重叠） | +10 |
| 单侧 vocal_reaction，对侧空 | 不配对惩罚；收尾补重成对 |
| 一方纯 ambient、一方 dialogue | −∞ / 禁止 |
| 行内 SDH 剥离前后相似度提升 | 用剥离后文本重算 |

避免「带 `[normal]` 的英文」与干净中文因表面字符串差而拆散。

---

### 10.10 落地切片（推荐实施顺序）

| 切片 | 内容 | 风险 | 验收 |
|------|------|------|------|
| **S1** | 抽出 `extractCueAnnotations` + lexicon；分类禁止 unknown→screen_text | 低 | `[normal]`/`[mouthing]` 不再是 screen_text |
| **S2** | lyrics↔dialogue 合并白名单 + 合并后强制 lyrics | 中 | **已验收** — §10.13 |
| **S3** | 行内 SDH 剥离后再对齐；packed turns 用净文本 | 中 | 图3 可展开且无脏标签 |
| **S4** | smart 不因 music 类删除 `type/cueKind=lyrics` 行 | 低 | **已随 S2 落地** — §10.13 |
| **S5** | title_card 信号 + UI 滤镜文案 | 低 | 图4 两类稳定 |
| **S6** | 单侧 vocal 补重成对，排除结构差异 | 低 | 英 `Mmm.`/中无「嗯」不成 single-track |

每一切片必须先补 §9 样例进 `test:core`，再改生产逻辑（与 TMDB 年份备忘同一纪律：**样例驱动，禁止口头经验写进默认分支**）。

---

### 10.11 明确不做什么

1. **不**用大模型做主分类（延迟/不稳）；词典 + 结构规则足够覆盖 Netflix/CC 常见 SDH。  
2. **不**在识别层删除时间轴行；删除只发生在 L3 导出模式。  
3. **不**把所有括号内容重新标成 narration 一锅炖——那只是换一个错误桶。  
4. **不**把单侧 `Mmm.` 当成缺译去「硬译」成必须出现的中文——默认补的是**结构成对**（对侧可空）；软填「嗯」仅作可选开关。  
5. **不**用「去重」描述图5；图5 是补重成对，不是删冗余。  
6. **不**把歌词塞进 `commentary` 导评输入槽——歌词是显示平面，导评是第三输入文件。

---

### 10.12 歌词是不是「第三轨」？处理机制如何体现

#### 行业里的两层含义（勿混）

| 含义 | 是什么 | 影视剧常见形态 |
|------|--------|----------------|
| **输入轨 / 文件槽** | 独立字幕文件或 ASS 独立 Style 流 | 导评、Commentary、有时单独 `lyrics.srt` |
| **显示平面 / 布局轨** | 画面上的占位区域，与对白错开 | 歌词/唱段多在**上方或非中下对白区**；对白在底部 |

片中插曲歌词，**绝大多数是第二种**：语义上仍来自主字幕（或 SDH）时间轴，但排版上占用「对白以外的第三显示带」。  
只有发行方单独提供歌词文件、或字幕组拆出 `Lyrics` 样式流时，才接近第一种「真·第三输入轨」。

#### 本仓库现状

| 概念 | 现状 | 与歌词关系 |
|------|------|------------|
| `files.zh` / `files.en` | 主副语言输入槽 | 歌词/译词通常**嵌在这两轨里**（`♪…♪`） |
| `files.commentary` | 第三**输入**槽（导评） | **不是**歌词轨；合并后 `type=commentary` |
| `cueKind/type = lyrics` | 行级语义 | 从主轨文本识别，非独立上传槽 |
| ASS `Style: Lyrics` / `Lyrics_EN` | 导出布局 | `lyricPosition` 默认 `top` → Alignment `8`（顶）；对白 `Han`/`EN` → Alignment `2`（底） |
| 画面文字 Note | 亦常顶置 `\an8` | 与歌词同属「上半区」，但语义不同，Style 已分开 |

结论：**导出层已把歌词当顶置布局轨**；合并层仍只是主轴上的特殊 `cueKind`，没有贯穿全链路的 `layoutLane`，也未与导评输入槽区分建模。

#### 建议显式建模：`layoutLane`（与输入槽正交）

```text
inputTrack:  zh | en | commentary | (仅必要时 lyricsFile)
layoutLane:  dialogue | lyrics | screen | note
cueKind:     dialogue | lyrics | screen_text | …
```

| layoutLane | 默认占位 | 谁写入 |
|------------|----------|--------|
| `dialogue` | 底部双语带 | 普通对白合并行 |
| `lyrics` | 顶部（或 `lyricPosition=bottom`） | `cueKind=lyrics` 合并行（含译词） |
| `screen` | 顶/定位 | 画面文字、标题卡 |
| `note` | 顶或侧 | 技术备注等 |

**合并层：**

1. 歌词↔译词白名单合并后：`cueKind=lyrics` **且** `layoutLane=lyrics`。  
2. `lyrics` 平面与 `dialogue` 平面 **允许时间重叠**（上歌词、下对白），不对齐竞争、不互相吞并。  
3. 可「先完成对白 DP，再按时间锚挂上 lyrics 行」；或按 lane 分子图。  
4. `commentary` 继续走第三**输入**槽；与歌词重叠靠导出 Layer/Style 分层。

**导出层（钉死现有能力）：**

```text
dialogue → Han/EN, Alignment 2, Layer 0
lyrics   → Lyrics/Lyrics_EN, Alignment 8|2, Layer 1
screen   → Note / \an8, Layer 1+
```

Workbench：歌词行除音符外给「顶带」分区预览，避免看起来像第三条底栏对白。

#### 何时才开真·歌词输入槽

仅当：用户单独丢了歌词文件，或主轨无词而源 ASS 带独立 `Style: Lyrics` 流。  
默认路径仍是：**主轨识别 → 译词合并 → lyrics 显示平面导出**。

#### 与「歌词↔译词白名单」的关系

- 白名单：同一 `layoutLane=lyrics` **内** 原文/译词成对。  
- `layoutLane`：成对之后进顶带、不与底栏对白抢合并。  

两步缺一：只有白名单可能合进底栏；只有顶置样式则译词可能因 `cueKind` 不一致合不进来。

---

### 10.13 验收记录：歌词译词合并（2026-07-26）

#### 缺陷复现（修前）

实片（Modern Love 等）同轴两行：

| 侧 | 文本 | cueKind |
|----|------|---------|
| 中 | `讓我準時上教堂` | `dialogue`（无 ♪） |
| 英 | `♪ Gets me to the church on time ♪` | `lyrics` |

`getCueMergeCompatibility` 因 `primaryKind !== secondaryKind` 直接拒合 → 列表保留两行 → 预览 `findActivePoint` 同刻只激活英词行 → 顶栏仅原文。

#### 代码改动

| 点 | 文件 | 行为 |
|----|------|------|
| 合并白名单 | `getCueMergeCompatibility` | `lyrics↔dialogue` / `lyrics↔lyrics` → `canMerge: true`，加分 +8/+10 |
| 合并产物 | `createMergedRow` + 快/工最终 map | 任一侧歌词 → `type=lyrics` 且 `cueKind=lyrics`；文本 `译\n原` |
| 防误展开 | `canExpandPackedDialogue` | 任一侧 `lyrics` / 含 ♪ → 不按 `A - B` 双人对话拆行 |
| 导出 | `shouldKeepSubtitleForAuxiliaryMode` | `lyrics` 行在 smart/clean 下保留（不被 music 辅助类误剥） |

#### 验收标准（已写入 `test:core`）

1. 工业对齐与快速合并：同轴「無 ♪ 译词 + ♪ 原文」→ **1 行**，`type/cueKind === 'lyrics'`，`text === '譯\n♪ … ♪'`。  
2. 含 ` - ` 的唱句（`準時上教堂 - 讓我害怕` / `♪ Church on time ♪ - ♪ Terrifies me ♪`）→ 仍为 **单行双语歌词**，`alignment !== 'expanded-dialogue'`。  
3. `applyAuxiliarySubtitleMode(..., 'smart')` 保留该合并行。  
4. 人工：Workbench 预览顶带应同时见译词与原文（`ScreenSimulator` 对 `type===lyrics'` 按 `\n` 拆两行）；列表不应再出现同轴拆开的 #24/#25。

#### 仍未做（不在本次范围）

- `layoutLane` 字段贯穿（§10.12）— 导出已靠 Lyrics Style 顶置，合并层未单列平面。  
- 行内 `[David Bowie]` / `[chorus]` / `[mouthing]` 剥离（S1/S3）。  
- 单侧 `Mmm.` 补重成对（S6）。

#### 工作台图示与定位（2026-07-26 续）

| 位置 | 行为 |
|------|------|
| 检查标记 `inspectionMarks` | 新增 `lyrics` 类：音符 glyph、青铜色、第四轨 |
| 分布图 | 歌词点可点击定位到对应行；筛选 tab「歌词」 |
| 概览计数 | 歌词条数与画面/声音并列 |
| 详细列表 | 歌词项带「定位」；判定文案含显示平面（顶部/底部，随 `lyricPosition`） |
| 序列列表 | 时间轴旁音符 + 内容区「歌词 · 顶部/底部」标签 |

歌词行优先记入 `lyrics` 轨，不再因 `auxiliary.music` 误入「声音描述」。
