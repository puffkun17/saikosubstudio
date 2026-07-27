# SubStudio Design Backlog

> 来源：`DESIGN_AUDIT.md`（2026-07-26 Reviewer 审计）  
> 身份约束：`DESIGN.md` Creed —— Editorial Desktop，非 AI SaaS  
> 设计方案（决策 + 验收）：`DESIGN_PLAN.md`  
> 状态约定：`Open` → `Approved` → `In Progress` → `Conditional` → `Done` / `Won't Fix`  
> **未获方案批准前不改产品视觉；已 In Progress 的条目以验收记录为准，不可自行标全部 Done。**

---

## 如何使用

1. 开工前先读 `DESIGN.md`，再认领本 Backlog 条目。  
2. **不要用工程 P0 当开工顺序。** 分开看两列：
   - **Business Impact** — 对工作流、可读性、误操作、无障碍的影响  
   - **Visual Impact** — 用户睁眼就能感到「不像 / 更像 SubStudio」的程度  
3. **当前项目默认序：Visual Impact 高 + 风险低 → 先做**（Asset / Icon / Badge）。  
   Token / Shadow / Spacing 长期重要，但用户几乎感知不到 → **排后**。  
4. 每条完成后更新 Status；若改了契约，回写 `DESIGN.md`。

### Impact 量表

| 字段 | 档位 | 含义 |
|------|------|------|
| **Business** | Low / Medium / High | 是否影响完成任务、误触、对比度可读、信息找得到 |
| **Visual** | ⭐ … ⭐⭐⭐⭐⭐ | 同屏是否「抢戏 / 脏 / 像别的产品」——与改不动 token 名无关 |
| **Risk** | Low / Med / High | 波及面；High = 全局 token/阴影重构，易连带回归 |

### 系统域（ID 前缀）

| 前缀 | 域 | 默认 Visual 倾向 |
|------|-----|------------------|
| `ASSET` | 第三方标、表面、对比度、插画边界 | 高感知 / 低–中风险 |
| `ICON` | Lucide、文件字形、检查几何 | 高感知 / 低风险 |
| `BADGE` | Meta / Tag / Identity / Chrome pill | 高感知 / 低风险 |
| `BUTTON` | `.ui-action` 与散装按钮 | 中感知 / 中风险 |
| `SHELL` | Modal / Menu / Toast / Panel / Choice | 中感知 / 中风险 |
| `TOKEN` | 色名、半径、阴影、字阶、间距、裸色 | **低感知** / 风险偏高 → 后做 |
| `DOC` | 契约与队列文档 | 无直接视觉 |

---

## 当前推荐序（按 Visual × 低风险）

先做用户看得见的，再还工程债。

### Wave 1 — 先做（高 Visual · 低 Risk）· **Done**（2026-07-26 Design Director 复验）

| ID | Business | Visual | Risk | 一句话 | Status |
|----|----------|--------|------|--------|--------|
| **ICON-001** | Low | ⭐⭐⭐⭐⭐ | Low | 检查标记去掉体系外蓝 `#3b82f6` | Done |
| **ASSET-001** | Low | ⭐⭐⭐⭐⭐ | Low | 去掉 TMDB 产品侧蓝 glow（Logo 本体可留蓝） | Done |
| **ICON-002** | Low | ⭐⭐⭐⭐ | Low | Lucide：size 16/20、stroke 2 统一 | Done |
| **ICON-003** | Low | ⭐⭐⭐⭐ | Low | 文件图标：默认 md、空态 lg；色板降饱和不抢 accent | Done |
| **BADGE-001** | Low | ⭐⭐⭐⭐ | Low | 强制 Badge 角色表，清掉越权 pill | **Done** |
| **BADGE-002** | Low | ⭐⭐⭐⭐ | Low | 语言标与文件标并排降饱和/定主次 | Done |
| **BADGE-003** | Low | ⭐⭐⭐ | Low | LanguageMark 只留 md / lg | Done |
| **ASSET-002** | Medium | ⭐⭐⭐ | Low | 托盘 / faint 对比度抽检并修可读点 | **Done** |

> **2026-07-27 Design Director：** UP-0 / UP-1 **Closed**。授权序：**先 CLEAN-A（可选清扫）→ 再 EP-0**。详见 `DESIGN_PLAN.md`「当前授权」。

### Wave 2 — 控件手感（中 Visual · 中 Risk）· **Done**（2026-07-27 Design Director 复验）

