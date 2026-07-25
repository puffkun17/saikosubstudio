# SaikoSubStudio 视觉设计审计报告

**日期：** 2026-07-26  
**范围：** `app/`、`src/`、`app/globals.css`（不含 `.snapshots/`、`.agents/`）  
**方法：** 静态代码盘点（token、class、组件用法统计）+ 与 Ridgeline（v5）声明体系对照  
**约束：** 本报告只审计、不改代码、不重设计实现。

---

## 总览

产品已具备清晰品牌骨架：**奶油底 `#f5f1ea` · 墨绿 `#1a3d37` · 柑橘 `#ef8d5f`（Ridgeline / v5）**，并有 `.ui-action` / `.ui-tag` / `.v4-panel` 等半成形控件层。主要问题不是「没有设计」，而是 **token 代际叠层（@theme 旧暗色 + v4 别名 + v5 实值）**、**控件实现双轨（shadcn 未用 vs 手写 Tailwind）**、以及 **语义色板外溢**（语言标、文件图标、检查标记各自一套色）。

建议把 Ridgeline 定为唯一真相源，把其余全部收敛为「角色 token + 有限组件 API」。

---

## 1. Colors（颜色）

### 1.1 当前声明体系（叠层）

| 层 | 位置 | 问题 |
|---|---|---|
| **Ridgeline 三元** | `--v5-cream/green/orange*` | 品牌核心，应保留 |
| **语义表面** | `--v5-canvas/panel/line/text/accent/danger/warning` | 可用，但命名仍挂 v5，组件里几乎全写 `--v4-*` |
| **v4 别名** | `--v4-* → var(--v5-*)` | 兼容正确，但新代码继续写 v4，代际永远清不掉 |
| **@theme 遗留暗色** | `--color-bg-dark/surface-*/text-primary` 等冷灰蓝 | 与奶油/墨绿产品面无关；`mint`/`emerald` 名却指向柑橘 |
| **动作色重复** | `--color-action*` ≈ `--v5-accent*` ≈ `--v5-orange*` | 同一色 3～4 个名字 |

### 1.2 重复 / 不一致（高影响）

| 现象 | 证据 |
|---|---|
| 同一 accent 多名 | `#ef8d5f` 同时叫 `mint`、`emerald`、`action`、`v5-orange`、`v5-accent`、`v4-accent` |
| 硬编码 hex/rgba 散落 | `src`+`app` 中 hex 出现百余次；阴影/hover 大量 `rgba(26,61,55,*)`、`rgba(239,141,95,*)` 未走 token |
| 检查标记引入体系外蓝 | `MARK_COLOR.screen = #3b82f6`（Tailwind blue-500） |
| 语言标独立 12 色 | `LANG_VISUAL` 内黄/绿/粉/棕等，故意避开文件图标色，但未进入全局 token |
| 文件图标独立 7 色 | `ADOBE` 调色板（teal/plum/citrus/brick/indigo…） |
| 危险 hover 硬编码 | `rgba(201,138,134,0.1)` 与 `--v4-danger #c45b55` 未绑定 |
| 托盘上奶油半透明 | 多处 `rgba(245,241,234,0.1~0.16)` 手写，未提成 `--tray-ink-soft` |
| TMDB 蓝 glow | `drop-shadow … rgba(59,130,246,0.6)` 品牌外溢 |

### 1.3 简化色板建议（不改实现，仅推荐）

**核心（保留）**

- Canvas：`cream` / `cream-raised` / `panel` / `panel-muted`
- Ink：`forest` + muted/faint（基于 forest alpha）
- Accent：`citrus` + strong/soft/ink
- Semantic：`danger` / `warning`（可选 `success` 从 forest 派生，勿再引入独立绿）

**收敛规则**

1. 删除或冻结 `@theme` 暗色与 mint/emerald 伪名。  
2. 新代码只写 `--v5-*`（或统一改名为无版本前缀：`--ss-accent`）。  
3. 语言 / 文件 / 检查标记色改为「有限语义角色」或「数据可视化辅色阶」，集中定义，禁止组件内散落 hex。  
4. 阴影与 hover 一律 `color-mix(in srgb, var(--v5-*) …)`，禁止裸 `rgba(239,141,95,*)`。

---

## 2. Border radius（圆角）

### 2.1 已声明 token

