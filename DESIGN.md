# SaikoSubStudio 设计基础 · Paper Ledger

> 状态：已接线（`design/paper-tokens`；`design/no-green` 去掉墨绿托盘）。本文件是**唯一活设计规矩**，取代旧的 Ridgeline（奶油/森林绿/橘）`DESIGN.md`。
> **已作废（勿再当 Spec）**：Ridgeline 墨绿品牌色、柑橘强调 `#ef8d5f`、实心橙主按钮、选中态「实心橙块 + 绿字」、`data-paper="chrome"` 绿托盘。
> 旧的 `DESIGN.md`、`DESIGN_AUDIT.md`、`DESIGN_BACKLOG.md`、`DESIGN_PLAN.md` 已归档到 `docs/design-archive/`，只作历史参考。
>
> Token 源文件：`src/styles/paper-tokens.css` · 旧变量映射：`docs/design/token-mapping.md` · 对比度脚本：`docs/design/contrast.py` · 预览：`docs/design/preview.html`

## 1. 产品与模式

SaikoSubStudio 是一个字幕工作台：导入（Ingest）→ 校对与编辑（Workbench）→ 关灯预览（Theater）。用户长时间盯着一列列时间码和双语字幕行，反复点选、修改、比对。

- **模式：Operate（操作型工具）**。界面的任务是让内容和状态清楚，而不是吸引注意。产品简报优先于任何通用设计规则。
- **用户流程带功能**：先保证“导入 → 改 → 看”这条路顺，再加功能。三个步骤共用一套色板，只改变密度。
- **空态首页舞台与工作台分离**：Act 1 空态首页（`HomepageHeroStage`）以交互式影院字幕演示舞台展示核心能力并引导拖入/导入；一旦挂载文件进入队列，立即切回纯纸面账本清单。
- **鼠标优先**：主要操作都能点到；键盘快捷键只是补充，不能是唯一入口。可点区域不小于 32px。
- **气质**：纸面账本。暖纸、深墨、细线、一个强调色。安静、克制、像一本好用的账簿，不像营销页。

## 2. 原则

1. **内容是主角。** 字幕文字永远是屏幕上对比度最高的东西；外框、图标、装饰都要退后。
2. **颜色只表达意义。** 近乎单色的纸与墨；酒红只用于“当前/主要操作/选中”；状态色只用于状态。**不使用绿色作为品牌色或大面积底色**（托盘、logo、theme-color、进度、评分都不用绿）。
3. **用线和纸色分层，不用阴影。** 页面内的层次靠纸色深浅 + 1px 发丝线；只有真正浮在上面的东西（菜单、弹层、对话框）才有阴影。**唯一场景例外**：Act 1 空态首页舞台的影院画框（`.hero-cinema-frame`）与居中分体主钮（`.hero-split-cta`）允许使用柔和落地投影，以在暖纸桌面上建立明确视觉焦点；挂载文件进入清单与后续工作台后严格回归零阴影。
4. **两档墨。** 深+重（`--ink-strong` + 500/600）给要读的内容；浅+轻（`--ink-muted` + 400）给元数据。中间档尽量少用。
5. **账本结构。** 行、列、时间码对齐；表头上下一道粗线，行间发丝线；数字等宽对齐。
6. **平静的状态变化。** hover 只换底色，按下只再深一点，没有位移、缩放、发光（空态首页分体主钮与文件夹图标悬停反馈见 §6/§9）。
7. **不抄大厂，不堆套路。** 不做侧边色条、渐变字、常规页面毛玻璃、紫色渐变、卡片套卡片、霓虹光晕（空态首页影院画框的拖入暗幕遮罩 `.hero-drop-veil` 允许轻量 `backdrop-blur-[4px]`）。

## 3. 颜色

全部数值来自 `paper-tokens.css`，对比度由 `python3 docs/design/contrast.py` 计算（108 组，全部通过；改值必须重跑）。正文要求 ≥4.5:1，控件边界与焦点要求 ≥3:1（WCAG 2.x AA）。

### 3.1 纸（表面）

| Token | 值 | 用途 |
|---|---|---|
| `--paper-desk` | `#F5F1E9` | 工作区底色 |
| `--paper-sheet` | `#FCFAF5` | 面板、账本页 |
| `--paper-raised` | `#FFFEFA` | 输入框、次按钮、弹层 |
| `--paper-sunken` | `#EDE7DB` | 表头、hover 行、禁用底、skeleton |

### 3.2 墨（文字）— 不再用绿色做字

