# SubStudio Design Plan

> **性质：** 设计决策 + 验收标准。未批准梯队禁止实现。  
> **排序原则：** 用户感知 P0 → 控件手感 → 工程 P0。  
> **身份：** `DESIGN.md` Creed。工程紧急 ≠ 用户看得见。  
> **队列：** `DESIGN_BACKLOG.md`  
> **批准 / 验收记录：** 见文末。

---

## 0. 排序定义

| 梯队 | 名称 | 判据 | 对应 Backlog |
|------|------|------|----------------|
| **UP-0** | 用户感知 P0 | 同屏一眼「脏 / 像别的产品 / 抢戏」 | Wave 1 |
| **UP-1** | 控件手感 | 点按、浮层、信息徽章的一致性 | Wave 2 |
| **EP-0** | 工程 P0 | Token / 阴影 / 间距真相源；用户几乎无感 | Wave 3 |

**全局非目标（全程有效）**

- 不重做品牌三元（奶油 / 墨绿 / 柑橘）
- 不引入 Bootstrap / Material / Windows / AI SaaS 美学
- 不为「系统更干净」而提前做 EP-0，压过 UP-0
- 不新增图标库、不启用 shadcn Badge/Button 作为产品入口

---

# UP-0｜用户感知 P0

目标：先除掉「睁眼就能感到不对」的东西。风险低、改完立刻更像 SubStudio。

---

## UP-0.1｜ICON-001 检查标记去体系外蓝

### 决策

时间轴三种检查几何保持形状语义不变：

| Kind | 形状 | 色角色 | 决策色 |
|------|------|--------|--------|
| structure | ■ | Danger | 维持 `#c45b55`（`--v5-danger`） |
| screen | ● | **Forest slate**（替换蓝） | `#456660`（墨绿派生冷石板，**禁止** `#3b82f6` / Tailwind blue） |
| sound | ▲ | Warning | 维持 `#c4893a`（`--v5-warning`） |

- 三色必须两两可辨，且全部落在 Ridgeline 封闭辅色内。  
- 色值集中定义（组件常量或 token），业务处不得再写第三套蓝。

### 验收

1. 全库不存在检查标记用途的 `#3b82f6` / `blue-500`。  
2. 奶油时间轴上 ■●▲ 并排：形状可辨、色相不与 SRT teal / 柑橘 accent 撞车。  
3. 滤镜标签「结构差异 / 画面文字 / 声音描述」与标记色一致。  
4. Theater / 暗轨 `muted` 态仍可辨认种类（不靠蓝光）。

---

## UP-0.2｜ASSET-001 TMDB 蓝不污染产品 chrome

### 决策

- **允许：** TMDB Logo SVG/位图保持官方蓝（第三方商标本体）。  
- **禁止：** 任何 `drop-shadow` / glow / ring / 背景晕染使用 TMDB 蓝或 `rgba(59,130,246,*)`。  
- 若需「可点击/聚焦」反馈：只用 forest 线或 citrus soft，不用第三方色。

### 验收

1. TmdbPanel、SourceIdentityStrip 等处无蓝 glow。  
2. Logo 本身仍可识别为 TMDB。  
3. 聚焦/悬停态不出现蓝光指纹。

---

## UP-0.3｜ICON-002 Lucide 尺寸与描边纪律

### 决策

| 场景 | Size | Stroke |
|------|------|--------|
| 工作区默认 | 16px（`h-4`） | **2** |
| 强调/主工具 | 20px（`h-5`） | **2** |
| Forest 托盘整区（可选） | 16 或 20 | **2.25**（整区统一，不得与 2 混栏） |

- 禁止：`h-3.5`、`h-[18px]`、`strokeWidth={2.2|2.5}`、同栏多种 stroke。  
- 填充仅「实心态」（如播放中）；默认描边。  
- 不引入第二图标库。

### 验收

1. 抽检 Ingest / Workbench / Theater / Tray：同栏 icon 尺寸 ≤2 档，stroke 一致。  
2. 无新增中间尺寸。  
3. 工具栏仍是线框语言，不像彩色贴纸栏。

---

## UP-0.4｜ICON-003 文件图标节奏与抢戏

### 决策

- **剪影语言不变**（document / archive / folder）。  
- **尺寸契约：** 列表与 TrackSelect 等选择器 = **md(30)**；空态格式一排 = **lg(36)**；禁止同列表混 sm/xl。  
- **色：** 维持 Ridgeline 降饱和板；ZIP 的 citrus-adjacent **不得亮过或等同** `#ef8d5f` accent（若接近，再降 face 饱和/明度一档）。  
- 禁止：渐变、玻璃、外发光、系统文件图标替换。

### 验收

1. TrackSelect / 任务列表文件标均为 md。  
2. 空态五格式一排为 lg，节奏整齐。  
3. 空态旁主 CTA（柑橘）仍是第一强调；文件标不抢 CTA。  
4. 无新增装饰效果。

---

## UP-0.5｜BADGE-001 徽章角色强制执行

### 决策（决策表 — 唯一）

| 信息类型 | 必须用 | 禁止 |
|----------|--------|------|
| 旁注 / 年份旁 / 任务 meta | Meta 排印（`.rd-chip` 或纯文字） | 方角 chip、胶囊 |
| 影片类型 | `.ui-tag` | pill、Identity 色块 |
| 语言 / 格式 | `LanguageMark` / `FileFormatIcon` | Lucide 冒充格式、随意彩色 pill |
| 检查筛选 | 方角 Status chip | `rounded-full` |
| 托盘缩放、LOCAL 等 | Chrome pill（`rounded-full` **仅托盘**） | 内容区胶囊 |
| 评分 | `.ui-rating` | 彩色星标堆叠 |
| 片源元数据行 | **排印优先**（延续 WorkflowChrome 去 chip） | 标签套标签 |

### 验收

1. 内容区无 `rounded-full` 信息胶囊（进度点除外）。  
2. 片源头区无 chip 墙。  
3. 同一信息不同屏只对应一种角色。  
4. shadcn `Badge` 未接入任何产品面。

---

## UP-0.6｜BADGE-002 语言标 × 文件标并排

### 决策

并排时（TrackSelect、预检行）：

1. **主身份 = 语言**（读轨靠语言）；文件标为辅。  
2. 文件标保持默认饱和；语言壳 `color-mix` **face 混合比下调**（建议 face 参与背景 ≤12%，现若为 16% 则降一档），避免两块色砖对撞。  
3. 不新增描边光晕、不放大任一侧制造「贴纸感」。

### 验收

1. TrackSelect 选中行：先读懂语言，再读懂格式。  
2. 并排不出现「两枚高饱和徽章打架」。  
3. cream / forest 表面仍可读（沿用 color-mix 表面适配）。

---

## UP-0.7｜BADGE-003 LanguageMark 尺寸收敛

### 决策

| 档 | 外壳高 | 用途 |
|----|--------|------|
| **md** | 32px（h-8） | 默认：列表、选择器 |
| **lg** | 36px（h-9） | 仅需强调的身份条 |

- 删除其余高度/字号中间档（13–17px 任意值收束到两档内固定值）。  
- 字标可用 mono；标签文案 mono semibold。

