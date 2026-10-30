# SaikoSubStudio 设计基础 · Paper Ledger

> 状态：草案（`design/paper-tokens` 分支）。本文件将取代根目录现有的 `DESIGN.md`（Ridgeline 奶油/森林绿/橘）。
> 旧的 `DESIGN.md`、`DESIGN_AUDIT.md`、`DESIGN_BACKLOG.md`、`DESIGN_PLAN.md` 之后统一移到 `docs/design-archive/`，届时本文件移到仓库根目录。现在先不动它们。
>
> Token 源文件：`src/styles/paper-tokens.css` · 旧变量映射：`docs/design/token-mapping.md` · 对比度脚本：`docs/design/contrast.py` · 预览：`docs/design/preview.html`

## 1. 产品与模式

SaikoSubStudio 是一个字幕工作台：导入（Ingest）→ 校对与编辑（Workbench）→ 关灯预览（Theater）。用户长时间盯着一列列时间码和双语字幕行，反复点选、修改、比对。

- **模式：Operate（操作型工具）**。界面的任务是让内容和状态清楚，而不是吸引注意。产品简报优先于任何通用设计规则。
- **用户流程带功能**：先保证“导入 → 改 → 看”这条路顺，再加功能。三个步骤共用一套色板，只改变密度。
- **鼠标优先**：主要操作都能点到；键盘快捷键只是补充，不能是唯一入口。可点区域不小于 32px。
- **气质**：纸面账本。暖纸、深墨、细线、一个强调色。安静、克制、像一本好用的账簿，不像营销页。

## 2. 原则

1. **内容是主角。** 字幕文字永远是屏幕上对比度最高的东西；外框、图标、装饰都要退后。
2. **颜色只表达意义。** 近乎单色的纸与墨；酒红只用于“当前/主要操作/选中”；状态色只用于状态。
3. **用线和纸色分层，不用阴影。** 页面内的层次靠纸色深浅 + 1px 发丝线；只有真正浮在上面的东西（菜单、弹层、对话框）才有阴影。
4. **两档墨。** 深+重（`--ink-strong` + 500/600）给要读的内容；浅+轻（`--ink-muted` + 400）给元数据。中间档尽量少用。
5. **账本结构。** 行、列、时间码对齐；表头上下一道粗线，行间发丝线；数字等宽对齐。
6. **平静的状态变化。** hover 只换底色，按下只再深一点，没有位移、缩放、发光。
7. **不抄大厂，不堆套路。** 不做侧边色条、渐变字、毛玻璃、紫色渐变、卡片套卡片、霓虹光晕。

## 3. 颜色

全部数值来自 `paper-tokens.css`，对比度由 `python3 docs/design/contrast.py` 计算（103 组，全部通过；改值必须重跑）。正文要求 ≥4.5:1，控件边界与焦点要求 ≥3:1（WCAG 2.x AA）。

### 3.1 纸（表面）

| Token | 值 | 用途 |
|---|---|---|
| `--paper-desk` | `#F2ECE1` | 工作区底色 |
| `--paper-sheet` | `#FAF7F0` | 面板、账本页 |
| `--paper-raised` | `#FFFDF8` | 输入框、次按钮、弹层 |
| `--paper-sunken` | `#EAE3D6` | 表头、hover 行、禁用底、skeleton |

### 3.2 墨（文字）— 不再用绿色做字

| Token | 值 | desk / sheet / raised / sunken | 用途 |
|---|---|---|---|
| `--ink-strong` | `#1C1A17` | 14.77 / 16.23 / 17.08 / 13.61 | 标题、字幕正文、关键数值 |
| `--ink-body` | `#3A352E` | 10.33 / 11.35 / 11.95 / 9.52 | 说明段落 |
| `--ink-muted` | `#5F584E` | 5.97 / 6.56 / 6.90 / 5.50 | 元数据、时间码、次要标签 |
| `--ink-placeholder` | `#736B60` | — / — / 5.16 / — | 输入占位 |
| `--ink-faint` | `#8A8276` | 3.55（sheet） | 只给图标、禁用、刻度；不承载必读文字 |

### 3.3 线

| Token | 值 | 对比 | 用途 |
|---|---|---|---|
| `--rule-hair` | `#DCD3C4` | 1.39（装饰） | 行间线、面板内分隔 |
| `--rule-strong` | `#B9AE9C` | 2.05（装饰） | 面板外框、分组线 |
| `--rule-control` | `#8C8375` | 3.68 raised / 3.49 sheet | 输入框、次按钮边框（控件边界须 ≥3:1） |
| `--rule-ledger` | = ink-strong | — | 账本表头上下 1.5px 粗线 |

### 3.4 强调：酒红（唯一）