| Token | 值 | desk / sheet / raised / sunken | 用途 |
|---|---|---|---|
| `--ink-strong` | `#1C1A17` | 15.41 / 16.64 / 17.20 / 14.10 | 标题、字幕正文、关键数值 |
| `--ink-body` | `#3A352E` | 10.78 / 11.65 / 12.04 / 9.87 | 说明段落 |
| `--ink-muted` | `#5F584E` | 6.23 / 6.73 / 6.95 / 5.70 | 元数据、时间码、次要标签 |
| `--ink-placeholder` | `#736B60` | — / — / 5.20 / — | 输入占位 |
| `--ink-faint` | `#8A8276` | 3.64（sheet） | 只给图标、禁用、刻度；不承载必读文字 |

### 3.3 线

| Token | 值 | 对比 | 用途 |
|---|---|---|---|
| `--rule-hair` | `#E2DACD` | 1.33（装饰） | 行间线、面板内分隔 |
| `--rule-strong` | `#C6BCA9` | 1.80（装饰） | 面板外框、分组线 |
| `--rule-control` | `#8C8375` | 3.70 raised / 3.58 sheet | 输入框、次按钮边框（控件边界须 ≥3:1） |
| `--rule-ledger` | = ink-strong | — | 账本表头上下 1.5px 粗线 |

### 3.4 强调：酒红（唯一）

| Token | 值 | 对比 |
|---|---|---|
| `--accent` | `#7A2233` | 作文字：desk 8.86 / sheet 9.57 / sunken 8.11 |
| `--accent-hover` | `#8C2B3D` | 按钮字 7.89 |
| `--accent-press` | `#651A29` | 按钮字 11.51 |
| `--accent-ink` | `#FFF8F1` | 主按钮字 9.48 |
| `--accent-soft` | accent 10% | 选中行底；其上 ink-strong 13.94、accent 8.02 |

- 主按钮、当前步骤、选中行、链接用酒红；一个视图里只有一个主按钮。
- 旧方案的橘色（`#EF8D5F` / `#E07845`）在奶油底上做文字只有约 2–3:1，被 `--accent-text` 取代。

### 3.5 状态（与酒红分开）

| Token | 值 | sheet / sunken / 自身 10% 底 | 说明 |
|---|---|---|---|
| `--state-danger` | `#B0361C` | 5.94 / 5.03 / 5.08 | 朱红偏橙，和酒红一眼可分；实心按钮字 5.88 |
| `--state-warning` | `#8A5A0B` | 5.67 / 4.81 / 4.95 | 深琥珀（旧 `#C4893A` 做字不达标） |
| `--state-success` | `#2D6640` | 6.52 / 5.53 / 5.63 | 完成、已校对。**全站唯一的绿**，只用于小面积状态指示（勾、小圆点、提示条细边），不做底色；进度和评分不用它 |
| `--state-info` | `#2E5A84` | 6.91 / 5.86 / 5.96 | 提示、处理中 |

状态永远是“图标/文字 + 颜色”双通道，不只靠颜色。

### 3.6 焦点

`--focus-ring: #2E5A84`（sheet 6.91:1），2px 环 + 2px 间隙，只在 `:focus-visible` 时出现，鼠标点击不出环。焦点色用蓝而不用酒红，这样主按钮上的焦点也看得见。

### 3.7 深色主题与局部深色表面

全站主题挂在 `html[data-theme="light|dark"]`（托盘小开关 + `localStorage nexus_site_theme`；首次无存档时可用系统偏好作默认）。深色 remap 与关灯放映同族暖近黑，**不是**冷蓝灰、也不是反相。

局部仍用属性：`:root` / `[data-paper="sheet"]` 为浅纸（sheet 用来在深色里重新放一块浅纸）；`[data-paper="theater"]` 关灯放映必须继续在 Act 3 局部覆盖主题。组件尽量读语义 token，不必为主题各写一套。

**纸面托盘（顶栏/底栏/步骤条）**：不再是单独的深色作用域（旧 `[data-paper="chrome"]` 墨绿托盘已删除），直接用默认浅色 token。底 `--paper-sunken #EDE7DB`，与页面之间一条 `--rule-hair` 发丝线；字 `--ink-strong`（14.10）/ `--ink-body`（9.87）/ `--ink-muted`（5.70）；托盘按钮 `--paper-raised` 底 + `--tray-line-control`（= `--ink-placeholder`，sunken 上 4.26）边，图标酒红。**当前步骤 = `--paper-raised` 纸片 + 墨字（17.20）+ 酒红下划线**；其余步骤统一中性（sunken 底 + 发丝分隔线），不按“已走过”填充。

