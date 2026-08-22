# SubStudio Design Language

> **所有 Agent 在改 UI / 样式 / 资产 / 文案呈现之前，必须先读完本文。**  
> 本文是共享设计真相源。Prompt 可以不同，语言必须一致。  
> 详细审计见 `DESIGN_AUDIT.md`；执行队列见 `DESIGN_BACKLOG.md`；设计方案（决策+验收）见 `DESIGN_PLAN.md`；实现 token 见 `app/globals.css`（`--v5-*`）。

---

## Creed

SaikoSubStudio is not an AI SaaS website.  
It is an editorial desktop application — a modern subtitle workbench,  
not a 仿宋书房 / poster-calligraphy surface.

Every visual decision must reinforce this identity.

Never introduce generic Bootstrap, Material, Windows,  
or modern AI startup aesthetics.

Preserve calmness, restraint, typography and paper-like warmth  
before introducing visual novelty.

**Editorial Desktop ≠ 仿宋书房.** Display Serif is for film titles only;  
product UI headlines (empty state, About) speak in UI Sans.

---

## 1. 品牌定位

**SaikoSubStudio 是 Editorial Desktop Application —— 字幕剪辑用的桌面编辑工作台。**

屏上品牌短名统一为 **SaikoSubStudio**（与政策全称一致）。禁止再并列 `SubStudio` / `LOCAL SUBTITLE STUDIO` 作为主品牌。

它不是：

- AI SaaS 落地页
- 通用 B2B 仪表盘
- 营销站或「智能助手」产品壳

它应该感觉像：

- 冷静、温暖、克制
- 编辑室 / 片场后台，而不是创业公司官网
- Desktop-first：双托盘（顶栏 + 底栏）框住奶油工作面
- 每一次视觉决策都有意图，不为「好看一点」而加料

一句话检验：

> **去掉 Logo 之后，这还像 SaikoSubStudio，还是像随便一个 AI 工具？**

---

## 2. 色彩原则

### 核心三元（Ridgeline）

| 角色 | Token | 值 | 用途 |
|------|-------|-----|------|
| Cream | `--v5-cream` / `--v5-canvas` | `#f5f1ea` | 工作区底 |
| Forest | `--v5-green` / `--v5-text` | `#1a3d37` | 墨水手、托盘、主文字 |
| Citrus | `--v5-accent` / `--v5-orange` | `#ef8d5f` | 唯一强调色、主操作 |

### 表面阶

- Canvas：`cream` → `canvas-raised` → `panel` → `panel-muted`
- 线：`--v5-line` / `--v5-line-strong`（墨绿 alpha，禁止冷灰蓝边线）
- 字：`text` → `text-muted` → `text-faint`（faint 只做装饰/占位，不作正文）
- 语义：`danger` `#c45b55` · `warning` `#c4893a` · success 从 forest 派生，**禁止再引入独立翠绿**

### 规则

1. **新代码只写 `--v5-*`。** `--v4-*` 仅为兼容别名（映射到 `--v5-*`），禁止在其上叠加新语义或新角色。  
2. 禁止再发明 `mint` / `emerald` / `action` / 冷灰蓝暗色 `@theme` 伪名（见下方 Deprecated）。  
3. 禁止组件内散落裸 hex / 随意 `rgba(239,141,95,*)`；用 `color-mix(in srgb, var(--v5-*) …)`。  
4. 阴影优先 **墨绿 tint**，奶油面上避免冷黑 elevation。  
5. 第三方品牌色（如 TMDB 蓝）只允许出现在对方 Logo 本体，不得污染 chrome / glow / 控件。  
6. 数据辅色（文件格式、语言标、检查标记）是**有限封闭色板**，不得临时加第 13 种语言色或 Tailwind 默认蓝。

### Deprecated `@theme`（EP-0.1 · 已删除，禁止回流）

