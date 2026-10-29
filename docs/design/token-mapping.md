# 旧 token → paper-tokens 映射

> 目的：接线时在 `globals.css` 里把旧变量改成别名（`--v4-text: var(--ink-strong);`），615 处 `var(--v4-*)` 和 51 处 `var(--v5-*)` 的 TSX 不用改。
> 本文件只是计划；现在还没有改 `globals.css`。次数 = `src/` 中 `var(--x` 出现次数（2026-10-29，`origin/cf-pages-hosted` @ 7e97d3f）。
> 对比度：旧值按奶油 `#F5F1EA` 计算，新值见 `contrast.py`。
> 标记：✅ 直接别名 · ⚠️ 别名可用但语义/外观会变，需要目测 · ❌ 没有对等项（缺口）

## 1. 表面

| 旧变量 | 次数 | 旧值 | 新 token | 备注 |
|---|---|---|---|---|
| `--v4-canvas` / `--v5-canvas` | 6 / 1 | `#F5F1EA` | `--paper-desk` | ✅ |
| `--v4-canvas-raised` / `--v5-canvas-raised` | 3 / 3 | `#FFFCF7` | `--paper-sheet` | ✅ |
| `--v4-panel` / `--v5-panel` | 23 / 29 | `#FFFCF7` | `--paper-sheet` | ✅ |
| `--v4-panel-raised` / `--v5-panel-raised` | 20 / 7 | `#FFFFFF` | `--paper-raised` | ✅ 纯白改为暖白 |
| `--v4-panel-muted` / `--v5-panel-muted` | 51 / 9 | `#EFEBE3` | `--paper-sunken` | ✅ |
| `--v5-cream` | 61 | `#F5F1EA` | 底色→`--paper-desk`；深底上的字→`--ink-strong`（在 chrome/theater 作用域内） | ⚠️ 一名两用：15 处 background、10 处 color/text-。别名只能选一个；建议别名到 `--paper-desk`，再逐个把“深底上的奶油字”改成 `--ink-strong` + `data-paper` |
| `--v4-desk-glow` / `--v5-desk-glow` | 2 / 1 | 绿 6% | — | ❌ 光晕不再使用 → `transparent` |
| `--v4-desk-veil` / `--v5-desk-veil` | 0 / 1 | 165° 线性渐变 | `--paper-desk`（纯色） | ❌ 渐变去掉 |

## 2. 文字

| 旧变量 | 次数 | 旧值（对比） | 新 token | 备注 |
|---|---|---|---|---|
| `--v4-text` / `--v5-text` | 97 / 1 | 墨绿 `#1A3D37`（10.56） | `--ink-strong` | ⚠️ 字从绿变暖黑（决策：文字≠绿色） |
| `--v4-text-muted` / `--v5-text-muted` | 119 / 17 | 绿 80%（5.98） | `--ink-muted` | ✅ |
| `--v4-text-faint` / `--v5-text-faint` | 65 / 1 | 绿 58%（**3.29，不达标**） | `--ink-muted` | ⚠️ 旧 faint 被当正文用 65 次，映射到 `--ink-faint` 会继续不达标；先并入 muted，之后按需把纯装饰用法改 `--ink-faint` |
| `--surface-text` | 6 | = v5-text | `--ink-strong` | ✅ |
| `--surface-text-muted` | 4 | | `--ink-muted` | ✅ |
| `--surface-text-faint` | 4 | | `--ink-muted` | ⚠️ 同上 |
| `--v5-green` | 70 | `#1A3D37` | 字/边→`--ink-strong`；底→`--chrome-bg` | ⚠️ 一名两用：17 color + 3 text- + 若干 border vs 9 background。**最大的缺口**：别名只能二选一。建议别名到 `--ink-strong`，9 处底色手改为 `--chrome-bg` + `data-paper="chrome"` |

## 3. 线

| 旧变量 | 次数 | 旧值 | 新 token | 备注 |
|---|---|---|---|---|
| `--v4-line` / `--v5-line` | 101 / 8 | 绿 12% | `--rule-hair` | ✅ |
| `--v4-line-strong` / `--v5-line-strong` | 41 / 10 | 绿 22% | `--rule-strong` | ⚠️ 输入框、次按钮这类控件边界应改用 `--rule-control`（≥3:1）；旧值 1.49:1 |
| `--surface-line` / `--surface-line-strong` | 15 / 7 | | `--rule-hair` / `--rule-strong` | ✅ |

## 4. 强调与状态

