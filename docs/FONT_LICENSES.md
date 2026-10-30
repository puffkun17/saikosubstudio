# 字体来源与许可

所有字体都自托管在 `public/fonts/`，由各页面 HTML（`index.html`、`about/index.html`、`feedback/index.html`）用 `<link rel="stylesheet">` 引入；CSP `font-src` 只有 `'self'`，不用任何第三方 CDN。字体栈定义在 `src/styles/paper-tokens.css`（`--pt-font-ui` / `--pt-font-mono` / `--pt-font-title`），规则见根目录 `DESIGN.md` §4。

## Geist Sans / Geist Mono（界面与时间码）

- 站点文件：`public/fonts/geist/Geist-Variable.woff2`、`GeistMono-Variable.woff2`（可变字重 100–900），`@font-face` 在 `public/fonts/geist/geist.css`
- 用途：Geist Sans 用于界面和字幕正文（中文回退 PingFang SC / 微软雅黑）；Geist Mono 只用于时间码和数值
- 来源：https://github.com/vercel/geist-font
- 许可证：SIL Open Font License 1.1，全文见 `public/fonts/geist/OFL.txt`（Copyright 2024 The Geist Project Authors）

## Noto Serif SC / 思源宋体（片名衬线字体）

- 站点文件：`public/fonts/noto-serif-sc/`（500、700 两个字重，拉丁与简体中文子集，WOFF2）
- 引入方式：各页面 HTML 的 `<link rel="stylesheet" href="/fonts/noto-serif-sc/noto-serif-sc.css">`（不走 CSS `@import`，避免打包器去解析 `public/` 下的路径）
- 用途：只用于片名（`--pt-font-title`），不用于正文或按钮
- 许可证：SIL Open Font License 1.1，说明见 `public/fonts/noto-serif-sc/README.md`

## 已移除：Source Han Sans / 思源黑体

此前随站点分发的 `public/fonts/SourceHanSansCN-VF.woff2`（约 8 MB）及其许可证副本没有被任何样式或代码引用，已于 2026-10-10 移除。正文使用系统黑体（PingFang / 微软雅黑 → Geist Sans）。