| 类别 | 已删除伪名 |
|------|------------|
| Accent 多名 | `--color-mint*`、`--color-accent-emerald*`、`--color-action*`、`--color-accent-neon\|glow\|muted` |
| 冷灰蓝暗色 | `--color-bg-dark\|base`、`--color-surface-*`、`--color-text-primary\|secondary`、`--color-glass-border` |

唯一强调色：`--v5-accent*`（及 `--v5-orange*` 别名）。产品面引用须走 `--v5-*` 或既有 `--v4-*` 别名。

### 三套表面契约

| 表面 | `data-surface` / 选择器 | 字色 / 边线 token |
|------|-------------------------|-------------------|
| Cream desk | 默认 / `[data-surface="cream"]` | `--surface-text*` / `--surface-line*` → 墨绿 |
| Forest chrome | `[data-surface="forest"]` | 同上 → 奶油半透明 ink |
| Theater dim | `[data-surface="theater"]` / `.lights-off-stage` | 更深奶油 ink + 柑橘强线 |

切换表面时文字角色映射到 `--surface-*`；`--v4-text|line*` 为兼容别名。

### Elevation / Glow（EP-0.2）

| Token | 用途 |
|-------|------|
| `--elevation-0` | 面板默认 / hairline |
| `--elevation-1` | 轻浮层 |
| `--elevation-2` | Menu、Toast、InfoHint |
| `--elevation-3` | Modal |
| `--elevation-*-dim` | Theater 同族更高 alpha（tip / chrome / 抽屉） |
| `--glow-accent` | 选中 / 焦点（一种） |
| `--glow-cta` | 仅 hero 主按钮 |

阴影色一律 `color-mix(forest …)`；禁止 Theater 另起纯黑 elevation 体系。

### Radius（EP-0.3）

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-xs` | 2px | 刻度、小标记 |
| `--radius-sm` | 6px | chip、语言牌、小 icon 钮 |
| `--radius-md` | 8px | 输入、标准面板、BrandMark 外框、`.ui-action` |
| `--radius-lg` | 12px | choice 容器、toast |
| `--radius-xl` | 20px | hero CTA、大抽屉 |
| `--radius-pill` | 999px | **仅**托盘胶囊、进度点 |

兼容：`--v5-radius-panel` → xl；`--v5-radius-control` → lg。禁止新增 `rounded-[Npx]` / 奇怪 rem 中间值；内容区信息徽章禁止 pill。

### Spacing（EP-0.5 TOKEN-011）

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1`…`--space-7` | 4 / 8 / 12 / 16 / 24 / 32 / 48 | 主阶；半档仅光学对齐 |
| `--space-panel` | 16（=`--space-4`） | 工作台面板内边距 |
| `--space-copy` | 24（=`--space-5`） | 关于 / 空态文案区 |

工具类：`.density-panel` / `.density-panel-x` · `.density-copy` / `.density-copy-x`。同级 Workbench 面板横向 padding 统一 16，禁止再 `px-5`/`md:px-6` 乱跳。

### 裸色纪律（EP-0.5 TOKEN-012）

1. **禁止**在组件内新增裸 triad hex / `rgba(26,61,55|239,141,95|245,241,234,*)`；派生色用 `color-mix(in srgb, var(--v5-*) …)`。  
2. 三原色、`--lang-*`、`--fmt-*`、BrandMark SVG **仅**在真相源定义，业务组件禁止覆盖。  
3. 存量随触及清扫；评审可拒「新增裸色」。不借清扫改品牌色相。

### Tray ink（EP-0.4 TOKEN-008）

| Token | 用途 |
|-------|------|
| `--tray-ink` | 托盘主字（奶油实色） |
| `--tray-ink-soft` | 控件默认字 |
| `--tray-ink-muted` / `--tray-ink-faint` | 次要 / 更弱 |
| `--tray-line*` / `--tray-fill*` | 托盘边线与半透明底 |

托盘禁止再手写 `rgba(245,241,234,*)`；用上表或 `color-mix(var(--v5-cream) …)`。

---

## 3. 字体原则