| Token | 值 | 用途意图 |
|---|---|---|
| `--v5-radius-panel` | `1.25rem` (20px) | 大面板 / CTA |
| `--v5-radius-control` | `0.75rem` (12px) | 控件 |

### 2.2 实际使用盘点

| 值 / 工具类 | 出现量级 | 典型用途 |
|---|---|---|
| `rounded-lg` (8px) | ~65 | 面板、输入、多数卡片 |
| `rounded-md` (6px) | ~34 | 小按钮、语言牌、下拉 |
| `rounded-xl` (12px) | ~19 | 部分列表行、反馈 toast |
| `rounded-full` / `999px` | ~20 + CSS 10 | 胶囊、点、托盘 chip |
| `rounded-sm` / `2px` | 少 | 屏幕框、刻度 |
| `0.45 / 0.5 / 0.625 / 0.65 / 0.375rem` | CSS 各 1 | `.ui-choice` / `.ui-action` / `.ui-tag` |
| `8px` / `6px` / `rounded-[11px]` | 散点 | BrandMark、局部控件 |
| `rounded-4xl` | shadcn Badge（未接入） | 死代码 |

**结论：** 声明只有 2 档，实战至少 **8～10 档**；面板常用 `rounded-lg`，却几乎不用 `--v5-radius-panel`（仅 CTA 等少数处）。

### 2.3 统一圆角阶建议

| 角色 | 建议值 | 用途 |
|---|---|---|
| `radius-xs` | 2px | 刻度、标记方块边 |
| `radius-sm` | 6px (`md`) | 芯片、语言牌、icon 按钮 |
| `radius-md` | 8px (`lg`) | 输入、标准面板、多数卡片 |
| `radius-lg` | 12px (`xl` / control) | 分段控件容器、toast |
| `radius-xl` | 20px (panel) | 空态主 CTA、大抽屉 |
| `radius-pill` | 999px | 仅托盘状态胶囊、进度点 |

禁止：一次性 `rounded-[11px]`、`0.45rem` 等中间值。

---

## 3. Shadows（阴影）

### 3.1 现状：几乎无 token，全是一次性值

盘点到 **20+** 种 elevation / glow，彼此差 2～6px 模糊半径或 alpha：

| 类型 | 代表值 | 出现场景 |
|---|---|---|
| 面板 hairline | `0 1px 0 rgba(26,61,55,0.04)` | `.v4-panel` |
| 下拉（浅） | `0_12px_28/36 … 0.12~0.14` | TrackSelect、Feedback |
| 下拉（深） | `0_12px_28 rgba(0,0,0,0.4)` | DragZone 菜单（偏黑，奶油面突兀） |
| Modal | `0_18px_48` / `0_24px_70`（黑或墨绿 alpha） | 确认框、TMDB、历史 |
| CTA glow | `0_8px_24 rgba(239,141,95,0.25)` | 空态主按钮 |
| Accent ring glow | `0_0_8~18px color-mix(accent…)` | 选中、色点、segment |
| Theater / tip | `0_8px_24 rgba(0,0,0,0.45)` | 进度 tip |
| 文件图标 | `drop-shadow 0_1px_1.5px` | FileFormatIcon |
| 杂项 | `shadow` / `shadow-sm` / `drop-shadow-2xl` | ColorSampler、TV 框 |

### 3.2 统一阴影体系建议

| 角色 | 建议 | 说明 |
|---|---|---|
| `elevation-0` | none / hairline | 默认面板 |
| `elevation-1` | `0 8px 24px color-mix(forest 10%, transparent)` | 轻浮层 |
| `elevation-2` | `0 16px 40px color-mix(forest 14%, transparent)` | 下拉、toast |
| `elevation-3` | `0 24px 64px color-mix(forest 18%, transparent)` | Modal |
| `glow-accent` | `0 0 12px color-mix(accent 22%, transparent)` | 仅选中/焦点，一种即可 |
| `glow-cta` | `0 8px 20px color-mix(accent 25%, transparent)` | 仅主按钮 |

奶油面上优先 **墨绿 tint 阴影**，避免同一 App 里一半冷黑一半暖绿。

---

## 4. Typography（字体排印）

### 4.1 字体族（健康）

| 角色 | 实现 | 评价 |
|---|---|---|
| UI 无衬线 | PingFang / 雅黑 → Geist Sans | 产品向，合适 |
| Display 衬线 | Noto Serif SC（自托管） | 片源名/空态主句，有辨识度 |
| Mono | Geist Mono | 时间码、缩放、语言标 |