| ID | Business | Visual | Risk | 一句话 | Status |
|----|----------|--------|------|--------|--------|
| **BUTTON-001** | Medium | ⭐⭐⭐ | Med | 三套按钮 → 单一 `.ui-action` + hero | **Done** |
| **BUTTON-002** | Medium | ⭐⭐⭐ | Med | Icon 方钮尺寸统一 | **Done** |
| **BUTTON-003** | Medium | ⭐⭐ | Low | 危险 hover 绑 danger token | **Done** |
| **SHELL-001** | Low | ⭐⭐ | Med | `.ui-modal` 单壳 | **Done** |
| **SHELL-002** | Low | ⭐⭐ | Med | `.ui-menu` 单壳 | **Done** |
| **SHELL-003** | Low | ⭐⭐ | Low | `.ui-toast` 单壳 | **Done** |
| **SHELL-004** | Low | ⭐⭐ | Low | StyleSidebar 走 choice | **Done** |
| **SHELL-005** | Low | ⭐ | Low | 面板去掉双重 border/radius | **Done** |
| **BADGE-004** | Low | ⭐⭐⭐ | Med | 语言色升 token（感知在并排时，工程在集中） | **Done** |
| **ICON-004** | Low | ⭐⭐ | Low | 文件色板迁 token（字形已定，防漂移） | **Done** |
| **ICON-005** | Low | ⭐ | Low | 语言字标 mono CJK 回退策略 | **Done** |

> **残留不重开 Wave 2** → 并入 **CLEAN-A**。

### CLEAN-A — 可选清扫 · **Done（2026-07-27 Design Director 复验）**

| ID | 一句话 | Status |
|----|--------|--------|
| **CLEAN-A1** | ColorSampler 可点图标离开 `text-faint` | **Done** |
| **CLEAN-A2** | 底栏 `.is-pending` 0.55→0.65 | **Done** |
| **CLEAN-A3** | SequenceList undo/redo → `.ui-action--icon` | **Done** |
| **CLEAN-A4** | 片源/TMDB 去冗余 `rounded-lg` | **Done** |
| **CLEAN-A5** | StyleSidebar 零星 toggle 能收则收 | **Done** |

> **Design Director：** CLEAN-A / THEATER-LAYER / EP-0.1–0.5 **Done**。**EP-0.6 Submitted · 待复验**。**HOME-BRAND Done** · **INTEGRATE Submitted · 待抽检**。REL-P1 Authorized（单独 PR）。

### Wave 3 — 工程真相源（EP-0）· **0.6 Submitted · 待复验（2026-07-28）**

| ID | Business | Visual | Risk | 一句话 | Status |
|----|----------|--------|------|--------|--------|
| **TOKEN-001** | Low | ⭐ | Med | 冻 mint/emerald/action 伪名 | **Done** |
| **TOKEN-002** | Low | ⭐ | Med | 冻 @theme 冷灰蓝暗色 | **Done** |
| **TOKEN-003** | Low | ⭐ | Low | 新代码只写 `--v5-*` | **Done** |
| **TOKEN-004** | Low | ⭐⭐ | High | elevation / glow 体系统一 | **Done** |
| **TOKEN-005** | Low | ⭐ | High | 六档 radius token + 扫中间值 | **Done** |
| **TOKEN-006** | Low | ⭐ | Low | 面板角色绑 radius-md vs xl | **Done** |
| **TOKEN-007** | Low | ⭐ | Low | BrandMark 归入半径阶 | **Done** |
| **TOKEN-008** | Low | ⭐ | Low | `--tray-ink-soft` | **Done** |
| **TOKEN-009** | Low | ⭐⭐ | Med | 字号 / tracking 收敛到字阶 | **Done** |
| **TOKEN-010** | Low | ⭐ | Low | 文档化 font-weight 450 | **Done** |
| **TOKEN-011** | Low | ⭐ | High | spacing 主阶 + 面板密度 | **Done** |
| **TOKEN-012** | Low | ⭐ | High | 裸 hex/rgba 逐步清扫 | **Done** |
| **ASSET-003** | Low | ⭐⭐ | Med | 三表面契约锁进 CSS | **Done** |
| **ASSET-004** | Low | ⭐⭐ | Med | Theater 阴影并入 elevation（勿纯黑另起） | **Done** |
| **SHELL-006** | Low | ⭐ | Low | 删除/隔离闲置 shadcn | **Submitted** |
| **DOC-001** | — | — | — | `DESIGN.md` + 本 Backlog（**Done**） | Done |