| 旧变量 | 次数 | 旧值（对比） | 新 token | 备注 |
|---|---|---|---|---|
| `--v4-accent` / `--v5-accent` | 79 / 12 | 橘 `#EF8D5F`（2.16） | `--accent` | ⚠️ 橘→酒红，主要用于 border（41）/ 底（15）/ ring；整体变深，需目测 |
| `--v5-orange` | 90 | `#EF8D5F` | `--accent` | ⚠️ 同上；13 border-color、10 box-shadow（多半是发光，见 §6） |
| `--v4-accent-strong` / `--v5-accent-strong` | 77 / 9 | `#E07845`（**2.69**） | `--accent-text` | ⚠️ 64 处当文字用，旧值不达标；新值 9.33 |
| `--v5-orange-deep` | 2 | `#E07845` | `--accent-press` | ✅ |
| `--v5-orange-strong` | 6 | `#F0A07A`（深色表面上的强调） | `--accent-text`（在 chrome/theater 作用域内自动提亮） | ⚠️ 需要容器加 `data-paper` |
| `--v4-accent-soft` / `--v5-accent-soft` | 57 / 6 | 橘 16% | `--accent-soft` | ✅ 新为 10% |
| `--v4-accent-ink` / `--v5-accent-ink` | 16 / 1 | `#FFFFFF`（橘底上 **2.43**） | `--accent-ink` | ✅ 新为 9.48 |
| `--v4-on-accent` | 1 | **未定义**（回退 `#fff`） | `--accent-ink` | ❌ 旧代码引用了不存在的变量，接线时一并修 |
| `--v4-danger` / `--v5-danger` | 41 / 6 | `#C45B55`（3.75） | `--state-danger` | ✅ 新 5.79，和酒红分开 |
| `--v4-warning` / `--v5-warning` | 21 / 9 | `#C4893A`（**2.67**） | `--state-warning` | ✅ 新 5.53 |
| — | — | — | `--state-success` / `--state-info` | 新增；现有 success 散落为 `--wb-done #2F6B44` 等硬编码 |

## 5. 墨绿托盘（tray）与局部深色表面

| 旧 | 次数 | 新 | 备注 |
|---|---|---|---|
| `[data-surface="forest"]` 作用域 | — | `[data-paper="chrome"]` | ⚠️ 接线时可在 paper-tokens 里把旧选择器并列，或逐个改属性 |
| `[data-surface="theater"]`, `.lights-off-stage` | — | `[data-paper="theater"]` | 同上 |
| forest `--v4-canvas-raised: #214942` | — | `--chrome-bg-raised #28463E` | ✅ |
| forest 半透明面板（奶油 5–10%） | — | `--paper-raised`/`--paper-sunken` 实色 | ⚠️ 半透明改实色，叠在视频上时需目测 |
| `--tray-ink` / `-soft` / `-muted` / `-faint` | 4/2/1/1 | `--ink-strong` / `--ink-body` / `--ink-muted` / `--ink-faint`（chrome 作用域） | ✅ |
| `--tray-line` / `-soft` / `-strong` | 2/1/1 | `--rule-hair` / `--rule-hair` / `--rule-strong` | ✅ |
| `--tray-fill` / `-soft` / `-hover` | 1/2/1 | `--paper-raised` / `--paper-sunken` / `--paper-raised` | ⚠️ 透明叠加 → 实色 |
| `--tray-h` | 10 | — | 布局尺寸，不属于本层，保留 |
| 托盘“当前步骤”橘色填充 | — | `--chrome-active-bg` + `--chrome-active-ink` | ⚠️ 视觉变化：奶油纸片代替橘块 |

## 6. 圆角、阴影、光晕