### 4.2 尺寸：声明与实战脱节

`@theme` 注释写：**annotation 13 / control 15 / body 16 / headings 18–24**，但组件里：

| 用法 | 约计次数 |
|---|---|
| `text-xs` / `text-sm` | 各 ~89（主导） |
| 任意 `text-[9~26px]` | **40+**（11/13/14/15/16/17/22…） |
| `text-base` / `lg` / `xl` / `3xl` | 很少 |

**权重：** `font-medium` ~86、`font-semibold` ~84、`font-bold` ~9；body 设 `font-weight: 450`，与 Tailwind 默认档不完全对齐。

**字距：** `tracking-[0.08em]` / `0.1em` / `0.12em` / `0.04em` 并存（eyebrow、反馈页、检查标签）。

### 4.3 建议字阶（产品 UI）

| 角色 | Size | Weight | 备注 |
|---|---|---|---|
| Caption / meta | 12–13px (`xs` 或固定 0.75–0.8125rem) | 500–600 | `.text-meta` / `.text-caption` |
| Control / label | 14–15px | 600 | 按钮、chip |
| Body | 16px | 450–500 | 默认 |
| Title (section) | 18px | 600–700 | |
| Display | 22–26px + `.font-display` | 700 | 仅空态/片名 |

禁止：同屏混用 `text-[11px]` 与 `text-xs` 表达同一层级。

---

## 5. Icons（图标）

### 5.1 来源清单

| 来源 | 用途 | 文件/位置 |
|---|---|---|
| **Lucide React** | UI 动作/状态（21 个文件 import） | 全站主图标源 |
| **自定义 SVG** | 文件格式 Adobe 风字形 | `FileFormatIcon.tsx` |
| **自定义几何** | 检查标记 ■●▲ | `inspectionMarks.tsx` |
| **品牌位图/SVG** | logo、favicon、ingest 四格插画 | `public/brand-mark*`、`ingest-features.png` |
| **场景/设备图** | TV CRT/modern、背景 | `public/tv-*.png`、`Background.jpg` |
| **第三方** | TMDB logo | `tmdb_logo_blue_square.svg` |

### 5.2 风格不一致

| 问题 | 证据 |
|---|---|
| 描边粗细不统一 | 默认 ~2；多处 `strokeWidth={2.25|2.5}`、`stroke-[2.2]`、SVG `1`/`1.75` |
| 尺寸阶混乱 | `h-3.5` / `h-4` / `h-5` / `h-[18px]` 混用 |
| 填充例外 | Play 用 `fill-current`，其余描边 |
| 语义图标 vs 插画 | Lucide 线框 + Adobe 色块文件标 + PNG 功能插画，同屏对比强 |
| 检查标记非 Lucide | 几何色块，与周围线框图标语言不同（可接受，但需文档化） |

### 5.3 建议

- Lucide：统一 **size 16/20**（`h-4` / `h-5`），**stroke 2**（托盘可单独 2.25，写成 token）。  
- 文件/语言/检查三类「数据字形」保持独立体系，但颜色进 token。  
- 插画只出现在空态/营销位，不进工具栏。

---

## 6. Badges / Pills / Labels（徽章）

### 6.1 并存的多套「标签语言」

| 体系 | 视觉 | 使用处 |
|---|---|---|
| `.ui-tag` | 圆角方 chip、墨绿淡底 | 影片类型 |
| `.rd-chip` | **无边框纯文字**（legacy 注释：已去 pill） | 任务列表 meta |
| `.ui-rating*` | 品牌大写 + mono 分数 | TMDB 等 |
| `LanguageMark` | 色块字牌 + 描边壳 | 轨语言 |
| `FileFormatIcon` | Adobe 折角/箱体 | 格式 |
| AlignmentDiff `badgeTone` | `rounded-md` + 语义底色 | 结构差异等 |
| SystemTray 缩放 | `rounded-full` 胶囊 + accent 小 pill | `Aa 100%` |
| Export option badge | `rounded-md` mono 11px | ASS/SRT |
| shadcn `Badge` | `rounded-4xl` h-5 | **未被引用（死代码）** |
| WorkflowChrome badges | 刻意「非 chip」静态排印 | 片源元数据 |

### 6.2 问题