| 角色 | 字体 | 用在哪里 |
|------|------|----------|
| UI Sans | PingFang / 雅黑 → Geist Sans（`--font-sans`） | 控件、正文、导航；**空态主句**（「本地字幕工作室」「拖入字幕开始」）；**关于 / 反馈页大标题** |
| Display Serif | Noto Serif SC（自托管）· `.font-display` | **仅片名**：工作台信息栏片源名、Theater 标题、TMDB 结果标题 |
| Prose Serif | 同上 · `.prose-serif` | 片名旁白 / 剧情简介等片源散文（非营销大标题） |
| Mono | Geist Mono | 时间码、缩放、语言标、评分、键值 |

### 字阶（产品 UI · EP-0.4 TOKEN-009）

| 角色 | Token | 约略尺寸 | 备注 |
|------|-------|----------|------|
| Caption / meta | `--type-caption` | 13px（`text-xs`） | 旁注、托盘 meta；**禁止**再写 `text-[11px]` |
| Control / label | `--type-control` | 15px | 按钮、chip |
| Body | `--type-body` | 16px | 默认阅读 |
| Title | `--type-title` | 18px | 区块标题 |
| Display (UI) | `--type-display` | ≈24px + **UI Sans** 700 | 空态 / 关于页大标题——现代工具声口，非海报书法 |
| Display (片名) | `.font-display` | 片名尺寸 + **Serif** 700 | **仅**片源名 / TMDB 标题 |

Eyebrow tracking **仅两档**：`--tracking-eyebrow`（0.06em）· `--tracking-eyebrow-wide`（0.08em）。

### 字重（EP-0.4 TOKEN-010）

| 角色 | 字重 | 说明 |
|------|------|------|
| Body 默认 | **450** | 产品阅读默认（`body { font-weight: 450 }`）；设计选择，非遗漏 |
| Meta / caption | 500 | 副文案、旁注 |
| Control | 600 | 按钮、chip、选择项 |
| Display / 强调 | 600–700 | 空态与关于页大标题（UI Sans）、片名（Serif）、托盘关键数字；少用喊话 |

同层级禁止 medium/semibold 随机跳（同一角色用同一档）。

### 规则

- **Display Serif = 片名 only。** 空态 hero / 关于与反馈页营销大标题必须用 UI Sans（约 600–700），禁止再挂 `.font-display` / `font-family: var(--font-serif)`。
- 宋体不是「高级装饰」，更不是书房气质；它只给**已确认的影视片名**身份感。工具栏、按钮、表单、产品空态禁止衬线。
- 禁止同屏用一堆 `text-[11px]` / `text-[14px]` / `text-[17px]` 打穿字阶；新代码走 `--type-*` 或 Tailwind 阶（`text-xs` = Caption）。
- Tracking：eyebrow / 大写品牌标只用上述两档；正文保持克制。不借此改动静默 fork 色板或其它 token。

---

## 4. Icon System

### 来源分工（不可混用职责）

| 体系 | 来源 | 职责 |
|------|------|------|
| UI 线框 | **Lucide React** | 动作、状态、工具栏、导航 |
| 文件字形 | `FileFormatIcon` | 格式识别（非装饰） |
| 语言字牌 | `LanguageMark` | 轨语言身份；**字标用 UI Sans（保证 CJK）**；右侧标签可用 mono |
| 检查几何 | `inspectionMarks` | ■ 结构 · ● 画面 · ▲ 声音 |
| 品牌 / 插画 | `BrandMark`、空态 PNG | Logo、空态说明；**不进工具栏** |

### 语言字标限制（ICON-005）

- 色块内字标（简 / 繁 / あ / 한 / En…）优先 **系统 / UI Sans**，避免 mono 在部分 Windows 字体链上缺字方框。  
- 右侧语言标签文案可继续 mono semibold。  
- 若抽样仍见方框：记录 OS + 字体回退，再考虑显式 `font-family` 栈；勿为此引入第二套图标库。