| 旧变量 | 次数 | 旧值 | 新 token | 备注 |
|---|---|---|---|---|
| `--radius-xs` | 4 | 2 | `--pt-radius-xs` 2 | ✅ |
| `--radius-sm` | 4 | 6 | `--pt-radius-md` 6 | ⚠️ 名字错位（旧 sm=6 ↔ 新 md=6） |
| `--radius-md` | 20 | 8 | `--pt-radius-lg` 8 | ⚠️ 名字错位；若用在按钮上应改为 `--pt-radius-md` 6 |
| `--radius-lg` / `--v5-radius-control` | 7 / — | 12 | `--pt-radius-md` 6 | ⚠️ 控件从 12 收到 6（“软化”是对营销页直角而言，工具里 12 偏圆） |
| `--radius-xl` / `--v5-radius-panel` | 9 / — | 20 | `--pt-radius-lg` 8（面板）/ `--pt-radius-xl` 12（对话框） | ⚠️ 20px 大圆角取消 |
| `--radius-pill` | 11 | 999 | `--pt-radius-pill` | ⚠️ 只保留开关/进度点；按钮上的 pill 改 `--pt-radius-md` |
| `--elevation-0` | 2 | 1px 底线阴影 | `--pt-elev-none` + 1px `--rule-hair` 边 | ⚠️ 阴影改边框 |
| `--elevation-1` | 1 | 0 8 24 绿10% | `--pt-elev-none`（页面内）/ `--pt-elev-float`（浮层） | ⚠️ 视用途 |
| `--elevation-2` | 7 | 0 16 40 绿14% | `--pt-elev-float` | ✅ 多为菜单/popover |
| `--elevation-3` | 1 | 0 24 64 绿18% | `--pt-elev-modal` | ✅ |
| `--elevation-1/2/3-dim` | 3/1/4 | 深色表面版 | theater 作用域内的 `--pt-elev-float` / `--pt-elev-modal` | ✅ 自动切换 |
| `--glow-accent` | 3 | 0 0 12 橘22% | — | ❌ 光晕取消 → `none`；选中改 `--accent-line` 1px 边或 `--accent-soft` 底 |
| `--glow-cta` | 3 | 0 8 20 橘25% | — | ❌ CTA 投影取消 → `none` |
| `box-shadow: … var(--v5-orange/--v4-accent)` | 10 / 5 | 彩色光圈/焦点 | `outline: var(--focus-ring)`（焦点）或 `--accent-line`（选中） | ⚠️ 需逐处判断 |

## 7. 动效

| 旧变量 | 次数 | 旧值 | 新 token | 备注 |
|---|---|---|---|---|
| `--v4-ease` / `--v5-ease` | 23 / 14 | cubic-bezier(0.16,1,0.3,1) | `--motion-ease-out` cubic-bezier(0.2,0,0,1) | ✅ 曲线略收，少一点“弹出”感 |
| `--v4-dur-fast` / `--v5-dur-fast` | 17 / 4 | 160ms | `--motion-fast` 150ms | ✅ |
| `--v4-dur` / `--v5-dur` | 5 / 2 | 240ms | `--motion-base` 200ms | ✅ |
| `--v4-dur-slow` / `--v5-dur-slow` | 1 / 2 | 420ms | `--motion-slow` 250ms | ⚠️ 超出 Operate 上限，收短 |

## 8. 其他已有 token 层（本次不映射）

- `--type-*`（13/15/16/18/24）→ 对应 `--pt-size-meta/control/body/title/display`，数值相同，接线时可别名。
- `--space-1…7`（4…48）→ `--pt-space-1…7`，数值相同。
- `ds.css` 的 `--ds-*`（字号 20/16/14/13/12、控件 36/32/28、`--ds-ink` 系）→ 可一一别名到 `--pt-size-*` / `--pt-control-h*` / `--ink-*`。
- Tailwind `@theme` 的 `--font-sans/-mono/-serif` → 见 DESIGN.md §4（字体栈顺序有一处待确认的改动）。
- **不迁移**：`--lang-*`、`--fmt-*`（字幕身份色）、烧录/字幕样式里的 hex。
- **待定**：`workbench-b7.css` 的 `--wb-cat-*`（review #B8433C、structure #7A5E8E、screen #1F7F78、credit #A3700C、sound #52708C）与 `--wb-done #2F6B44`。`--wb-cat-review` 与新酒红、朱红都接近，接线前要单独排一次。

## 缺口汇总

1. `--v5-green`（70）与 `--v5-cream`（61）一名两用（字 vs 底），别名只能选一边，约 25 处需要手改。
2. `--v4-text-faint`（65）旧值 3.29:1 不达标，新方案并入 `--ink-muted`，少一档灰。
3. 光晕/渐变（`--glow-*`、`--desk-glow`、`--desk-veil`、彩色 box-shadow）没有对等项，设计上取消。
4. `--v4-on-accent` 未定义（现有 bug）。
5. 圆角名字错位（旧 sm/md/lg/xl = 6/8/12/20，新 sm/md/lg/xl = 4/6/8/12），按名字别名会让所有圆角都变小一档以上，需要按用途对。
6. tray/forest 的半透明叠加改为实色；`[data-surface]` → `[data-paper]` 选择器需要接线。
7. `--wb-cat-*` 分类色未纳入，`--wb-cat-review` 与强调/危险色相近。