- 「什么时候用 pill / chip / 纯文字 meta」没有统一决策表。  
- shadcn Badge 与产品视觉无关，增加认知噪音。  
- 托盘胶囊（full）与工作区方 chip（md）并存，层级合理但半径/字号未 token 化。

### 6.3 建议角色表

| 角色 | 形态 | 例子 |
|---|---|---|
| Meta text | 无底 | rd-chip、年份旁注 |
| Category tag | `.ui-tag` | 类型 |
| Status / filter | 方 chip md | 检查类型 |
| Identity mark | LanguageMark / FileFormat | 语言、格式 |
| Chrome pill | full 仅顶栏 | 缩放、LOCAL |

---

## 7. File icons（文件类型图标）

### 7.1 实现摘要（`FileFormatIcon.tsx`）

- 三种剪影：document（折角）/ archive（箱）/ folder。  
- 尺寸：sm24 / md30 / lg36 / xl44。  
- 色：7 套 face/fold，偏 Adobe CC，已做「Ridgeline 降饱和」注释。  
- 额外 `drop-shadow` 暖黑。

### 7.2 审计结论

| 优点 | 风险 |
|---|---|
| 识别度高，空态五格式一排清晰 | 色相与主三元竞争注意力 |
| 三种剪影语义清楚 | ZIP 柑橘与品牌 accent 几乎撞车 |
| size API 完整 | 同列表混用 sm/lg/xl 时节奏不稳 |

**建议：** 保留字形；把 `ADOBE` 迁入 CSS/token；空态与列表约定默认 `md`，仅空态展示条用 `lg`。

---

## 8. Language badges（语言指示）

### 8.1 实现摘要

- `LanguageMark`：左色块字标（简/繁/En/あ…）+ 右 mono 标签。  
- 双语：双牌重叠 +「双语」。  
- `chipSurfaceStyle` 用 `color-mix` 适配 cream/forest 表面（好实践）。  
- 高度：h-8 / h-9；字号 13–17px 多档。

### 8.2 问题

- 12+ 硬编码 face/ink，与全局色板平行。  
- 与 FileFormat 并排时，两套高饱和色同时出现（TrackSelect / 预检行）。  
- `font-mono` 中日韩字标在部分系统回退观感不一。

### 8.3 建议

- 语言色升为 `--lang-zh-cn` 等 token（或单文件 `tokens/lang.css`）。  
- 与文件图标约定：并排时降低一侧饱和（已有「避开文件色」策略，可再降 face 混合比）。  
- 尺寸只保留 md（32）/ lg（36）。

---

## 9. Buttons（按钮）

### 9.1 实际主系统：`.ui-action*`

| 变体 | 特征 |
|---|---|
| default | soft accent 底、min-h 2.25rem、radius 0.5rem、13px semibold |
| `--secondary` | raised 面板色 |
| `--quiet` | 透明 |
| `--danger` | danger tint |
| `--lg` | min-h 2.5rem |
| `--icon` | 2.5×2.5rem |

### 9.2 并行的一次性按钮

| 样式 | 位置 | 与 ui-action 差异 |
|---|---|---|
| `h-12` + `rounded-[var(--v5-radius-panel)]` + CTA shadow | DragZone 空态主/次 | 更高、更圆、有阴影 |
| `h-8/9/10` icon grid `rounded-md` | 列表删除、撤销、theater chip | 无 ui-action 边框语义 |
| `system-tray__ctrl` | 顶栏 | 墨绿面上的奶油半透明 |
| `theater-chrome-chip` | 预览栏 | 暗面特殊 |
| shadcn `Button` | **零引用** | primary/ring 等未接入主题 |

### 9.3 高度统计（组件 class）

`h-8`≈13、`h-9`≈15、`h-10`≈15、`h-11`≈5、`h-12`≈3，再加 `min-h-9/11` 与 CSS `2.25/2.5rem`。

### 9.4 建议

| Size | Height | Radius | 用途 |
|---|---|---|---|
| sm | 32px | sm | 行内、工具条 |
| md | 36px | md | 默认 ui-action |
| lg | 40px | md | ui-action--lg |
| hero | 48px | xl | 仅空态双 CTA |

废弃未使用的 shadcn Button，或一次性接上 v5 token 后替换散装 class。

---

## 10. Components（重复组件样式）