### 验收

1. API/调用点仅出现 md | lg。  
2. 同列表高度一致。  
3. 双语叠牌在两档下仍对齐光学中心。

---

## UP-0.8｜ASSET-002 托盘与 faint 可读性

### 决策

- `text-faint` **禁止**作可操作文案或关键 meta 的唯一颜色。  
- 托盘上可点控件：奶油 ink 对比不低于「能扫读」；装饰性可用更淡。  
- 抽检对象：顶栏控件标签、底栏步骤文案、placeholder、空态次要句。

### 验收

1. 奶油面 + 墨绿托盘各出一张抽检记录（通过/失败项）。  
2. 失败项改为 `text-muted` 或提高 tray ink alpha，不靠加粗喊话。  
3. 不引入纯白高对比「Windows 设置页」风格。

---

# UP-1｜控件手感

目标：点下去像同一套桌面工具，而不是若干次临时 Tailwind。

---

## UP-1.1｜BUTTON-001 / 002 / 003 按钮单一语言

### 决策

| 变体 | 用途 | 高度 | 半径角色 |
|------|------|------|----------|
| `ui-action` | 默认主/次操作 | md **36** | control（约 8px） |
| `ui-action--secondary` | 次要 | 36 | 同 |
| `ui-action--quiet` | 轻操作 | 36 | 同 |
| `ui-action--danger` | 破坏性 | 36 | 同；hover 仅 `color-mix(danger)` |
| `ui-action--lg` | 略强调 | **40** | 同 |
| `ui-action--icon` | 纯图标 | **36×36**（sm 场景允许 32） | sm/md |
| `ui-action--hero` | **仅空态双 CTA** | **48** | xl（约 20px）+ 允许唯一 CTA glow |

- Theater / Tray 用 **surface 变体**（色随表面），不新开圆角体系。  
- 闲置 shadcn Button 不作为入口（删除见 EP 或 SHELL-006）。

### 验收

1. DragZone 空态主按钮 = hero；其余页无 hero。  
2. 工作区破坏性 hover 无裸 `rgba(201,138,134,*)`。  
3. 抽检工具条 icon 钮边长仅为 32 或 36。  
4. 无可识别的第三套「自定义按钮皮肤」。

---

## UP-1.2｜SHELL-001 / 002 / 003 浮层三壳

### 决策

| 壳 | 类名 | Elevation 角色 | 半径 |
|----|------|----------------|------|
| Modal | `.ui-modal` | elevation-3 | md/lg 固定一档 |
| Menu / 下拉 | `.ui-menu` | elevation-2 | sm/md 固定一档 |
| Toast | `.ui-toast` | elevation-2 | lg |

- 奶油面阴影：**墨绿 tint**，禁止菜单再用冷黑 `rgba(0,0,0,0.4)` 独一份。  
- （Elevation 数值可在 EP-0 TOKEN-004 落地；UP-1 先 **统一角色与观感**，允许暂用同一组字面值。）

### 验收

1. 四处 Modal 视觉 elevation 一致。  
2. TrackSelect / Export / DragZone 菜单同源。  
3. Toast 不另起黑色大阴影语言。

---

## UP-1.3｜SHELL-004 / 005 选择器与面板

### 决策

- StyleSidebar 分段 → **必须** `.ui-choice-group` / `.ui-choice`，禁止手写第三套 segment。  
- Workbench 面板 → 单一 `.v4-panel`（含边线与半径），禁止外再套一层 `rounded-lg border`。

### 验收

1. 设置侧栏分段与产品 choice 同族。  
2. 同级面板圆角/边线一致，无「双框」。

---

## UP-1.4｜BADGE-004 / ICON-004 / ICON-005（手感期收尾）

### 决策

- **BADGE-004：** 语言色迁入集中表（CSS 或 tokens 文件）；组件只引用角色名。  
- **ICON-004：** 文件 `ADOBE` 色板同上；业务禁止覆盖 fill。  
- **ICON-005：** 语言**字标**优先系统/UI Sans 保证 CJK；右侧标签可 mono。文档写明限制即可，非必须改字形。

### 验收

1. 新增语言/格式色只改一处表。  
2. 业务组件无散落 face hex。  
3. 简中/日/韩字标在 macOS / Windows 抽样不「缺字方框」（若仍有，有文档记录）。

---

# EP-0｜工程 P0（后置）

目标：锁真相源，防漂移。 **默认不抢 UP-0/UP-1 档期。**  
用户几乎感觉不到「变量改名」——除非顺带修了可见色/阴影。

---

## EP-0.1｜TOKEN-001 / 002 / 003 命名与废弃

> **状态：** **Done（2026-07-28 Design Director 复验）** — 验收 3/3 Pass。

### 决策

- 唯一强调色名：`--v5-accent*`（及 orange 别名若保留）。  
- `@theme` 中 `mint` / `emerald` / `action` 及冷灰蓝暗色：**冻结或删除**，文档标 Deprecated。  
- **新代码只写 `--v5-*`**；`--v4-*` 仅兼容别名。

### 验收

1. 新 PR 不含新增 mint/emerald/暗色引用。  
2. `DESIGN.md` 与注释写明废弃名单。  
3. 产品面视觉相对 UP-1 **无故意变化**（纯工程收敛）。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| TOKEN-001 | 删除 `@theme` mint/emerald/action*；`.action-required-marker` glow → `color-mix(var(--v5-accent) 22%)` |
| TOKEN-002 | 删除冷灰蓝暗色 `@theme`（bg/surface/text-primary/glass-border 等） |
| TOKEN-003 | `DESIGN.md` §2：v5-only + v4 别名约定 + Deprecated 表 |

**状态：Done · Design Director 2026-07-28 复验通过。**

### Design Director 复验（2026-07-28）

分支：`cursor/ep0-token-001-003` · 提交：`d4cdd36d`

| # | 验收 | 结果 | 证据 |
|---|------|------|------|
| 1 | 无新增 mint/emerald/暗色引用；伪名已删 | **Pass** | `@theme` 删除 mint/emerald/action* + 冷灰蓝；产品 `src/`/`app/` 无残留引用 |
| 2 | `DESIGN.md` 写明废弃名单 | **Pass** | §2 Deprecated 表 + v5-only / v4 别名约定 |
| 3 | 产品面无故意视觉变化 | **Pass** | 唯一运行时改动：`.action-required-marker` glow `rgba(…,0.22)` → 等价 `color-mix(--v5-accent 22%)` |

**范围纪律：** 未混 HOME-BRAND / EP-0.2+（elevation / radius / SHELL-006）。

**下一步：** EP-0.2（TOKEN-004 + ASSET-003/004）可开工；单独 PR。

---

## EP-0.2｜TOKEN-004 / ASSET-003 / ASSET-004 Elevation 与表面

> **状态：** **Done（2026-07-28 Design Director 复验）** — 验收 3/3 Pass。

### 决策