- `[data-paper="theater"]` 关灯放映：底 `#121110`/`#1A1917`/`#23211E`，字 `#EEE8DC`（15.46/14.40/13.16）、muted `#A39B8E`（≥5.84）、强调提亮为 `#D06276`（按钮，深字 5.17）与 `#E59AAA`（文字 ≥7.29）；状态色各自提亮，均 ≥5.8。

## 4. 字体

只用已经在仓库里或系统自带的字体（`public/fonts/geist`、`public/fonts/noto-serif-sc`），CSP 不变。

| 角色 | Token | 栈 |
|---|---|---|
| UI / 字幕 | `--pt-font-ui` | Geist Sans → PingFang SC → Hiragino Sans GB → Microsoft YaHei UI → Noto/Source Han Sans → system-ui |
| 时间码 / 数值 | `--pt-font-mono` | Geist Mono → SF Mono → Cascadia Mono → … → PingFang SC |
| 片名 | `--pt-font-title` | Noto Serif SC（只有 500/700 字重，用 500） |

- **变化点（待确认）**：现有 `--font-sans` 是中文字体在前；这里改为 Geist 在前，让英文、数字在 Mac/Windows 上一致，中文自动回退到系统黑体。若接线后中英混排基线不齐，退回中文在前。
- 字重只有 400 / 500 / 600。不用 700：PingFang 最高到 600 左右，且 `font-synthesis: none` 下 700 会退化，中英粗细不一致。
- 时间码、序号、时长一律 `font-variant-numeric: tabular-nums`。
- 中文段落行高 1.6（`--pt-leading-cjk`），UI 1.45，标题 1.25；标题用 `text-wrap: balance`，段落 `pretty`。
- 不用全大写做中文标签；英文小标签可用 `--pt-tracking-caps`。

| Token | 尺寸 | 用途 |
|---|---|---|
| `--pt-size-micro` | 12 | 语言牌、徽标（下限） |
| `--pt-size-meta` | 13 | 元数据、时间码、提示 |
| `--pt-size-dense` | 14 | 账本行、紧凑控件 |
| `--pt-size-control` | 15 | 按钮、输入 |
| `--pt-size-body` | 16 | 正文、字幕预览 |
| `--pt-size-title` | 18 | 面板标题 |
| `--pt-size-page` | 20 | 页标题、片名 |
| `--pt-size-display` | 24 | 空态大标题（上限） |

## 5. 间距、圆角、层级

- 间距 4 基准：`--pt-space-1…7` = 4 / 8 / 12 / 16 / 24 / 32 / 48。账本行 `8px 12px`。
- 控件高 36 / 32 / 28（`--pt-control-h*`），可点区域 ≥32。
- 圆角（为工具软化，不做胶囊）：xs 2（数据标记）· sm 4（chip、语言牌）· **md 6（按钮、输入）** · lg 8（面板、菜单）· xl 12（对话框上限）· pill 只给开关轨道。
- 层级：常规页面内 **零阴影**，靠纸色 + 线。浮层二选一只用阴影：`--pt-elev-float`（菜单、popover、toast）、`--pt-elev-modal`（对话框）。不叠“边框 + 阴影 + 光晕”。**Act 1 空态首页舞台例外**：`.hero-cinema-frame` 与 `.hero-split-cta` 允许单层柔和落地投影以确立主舞台层级。
- 对话框遮罩 `--pt-scrim`；点遮罩不关闭有未保存修改的对话框。

## 6. 组件规则

**按钮**（高 36，圆角 6，字 15/500）
- 主要：`--accent` 底 + `--accent-ink` 字；hover → `--accent-hover`；按下 → `--accent-press`；不位移、不缩放、不发光。
- 次要：`--paper-raised` 底 + 1px `--rule-control` 边 + `--ink-strong` 字；hover → `--paper-sunken`。
- 安静：透明底 + `--ink-body`；hover → `--paper-sunken`。用于工具条。
- 危险：默认是次要样式 + `--state-danger` 字；只有确认对话框里才用实心 `--state-danger`。
- 禁用：`--paper-sunken` 底 + `--ink-faint` 字 + `cursor: not-allowed`；不用整体透明度。
- 加载中：保持宽度，文字换成“处理中…”，不放转圈。

**输入框**：`--paper-raised` 底、1px `--rule-control` 边、圆角 6、高 36；占位 `--ink-placeholder`；聚焦边变 `--accent` + 焦点环；错误边 `--state-danger` + 下方文字说明。