### Lucide 规范

- 尺寸：默认 **16 / 20**（`h-4` / `h-5`）；托盘可略大，但不要发明 `h-[18px]` 中间值。
- 描边：**stroke 2** 为默认；托盘若需 2.25，整区统一，禁止同栏 2 / 2.2 / 2.5 混用。
- 以描边为主；填充仅用于明确「实心态」（如播放中），不要把半个工具栏填实。
- 禁止引入第二套图标库（Heroicons、Phosphor、Remix 等）。
- **范围：** 上述 size/stroke 纪律**仅约束 Lucide UI 线框**。原生 checkbox、分布图命中点、检查几何 ■●▲、文件/语言字形不在此条内。

### 规则

- 插画只出现在空态 / 关于 / 营销位。
- 语义图标与数据字形可以同屏，但**不要用 Lucide 再画一套文件类型图标**。

---

## 5. Badge System

徽章不是装饰贴纸。先问：**这是身份、分类、元信息，还是 chrome 状态？**

| 角色 | 形态 | 实现 | 例子 |
|------|------|------|------|
| Meta text | 无底、无边框 | `.rd-chip` / 纯排印 | 任务旁注、年份旁信息 |
| Category tag | 小方角 chip | `.ui-tag` | 影片类型 |
| Identity mark | 色块字牌 / 文件剪影 | `LanguageMark` / `FileFormatIcon` | 语言、格式 |
| Status / filter | 方角 chip（非胶囊） | 工作区 filter | 检查类型筛选 |
| Chrome pill | `rounded-full` **仅托盘** | 顶/底栏 | 缩放 `Aa 100%`、LOCAL |
| Rating | 大写品牌 + mono 分 | `.ui-rating*` | TMDB 分 |

### 规则

1. **片源元数据优先排印，不要堆 chip**（见 WorkflowChrome 的「去 chip」决策）。
2. 禁止把 shadcn `Badge`（`rounded-4xl` 胶囊）接入产品面（文件已删，勿回流）。
3. 工作区默认方角；全圆胶囊只属于 chrome，不属于内容区。
4. 同一信息只选一种徽章角色，禁止「标签套标签」。

---

## 6. 文件图标规范

实现：`src/components/ui/FileFormatIcon.tsx`

### 语言

Adobe CC 式文件徽章，经 Ridgeline **降饱和、偏暖** 调和：

- 一类剪影一种语义：
  - **document**（折角纸）：SRT / ASS / unknown
  - **archive**（箱体+盖+卡扣）：ZIP / RAR / 7Z
  - **folder**（吊挂文件夹）：DIR
- 大写扩展名码是主体；禁止再加装饰、渐变、玻璃、外发光。
- 尺寸 API：`sm 24` · `md 30` · `lg 36` · `xl 44`  
  - 列表 / 选择器默认 **md**  
  - 空态展示条可用 **lg**  
  - 禁止同列表随意混 sm/xl

### 色板（封闭）

| Format | 气质 | 说明 |
|--------|------|------|
| SRT | Forest-teal | 呼应墨绿 |
| ASS | Muted plum | 样式轨 |
| ZIP | Citrus-adjacent | 靠近强调色，勿再提亮 |
| RAR | Soft brick | |
| 7Z | Dusty indigo | |
| Folder | Warm gold-dust | |
| Unknown | Warm stone | |

### 规则

- 新格式必须走同一剪影体系 + 降饱和原则，禁止直接贴高饱和 Adobe 原色或系统文件图标。
- 与 `LanguageMark` 并排时：语言色已避开文件色；不要再给任一侧加描边光晕抢戏。
- 颜色日后应升为 token；在此之前，**只改 `ADOBE` 一处**，禁止在业务组件里覆盖 fill。

---

## 7. 组件设计原则

### 控件真相源

