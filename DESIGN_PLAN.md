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

### 决策

- 唯一强调色名：`--v5-accent*`（及 orange 别名若保留）。  
- `@theme` 中 `mint` / `emerald` / `action` 及冷灰蓝暗色：**冻结或删除**，文档标 Deprecated。  
- **新代码只写 `--v5-*`**；`--v4-*` 仅兼容别名。

### 验收

1. 新 PR 不含新增 mint/emerald/暗色引用。  
2. `DESIGN.md` 与注释写明废弃名单。  
3. 产品面视觉相对 UP-1 **无故意变化**（纯工程收敛）。

---

## EP-0.2｜TOKEN-004 / ASSET-003 / ASSET-004 Elevation 与表面

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

---

## EP-0.3｜TOKEN-005 / 006 / 007 半径阶

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

---

## EP-0.4｜TOKEN-008 / 009 / 010 托盘 ink、字阶、字重

### 决策

- `--tray-ink-soft` 替代手写奶油 rgba。  
- 字阶仅 Caption / Control / Body / Title / Display；eyebrow tracking 固定 **两档**（如 0.06em / 0.08em）。  
- Body `450` 保留为设计选择则**写进 DESIGN.md**；同层级禁止 medium/semibold 随机跳。

### 验收

1. 托盘半透明引用 token。  
2. 抽检无双重视觉层级的 `text-[11px]` vs `text-xs` 混用。  
3. 字重规则有文档。

---

## EP-0.5｜TOKEN-011 / 012 间距与裸色

### 决策

- 间距主阶：`4 / 8 / 12 / 16 / 24 / 32 / 48`；半档仅光学对齐。  
- 密度：工作台面板 padding **16**；关于/空态文案区 **24**。  
- 裸 hex/rgba：禁止新增；存量随触及清扫，`color-mix(var(--v5-*))`。

### 验收

1. 同级 Workbench 面板 padding 一致。  
2. CI/评审可拒「新增裸色」。  
3. 不借清扫名义改品牌色。

---

## EP-0.6｜SHELL-006 死代码

### 决策

删除或移出产品路径：`button.tsx` / `badge.tsx` / `card.tsx`（shadcn 未接入者）。  
避免贡献者误用 `rounded-4xl` Badge。

### 验收

1. 产品 import 图中无上述入口。  
2. 文档注明「产品按钮 = `.ui-action`」。

---

# 推荐实施序

```
UP-0:  ICON-001 → ASSET-001 → ICON-002 → ICON-003
       → BADGE-001 → BADGE-002 → BADGE-003 → ASSET-002
       【方案已批准 · 实现进行中 · 验收 = 有条件通过，不可标全部 Done】

UP-1:  BUTTON-001 → BUTTON-002 → BUTTON-003
       → SHELL-001 → SHELL-002 → SHELL-003 → SHELL-004 → SHELL-005
       → BADGE-004 → ICON-004 → ICON-005
       【方案待批准】

EP-0:  TOKEN-001 → TOKEN-002 → TOKEN-003
       → TOKEN-004 + ASSET-003 + ASSET-004
       → TOKEN-005 → TOKEN-006 → TOKEN-007 → TOKEN-008
       → TOKEN-009 → TOKEN-010 → TOKEN-011 → TOKEN-012
       → SHELL-006
       【方案待批准】
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
| **UP-0** | 实现开工 | **In Progress** | 2026-07-26 | 工作区已有实质改动；状态机与此对齐 |
| **UP-1** | BUTTON / SHELL / BADGE-004 / ICON-004/005 | Pending | — | 未批准 |
| **EP-0** | TOKEN / ASSET-003/004 / SHELL-006 | Pending | — | 未批准 |

---

# 验收记录（UP-0）

| 日期 | 对象 | 裁定 | 说明 |
|------|------|------|------|
| 2026-07-26 | `DESIGN_PLAN.md` 决策稿 | **Pass** | 可作为 UP-0 唯一验收契约 |
| 2026-07-26 | UP-0 实现（unstaged） | **Conditional Pass** | 完工声明驳回；不可标全部 Done |
| 2026-07-26 | ASSET-002 / BADGE-001 扫尾（UI Engineer） | **待 Design Director 复验** | 已补对比度/可点 faint/eyebrow；已归档胶囊抽检表。**未标 Done** |

### 逐条

| ID | 裁定 | 关闭前缺口 |
|----|------|------------|
| ICON-001 | **Done** | — |
| ASSET-001 | **Done** | — |
| ICON-003 | **Done** | — |
| BADGE-002 | **Done** | — |
| BADGE-003 | **Done** | — |
| ICON-002 | **Done** | 边界已写入 `DESIGN.md` §4（仅约束 Lucide） |
| BADGE-001 | **Conditional → 待复验** | 抽检表已归档（见下）；越权内容区 pill 已清 |
| ASSET-002 | **Conditional → 待复验** | 禁用步骤 cream@0.65 ≈5.45:1；可点 faint 已抬；eyebrow `color-mix(accent 40%, text)` ≈5.59:1 |

### BADGE-001｜信息胶囊目视抽检（DESIGN.md §5）

抽检日期：2026-07-26 · 工程师自检 · **待 Design Director 裁定**

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
| Forest 托盘 | 禁用步骤文案（仍可点 / cursor-help） | cream@0.55 ≈**4.37:1** | cream@0.65 ≈**5.45:1** | **待复验** |
| Forest 托盘 | 可点步骤 / 底栏步骤标签 | 已抬至 ≥0.72 档 | 维持 | **待复验** |
| Cream 空态 | eyebrow `LOCAL SUBTITLE STUDIO`（柑橘） | accent-strong ≈**2.2:1** | `color-mix(accent 40%, text)` ≈**5.59:1** | **待复验** |
| Cream | 可点控件唯一色为 `text-faint` | InfoHint / 关闭 / 拖柄 / 清除 等 | 改为 `text-muted` | **待复验** |
| Cream | placeholder / 装饰旁注 | 允许 faint | 未改（符合决策） | Pass（策略） |

### 关闭 UP-0 全集前的清单

1. ~~文档状态与实现一致~~（本记录 + Backlog 已同步）。  
2. ~~ASSET-002 对比度与可点 faint 扫尾~~（代码已补；**待 Design Director 复验**）。  
3. ~~ICON-002 边界~~（已写入 `DESIGN.md` §4）。  
4. ~~BADGE-001 抽检表归档~~（见上表；**待 Design Director 复验**）。  

**UP-1 / EP-0：** 本次不验收、不批准开工。