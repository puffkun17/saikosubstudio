# 字体来源与许可

## Noto Serif SC / 思源宋体（片名衬线字体）

- 站点文件：`public/fonts/noto-serif-sc/`（500、700 两个字重，拉丁与简体中文子集，WOFF2）
- 引入方式：`app/globals.css` 第一条 `@import`（必须写在 `@import "tailwindcss"` 之前，否则构建时会被丢弃）
- 许可证：SIL Open Font License 1.1，说明见 `public/fonts/noto-serif-sc/README.md`

## 已移除：Source Han Sans / 思源黑体

此前随站点分发的 `public/fonts/SourceHanSansCN-VF.woff2`（约 8 MB）及其许可证副本没有被任何样式或代码引用，已于 2026-10-10 移除。正文使用系统黑体（PingFang / 微软雅黑 → Geist Sans）。