> **剩余工作摘要：** Wave 1+2 + CLEAN-A + THEATER-LAYER + EP-0.1–0.5 **Done**。**EP-0.6 Submitted**。**HOME-BRAND** 经 **INTEGRATE Submitted** 合入 tip。**REL-P1 Authorized**（单独 PR）。REL-P2 未授权。

### THEATER-LAYER — 放映厅叠层 · **Done（2026-07-27）**

| ID | 一句话 | Status |
|----|--------|--------|
| **TL-D1** | 导出菜单 Portal + fixed，走 `--z-dropdown` | **Done** |
| **TL-D2** | 去掉播放条临时 z-50；抽屉 bottom 让出播放条 | **Done** |
| **TL-D3** | 开合不横跳 / 不改预览几何 | **Done** |
| **TL-D4** | 小屏遮罩不盖顶栏 | **Done** |

> 契约与验收见 `DESIGN_PLAN.md`「THEATER-LAYER」。Design Director 复验 6/6 Pass。

### HOME-BRAND — 空态品牌与首页排版 · **Submitted · 待复验（2026-07-28）**

| ID | 一句话 | Status |
|----|--------|--------|
| **HB-1** | 顶栏字标 SaikoSubStudio；删空态英文 eyebrow | Submitted |
| **HB-2** | 底栏「存档/隐私/反馈」+ Archive/Scale/PenLine；降 `@[22rem]` | Submitted |
| **HB-3** | 空态三层锁定文案 | Submitted |

> 契约见 `DESIGN_PLAN.md`「HOME-BRAND」。单独 PR；**交 Design Director 复验**，未复验勿标 Done。
---

## 全量条目

### ASSET

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **ASSET-001** | Low | ⭐⭐⭐⭐⭐ | Low | TMDB 蓝 drop-shadow 侵入 chrome | Logo 可保留蓝；去掉产品侧蓝 glow | TmdbPanel、SourceIdentityStrip | Done |
| **ASSET-002** | Medium | ⭐⭐⭐ | Low | faint / 托盘半透明对比度未抽检 | 奶油面与墨绿托盘各修一轮可读点 | 托盘、meta、placeholder | **Done** |
| **ASSET-003** | Low | ⭐⭐ | Med | cream / forest / theater 表面契约未锁死 | 三套字色/边线 alpha 成 CSS 变量 | 审计 §12 | **Done** |
| **ASSET-004** | Low | ⭐⭐ | Med | Theater 纯黑阴影与奶油面 elevation 分裂 | 并入同一 elevation，仅调 alpha | Theater tip | **Done** |

### ICON

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **ICON-001** | Low | ⭐⭐⭐⭐⭐ | Low | 检查标记 `screen = #3b82f6` | 改入 triad 封闭辅色 | `inspectionMarks.tsx` | Done |
| **ICON-002** | Low | ⭐⭐⭐⭐ | Low | Lucide stroke/size 混用 | 默认 16/20 + stroke 2；托盘若 2.25 整区统一；**仅约束 Lucide**（见 `DESIGN.md` §4） | 全站 Lucide | Done |
| **ICON-003** | Low | ⭐⭐⭐⭐ | Low | 文件标抢戏；列表尺寸节奏乱 | 列表 md、空态 lg；降饱和不抢 citrus | `FileFormatIcon.tsx` | Done |
| **ICON-004** | Low | ⭐⭐ | Low | `ADOBE` 色板仍在组件内 | 迁入 token；业务禁止覆盖 fill | 同上 | **Done** |
| **ICON-005** | Low | ⭐ | Low | mono 中日韩字标回退不稳 | 文档限制；必要时字标改 sans | `LanguageMark` | **Done** |

### BADGE

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **BADGE-001** | Low | ⭐⭐⭐⭐ | Low | 6+ 套 chip/pill 语言 | 只按 `DESIGN.md` §5 角色表 | WorkflowChrome、TaskList、Export、AlignmentDiff | **Done** |
| **BADGE-002** | Low | ⭐⭐⭐⭐ | Low | 语言 + 文件并排双高饱和 | 定主次或降一侧 face 混合比 | TrackSelect、预检行 | Done |
| **BADGE-003** | Low | ⭐⭐⭐ | Low | LanguageMark 尺寸档过多 | 仅 md(32) / lg(36) | `LanguageMark` | Done |
| **BADGE-004** | Low | ⭐⭐⭐ | Med | 语言 12 色硬编码 | 升 `--lang-*` 或 `tokens/lang.css` | `LANG_VISUAL` | **Done** |