**账本行（字幕表）**
- 表头：`--paper-sunken` 底，上下 1.5px `--rule-ledger`，13/500 `--ink-muted`。
- 行：14/400，行间 1px `--rule-hair`，无斑马纹；序号、时间码用 mono + tabular-nums + `--ink-muted`。
- 双语：原文 `--ink-strong`，译文 `--ink-body`，同一格上下排，行高 1.6。
- hover：`--paper-sunken`；选中：`--accent-soft` 底 + 序号变 `--accent-text`，**不加左侧色条**。
- 状态列：文字 + 小圆点，颜色走 `--state-*`。

**面板**：`--paper-sheet` 底、1px `--rule-strong` 边、圆角 8、无阴影；标题 18/600 + 下方发丝线。不在面板里再套卡片，用分隔线分组。

**纸面托盘**：不加 `data-paper`；`--paper-sunken` 底 + 发丝线分隔页面；步骤之间用发丝线；当前步骤 raised 纸片 + 墨字 + 酒红下划线。

**进度与评分**：进度条、评分环用墨色（高分）/酒红（中段），低分才用 `--state-danger`；不用绿色。

**品牌标与浏览器色**：logo 为墨底 `#1C1A17` + 纸色字幕轨 + 酒红条；`theme-color` / manifest `theme_color` = 托盘色 `#EDE7DB`。

**首页空态舞台（Act 1，`HomepageHeroStage` + `homepage-hero.css`）**：
- 仅在 `queuedItems.length === 0` 时展示：上方为交互式影院字幕画框（`.hero-cinema-frame`，圆角 12、`1px solid var(--rule-strong)`、暗幕底 `#12100E` 与轻微落地投影），中间留出 `46px` 格式倾倒跑道，下方为居中分体主操作钮 `[ 导入字幕 | 文件夹 ]`（`.hero-split-cta`，高 46、圆角 11、`--accent` 实心底 + 左侧酒红主选文件 + 右侧分隔半透深底选文件夹）。
- 画框内悬浮半透明暗底 HUD 胶囊（`.hero-screen-hud`）：左上显示当前双轨状态与样片计数滚筒（1–3 切换），右上为 4 枚机械密码锁式功能滚筒（字体 / 配色 / 副语 / 顶部歌词），支持点击切换与聚焦/悬停后滚轮拨动（采用显式 `{ passive: false }` 监听，页面可滚动时未聚焦且悬停未满 220ms 不拦截页面滚动）。
- 拖入文件时画框内出现 `.hero-drop-veil`（允许 `backdrop-blur-[4px]` 与四角 `--accent` 取景框），其余工作区面板仍严禁毛玻璃。

**格式图标（`FileFormatIcon` / `FileFormatGlyph`）**：只用纸 / 墨 / 酒红三色双色调行业意象（SRT 折角文档、ASS 酒红样式角星芒、ZIP 拉链收纳袋、RAR 三册束带叠书、7z 双切块 `7|z`、文件夹标签夹）；纸片本体保持不透明，叠放时不透出下层内容。

**焦点环**：`outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: var(--focus-ring-offset);` 仅 `:focus-visible`。

**加载**：skeleton（`--skeleton` 纯色块，形状贴近真实内容）；可以有 1.6s 的轻微透明度脉动，减少动效时静止。不用转圈占满面板。

**浏览器表面**：`::selection` 用 `--selection-bg`；`caret-color: var(--accent)`；滚动条 thumb 用 `--scrollbar-thumb`；`accent-color: var(--accent)`。


## 7. 交互分层（A–E）

适用于导入确认 / 工作台 / 预览的 InfoBar 与幕内控件（Act 2 契约；导入页同吃）。实现皮：`.ui-action` / `.ui-action--info` / `.ui-action--solid` 等（见 `src/styles/globals.css`）。

| 层 | 含义 | 形态 |
|---|---|---|
| **A** | 信息展示 | 排印 / 轻元数据；非按钮 |
| **B** | ⓘ 提示 | 只放补充说明；点击区 ≥32 |
| **C** | 信息录入 | 输入、开抽屉/概览等入口；用 `.ui-action--info` 等，**禁用** `ui-action--quiet` |
| **D** | 数据筛选 | 显式筛选/模式切换（如 OutputMode）；可点但不是流程推进 |
| **E** | 操作 | 确认、清除、前进、危险确认；真控件，不是下划线伪链 |