| 需求 | 使用 |
|------|------|
| 按钮 | **`.ui-action`**（含 `--secondary` / `--quiet` / `--danger` / `--lg` / `--icon`） |
| 分段选择 | `.ui-choice-group` / `.ui-choice` |
| 面板 | `.v4-panel`（或等价 v5 面板类） |
| 类型标签 | `.ui-tag` |
| 评分 | `.ui-rating` |

**产品按钮 = `.ui-action`。** 勿再引入 shadcn / Base UI `Button`·`Badge`·`Card`（EP-0.6 SHELL-006 已从 `src/components/ui/` 删除 `button.tsx` / `badge.tsx` / `card.tsx`）。

空态主 CTA 可以更高更圆（hero），但应视为 `ui-action` 的 **hero 变体**，不是另一套按钮系统。

### 原则

1. **一个组合、一个焦点**：桌面工作台不是卡片墙；能去边框/阴影/底就去。
2. **卡片是例外**：只有承载交互时才需要容器感。
3. **圆角有限档**：xs 2 · sm 6 · md 8 · lg 12 · xl 20 · pill 999。禁止 `rounded-[11px]` 等一次性值。
4. **密度分区**：工作台紧（`--space-panel` = 16），关于/空态文案区松（`--space-copy` = 24）。
5. **动效克制**：用现有 `--v5-ease` 与时长阶；动效服务层级与状态，不服务炫耀。
6. **禁止双轨**：不要一边用 `.ui-action`，一边手写第三套按钮；**禁止**把已删除的 shadcn Button/Badge/Card 加回产品路径。
7. **先身份，后便利**：技术上「用现成紫色组件更快」不构成设计理由。

### 改 UI 前的自问

1. 这是在加强 Editorial Desktop，还是在往 AI SaaS 靠？
2. 能否用现有 token / `.ui-*` / 既有徽章角色完成？
3. 会不会引入新的圆角、阴影、色相、图标库？
4. Design Director / 本文是否已覆盖？若冲突，停，先对齐文档。

---

## 8. Do / Don't

### Do

- 维持奶油工作面 + 墨绿双托盘 + 柑橘单点强调
- 片名用思源宋体；空态 / 关于页大标题与控件用系统黑体（UI Sans）
- Lucide 做 UI；文件/语言/检查走既有专用体系
- 元信息尽量排印化；徽章按角色表选用
- 新色、新半径、新 elevation 先写入本文与 token，再落地组件
- Desktop-first：尊重托盘、工作区、预览区的表面契约

### Don't（绝对不要引入）

| 禁止 | 为什么 |
|------|--------|
| 紫/靛渐变、霓虹 glow、玻璃拟态 | AI SaaS / 通用暗黑仪表盘指纹 |
| Material / Bootstrap / Windows 系统控件感 / 圆角胶囊成灾 | 通用桌面壳或 OS 皮肤，冲掉编辑气质 |
| Inter / Roboto / 默认系统栈当品牌展示 | 无身份 |
| 第二套图标库或彩色扁平 emoji 图标 | 打断 Lucide + 数据字形语言 |
| shadcn Badge 式超圆 pill 铺内容区 | 与 Ridgeline chip 语言冲突 |
| 冷灰蓝暗色主题当默认产品面 | 已封存的 tungsten 方向，不是 Ridgeline |
| 检查标记 / 状态随便借用 Tailwind `blue-500` 等 | 破坏三元与封闭辅色板 |
| 为「更科技」加网格、扫描线、终端绿、赛博边 | 不是本产品 |
| 首屏堆统计条、功能胶囊、浮动贴纸徽章 | 营销站噪音 |
| 无故重设计整页「换个风格试试」 | 身份靠连贯，不靠刷新感 |

---

## 维护

- 本文优先于任何 Agent 的个人审美或临时 Prompt。
- 若实现与本文冲突：先改实现，或先提案修订本文并经 Design Director 确认——**禁止静默分叉**。
- 审计细节（只读）：`DESIGN_AUDIT.md`。  
- 执行队列与验收：`DESIGN_BACKLOG.md`。  
- 实值与控件 CSS：`app/globals.css`。