| 重复模式 | 出现处 | 建议合并为 |
|---|---|---|
| Modal 壳：`rounded-lg` + `shadow-[0_18px_48…]` / `0_24px_70…` | SystemTray、WorkbenchStep、TmdbPanel、IngestStep | `ui-modal` |
| 下拉：`rounded-md/lg` + 12～18px 阴影 | TrackSelect、Export、DragZone | `ui-menu` |
| Icon 方钮 `h-8/9 w-8/9 rounded-md` | SequenceList、Timeline、ControlDeck | `ui-action--icon` 统一尺寸 |
| 面板 `v4-panel` + 有时再套 `rounded-lg border` | Workbench 多面板 | 单一 `.v4-panel`（含 radius） |
| 危险 hover `rgba(201,138,134,0.1)` | DragZone 多处删除钮 | `ui-action--danger` 图标变体 |
| Toast：`rounded-xl` + 墨绿阴影 | FeedbackCenter | `ui-toast` |
| shadcn card/badge/button | 未使用 | 删除或接入，忌双轨 |
| Segment：`.ui-choice-group` vs StyleSidebar 手写 `grid-cols-3 rounded-xl` | 设置侧栏 | 统一 choice |

---

## 11. Spacing（间距）

### 11.1 实战频率（Tailwind）

高频：`gap-2`、`gap-3`、`gap-1.5`、`gap-4`、`px-3`、`py-2`、`mt-1`、`px-4`…  
半档很多：`0.5 / 1.5 / 2.5 / 3.5`。

### 11.2 问题

- 无 `--space-*` token；全靠 Tailwind 默认阶 + 任意值。  
- 面板内边距 `p-3/4/5/6` 混用，同级面板不对齐。  
- 托盘高度 `--tray-h: 60px` 已 token 化（好）；内容区 gutter 未对称声明。

### 11.3 建议间距阶

`4 / 8 / 12 / 16 / 24 / 32 / 48`（px）为主；半档仅用于图标与标签光学对齐。  
面板默认：`padding: 16` 或 `24` 二选一，按密度分区（工作台紧、关于页松）。

---

## 12. Overall visual consistency（整体一致性）

### 做得好的地方

- Ridgeline 三元清晰；墨绿双托盘 vs 奶油工作区形成稳定「影院后台」结构。  
- Display 宋体只用于片源/空态，避免整站衬线噪音。  
- `.ui-action` / `.ui-tag` / `.ui-rating` / LanguageMark 的 color-mix 适配表明在有意识建系统。  
- WorkflowChrome 主动「去 chip」是正确的信息层级收敛。

### 主要张力

1. **Token 代际：** v5 真相 + v4 别名 + @theme 假名 + 组件硬编码。  
2. **控件双轨：** 文档化 ui-* vs 大量复制 Tailwind；shadcn 闲置。  
3. **辅色爆炸：** 文件 / 语言 / 检查 / TMDB 蓝各自为政。  
4. **Radius & shadow 无阶：** 同功能不同 elevation。  
5. **字号任意值：** 与声明的 13/15/16/18–24 不符。  
6. **表面模式：** cream 工作区 + forest 托盘 + theater 暗面，三套规则未完全写成「表面契约」。

### Anti-pattern 备注（产品语境）

奶油底 + 暖强调色接近常见「AI 默认暖纸」簇，但 **墨绿托盘 + 宋体片名 + 本地工具气质** 形成差异化；问题不在品牌本身，而在执行层未锁死。

---

## Top 20 视觉不一致（按影响排序）