| Token | 用途 |
|-------|------|
| `elevation-0` | 面板默认 / hairline |
| `elevation-1` | 轻浮层 |
| `elevation-2` | Menu、Toast |
| `elevation-3` | Modal |
| `glow-accent` | 选中/焦点（一种） |
| `glow-cta` | 仅 hero 主按钮 |

- 阴影色：`color-mix(forest …)`；Theater 只用更高 alpha 的**同一族**，禁止独立纯黑体系。  
- 三表面（cream / forest-chrome / theater-dim）字色与边线 alpha 写成变量。

### 验收

1. 浮层阴影来自 token，无 20+ 散装值新增。  
2. Theater tip 与 Modal 同属墨绿 tint 族。  
3. 三表面切换时文字角色可映射到变量。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| TOKEN-004 | `:root` `--elevation-0…3` / `*-dim` / `--glow-accent` / `--glow-cta`；接到 `.v4-panel` / `.ui-menu|toast|modal` / `.ui-action--hero` |
| ASSET-003 | `--surface-text*|line*`；`[data-surface=cream|forest|theater]` + `.lights-off-stage` |
| ASSET-004 | Theater tip / chrome / 抽屉 / screen-sim-frame：纯黑 → `elevation-*-dim` |

**状态：Done · Design Director 2026-07-28 复验通过。**

### Design Director 复验（2026-07-28）

分支：`cursor/ep0-elevation-surface` · 提交：`c000d213`

| # | 验收 | 结果 | 证据 |
|---|------|------|------|
| 1 | 浮层阴影来自 token；无 20+ 散装新增 | **Pass** | `--elevation-0…3` / `*-dim` / `--glow-*`；接到 panel / menu / toast / modal / hero / InfoHint |
| 2 | Theater tip 与 Modal 同属墨绿 tint 族 | **Pass** | tip → `elevation-1-dim`；chrome/抽屉/frame → `*-dim`；modal → `elevation-3`；皆 `color-mix(--v5-green …)` |
| 3 | 三表面字色/边线可映射变量 | **Pass** | `--surface-text*|line*`；`[data-surface=cream|forest|theater]` + `.lights-off-stage`；`--v4-text|line*` 别名 |

**范围纪律：** 未混 EP-0.3+（radius）/ SHELL-006 / HOME-BRAND。

**不挡关闭：** 海报/BrandMark/TaskList 等仍有零星内联阴影；字幕描边纯黑；`.glass-btn-ar` inset 黑——非 ASSET-004 声明面，可日常扫。Modal 收成单层 `elevation-3`（去掉白 hairline）属收敛，可接受。

**下一步：** EP-0.3（TOKEN-005/006/007 半径）可开工；单独 PR。

---

## EP-0.3｜TOKEN-005 / 006 / 007 半径阶

> **状态：** **Done（2026-07-28 Design Director 复验）** — 验收 3/3 Pass。

### 决策

| Token | 值 | 用途 |
|-------|-----|------|
| radius-xs | 2px | 刻度、小标记 |
| radius-sm | 6px | chip、语言牌、小 icon 钮 |
| radius-md | 8px | 输入、标准面板 |
| radius-lg | 12px | choice 容器、toast |
| radius-xl | 20px | hero CTA、大抽屉 |
| radius-pill | 999px | **仅**托盘胶囊、进度点 |

- BrandMark 归入 sm 或 md，禁止 `11px`。  
- 面板角色显式绑 md；hero 绑 xl。

### 验收

1. 无新增 `rounded-[Npx]` / 奇怪 rem 中间值。  
2. BrandMark 半径为阶内值。  
3. pill 未出现在内容区信息徽章上。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| TOKEN-005 | `:root` `--radius-xs…pill`；`--v5-radius-panel|control` 别名到 xl/lg |
| TOKEN-006 | `.v4-panel` / `.ui-action` / `.ui-modal|menu` → md；`.ui-choice-group` / `.ui-toast` → lg；`.ui-action--hero` / theater 抽屉 → xl；`.ui-choice` / `.ui-tag` → sm |
| TOKEN-007 | BrandMark 外框 `rounded-[var(--radius-md)]`；清 `0.45/0.55/0.625rem` 与裸 `2/6/8/999px` |

**状态：Done · Design Director 2026-07-28 复验通过。**

### Design Director 复验（2026-07-28）

分支：`cursor/ep0-radius-tokens` · 提交：`8a439987`

| # | 验收 | 结果 | 证据 |
|---|------|------|------|
| 1 | 无新增 `rounded-[Npx]` / 奇怪 rem 中间值 | **Pass** | 六档 `--radius-xs…pill`；清 `0.45/0.55/0.625rem` 与裸 `2/6/8/999px` |
| 2 | BrandMark 半径为阶内值；未改 SVG 图形 | **Pass** | 外框 `rounded-[var(--radius-md)]`；本提交无 BrandMark SVG 变更 |
| 3 | pill 未出现在内容区信息徽章 | **Pass** | pill → 托盘胶囊/进度点/滑轨/滚动条；`.ui-tag`/`.ui-choice` → sm |

**角色绑定抽检：** panel/action/modal/menu → md；choice-group/toast → lg；hero + theater 抽屉壳 → xl。

**范围纪律：** 未混 EP-0.4+ / SHELL-006 / HOME-BRAND。

**不挡关闭：** 产品面仍有 Tailwind `rounded-md/lg/full`（几何圆点/色板/spinner）；shadcn `ui/button` 内 `min(radius-md,10px)` 属 SHELL-006。

**下一步：** EP-0.5 **Done**；EP-0.6（SHELL-006）可开工。

---

## EP-0.4｜TOKEN-008 / 009 / 010 托盘 ink、字阶、字重

> **状态：** **Done（2026-07-28 Design Director 复验）** — 验收 3/3 Pass。

### 决策

- `--tray-ink-soft` 替代手写奶油 rgba。  
- 字阶仅 Caption / Control / Body / Title / Display；eyebrow tracking 固定 **两档**（如 0.06em / 0.08em）。  
- Body `450` 保留为设计选择则**写进 DESIGN.md**；同层级禁止 medium/semibold 随机跳。

### 验收

1. 托盘半透明引用 token。  
2. 抽检无双重视觉层级的 `text-[11px]` vs `text-xs` 混用。  
3. 字重规则有文档。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| TOKEN-008 | `--tray-ink*` / `--tray-line*` / `--tray-fill*`；`.system-tray*` + `SystemTray.tsx` 去手写奶油 rgba |
| TOKEN-009 | `--type-caption…display` + `--tracking-eyebrow(|-wide)`；产品面 `text-[11/10/12/13px]` → `text-xs` / type token |
| TOKEN-010 | `DESIGN.md` §3：Body **450** 为设计选择；Meta 500 / Control 600 / Display 700 |

**状态：Done · Design Director 2026-07-28 复验通过。**

### Design Director 复验（2026-07-28）

分支：`cursor/ep0-tray-type` · 提交：`f92c437b`

