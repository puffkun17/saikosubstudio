# 卡片内边距审计（v1.2，2026-10-13 HKT）

标准：`--ds-pad-card` 桌面 16 / 手机 12，四边一致（±1px）。
测量方法：对每张卡片（v4-panel、ds-card、ds-well、弹窗、停靠面板头部/列表、导出面板各段、提示条、选项卡片），取其内部文字与控件外框到卡片内边的最小距离（上/右/下/左）。右边距由文字长度决定，不参与判定；下边距只在内容没有滚动时判定。
截图：`pr4-shots/cards/{before,after}/`（红线 = 块间距），卡片顶边 → 「字幕序列」：`pr4-shots/cardtop/`。

## 「字幕序列」卡片顶边 → 标题文字（Derek 指出的那段）
| 层 | 修改前（线上） | 修改后 |
|---|---|---|
| 卡片描边 | 1 | 1 |
| 卡片上内边距 `TaskList.tsx:629` `p-5 md:p-6` | 24 | 16（`--ds-pad-card`，`app/ds.css` `.ds-card`） |
| 标题行高 `TaskList.tsx:676` `text-base`（行高 24，字形上方多出约 2px） | +1 | 0（`.ds-head` 行高 20） |
| 外层 margin / 隐藏元素 / min-height | 0（已逐层确认，无） | 0 |
| **文字盒顶到卡片顶** | **26** | **16（手机 12）** |
没有多余的空元素或 margin，宽的原因就是 24px 的卡片内边距加上 1.5 倍行高。

## 逐卡片结果

### 桌面（标准 16px）

| 卡片 | 画面 | 修改前 padding · 文字到边 上/右/下/左 | 修改后 padding · 上/右/下/左 | 结论 |
|---|---|---|---|---|
| FOOTER «4 条» | 10-history | 8px 16px · 8/16/8/16 | — | — |
| HEADER «历史» | 10-history | 12px 16px · 11/16/13/16 | — | — |
| align-choice__item «智能» | 03-import-pair | 8px 12px · 9/254/9/12 | 16px · 17/228/17/16 | ✓ |
| align-choice__item «精校» | 03-import-pair | 8px 12px · 9/215/9/12 | 16px · 17/176/17/16 | ✓ |
| ds-card.gap-[var(--ds-gap-group)] «熊家餐馆» | 03-import-pair | — | 16px · 15/22/266/16 | ✓ |
| ds-dock__head «剧照» | 06c-dock-backdrop | — | 16px · 16/16/17/16 | ✓ |
| ds-dock__head «导出字幕» | 07-dock-export | — | 16px · 16/16/17/16 | ✓ |
| ds-dock__head «样式参数» | 09-dock-style | — | 16px · 16/16/17/16 | ✓ |
| ds-dock__head «样式预设» | 08-dock-preset | — | 16px · 16/16/17/16 | ✓ |
| ds-dock__head «画幅» | 06b-dock-aspect | — | 16px · 16/16/17/16 | ✓ |
| ds-dock__list «4:3» | 06b-dock-aspect | — | 12px 6px · 12/6/12/6 | 偏差 |
| ds-dock__list «字幕样式» | 08-dock-preset | — | 12px 6px · 11/6/12/6 | 偏差 |
| ds-dock__list «默认背景» | 06c-dock-backdrop | — | 12px 6px · 12/6/12/6 | 偏差 |
| ds-form.bg-[var(--v4-panel-muted)] «制作声明» | 03-import-pair | 12px 16px · 16/434/-12/16 | — | — |
| ds-form.ds-well «制作声明» | 03-import-pair | — | 16px · 20/442/-8/16 | 偏差 |
| ds-well.bg-[var(--v4-panel-muted)] «.ass / .srt» | 03b-import-pair-scrolled | — | 16px · 23/27/21/16 | 偏差 |
| ds-well.gap-[var(--ds-gap-item)] «主字幕» | 03-import-pair | — | 16px · 16/24/18/16 | 偏差 |
| export-menu__body «文件名» | 07-dock-export | — | 16px · 17/16/17/16 | ✓ |
| history-panel.ui-modal «历史» | 10-history | 0px · 11/17/9/16 | 0px · 15/17/17/16 | ✓ |
| p-[var(--ds-pad-card)] «1 条» | 10-history | — | 16px · 16/16/16/16 | ✓ |
| p-[var(--ds-pad-card)] «历史» | 10-history | — | 16px · 15/16/17/16 | ✓ |
| v4-panel «字幕序列» | 03-import-pair | 24px · 25/28/166/24 | — | — |
| v4-panel «时间轴» | 04-workbench | 0px · 8/17/-68/-1 | 0px · 16/17/-100/-1 | 偏差 |
| v4-panel «本地文件处理 / Loc» | 13-about | 24px · 26/37/853/24 | — | — |
| v4-panel «样式参数» | 05-style-drawer | 0px · 22/30/-64/20 | 0px · 18/26/-98/16 | 偏差 |
| v4-panel «概览» | 04-workbench | 0px · 12/21/15/16 | 0px · 20/21/15/16 | 偏差 |
| v4-panel «熊家餐馆» | 03-import-pair | 0px · 0/1/227/0 | 0px · 0/1/266/0 | 偏差 |
| v4-panel.ds-card «字幕序列» | 03-import-pair | — | 16px · 15/20/233/16 | ✓ |
| v4-panel.ds-card «本地文件处理 / Loc» | 13-about | — | 16px · 18/22/604/16 | 偏差 |
| workbench-overview «概览» | 04-workbench | 8px 16px · 12/20/12/16 | — | — |
| workbench-overview.gap-[var(--ds-gap-item)] «概览» | 04-workbench | — | 16px · 20/20/20/16 | 偏差 |