**InfoBar**
- `status` / display：**A**，若有模式切换则为 **A + 显式 D**（如 OutputMode）。
- `actions`：**只放 E**。
- 每屏 **一个** 实心主前进（酒红 `.ui-action--solid`），默认落在右下（例：工作台「打开预览」）。
- 返回：**左下 XOR 顶栏 chevron**，二者只留一条，不双轨。
- 清除 / 关闭类：必须是真 **E** 控件，禁止做成 quiet 下划线文字装内容。
- 闸门红字：默认锁在 **A**（只读提示）；用户点进筛选后才升为 **D**（软选皮）。
- 主钮 ≤1：同一视图不得出现第二个实心酒红主按钮。

## 8. 信息层级 / 跨区从属

跨区原则：任务身份、片源信息、操作钮 **不得同权同皮**。A–E 管控件语义；本节管「谁压过谁」。

1. **任务身份 / 任务切换 > 剧集 · TMDB 片源信息。**
2. 任务轨放在 **InfoBar 主位**，或紧贴标题旁的任务轨；不要压在内容卡里当附属 chip。
3. 「N 个任务 · 格式 · 来源」是 **轻 A** 元数据，不得做成按钮皮，也不得与任务轨抢一级。
4. 海报 / TMDB / 片名 / 年份 / 类型标签留在 **片源卡**；类型是片源附属 A，视觉权重低于任务轨。
5. 取消、移除、继续添加、开始合轴等属 **E**，与 A 元数据、片源标签 **不同皮**；危险项用确认槽或图标，避免一排 quiet 字钮。
6. 任务名有空间就完整显示，禁止无必要的硬 `max-width` + truncate；不够再 truncate 并保留 `title`。

## 9. 动效（Operate）

- 时长：`--motion-fast` 150（hover、颜色）· `--motion-base` 200（展开、切换）· `--motion-slow` 250（抽屉、对话框，上限）· `--motion-exit` 150（退出比进入快）。
- 曲线：进入 `--motion-ease-out`，退出 `--motion-ease-in`。
- 只动 `opacity`、`transform`、颜色；不动宽高布局。
- 没有页面加载动画、没有装饰动画、没有弹跳。
- `prefers-reduced-motion`：时长都压到 150，`--motion-move` 归零（位移去掉，颜色/透明度保留）。
- **唯一例外（Act 1 舞台）**：
  - 跨区远距离移动（文件从列表落到舞台 / 暂存区，2026-10-30 批准）：`visualDuration` ≤ 350，弹簧 bounce 0，只动 transform。代码常量见 `src/core/motion.ts`。
  - **Act 1 空态首页舞台编排（`HomepageHeroStage`）**：仅空态首页允许按节拍演示「文件芯片自 CTA 后方滑出落定字幕基线 → 居中展开双语/歌词 → 46px 跑道前导/悬停倾倒格式图标 → 漏斗微动 → 机械滚筒步进」。`prefers-reduced-motion` 下直接落定在 `unfold` 静态演示态，所有循环动画停用且过渡压缩至 `10ms`。

## 10. 要做 / 不要做

| 要做 | 不要做 |
|---|---|
| 常规页用纸色 + 发丝线分层 | 常规页内卡片投影、卡片套卡片 |
| Act 1 空态舞台限定使用画框/主钮投影与拖入暗幕轻模糊 | 把首页影院重阴影/毛玻璃扩散到清单页或工作台 |
| 一个酒红主按钮 | 多个彩色按钮抢注意 |
| 选中 = 淡底 + 文字变色 | 左侧粗色条（>1px）、发光描边 |
| 时间码等宽对齐 | 渐变字、毛玻璃、紫色渐变、霓虹光晕 |
| 状态 = 图标/文字 + 颜色 | 只靠颜色区分状态 |
| skeleton 占位 | 全屏转圈、页面入场动画 |
| 圆角 6/8（空态画框 12 / 分体主钮 11） | 胶囊按钮、20px 大圆角面板 |
| 400/500/600 两档墨 | 700 粗体、灰上加灰的三四层文字 |
| 任务轨压过片源卡；E 与 A 不同皮 | 任务 / TMDB / 操作钮同权同皮 |
| 酒红实心主钮 ≤1 | Ridgeline 实心橙、选中「橙块+绿字」、绿托盘 |

## 11. 不在本次范围

- 字幕样式本身（`--lang-*`、`--fmt-*`、烧录预设的颜色）是用户内容的身份色，不迁移到这套 token。
- 工作台分类色（`--wb-cat-*`，含 review 的 `#B8433C`）是数据编码，本次保留不动，记录在 `docs/migration-notes.md`；以后再评估是否收进 `--state-*`。
- 旧名 `--v4-*` / `--v5-*` 现在只是指向新 token 的别名（`src/styles/globals.css`），映射见 `docs/design/token-mapping.md`；逐个改名是后续工作。

---

Visual principles inspired by Cindy.