| # | 验收 | 结果 | 证据 |
|---|------|------|------|
| 1 | 托盘半透明引用 token | **Pass** | `--tray-ink*|line*|fill*`；`.system-tray*` + `SystemTray` 去手写 `rgba(245,241,234,*)` |
| 2 | 无 `text-[11px]` vs `text-xs` 双轨混用 | **Pass** | `--type-caption…display`；产品面 `text-[10/11/12/13px]` 已收敛；抽检 `src/` 无残留 |
| 3 | 字重规则有文档 | **Pass** | `DESIGN.md` §3：Body **450** / Meta 500 / Control 600 / Display 700 |

**范围纪律：** 未混 EP-0.5+（spacing / 裸色大扫）/ SHELL-006 / HOME-BRAND。

**不挡关闭：** 托盘个别态仍用 `color-mix(--v5-cream N%)`（文档允许）；Theater chrome 奶油 rgba 属表面/TOKEN-012 债。

**下一步：** EP-0.5 **Done**。

---

## EP-0.5｜TOKEN-011 / 012 间距与裸色

> **状态：** **Done（2026-07-28 Design Director 复验）** — 验收 3/3 Pass。

### 决策

- 间距主阶：`4 / 8 / 12 / 16 / 24 / 32 / 48`；半档仅光学对齐。  
- 密度：工作台面板 padding **16**；关于/空态文案区 **24**。  
- 裸 hex/rgba：禁止新增；存量随触及清扫，`color-mix(var(--v5-*))`。

### 验收

1. 同级 Workbench 面板 padding 一致。  
2. CI/评审可拒「新增裸色」。  
3. 不借清扫名义改品牌色。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| TOKEN-011 | `--space-1…7` + `--space-panel/copy`；`.density-*`；Workbench 面板 `px-4`；About / 空态 intro 走 copy 密度 |
| TOKEN-012 | `:root` 派生色、surface remap、Theater chrome、Feedback/Tray/磁力线等触及处 → `color-mix(var(--v5-*))`；`DESIGN.md` 裸色纪律 |

**状态：Done · Design Director 2026-07-28 复验通过。**

### Design Director 复验（2026-07-28）

分支：`cursor/ep0-spacing-nude` · 提交：`d0cc6e30`

| # | 验收 | 结果 | 证据 |
|---|------|------|------|
| 1 | 同级 Workbench 面板 padding 一致 | **Pass** | `--space-1…7` / `--space-panel|copy`；SequenceList / AlignmentDiff / SourceMatch / WorkbenchStep 横垫统一 `px-4`（16） |
| 2 | 评审可拒「新增裸色」 | **Pass** | `DESIGN.md` 裸色纪律；派生走 `color-mix(var(--v5-*))` |
| 3 | 不借清扫改品牌色 | **Pass** | triad hex 仍密封于 `:root`（`#1a3d37` / `#f5f1ea` / `#ef8d5f`）；触及处仅改为 token 引用 |

**范围纪律：** 未混 SHELL-006 / HOME-BRAND。

**不挡关闭：** 存量裸色未一次扫尽（lang/fmt 密封源、未触及组件）；About / 空态已走 `density-copy*`。

**下一步：** EP-0.6 已 Submitted · 待复验；通过后 EP-0 Wave 3 可收口。

---

## EP-0.6｜SHELL-006 死代码

> **状态：** **Submitted · 待复验（2026-07-28）** — shadcn `button` / `badge` / `card` 已删；文档锁定 `.ui-action`。未复验勿标 Done。

### 决策

删除或移出产品路径：`button.tsx` / `badge.tsx` / `card.tsx`（shadcn 未接入者）。  
避免贡献者误用 `rounded-4xl` Badge。

### 验收

1. 产品 import 图中无上述入口。  
2. 文档注明「产品按钮 = `.ui-action`」。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| SHELL-006 | 删除 `src/components/ui/{button,badge,card}.tsx`；`DESIGN.md` §7 明示产品按钮 = `.ui-action`、禁止回流 |

**状态：Submitted · 待 Design Director 复验。未混 HOME-BRAND / 发布债。**

---

# 推荐实施序

```
UP-0:  ICON-001 → ASSET-001 → ICON-002 → ICON-003
       → BADGE-001 → BADGE-002 → BADGE-003 → ASSET-002
       【Done · 2026-07-26 Design Director 复验关闭】

UP-1:  BUTTON-001 → BUTTON-002 → BUTTON-003
       → SHELL-001 → SHELL-002 → SHELL-003 → SHELL-004 → SHELL-005
       → BADGE-004 → ICON-004 → ICON-005
       【Done · 2026-07-27 Design Director 复验关闭】

CLEAN-A（可选清扫）:
       ColorSampler faint → muted
       → 底栏 .is-pending 0.55→0.65
       → SequenceList undo/redo → .ui-action--icon
       → SourceIdentityStrip / TmdbPanel 去冗余 rounded-lg
       → StyleSidebar 零星 toggle 能收则收
       【Done · 2026-07-27 Design Director 复验关闭】

EP-0:  TOKEN-001 → TOKEN-002 → TOKEN-003
       【Done · 2026-07-28 Design Director 复验关闭】
       → TOKEN-004 + ASSET-003 + ASSET-004
       【Done · 2026-07-28 Design Director 复验关闭】
       → TOKEN-005 → TOKEN-006 → TOKEN-007
       【Done · 2026-07-28 Design Director 复验关闭】
       → TOKEN-008 → TOKEN-009 → TOKEN-010
       【Done · 2026-07-28 Design Director 复验关闭】
       → TOKEN-011 → TOKEN-012
       【Done · 2026-07-28 Design Director 复验关闭】
       → SHELL-006
       【Submitted · 待复验 · 2026-07-28】
```
---

# 批准闸门

| 问题 | 通过条件 |
|------|----------|
| 是否加强 Editorial Desktop？ | 是 |
| 是否引入 AI SaaS / Material / Windows 指纹？ | 否 |
| 是否用工程整洁压过用户感知序？ | 否 |
| 决策与实现状态是否可审计？ | 是（须与 Backlog Status 同步） |

---

# 批准记录