### BUTTON

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **BUTTON-001** | Medium | ⭐⭐⭐ | Med | `.ui-action` / hero / 散装三套 | 单一 API + `--hero`；高 sm/md/lg/hero | DragZone、列表、Theater | **Done** |
| **BUTTON-002** | Medium | ⭐⭐⭐ | Med | Icon 方钮各自为政 | 统一 `ui-action--icon`；tray/theater 用 surface 变体 | 各工具条 | **Done** |
| **BUTTON-003** | Medium | ⭐⭐ | Low | 危险 hover 裸粉红 rgba | 只走 `ui-action--danger` + color-mix | DragZone 删除等 | **Done** |

### SHELL

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **SHELL-001** | Low | ⭐⭐ | Med | Modal 多套 shadow | `.ui-modal` + 单一 elevation | SystemTray、Workbench、Tmdb、Ingest | **Done** |
| **SHELL-002** | Low | ⭐⭐ | Med | Menu 多套 shadow | `.ui-menu` | TrackSelect、Export、DragZone | **Done** |
| **SHELL-003** | Low | ⭐⭐ | Low | Toast 未产品化 | `.ui-toast` | FeedbackCenter | **Done** |
| **SHELL-004** | Low | ⭐⭐ | Low | choice 与 StyleSidebar 双轨 | 侧栏走 `.ui-choice-group` | StyleSidebar | **Done** |
| **SHELL-005** | Low | ⭐ | Low | 面板双重圆角/边线 | 单一 `.v4-panel` | Workbench | **Done** |
| **SHELL-006** | Low | ⭐ | Low | shadcn Button/Badge/Card 死代码 | 删除或隔离；禁止新入口 | `ui/button|badge|card.tsx` | **Submitted** |

### TOKEN（EP-0 · 0.5 Done；SHELL-006 Submitted）

| ID | Business | Visual | Risk | 问题 | 验收标准 | 落点 | Status |
|----|----------|--------|------|------|----------|------|--------|
| **TOKEN-001** | Low | ⭐ | Med | Accent 多名 mint/emerald/action… | 冻结伪名；只用 `--v5-accent*` | `globals.css` `@theme` | **Done** |
| **TOKEN-002** | Low | ⭐ | Med | @theme 冷灰蓝暗色残留 | 冻结/移除；禁新引用 | 同上 | **Done** |
| **TOKEN-003** | Low | ⭐ | Low | 新代码仍写 `--v4-*` | 约定只写 `--v5-*` | `DESIGN.md` §2 | **Done** |
| **TOKEN-004** | Low | ⭐⭐ | High | 阴影 20+ 一次性值 | elevation-0…3 + glow-accent/cta | 审计 §3 | **Done** |
| **TOKEN-005** | Low | ⭐ | High | 圆角 8–10 档实战 | xs…pill 六档；禁中间值 | 审计 §2 | **Done** |
| **TOKEN-006** | Low | ⭐ | Low | `radius-panel` 名存实亡 | 角色映射进注释与类 | `.v4-panel`、CTA | **Done** |
| **TOKEN-007** | Low | ⭐ | Low | BrandMark `rounded-[11px]` | 归入半径阶 | `BrandMark.tsx` | **Done** |
| **TOKEN-008** | Low | ⭐ | Low | 托盘奶油半透明手写 rgba | `--tray-ink-soft` | tray CSS | **Done** |
| **TOKEN-009** | Low | ⭐⭐ | Med | `text-[Npx]` / tracking 打穿 | Caption→Display 字阶 | 全站 type | **Done** |
| **TOKEN-010** | Low | ⭐ | Low | weight 450 vs medium/semibold | 文档化；同层不跳 | body CSS | **Done** |
| **TOKEN-011** | Low | ⭐ | High | 无 space token；面板 padding 乱 | 4…48 主阶；密度 16 vs 24 | 全站 | **Done** |
| **TOKEN-012** | Low | ⭐ | High | 百余处裸 hex/rgba | 逐步 color-mix；禁新增 | `src`+`app` | **Done** |

### DOC

| ID | Business | Visual | Risk | 问题 | 验收标准 | Status |
|----|----------|--------|------|------|----------|--------|
| **DOC-001** | — | — | — | 契约防漂移 | `DESIGN.md` + 本文件为真相源 | **Done** |

---

## 旧 ID → 新 ID