| # | 问题 | 影响 | 严重度 |
|---|---|---|---|
| 1 | Accent 多名（mint/emerald/action/v5-orange/v4-accent）+ @theme 遗留暗色 | 主题无法单点修改，易漂移 | P0 |
| 2 | 按钮三套：ui-action / 空态 hero / 散装 icon 钮；shadcn 闲置 | 主操作手感不统一 | P0 |
| 3 | 阴影 20+ 一次性值（黑 vs 墨绿 tint 混用） | 浮层「有的脏、有的飘」 | P0 |
| 4 | 圆角声明 2 档、实战 8+ 档 | 同级面板圆角不一致 | P1 |
| 5 | 字号大量 `text-[Npx]` 打穿 token 字阶 | 层级难读、难维护 | P1 |
| 6 | 语言标 12 色硬编码 | 与品牌三元抢戏、难适配暗面 | P1 |
| 7 | 文件图标 7 色独立板 + ZIP≈accent | 空态五标过「贴纸」 | P1 |
| 8 | 检查标记引入 `#3b82f6` | 唯一体系外蓝，破坏三元 | P1 |
| 9 | Badge/chip 语言 6+ 套（ui-tag/rd-chip/LanguageMark/tray pill/…） | 元信息视觉噪声 | P1 |
| 10 | Lucide stroke/size 不统一（2 / 2.2 / 2.25 / 2.5） | 工具栏精致度不稳 | P2 |
| 11 | Modal/菜单壳复制粘贴 | 改一处漏三处 | P2 |
| 12 | 危险 hover 硬编码粉红 rgba | 与 danger token 脱节 | P2 |
| 13 | 面板 `rounded-lg` 几乎不用 `--v5-radius-panel` | token 名存实亡 | P2 |
| 14 | Tracking 0.04–0.12em 随意 | eyebrow 风格不统一 | P2 |
| 15 | 间距半档过多、面板 padding 不齐 | 栅格感弱 | P2 |
| 16 | Theater / lights-off 阴影与 tip 用纯黑 | 与 cream 面 elevation 语言分裂 | P2 |
| 17 | TMDB 蓝 drop-shadow | 第三方品牌色侵入 chrome | P3 |
| 18 | BrandMark `rounded-[11px]` | 一次性半径 | P3 |
| 19 | shadcn Badge/Card 死代码 | 误导后续贡献者 | P3 |
| 20 | `font-weight: 450` vs Tailwind medium/semibold 混叠 | 部分文案发灰或过重 | P3 |

---

## 优先路线图（Roadmap）

### Phase A — 锁真相源（约 1～2 天）

1. 冻结 `@theme` 中 mint/emerald/暗色；文档标明废弃。  
2. 规定新代码只使用 `--v5-*`（或一次性全局重命名为无版本前缀）。  
3. 抽出 `--radius-*` 与 `--elevation-*` / `--glow-accent`。  
4. 删除或隔离未使用的 shadcn button/badge/card，避免双轨。

### Phase B — 控件收敛（约 3～5 天）

1. 所有主/次/危险/安静按钮只走 `.ui-action*`；空态 hero 升为 `--hero` 变体。  
2. Icon 按钮统一尺寸阶，theater/tray 用 surface 变体而非新圆角。  
3. Modal / Menu / Toast 三个壳类替换复制粘贴阴影。  
4. 字号扫一遍：消灭非字阶 `text-[Npx]`（mono 时间码可例外）。

### Phase C — 数据色与标记（约 2～3 天）

1. `LANG_VISUAL` / `ADOBE` / `MARK_COLOR` 迁入 token；检查标记蓝改为 triad 内色（如 accent-soft 变体或 forest 派生）。  
2. 写一页「Badge 决策表」（meta / tag / identity / chrome pill）。  
3. Lucide：统一 size + stroke。

### Phase D — 抛光（持续）

1. 间距：工作台 vs 文档页两套 density。  
2. 表面契约：cream / forest-chrome / theater-dim 三套文字与边线 alpha。  
3. 对比度抽检（faint 文案、托盘半透明控件）。  
4. （可选）`$impeccable document` 产出 DESIGN.md / PRODUCT.md，防止再次漂移。

---

## 附录：关键文件索引

| 主题 | 路径 |
|---|---|
| Token / 控件 CSS | `app/globals.css` |
| 文件与语言标 | `src/components/ui/FileFormatIcon.tsx` |
| 检查标记色 | `src/components/Workbench/inspectionMarks.tsx` |
| 按钮主系统 | `app/globals.css` → `.ui-action*` |
| 闲置 shadcn | `src/components/ui/button.tsx`、`badge.tsx`、`card.tsx` |
| 空态 CTA | `src/components/Ingest/DragZone.tsx` |
| 类型标签 | `src/components/Ingest/FilmMetaBlock.tsx` + `.ui-tag` |

---

## 说明

- 本审计 **未修改** 任何业务或样式源码；仅新增本报告文件。  
- 设计语言已固化：`DESIGN.md`。执行队列已重组织：`DESIGN_BACKLOG.md`（本报告保持只读证据，不充当看板）。  
- 统计为静态扫描近似值，后续重构请以 `DESIGN_BACKLOG.md` 条目验收，而非追求本报告频次数字精确。