| 梯队 | 范围 | 状态 | 日期 | 备注 |
|------|------|------|------|------|
| **UP-0** | 设计决策与验收标准 | **Approved** | 2026-07-26 | Design Director 方案批准 |
| **UP-0** | 实现开工 | ~~In Progress~~ → **Done** | 2026-07-26 | 实现已验收关闭 |
| **UP-0** | 实现验收（八条） | **Done** | 2026-07-26 | 扫尾关闭 ASSET-002 / BADGE-001 |
| **UP-0** | Design Director 终裁 | **Approved / Closed** | **2026-07-27** | 独立复验通过；Wave 1 正式关闭 |
| **UP-1** | 设计决策与验收标准（`DESIGN_PLAN.md` UP-1 节） | **Approved** | **2026-07-27** | 方案以计划原文为准，不另开设计轮 |
| **UP-1** | 实现开工 | **Authorized** → **Done** | **2026-07-27** | UI Engineer 已落地 |
| **UP-1** | 实现验收（十一条） | **Done** | **2026-07-27** | Design Director 复验关闭 Wave 2 |
| **CLEAN-A** | 可选清扫（UP-0/UP-1 残留） | **Done** | **2026-07-27** | Design Director 复验通过 A1–A5；解锁 EP-0 |
| **THEATER-LAYER** | 放映厅叠层 / 几何避让 | **Done** | **2026-07-27** | Design Director 复验通过 D1–D4 / 验收 6 条；EP-0 恢复可开工 |
| **EP-0.1** | TOKEN-001 → 002 → 003 | **Done** | **2026-07-28** | Design Director 复验 3/3 Pass；`d4cdd36d` |
| **EP-0.2** | TOKEN-004 + ASSET-003/004 | **Done** | **2026-07-28** | Design Director 复验 3/3 Pass；`c000d213` |
| **EP-0.3** | TOKEN-005 → 006 → 007 | **Done** | **2026-07-28** | Design Director 复验 3/3 Pass；`8a439987` |
| **EP-0.4** | TOKEN-008 → 009 → 010 | **Done** | **2026-07-28** | Design Director 复验 3/3 Pass；`f92c437b` |
| **EP-0.5** | TOKEN-011 → 012 | **Done** | **2026-07-28** | Design Director 复验 3/3 Pass；`d0cc6e30` |
| **EP-0.6** | SHELL-006 | **Done** | **2026-07-28** | `51be309a`；Wave 3 收口 |
| **HOME-BRAND** | 品牌名 / 底栏三钮 / 空态排版 | **Done** | **2026-07-28** | 经 INTEGRATE 合入 tip |
| **INTEGRATE** | HOME-BRAND → EP-0 tip | **Done** | **2026-07-28** | Director 抽检 Pass · `dbaccf81` |
| **REL-P1** | REL-1/2/3 a11y | **Done** | **2026-07-28** | Director 复验 3/3 Pass · `73c673c6` |

---

# 验收记录（UP-0）

| 日期 | 对象 | 裁定 | 说明 |
|------|------|------|------|
| 2026-07-26 | `DESIGN_PLAN.md` 决策稿 | **Pass** | 可作为 UP-0 唯一验收契约 |
| 2026-07-26 | UP-0 实现（unstaged） | **Conditional Pass** | 完工声明驳回；不可标全部 Done |
| 2026-07-26 | ASSET-002 / BADGE-001 扫尾（UI Engineer） | **Submitted** | 已补对比度/可点 faint/eyebrow；已归档胶囊抽检表 |
| 2026-07-26 | ASSET-002 / BADGE-001 初复验记录 | **Pass → Done** | 抽检表与代码对齐；对比度声称写入计划 |
| **2026-07-27** | **Design Director 终裁复验** | **Approved / Done** | 独立核对代码 + 对比度核算；**确认关闭 UP-0** |

### 逐条

| ID | 裁定 | 关闭前缺口 |
|----|------|------------|
| ICON-001 | **Done** | — |
| ASSET-001 | **Done** | — |
| ICON-003 | **Done** | — |
| BADGE-002 | **Done** | — |
| BADGE-003 | **Done** | — |
| ICON-002 | **Done** | 边界已写入 `DESIGN.md` §4（仅约束 Lucide） |
| BADGE-001 | **Done** | §5 抽检表已 Director 复核；内容区越权全圆已清 |
| ASSET-002 | **Done** | 禁用步骤 5.45:1；eyebrow ≈5.6:1；声称可点 faint 已抬至 muted |

### BADGE-001｜信息胶囊目视抽检（DESIGN.md §5）

抽检日期：2026-07-26 · 工程师自检 · **Design Director 2026-07-26 裁定：Pass → Done**

| 表面 / 落点 | 所见 | §5 角色判定 | 结果 | 处置 |
|-------------|------|-------------|------|------|
| SystemTray LOCAL / 时钟壳 | `rounded-full` + 文案 | Chrome pill（仅托盘） | **Pass** | 保留 |
| WorkflowChrome InfoBar 年份/集数/本地摘要 | 纯排印，无底框 | Meta text | **Pass** | 已去 chip |
| FilmMetaBlock 类型 | `.ui-tag` 方角 | Category tag | **Pass** | — |
| FilmMetaBlock / 评分 | `.ui-rating*` | Rating | **Pass** | — |
| TrackSelect / TaskList / 预检行 | `LanguageMark` + `FileFormatIcon` | Identity mark | **Pass** | — |
| TaskList「双语 · N 行」 | `.rd-chip` 无底 | Meta text | **Pass** | — |
| Workbench 检查筛选 | `.ui-choice` 方角 | Status / filter | **Pass** | — |
| AlignmentDiff 行内 kind 标 | `rounded-md` 方角 chip | Status / filter | **Pass** | — |
| SourceMatch 聚合计数 | 曾 `rounded-full` 数字角标 | 越权胶囊 → 应方角 | **Fail→Fixed** | 改为 `rounded-md` |
| InfoHint / 面板关闭钮 | 曾 `rounded-full` 圆钮 | 非信息胶囊，但是内容区全圆控件 | **Fail→Fixed** | 改为 `rounded-md`；可点色改 muted |
| 色板圆点 / spinner / 进度点 / ■●▲ | 几何或加载 | 非信息胶囊（进度点除外） | **Pass** | 保留 |
| `src/components/ui/badge.tsx` | shadcn `rounded-4xl` | 禁止产品入口 | **Pass** | 无产品 import |

### ASSET-002｜对比度抽检记录

| 表面 | 抽检项 | 修复前 | 修复后 | 结果 |
|------|--------|--------|--------|------|
| Forest 托盘 | 禁用步骤文案（仍可点 / cursor-help） | cream@0.55 ≈**4.37:1** | cream@0.65 ≈**5.45:1**（Director 实机 **5.45:1**） | **Pass** |
| Forest 托盘 | 可点步骤 / 底栏步骤标签 | 已抬至 ≥0.72 档 | 维持 | **Pass** |
| Cream 空态 | eyebrow `LOCAL SUBTITLE STUDIO`（柑橘） | accent-strong ≈**2.2:1** | `color-mix(accent 40%, text)` ≈**5.59:1**（Director 复核 mix ≈**5.6:1**） | **Pass** |
| Cream | 可点控件唯一色为 `text-faint` | InfoHint / 关闭 / 拖柄 / 清除 / Powered by | 改为 `text-muted` | **Pass** |
| Cream | placeholder / 装饰旁注 | 允许 faint | 未改（符合决策） | Pass（策略） |

### 关闭 UP-0 全集前的清单

1. ~~文档状态与实现一致~~。  
2. ~~ASSET-002 对比度与可点 faint 扫尾~~ → **Done（Director 复验 Pass）**。  
3. ~~ICON-002 边界~~（已写入 `DESIGN.md` §4）。  
4. ~~BADGE-001 抽检表归档~~ → **Done（Director 复验 Pass）**。  

**UP-0 全集：Done（2026-07-26 扫尾 · 2026-07-27 Design Director 终裁确认）。**

### Design Director 终裁批注（2026-07-27）

**裁定：批准关闭 UP-0 / Wave 1。**