| 旧 | 新 |
|----|-----|
| A1 | TOKEN-001 |
| A2 | TOKEN-002 |
| A3 | TOKEN-003 |
| A4 | TOKEN-004 |
| A5 | TOKEN-005 |
| A6 | TOKEN-006 |
| A7 | SHELL-006 |
| A8 | TOKEN-007 |
| B1 | BUTTON-001 |
| B2 | BUTTON-002 |
| B3 | SHELL-001 |
| B4 | SHELL-002 |
| B5 | SHELL-003 |
| B6 | BUTTON-003 |
| B7 | TOKEN-009 |
| B8 | TOKEN-010 |
| B9 | SHELL-004 |
| B10 | SHELL-005 |
| C1 | ICON-001 |
| C2 | BADGE-004 |
| C3 | ICON-003 + ICON-004 |
| C4 | BADGE-001 |
| C5 | ICON-002 |
| C6 | BADGE-002 |
| C7 | BADGE-003 |
| C8 | ASSET-001 |
| C9 | TOKEN-008 |
| C10 | ICON-005 |
| D1 | TOKEN-011 |
| D2 | ASSET-003 |
| D3 | ASSET-004 |
| D4 | TOKEN-012 |
| D5 | ASSET-002 |
| D6 | DOC-001 |

---

## 审计 Top 20 × Impact（防混淆）

| # | 问题 | 工程语气 | Business | Visual | 新 ID |
|---|------|----------|----------|--------|-------|
| 1 | Accent 多名 + 暗色 | 「P0 主题债」 | Low | ⭐ | TOKEN-001/002 |
| 2 | 按钮三套 | 「P0 控件」 | Medium | ⭐⭐⭐ | BUTTON-001/002 |
| 3 | 阴影碎片 | 「P0 系统」 | Low | ⭐⭐ | TOKEN-004 |
| 4 | 圆角多档 | 工程整洁 | Low | ⭐ | TOKEN-005 |
| 5 | 字号任意值 | 可维护性 | Low | ⭐⭐ | TOKEN-009 |
| 6 | 语言标硬编码 | 色板债 | Low | ⭐⭐⭐ | BADGE-002/003/004 |
| 7 | 文件图标色 | 色板债 | Low | ⭐⭐⭐⭐ | ICON-003/004 |
| 8 | 检查标记蓝 | 辅色债 | Low | ⭐⭐⭐⭐⭐ | ICON-001 |
| 9 | Badge 多语言 | IA 债 | Low | ⭐⭐⭐⭐ | BADGE-001 |
| 10 | Lucide 不统一 | 细节债 | Low | ⭐⭐⭐⭐ | ICON-002 |
| 11 | Modal/菜单复制 | DRY | Low | ⭐⭐ | SHELL-001/002 |
| 12 | 危险 hover | token 绑定 | Medium | ⭐⭐ | BUTTON-003 |
| 13 | radius-panel 闲置 | token 闲置 | Low | ⭐ | TOKEN-006 |
| 14 | Tracking 随意 | 排印债 | Low | ⭐⭐ | TOKEN-009 |
| 15 | 间距不齐 | 栅格债 | Low | ⭐ | TOKEN-011 |
| 16 | Theater 纯黑阴影 | elevation | Low | ⭐⭐ | ASSET-004 |
| 17 | TMDB 蓝 glow | 第三方色 | Low | ⭐⭐⭐⭐⭐ | ASSET-001 |
| 18 | BrandMark 11px | 一次性值 | Low | ⭐ | TOKEN-007 |
| 19 | shadcn 死代码 | 误导贡献者 | Low | ⭐ | SHELL-006 |
| 20 | font-weight 450 | 字重叠 | Low | ⭐ | TOKEN-010 |

读表方式：#1 / #3 / #4 在审计里很「工程紧急」，但 **Visual 只有 ⭐～⭐⭐** —— 不要插队压过 ICON-001 / ASSET-001。

---

## 相关文件

| 用途 | 路径 |
|------|------|
| 设计语言（必读） | `DESIGN.md` |
| 审计原文（只读） | `DESIGN_AUDIT.md` |
| Token / 控件 CSS | `app/globals.css` |
| 文件 + 语言标 | `src/components/ui/FileFormatIcon.tsx` |
| 检查标记 | `src/components/Workbench/inspectionMarks.tsx` |
| 空态 CTA | `src/components/Ingest/DragZone.tsx` |
| 闲置 shadcn（已删） | ~~`ui/button|badge|card.tsx`~~ · SHELL-006 Submitted |
