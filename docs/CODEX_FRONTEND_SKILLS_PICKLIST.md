# Codex / ChatGPT 前端 & UI 逻辑 Skills 挑选清单

> 面向：**Codex（含 ChatGPT App 合并后的 Skills 生态）**  
> 用途：挑选可安装的前端审美 skill、UI 逻辑 skill  
> 信息源：公开网络检索（2026 年资料为主），**不是**本机 skill 目录整理  
> 整理日期：2026-07-16

---

## 1. 安装与使用（通用）

当前主流安装方式（兼容 Codex / Cursor / Claude Code 等）：

```bash
# 通用（Vercel skills CLI）
npx skills add <owner/repo>
npx skills add <owner/repo> --skill "<install-name>"

# 也可把 SKILL.md 复制进项目 / 粘贴进 ChatGPT·Codex 对话
```

Codex 官方 curated skills 还可用应用内 `$skill-installer`（见 [openai/skills](https://github.com/openai/skills)）。

**注意：**

- 官方 `frontend-skill` 路径曾出现变更/下架讨论；安装前以 [OpenAI 博客原文](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4) 与 [openai/skills](https://github.com/openai/skills) 当前树为准。
- 社区 skill 质量参差：优先 **有明确 SKILL.md、可审计、可单独安装** 的包。
- **不要一次装一堆审美 skill**——它们会互相打架（有的禁卡片，有的爱 bento；有的推高饱和 motion，有的要求极简）。

---

## 2. 候选 Skill 目录（按类型）

### A. 官方 / 准官方「审美与构图」

| # | Skill | 来源 | 类型 | 一句话 | 安装线索 | 适合 |
|---|--------|------|------|--------|----------|------|
| A1 | **frontend-skill** | OpenAI 官方（GPT-5.4 前端指南配套） | 审美 + 构图 | 强调构图、全出血 hero、少卡片、品牌优先、克制 motion | 博客内嵌全文；历史上经 `$skill-installer frontend-skill` / openai/skills curated | 营销页、demo、需要「不像模板」的落地页 |
| A2 | **Playwright / browser verify** | OpenAI 推荐配套 | **UI 逻辑验证** | 渲染后多视口检查、流程点击、视觉对照 | openai/skills 中 playwright 等 | **任何产品 UI**：比纯审美更关键 |

参考：[Designing delightful frontends with GPT-5.4](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)

**官方前端 skill 的核心逻辑（摘录语义）：**

- 先写 visual thesis / content plan / interaction thesis  
- 首屏是一张「海报」不是 dashboard  
- 默认少卡片；每区一件事  
- 2 字体上限、默认 1 个 accent  
- motion 用来建立层级，不是噪声  
- **若已有设计系统，优先保留现有语言**（这对 SaikoSubStudio 很关键）

---

### B. Anti-slop 审美框架（社区最热）

| # | Skill | 来源 | 类型 | 一句话 | 安装线索 | 适合 |
|---|--------|------|------|--------|----------|------|
| B1 | **design-taste-frontend** (taste-skill v2) | [Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) · [tasteskill.dev](https://www.tasteskill.dev/) | 审美总控 | 先读 brief，再设 VARIANCE/MOTION/DENSITY 三旋钮；反 AI 默认审美 | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | 新页面、重设计探索 |
| B2 | **gpt-taste** | 同上 repo | 审美（Codex 特化） | 给 GPT/Codex 更严的 layout variance + motion 约束 | `--skill "gpt-taste"` | **优先试这个**，若你主要用 Codex |
| B3 | **design-taste-frontend-v1** | 同上 | 审美（旧版 pin） | v1 行为冻结 | `--skill "design-taste-frontend-v1"` | v2 改坏现有流程时回退 |
| B4 | **image-to-code** | 同上 | 流程：图 → 分析 → 码 | 先生图再实现，贴近 ChatGPT Images + Codex 新链路 | `--skill "image-to-code"` | 想用「视觉定稿再写码」 |
| B5 | **redesign-existing-projects** | 同上 | 审计 + 改版 | 先 audit 再改，不适合从零乱喷样式 | `--skill "redesign-existing-projects"` | **已有产品迭代（v4 工作台）** |
| B6 | **high-end-visual-design** (soft-skill) | 同上 | 风格包 | 柔、贵、留白、低对比 | `--skill "high-end-visual-design"` | 静奢 / 高价感，非工具台 |
| B7 | **minimalist-ui** | 同上 | 风格包 | Linear/Notion 式克制 | `--skill "minimalist-ui"` | 编辑台、工具 UI 较接近 |
| B8 | **industrial-brutalist-ui** | 同上 | 风格包 | 瑞士排版、硬对比 | 见 repo | 实验页；**不适合**阅片工具主流程 |
| B9 | **imagegen-frontend-web / mobile / brandkit** | 同上 | 只出图 | 给 Images 用的构图纪律 | 同 repo | 先 moodboard，再交给实现 agent |

Stars 量级参考：taste-skill 公开页约 **6 万+ star**（以 GitHub 页面为准，会变动）。

---

### C. 设计工程 / UI 逻辑 / 审计（比「好看」更重要）

| # | Skill | 来源 | 类型 | 一句话 | 安装线索 | 适合 |
|---|--------|------|------|--------|----------|------|
| C1 | **web-design-guidelines** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | **UI 审核** | 对照 Web Interface Guidelines：a11y、focus、UX 等 100+ 规则 | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines` | **PR 前 UI review** |
| C2 | **building-components** | Vercel components.build | 组件逻辑 | 可访问、可组合 API、主题 | 见 [Vercel Agent Skills 文档](https://vercel.com/docs/agent-resources/skills) | 抽组件、修 shadcn 用法 |
| C3 | **baseline-ui** | [ui-skills.com](https://www.ui-skills.com/) / ibelick | 快修 | 间距、层级、字体、小布局 deslop | `npx ui-skills start` 路由 | 现有页「擦灰」 |
| C4 | **fixing-accessibility** | ui-skills 合集 | a11y 逻辑 | ARIA、键盘、焦点、对比度、表单错误 | 同上 | 导入/工作台表单密集区 |
| C5 | **fixing-motion-performance** | 同上 | 动效逻辑 | 避免 layout thrash、错误 blur、滚动绑定卡顿 | 同上 | Framer Motion 过重时 |
| C6 | **emil-design-eng** | Emil Kowalski 路线（animations.dev 生态） | 工艺 | 微交互、组件 polish、生产级 craft | ui-skills 目录 | 动效质量门槛 |
| C7 | **make-interfaces-feel-better** | ui-skills 合集 | 手感 | 微交互、字体、细节 | 同上 | 「能用但发木」时 |
| C8 | **shadcn** (project-aware) | shadcn-ui 生态 skill | 组件逻辑 | 按项目正确 add/compose/fix | 见 ui-skills / shadcn 文档 | 你栈里有 shadcn 时 |
| C9 | **react-doctor** | Million 生态 | 正确性 | 安全/性能/架构回归检测 | ui-skills | 大改 UI 后体检 |
| C10 | **wcag-audit-patterns** | wshobson 等 | 合规审计 | WCAG 2.2 流程化 | ui-skills | 对外/无障碍要求时 |

入口导航站：[UI Skills](https://www.ui-skills.com/) · 生态目录：[skills.sh](https://skills.sh) · [vercel-labs/skills CLI](https://github.com/vercel-labs/skills)

---

### D. 大型「设计智能库」（样式字典型）

| # | Skill | 来源 | 类型 | 一句话 | 安装线索 | 适合 |
|---|--------|------|------|--------|----------|------|
| D1 | **ui-ux-pro-max** | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 风格/色板/字体/栈库 | 可检索大量 style、palette、font pairing、UX 规则、多技术栈 | `npx skills add` / 站点 uupm；支持 Codex | **需要灵感菜单**时；别当唯一真理 |
| D2 | **interface-design** | Dammyjay93 等（ui-skills 收录） | Dashboard/SaaS 专精 | 后台/SaaS 一致性 | ui-skills | 工作台密集信息 |
| D3 | **impeccable** | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 旗舰工艺 + 命令集 | 1 skill + 多 command（polish/audit…），反 AI 模板痕迹；可配合 PRODUCT.md / DESIGN.md | 见 impeccable.style / repo | 想要「可调用的设计命令面板」 |
| D4 | **frontend-design** (Anthropic 系) | anthropics/skills 或经 Vercel 镜像 | 经典 anti-slop | 社区最常被引用的「别做成 AI 默认站」 | Composio 示例：`npx skills add vercel-labs/agent-skills --skill frontend-design`（以仓库实际名为准） | 通用起手；与 OpenAI 官方稿互补 |

参考综述：[Composio Top 10 Codex Skills 2026](https://composio.dev/content/top-codex-skills)

---

### E. 产品 / 动线 / 需求逻辑（UI「为什么这样」）

| # | Skill | 来源 | 类型 | 一句话 | 安装线索 | 适合 |
|---|--------|------|------|--------|----------|------|
| E1 | **grill-me** | [mattpocock/skills](https://github.com/mattpocock/skills) | **需求澄清** | 一次一问，逼出真实目标 | `npx skills add mattpocock/skills --skill grill-me` | 大改 UI 前防跑偏 |
| E2 | **handoff** | 同上 | 上下文交接 | 会话压缩成文档再开新窗 | `--skill handoff` | 长 UI 迭代 |
| E3 | **product-design**（Vercel 内部范式公开文章） | [Teaching agents product design](https://vercel.com/blog/teaching-agents-product-design-at-vercel) | 产品判断路由 | 按场景加载 judgment / copy / guidelines / resilience | 理念可自建；非开箱即用单一包 | 你要「导入交接 vs 阅片」这类判断时 **最该抄的结构** |
| E4 | **output-skill / full-output-enforcement** | taste-skill repo | 执行纪律 | 禁止半截输出、假 TODO | taste-skill `--skill` 见 README | 模型爱截断长 TSX 时 |

---

### F. 图像 / 演示（辅助前端，不是主 UI）

| # | Skill | 用途 | 何时要 |
|---|--------|------|--------|
| F1 | imagegen-frontend-web | 网站参考图 | 先定「阅片台」气质再写码 |
| F2 | frontend-slides | 动画 HTML 幻灯 | 对内设计评审 |
| F3 | remotion | 代码驱动视频 | 宣传片；与产品 UI 无关 |

---

## 3. 怎么选：决策树（给 Codex 用）

```
任务类型？
├─ 全新落地页 / 宣传 / 活动页
│   → B2 gpt-taste 或 B1 taste v2
│   → 可选 A1 OpenAI frontend-skill 原则作硬约束
│   → 可选 B4 image-to-code（有 Images）
│
├─ 已有产品 UI 迭代（SaikoSubStudio 主战场）
│   → B5 redesign-existing-projects
│   → C1 web-design-guidelines（审）
│   → C3 baseline-ui / C4 a11y（修）
│   → C5 motion-performance（若动效脏）
│   → 可选 D3 impeccable polish/audit
│   → ❌ 不要开 brutalist / 高 VARIANCE 营销默认
│
├─ Dashboard / 工作台信息密度
│   → D2 interface-design 或 B7 minimalist-ui
│   → C8 shadcn + C2 building-components
│   → D1 ui-ux-pro-max 仅作「查字典」
│
├─ 组件库 / 可访问性 / 焦点陷阱
│   → C1 + C4 + C8
│
└─ 需求还没定清
    → E1 grill-me → 再选审美 skill
```

---

## 4. 针对 SaikoSubStudio 的适配意见（审美 + 创造性）

### 4.1 你的产品真实动线（skill 必须服从这个）

```
上传（导入交接台）→ 工作台 → 放映厅（阅片环境兑现）
```

因此：

| 页面 | 审美目标 | Skill 该助长什么 | Skill 不该助长什么 |
|------|----------|------------------|-------------------|
| 导入 | 交接台、开工仪式 | 清晰入口、状态可信、少装饰 | 影院大门、营销 hero、全出血海报 |
| 工作台 | 深蓝灰编辑台、信息优先级 | 密度控制、时间轴对齐、可扫描 | bento 炫技、卡片套卡片 |
| 放映厅 | 家庭观影 / 阅片真实感 | 画幅、电视框、字幕可读 | 通用 SaaS 仪表盘感 |
| 信息页 | 克制说明 | 排版层级、a11y | 渐变紫、Inter 默认站 |

**术语硬规则（继续执行）：** 用「阅片环境 / 家庭观影」，不用「电影感」当目标。

### 4.2 对主流 skill 的「创造性评分」（主观，供挑选）

| Skill | 创意分 | 产品契合 | 风险 | 评语 |
|-------|--------|----------|------|------|
| **gpt-taste / taste v2** | ★★★★★ | ★★★ | 高 VARIANCE 会毁工具台 | 探索页强；主 App 用时 **手动把 MOTION/VARIANCE 拧低** |
| **OpenAI frontend-skill 原则** | ★★★★ | ★★★ | 「禁卡片 / 全出血」过猛 | 当 **审查清单** 用，别当工作台生成器 |
| **redesign-existing-projects** | ★★★ | ★★★★★ | 低 | **v4 迭代首选审美 skill** |
| **minimalist-ui / soft-skill** | ★★★★ | ★★★★ | soft 可能太「贵妇官网」 | minimalist 更贴编辑台 |
| **ui-ux-pro-max** | ★★★★ | ★★ | 风格菜单诱发乱换皮 | 只在「缺方向」时查库，定稿后关掉 |
| **web-design-guidelines** | ★★ | ★★★★★ | 几乎无 | **必装逻辑层**，不负责好看 |
| **baseline-ui + a11y + motion-perf** | ★★ | ★★★★★ | 低 | 每周 polish 套装 |
| **impeccable** | ★★★★★ | ★★★★ | 命令多，学习成本 | 想把设计流程「工具化」时上 |
| **image-to-code** | ★★★★★ | ★★★ | 易漂成营销站 | 仅限放映厅/品牌素材，不拿它重做导入清单 |
| **brutalist** | ★★★★ | ★ | 高 | 娱乐向，别碰主流程 |
| **grill-me** | ★★ | ★★★★★ | 无 | 动线/仪式感争论时先装 |

### 4.3 我建议你「先装这 5 个」（精简套餐）

面向 **Codex + SaikoSubStudio v4**，不是通用 landing 工厂：

1. **web-design-guidelines**（Vercel）— UI 逻辑与 a11y 底线  
2. **redesign-existing-projects** 或 **baseline-ui** — 在现有 v4 上改，不推倒  
3. **gpt-taste**（仅在明确「探索视觉」会话启用）— Codex 向 anti-slop  
4. **fixing-accessibility** + **fixing-motion-performance**（按需）— 导入/时间轴/预览  
5. **grill-me** — 大改前锁需求（导入交接 vs 阅片入口这种题已验证有用）

**可选加强：**

- 要命令式 polish：`impeccable`  
- 要色板/字体字典：`ui-ux-pro-max`（当百科，不当默认人格）  
- 要视觉先行：`imagegen-frontend-web` + `image-to-code`（只服务放映厅/品牌）

**明确不建议当默认人格：**

- 纯营销 `frontend-skill` 全套硬规则（会逼你做 hero 海报站）  
- brutalist / 过高 MOTION 预设  
- 多个 anti-slop skill 同时常驻（taste + impeccable + anthropic frontend-design 叠三层 = 风格精神分裂）

### 4.4 创造性方向（不是 skill 名，是你让 skill 服从的 brief）

给 Codex 时，建议固定一段 **项目 brief**（比再装 3 个 skill 更有效）：

```text
产品：SaikoSubStudio v4 — 本地双语字幕整理与阅片预览工具。
动线：导入交接台 → 工作台 → 放映厅（阅片环境兑现点）。
视觉：深蓝灰编辑台；暗场；思源黑体 VF + 克制 mono；薄荷/雾蓝点缀，非紫粉渐变。
原则：状态变化传达信息；motion 仅服务反馈；禁止 SaaS 虚线上传框与影院门隐喻抢放映厅。
约束：保守改动；不暴露算法参数；保留本地处理叙事；先复现再改善。
```

**创造性加分项（可写进自建 skill）：**

- **导入仪式** = 拖入接收 → 解析接手 → 就绪，而不是装饰扫描线  
- **统一时间轴**（字幕/片源/拨盘同一刻度）是「工具美」，比玻璃拟态更高级  
- **ASS 源样式预览 + 手动采用** = 信任与克制（比自动套皮更有专业气质）  
- 放映厅才允许「环境光 / 画幅 / 电视框」叙事升维  

---

## 5. 推荐「会话级」组合（复制即用）

### 组合 α — 只打磨现有 v4 UI

```
skills: redesign-existing-projects + web-design-guidelines + baseline-ui
prompt: 在现有 token 与组件上收敛，不引入新设计语言；保留深蓝灰编辑台。
```

### 组合 β — 导入页动线 / 信息架构

```
skills: grill-me →（确认后）baseline-ui + fixing-accessibility
prompt: 导入是交接台不是阅片入口；右下文件/文件夹；拖入才薄荷反馈。
```

### 组合 γ — 放映厅观感升级

```
skills: soft-skill 或 gpt-taste（MOTION 中低）+ imagegen-frontend-web（可选）
prompt: 家庭观影模拟；字幕可读优先；禁止营销 hero 模板。
```

### 组合 δ — 发版前质量闸

```
skills: web-design-guidelines + fixing-accessibility + fixing-motion-performance + react-doctor
prompt: 只报问题与最小修复；不扩大视觉改版面。
```

---

## 6. 快速安装命令备忘（以官方 README 为准，可能变更）

```bash
# Taste 全家桶入口
npx skills add https://github.com/Leonxlnx/taste-skill
npx skills add https://github.com/Leonxlnx/taste-skill --skill "gpt-taste"
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
npx skills add https://github.com/Leonxlnx/taste-skill --skill "redesign-existing-projects"

# Vercel 审核 / 组件
npx skills add vercel-labs/agent-skills --skill web-design-guidelines

# UI Skills 路由（让 agent 先选对子 skill）
npx ui-skills start

# UI/UX Pro Max
# 见 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

# Matt Pocock
npx skills add mattpocock/skills --skill grill-me
npx skills add mattpocock/skills --skill handoff
```

OpenAI 官方前端原则全文见：  
https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4  

---

## 7. 挑选勾选表（你直接打勾）

**审美层（最多勾 1–2 个常驻）**

- [ ] gpt-taste  
- [ ] design-taste-frontend (v2)  
- [ ] redesign-existing-projects  
- [ ] minimalist-ui  
- [ ] soft-skill / high-end-visual-design  
- [ ] impeccable  
- [ ] ui-ux-pro-max（仅字典）  
- [ ] OpenAI frontend-skill 原则（文档级约束，可不装包）  

**逻辑 / 质量层（可多选）**

- [ ] web-design-guidelines  
- [ ] baseline-ui  
- [ ] fixing-accessibility  
- [ ] fixing-motion-performance  
- [ ] building-components / shadcn  
- [ ] react-doctor  
- [ ] Playwright 类 browser verify  

**流程层**

- [ ] grill-me  
- [ ] handoff  
- [ ] image-to-code  
- [ ] imagegen-frontend-web  

---

## 8. 结语（我的总建议）

1. **逻辑 skill > 审美 skill**。对工具产品，a11y / focus / 状态完整 / 时间轴一致，比「再潮一点」更能提升专业感。  
2. **审美 skill 用会话级启用**，不要全局常驻多个 anti-slop。  
3. **v4 主路径：redesign + guidelines + 你自己的「阅片/交接」brief**；marketing 向 frontend-skill 只借鉴原则。  
4. **创造力放在动线隐喻与反馈诚实**，不是放在装饰层数。  

你勾选第 7 节后，我可以下一步直接：  
- 生成一份 **项目内 `SKILL.md` 定制版（SaikoSubStudio 专用）**，或  
- 按你的勾选写 **Codex 安装脚本 + 会话启动模板**。

---

## 9. 主要网络来源

- OpenAI: [Designing delightful frontends with GPT-5.4](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)  
- Taste Skill: [tasteskill.dev](https://www.tasteskill.dev/) · [GitHub Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)  
- Vercel: [Agent Skills 文档](https://vercel.com/docs/agent-resources/skills) · [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) · [skills ecosystem](https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem) · [product design agents](https://vercel.com/blog/teaching-agents-product-design-at-vercel)  
- UI Skills 导航: [ui-skills.com](https://www.ui-skills.com/)  
- UI UX Pro Max: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)  
- Impeccable: [pbakaus/impeccable](https://github.com/pbakaus/impeccable)  
- 综述: [Composio Top 10 Codex Skills](https://composio.dev/content/top-codex-skills) · [openai/skills catalog](https://github.com/openai/skills)