| 复核项 | 证据 | 结果 |
|--------|------|------|
| ASSET-002 禁用步骤 | `SystemTray` `rgba(245,241,234,0.65)`；核算 **5.45:1** ≥ 4.5 | Pass |
| ASSET-002 eyebrow | `.ingest-empty-intro__eyebrow` = `color-mix(accent 40%, text)`；核算 **5.60:1** | Pass |
| ASSET-002 可点 faint | `InfoHint` 等已改 `text-muted` + `rounded-md` | Pass |
| BADGE-001 越权胶囊 | SourceMatch 计数 `rounded-md`；托盘 LOCAL 保留 `rounded-full` | Pass |
| BADGE-001 抽检表 | 计划内 §5 表完整，与代码一致 | Pass |
| ICON-001 未回退 | `screen: #456660`；无检查用途蓝 | Pass |

**残留（不重开 UP-0，日常清扫即可）：** ColorSampler 上传区图标仍 `text-faint`；底栏 `.is-pending` 仍 cream@0.55（≈4.36:1，若视为可读步骤可随后抬到 0.65）。

**下一步（已更新）：** UP-1 / CLEAN-A / **THEATER-LAYER Done** · EP-0 **Authorized**。发布债未授权。

---

# 验收记录（UP-1）

| 日期 | 对象 | 裁定 | 说明 |
|------|------|------|------|
| 2026-07-27 | UP-1 方案 | **Approved** | 计划原文即契约 |
| 2026-07-27 | UP-1 实现开工 | **Authorized** | 允许按序实施 |
| 2026-07-27 | UP-1 实现提交（UI Engineer） | **Submitted** | hero / 三壳 / choice / panel / lang+fmt token |
| **2026-07-27** | **Design Director 复验** | **Pass → Done** | 逐条对照验收标准；Wave 2 关闭 |

### 逐条

| ID | 裁定 | Director 复核要点 |
|----|------|-------------------|
| BUTTON-001 | **Done** | 空态双 CTA = `.ui-action--hero`；全库仅 DragZone |
| BUTTON-002 | **Done** | `.ui-action--icon` = 36；`--icon-sm` = 32；主路径关闭/删除已迁入 |
| BUTTON-003 | **Done** | 产品面无裸 `rgba(201,138,134,*)`；danger hover 走 color-mix |
| SHELL-001 | **Done** | SystemTray / Workbench / Tmdb / Ingest → `.ui-modal`；墨绿 tint |
| SHELL-002 | **Done** | TrackSelect / Export / DragZone → `.ui-menu`；冷黑阴影已去 |
| SHELL-003 | **Done** | FeedbackCenter → `.ui-toast` |
| SHELL-004 | **Done** | StyleSidebar 分类 tab + 辅助策略 → `.ui-choice-group` |
| SHELL-005 | **Done** | Workbench 概览/序列/差异/样式抽屉 → 单一 `.v4-panel` |
| BADGE-004 | **Done** | `--lang-*-face/ink` 集中于 `globals.css`；组件只引 var |
| ICON-004 | **Done** | `--fmt-*-face/fold` + `--fmt-ink`；无内联 face hex |
| ICON-005 | **Done** | `LangTile` 字标 `font-sans`；`DESIGN.md` §4 已文档化 |

### 残留（不重开 UP-1）

| 项 | 说明 |
|----|------|
| SequenceList 撤销/重做 | 仍手写 `h-9 w-9`（边长已是 36）；可改 `.ui-action--icon` |
| SourceIdentityStrip / TmdbPanel | `v4-panel` 上多余 `rounded-lg`（同值冗余） |
| StyleSidebar 辅助线 / 斜体歌词 | 少量自定义 toggle，非主 CTA 竞品皮肤 |
| InfoHint 浮层 | tip ≠ menu/modal，未强制归入三壳 |

**UP-1 全集：Done（2026-07-27）。残留转入 CLEAN-A，不重开 Wave 2。**

---

# 当前授权（2026-07-27）· 先 A 再 B

> **硬顺序：~~CLEAN-A 全部 Done + Design Director 复验通过 → 才可开工 EP-0。~~**  
> **当前：CLEAN-A = Done → EP-0 = Authorized。** 禁止同一 PR 混清扫与 token 重构（清扫已关）。

## CLEAN-A｜可选清扫 · **Done（2026-07-27 Design Director 复验）**

### 范围与验收

| # | 项 | 验收 | 实现 | Director |
|---|-----|------|------|----------|
| A1 | ColorSampler 上传区图标 | 可点态不用 `text-faint` 作唯一色 → `text-muted` | `ImageIcon` → `text-muted` | **Pass** |
| A2 | 底栏 `.is-pending` | cream α `0.55` → `0.65` | globals `0.65` | **Pass** |
| A3 | SequenceList 撤销 / 重做 | `.ui-action--icon` | `quiet` + `icon` | **Pass** |
| A4 | SourceIdentityStrip / TmdbPanel | 去掉与 `.v4-panel` 同值的多余 `rounded-lg` | 外壳去冗余 | **Pass** |
| A5 | StyleSidebar 零星 toggle | 能收进 `.ui-choice` 则收 | 辅助线 / 斜体歌词 → choice | **Pass** |

### 禁止（本档关闭后仍有效于 EP-0）

- 发布债（嵌套 button / Modal 焦点 / 窄屏）混入 EP-0  
- 借 token 重构重做品牌或控件语言  

### 状态机

`Authorized` → 实施 → `Submitted` → **Director 复验 → Done** → **EP-0 Authorized** ✓

---

## EP-0｜工程真相源 · **In Progress（0.6 Submitted · 2026-07-28）**

方案以本文 **EP-0** 各节为准。实施序：

```
TOKEN-001 → 002 → 003          【Done · 2026-07-28】
→ TOKEN-004 + ASSET-003 + ASSET-004   【Done · 2026-07-28】
→ TOKEN-005 → 006 → 007               【Done · 2026-07-28】
→ TOKEN-008 → 009 → 010               【Done · 2026-07-28】
→ TOKEN-011 → 012                     【Done · 2026-07-28】
→ SHELL-006                            【Submitted · 待复验】
```

**约束：** 纯工程收敛；产品面无故意视觉改版；完成后交 Director 复验标 Done。

> **插队规则：** THEATER-LAYER 已 Done。EP-0 切片单独 PR；禁止与 HOME-BRAND / 发布债混做。

---

# THEATER-LAYER｜放映厅叠层与互不干扰（**Approved / Authorized · 2026-07-27**）

> **来源：** 实机截图——样式参数盖住导出菜单；播放条与抽屉互相抢层。  
> **身份：** Editorial Desktop；用逻辑叠层 + 几何避让，**禁止**用狂拉 z-index / 开关时改布局尺寸来「压过去」。  
> **状态：** **Done（2026-07-27 Design Director 复验）** — D1–D4 与验收 6 条通过。

## 1. 问题审计

| 现象 | 根因（代码） |
|------|----------------|
| 导出菜单被样式抽屉挡住 | 顶栏 `z-[--z-raised]`(=10) 自成叠层上下文；菜单 `z-110` 出不去。抽屉 `z-40` 在主区参与**根级**比较 → **40 > 10，抽屉压过整段顶栏** |
| 开样式后播放条 `z-50` | `TheaterStep` 为「可点」临时抬层 → 播放条反而压过样式（`50 > 40`），与「样式在播放之上」的产品逻辑相反 |
| 半透明叠字发脏 | 错误叠层下菜单字透出抽屉；不是要加实心遮罩糊弄 |
| 怕抖动 / 横跳 / 忽大忽小 | 已用 `absolute` 抽屉避免 flex 挤预览（保留）。**禁止**改回进文档流；避让用 **inset / max-height**，不用整页 reflow |