| Token | 值 | 对比 |
|---|---|---|
| `--accent` | `#7A2233` | 作文字：desk 8.49 / sheet 9.33 / sunken 7.82 |
| `--accent-hover` | `#8C2B3D` | 按钮字 7.89 |
| `--accent-press` | `#651A29` | 按钮字 11.51 |
| `--accent-ink` | `#FFF8F1` | 主按钮字 9.48 |
| `--accent-soft` | accent 10% | 选中行底；其上 ink-strong 13.66、accent 7.85 |

- 主按钮、当前步骤、选中行、链接用酒红；一个视图里只有一个主按钮。
- 旧方案的橘色（`#EF8D5F` / `#E07845`）在奶油底上做文字只有约 2–3:1，被 `--accent-text` 取代。

### 3.5 状态（与酒红分开）

| Token | 值 | sheet / sunken / 自身 10% 底 | 说明 |
|---|---|---|---|
| `--state-danger` | `#B0361C` | 5.79 / 4.85 / 4.99 | 朱红偏橙，和酒红一眼可分；实心按钮字 5.88 |
| `--state-warning` | `#8A5A0B` | 5.53 / 4.64 / 4.82 | 深琥珀（旧 `#C4893A` 做字不达标） |
| `--state-success` | `#2D6640` | 6.36 / 5.33 / 5.50 | 完成、已校对 |
| `--state-info` | `#2E5A84` | 6.74 / 5.65 / 5.81 | 提示、处理中 |

状态永远是“图标/文字 + 颜色”双通道，不只靠颜色。

### 3.6 焦点

`--focus-ring: #2E5A84`（sheet 6.74:1），2px 环 + 2px 间隙，只在 `:focus-visible` 时出现，鼠标点击不出环。焦点色用蓝而不用酒红，这样主按钮上的焦点也看得见。

### 3.7 局部深色表面（没有系统暗色模式）

App 不跟随 `prefers-color-scheme`。深色只出现在两个局部，用属性切换，组件不需要改写：

- `[data-paper="chrome"]` 墨绿托盘（顶栏/步骤条）：底 `#1F3A33`，字 `#F2ECE1`（10.44）、muted `#C4CCC2`（7.46）、强调字 `#F0B3BE`（6.95）、控件边 `#7F998F`（3.37）、焦点 `#A9C8EA`（7.09）。**当前步骤 = 奶油纸片 `#FAF7F0` + 墨字（16.23）**，不再用橘色填充。绿色只在这里出现。
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
- 层级：页面内 **零阴影**，靠纸色 + 线。浮层二选一只用阴影：`--pt-elev-float`（菜单、popover、toast）、`--pt-elev-modal`（对话框）。不叠“边框 + 阴影 + 光晕”。
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

**墨绿托盘**：容器加 `data-paper="chrome"`；步骤之间用发丝线；当前步骤奶油纸片。

**焦点环**：`outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: var(--focus-ring-offset);` 仅 `:focus-visible`。

**加载**：skeleton（`--skeleton` 纯色块，形状贴近真实内容）；可以有 1.6s 的轻微透明度脉动，减少动效时静止。不用转圈占满面板。

**浏览器表面**：`::selection` 用 `--selection-bg`；`caret-color: var(--accent)`；滚动条 thumb 用 `--scrollbar-thumb`；`accent-color: var(--accent)`。

## 7. 动效（Operate）

- 时长：`--motion-fast` 150（hover、颜色）· `--motion-base` 200（展开、切换）· `--motion-slow` 250（抽屉、对话框，上限）· `--motion-exit` 150（退出比进入快）。
- 曲线：进入 `--motion-ease-out`，退出 `--motion-ease-in`。
- 只动 `opacity`、`transform`、颜色；不动宽高布局。
- 没有页面加载动画、没有装饰动画、没有弹跳。
- `prefers-reduced-motion`：时长都压到 150，`--motion-move` 归零（位移去掉，颜色/透明度保留）。

## 8. 要做 / 不要做

| 要做 | 不要做 |
|---|---|
| 纸色 + 发丝线分层 | 页面内卡片投影、卡片套卡片 |
| 一个酒红主按钮 | 多个彩色按钮抢注意 |
| 选中 = 淡底 + 文字变色 | 左侧粗色条（>1px）、发光描边 |
| 时间码等宽对齐 | 渐变字、毛玻璃、紫色渐变、霓虹光晕 |
| 状态 = 图标/文字 + 颜色 | 只靠颜色区分状态 |
| skeleton 占位 | 全屏转圈、页面入场动画 |
| 圆角 6/8 | 胶囊按钮、20px 大圆角面板 |
| 400/500/600 两档墨 | 700 粗体、灰上加灰的三四层文字 |

## 9. 不在本次范围

- 字幕样式本身（`--lang-*`、`--fmt-*`、烧录预设的颜色）是用户内容的身份色，不迁移到这套 token。
- 工作台分类色（`--wb-cat-*`）先保留，下一步再评估是否收进 `--state-*`。
- 接线（在 `globals.css` 里把 `--v4-*` / `--v5-*` 别名到新 token）另开一步，见 `token-mapping.md`。

---

Visual principles inspired by Cindy.