### 手机（标准 12px）

| 卡片 | 画面 | 修改前 padding · 文字到边 上/右/下/左 | 修改后 padding · 上/右/下/左 | 结论 |
|---|---|---|---|---|
| align-choice__item «智能» | 03-import-pair | 8px 12px · 9/15/9/12 | 12px · 13/18/13/12 | ✓ |
| align-choice__item «精校» | 03-import-pair | 8px 12px · 9/15/9/12 | 12px · 13/18/13/12 | ✓ |
| ds-card.gap-[var(--ds-gap-group)] «熊家餐馆» | 03-import-pair | — | 12px · 11/12/12/12 | ✓ |
| ds-dock__head «剧照» | 06c-dock-backdrop | — | 12px · 12/12/13/12 | ✓ |
| ds-dock__head «导出字幕» | 07-dock-export | — | 12px · 12/12/13/12 | ✓ |
| ds-dock__head «样式参数» | 06-preview | — | 12px · 12/12/13/12 | ✓ |
| ds-dock__head «样式预设» | 08-dock-preset | — | 12px · 12/12/13/12 | ✓ |
| ds-dock__head «画幅» | 06b-dock-aspect | — | 12px · 12/12/13/12 | ✓ |
| ds-dock__list «4:3» | 06b-dock-aspect | — | 12px 2px · 12/2/12/2 | 偏差 |
| ds-dock__list «字幕样式» | 08-dock-preset | — | 12px 2px · 11/2/52/2 | 偏差 |
| ds-dock__list «默认背景» | 06c-dock-backdrop | — | 12px 2px · 12/2/12/2 | 偏差 |
| ds-form.bg-[var(--v4-panel-muted)] «制作声明» | 05-style-drawer | 12px 16px · 17/94/262/16 | — | — |
| ds-form.ds-well «制作声明» | 03-import-pair | — | 12px · 17/52/200/12 | 偏差 |
| ds-well.bg-[var(--v4-panel-muted)] «.ass / .srt» | 03b-import-pair-scrolled | — | 12px · 19/23/17/12 | 偏差 |
| ds-well.gap-[var(--ds-gap-item)] «主字幕» | 03-import-pair | — | 12px · 12/-199/14/12 | 偏差 |
| export-menu__body «文件名» | 07-dock-export | — | 12px · 13/12/13/12 | ✓ |
| ui-toast.px-[var(--ds-pad-card)] «新版本可用» | 01-landing | — | 8px 12px · 8/13/9/12 | 偏差 |
| v4-panel «字幕序列» | 05-style-drawer | 20px · 21/-207/523/20 | — | — |
| v4-panel «时间轴» | 04-workbench | — | 0px · 12/13/-87/12 | ✓ |
| v4-panel «本地文件处理 / Loc» | 13-about | 24px · 26/26/1530/24 | — | — |
| v4-panel «样式参数» | 05-style-drawer | — | 0px · 14/12/-83/12 | 偏差 |
| v4-panel «概览» | 04-workbench | — | 0px · 12/21/15/12 | 偏差 |
| v4-panel «熊家餐馆» | 03-import-pair | 0px · 0/13/1/0 | 0px · 0/13/1/0 | 偏差 |
| v4-panel.ds-card «字幕序列» | 03-import-pair | — | 12px · 11/-183/450/12 | ✓ |
| v4-panel.ds-card «本地文件处理 / Loc» | 13-about | — | 12px · 14/12/867/12 | 偏差 |
| workbench-overview.gap-[var(--ds-gap-item)] «概览» | 04-workbench | — | 12px · 12/44/16/12 | 偏差 |

## 仍标为「偏差」的项目及原因
- **ds-dock__list**（画幅/剧照/预设列表）：表中是修正前的测量值。之后已改为整行列表：行左右内边距 = token，所以文字在 16/12 处；按钮的点击区域贴边。
- **ds-form.ds-well**（属性信息）：控件在 16 处；左列标签有 `padding-top: 6px`，用来与 32px 控件垂直居中，所以标签文字在 20 处。
- **导出选项底板**（.ass / .srt）：输入框外框在 16 处；23 是框内文字的位置。
- **字幕序列底板**：下边 18，最后一行的行高带了 2px。
- **v4-panel 外壳**（影片卡、概览、时间轴、样式参数）：这些外壳本身 padding 为 0，内容由内层的 ds-card / 头部负责，以内层的测量为准。
- **关于页卡片**：标题文字 18（行高 1.25 下 CJK 字形高出 2px）。
- **提示条「新版本可用」**：内含 32px 的「刷新」按钮，上下改为 8（item），左右为 token。