## 2. 逻辑叠层（契约）

自下而上，放映厅局部：

| 层 | 角色 | 内容 |
|----|------|------|
| **L0 Stage** | 最底 | 预览屏 + 播放控制条（永远可点、不被抽屉盖住） |
| **L1 Style** | 中 | 样式参数壳 + 小屏遮罩 |
| **L2 Action menu** | 最顶（开时） | **导出字幕**菜单（及同级顶栏下拉） |

全局 `--z-dropdown` / `--z-modal` 仍高于本局部；关灯暗幕逻辑不变。

## 3. 决策（非粗暴）

### D1 · 导出菜单脱离顶栏叠层

- `ExportDropdown` 打开时：菜单经 **`OverlayPortal` + `position: fixed`**（按按钮 `getBoundingClientRect` 锚定），`z-index: var(--z-dropdown)`。  
- **不要**把整段顶栏抬到 999；**不要**给抽屉狂加 z 去「盖过预览」。  
- 关闭：原 outside-click / Esc 行为保留。

### D2 · 样式与播放条：几何避让，不抢 z

- **删除**「开样式 → 播放条 `z-50`」分支。  
- 播放条固定 **L0**；样式壳固定 **L1**。  
- 抽屉定位：`top/right` 保留；**`bottom` 改为让出播放条占位**（`bottom: calc(播放条高度 + 既有 gap)`，高度用 CSS 变量如 `--theater-deck-h`，一次量好写死档，禁止每帧测量导致抖动）。  
- 抽屉内部 **只滚内容区**；外壳宽高档位固定（现有 `w-[380px]` / `min()`），开合仍用现有 transform，**禁止**改 flex 让预览左右挪。

### D3 · 稳定与可预测

| 要 | 不要 |
|----|------|
| 开合样式：预览几何不变（已 absolute） | 开合时预览宽度横跳 |
| 开合导出：仅菜单出现，舞台不动 | 为菜单临时改播放条/抽屉尺寸 |
| 叠层角色写死在 token/注释 | `z-50` 之类一次性抬层 |
| 小屏遮罩仍在 L1，点遮罩关样式 | 遮罩盖住导出按钮且点不透（导出在顶栏，遮罩应 `inset` 限在主区） |

### D4 · 互斥（可选、轻量）

- **不强制**开导出就关样式（用户可能边看样式边导出）。  
- 因 D1 菜单在 L2，二者可同开且菜单可读。  
- 若小屏遮罩挡顶栏：遮罩不得覆盖顶栏命中区。

## 4. 验收

1. 样式开着时点「导出字幕」：菜单**完整可见、可点**，不被样式壳裁切或透字。  
2. 样式开着时：播放条**完整可见、可点**；抽屉底缘在播放条之上，**无重叠抢点击**。  
3. 开关样式：预览画面**无左右横跳**；无整页高度忽大忽小。  
4. 开关导出：舞台与抽屉几何**不变**。  
5. 关灯模式：暗幕 / 舞台点亮逻辑不回退。  
6. 无新增「z-999」魔法数；局部层用 `--z-theater-stage|style` + 菜单走既有 `--z-dropdown`。

### 实现提交（UI Engineer · 2026-07-27）

| 决策 | 落点 |
|------|------|
| D1 | `useExport.tsx` → `OverlayPortal` + `fixed` + 按钮 rect 锚定；`z-[var(--z-dropdown)]`；去掉顶栏按钮组 `z-dropdown` 抬层 |
| D2 | 删除开样式 `z-50`；`--theater-deck-h: 5.25rem`；抽屉 / 小屏遮罩 `bottom` 让出；`--z-theater-stage|style` |
| D3 | 抽屉保持 `absolute`；开合仍 spring transform，未改 flex |
| D4 | 遮罩仍在主区 `relative` 内；`bottom` 让出播放条；不盖顶栏 |

**状态：Done · Design Director 2026-07-27 复验通过。**

### Design Director 复验（2026-07-27）

| # | 验收 | 结果 |
|---|------|------|
| 1 | 样式开着时导出菜单完整可见可点 | **Pass** · Portal + fixed + `--z-dropdown` |
| 2 | 样式开着时播放条完整可见可点、无重叠 | **Pass** · 无 z-50；抽屉 `bottom: var(--theater-deck-h)` |
| 3 | 开关样式预览无横跳 | **Pass** · 抽屉保持 absolute |
| 4 | 开关导出舞台几何不变 | **Pass** |
| 5 | 关灯逻辑未回退 | **Pass** · 未改暗幕路径 |
| 6 | 无 z-999；用 theater token + dropdown | **Pass** |

---

- 不重做样式信息架构、不改毛玻璃美学。  
- 不并进 EP-0 token 大扫。  
- 不做发布债（焦点陷阱等），除非顺手且零风险。

---

# 剩余工作（2026-07-28 · EP-0 Wave 3 收口后）

## 已关闭

| 梯队 | 状态 |
|------|------|
| **UP-0 / Wave 1** | **Done** |
| **UP-1 / Wave 2** | **Done** |
| **CLEAN-A** | **Done** |
| **THEATER-LAYER** | **Done（2026-07-27）** |
| **EP-0 / Wave 3** | **Done（2026-07-28）** · 0.1–0.6 全集 |
| **HOME-BRAND** | **Done** · 经 INTEGRATE 合入 tip |
| **INTEGRATE** | **Done（2026-07-28）** |
| **REL-P1** | **Done（2026-07-28）** · `73c673c6` |

## 当前布置（Design Director · 2026-07-28）

> **INTEGRATE / REL-P1 Done。** REL-P2 已于 **2026-07-28** 明示 **Authorized**。

### 序 0｜INTEGRATE — 分支合入 · **Done（2026-07-28）**

| 步 | 动作 | 负责 | 验收 |
|----|------|------|------|
| 0.1 | 以 `cursor/ep0-shell-006` 为基 | UI Engineer | **Pass** · merge `dbaccf81` |
| 0.2 | merge `home-brand-72d9`；文案 HOME-BRAND；token EP-0 | UI Engineer | **Pass** · 顶栏 `SaikoSubStudio`；无 `LOCAL SUBTITLE`；底栏存档/隐私/反馈 |
| 0.3 | Design Director 合入后抽检 | Design Director | **Pass** · 冲突面干净 |

---

### 序 1｜REL-P1 — 产品发布债（可访问性 / 结构）· **Done（2026-07-28）**

> 分支：`cursor/rel-p1-a11y` · 提交：`73c673c6` · 基于 INTEGRATE tip。

| ID | 项 | 验收 | Director |
|----|-----|------|----------|
| **REL-1** | 嵌套 `<button>` | 空态卡去 `role=button`；键盘走 hero CTA | **Pass** |
| **REL-2** | Modal 焦点陷阱 | `useUiModalFocus`：开锁内 / Tab 循环 / Esc / 关回触发源；重置 / 回导入 / 存档 / TMDB 四路 `.ui-modal` | **Pass** |
| **REL-3** | 窄屏步骤可达 | 顶栏工作流步骤条窄屏常显可点；去掉仅展示的 `STEP_LABEL` | **Pass** |

**状态：Done · Design Director 2026-07-28 复验通过。**

---

### 序 2｜REL-P2 — 体验 / 布局债 · **Submitted · 待复验（2026-07-28）**

> 基于 `cursor/rel-p1-a11y` tip 单独 PR（REL-4 + REL-5）。交 Director 复验后标 Done。未混其它轨、未重开 EP-0。

| ID | 项 | 决策 / 验收 |
|----|-----|-------------|
| **REL-4** | 超宽桌面空洞 | 空态与工作台主列在 ≥1440/1920 仍有可读节奏：沿用既有 `max-w-*` 体系收紧或加水平 padding；**禁止**加卡片墙 / 装饰条 / 新色。验收：超宽下首屏不「字贴中间、两侧真空失控」；窄屏无回退 |
| **REL-5** | EP-0 复验残留扫 | 触及清扫：海报 / BrandMark / TaskList 等零星内联阴影 → `--elevation-*` / `--glow-*`；组件内 triad 半透明 → `color-mix(var(--v5-*))`；能改的 `rounded-[Npx]` → `--radius-*`。验收：无新增裸色；无故意视觉改版 |

**不做：** 新品牌叙事、重做空态三层、重开 EP-0 token 阶、REL-P1 回退、发布债扩面。

### 实现提交（UI Engineer · 2026-07-28）

| ID | 落点 |
|----|------|
| REL-4 | 导入壳 `xl/2xl` 水平 gutter；工作台主列 `1480→1280`；About/Feedback `xl:px-16`；空态保持 `max-w-6xl` |
| REL-5 | BrandMark/海报/TaskList 阴影 → elevation/glow；warning 边线与分布图 stroke → `var(--v5-*)`；触及 `rounded-xl` → `--radius-xl` |

**状态：Submitted · 待 Design Director 复验。**



---

## 工程师执行卡（可粘贴）

```
【当前】REL-P2 Submitted · 待复验
基：cursor/rel-p1-a11y tip
REL-4 超宽空洞：收 max-w / 水平 padding；禁卡片墙/新色
REL-5 残留扫：阴影→elevation/glow；nude→color-mix；圆角→radius token
单独 PR；交 Director 复验
【禁止】视觉改版、重开 EP-0、混其它轨
【已关闭】INTEGRATE · REL-P1
```

## 产品发布债（状态）

P1 → **REL-P1 Done（2026-07-28）**。  
P2 → **REL-P2 Submitted · 待复验（2026-07-28）**。  
**勿重开已关闭的 EP-0。**


---

# HOME-BRAND｜空态品牌与首页排版（**Approved / Authorized · 2026-07-28**）

> **来源：** 空态拥挤、品牌名三轨、底栏三钮常隐字。  
> **契约：** `DESIGN.md` Creed + Ridgeline；Desktop-first。  
> **状态：** **Done（2026-07-28）** — 设计轨复验通过；经 INTEGRATE 合入 tip；冲突面抽检 Pass。

## 1. 品牌名统一为 SaikoSubStudio

| 位置 | 决策 |
|------|------|
| 顶栏 | Logo **右侧**字标改为 **`SaikoSubStudio`**（替换 `SubStudio`）；与标同一可点区，间距 10–12px；`≥420px` 显示字标 |
| 空态 | **删除** `LOCAL SUBTITLE STUDIO` eyebrow（避免第三套英文品牌） |
| 其它 | `layout` title / About 已用 SaikoSubStudio 则保持；屏上主品牌禁止再写 `SubStudio` |
| Logo 图形 | **本档不改** BrandMark SVG（图形改版另案） |

## 2. 底栏三钮：常显文案 + 换标

| 钮 | aria / title（全称） | 可见标签 | Lucide（新） |
|----|----------------------|----------|--------------|
| 存档 | 历史存档 | **存档** | `Archive`（替 `FolderClock`） |
| 隐私 | 隐私与版权 | **隐私** | `Scale`（替 `ShieldCheck`） |
| 反馈 | 反馈 | **反馈** | `PenLine`（替 `MessageSquareText`） |

- 默认桌面宽度下三钮文字**必须可见**（降低或取消 `@[22rem]` 隐藏；极窄才 icon-only）。  
- `whitespace-nowrap`；icon `h-5` / stroke `2.25`；`gap-2`。  
- 仍用 Lucide，禁止第二图标库。

## 3. 空态中区：三层结构，去拥挤

```
[1 主张]  标题一行 + 副句一行
[2 开始]  五格式标 → 行动句 → 一句说明 → 双 CTA → 格式脚注
[3 亮点]  四列等宽 rail
```

### 锁定文案

| 块 | 文案 |
|----|------|
| 主张标题 | **本地字幕工作室**（宋体；≥720px `nowrap`） |
| 主张副句 | **对齐合并 · 样式调整 · 预览导出**（单行 muted） |
| 开始标题 | **拖入字幕开始** / 拖中 **松开即可加入** |
| 开始说明 | **文件留在本地，不上传** |
| 格式脚注 | 保持现有 SRT/ASS/ZIP… 句 |
| 亮点 | 本地处理 / 多轨整理 / 样式定制 / 效果预览（说明各一行、节奏齐） |

### 排版纪律

- 删英文 eyebrow；主张与开始卡**同轴居中**、相近 `max-width`。  
- 层间距固定一档；亮点上沿一条细分隔即可。  
- 双 CTA 等宽；禁止一大一小 padding。  
- 拖拽只改文案/虚线，**不改**主张与亮点几何。

## 4. 验收

1. 顶栏 Logo 右为 **SaikoSubStudio**；无屏上主品牌 `SubStudio` / `LOCAL SUBTITLE STUDIO`。  
2. 底栏三钮默认可见「存档 / 隐私 / 反馈」+ 新图标。  
3. 空态仅三层；≥720px 主张标题与副句不换行。  
4. 无新色、无玻璃堆、无抖动横跳。  
5. 设计轨单独 PR 已合入；主线以 INTEGRATE 抽检为准。

### 实现提交（UI Engineer · 2026-07-28）

| 项 | 落点 |
|----|------|
| 顶栏字标 | `SystemTray` → `SaikoSubStudio`（≥420px） |
| 去 eyebrow | `DragZone` 删除 `LOCAL SUBTITLE STUDIO` |
| 底栏三钮 | 可见「存档/隐私/反馈」；`Archive` / `Scale` / `PenLine`；标签阈值 `@[8rem]` |
| 空态文案 | 主张「本地字幕工作室」+「对齐合并 · 样式调整 · 预览导出」；开始「拖入字幕开始」+「文件留在本地，不上传」 |

**状态：Submitted · 待 Design Director 复验。未改 BrandMark SVG；未混 EP-0。**

---
