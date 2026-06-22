# 上线安全清单

## 已在代码中启用

- TMDB Key 仅从 Cloudflare Pages 的 `TMDB_API_KEY` Secret 读取，客户端不接触密钥。
- `/api/tmdb/*` 仅允许应用实际使用的检索、详情和图片端点；路径与参数均经过校验。
- 代理在单个运行实例内限制突发请求，并为可缓存的 TMDB 数据返回缓存策略。
- 静态资源通过 `public/_headers` 增加防嗅探、防嵌入、引用来源和浏览器权限限制。
- 导入仅在浏览器本地进行；单文件、批次、ZIP 条目和解压总量均有限制，避免异常文件耗尽浏览器内存。

## Cloudflare Pages 上线前手动配置

1. 将 `TMDB_API_KEY` 只配置为 Production / Preview 的 Secret，不要提交到仓库、`wrangler.toml` 或客户端环境变量。
2. 在 Security > WAF > Rate limiting rules 创建规则：匹配 `/api/tmdb/*`，按 IP 在 60 秒内限制 30 次请求；先使用 Managed Challenge，确认没有误伤后再决定是否改为 Block。
3. 在 Workers & Pages > 项目 > Metrics 中按需启用 Web Analytics；上线后先观察一周的 API 请求量、限流命中与错误比例，再调整阈值。
4. 若以后加 Turnstile，必须由服务端验证 Siteverify Token。仅放客户端组件并不能防滥用。

## 运营边界

- 不记录字幕正文、文件名或用户选择的本地片源路径到日志与分析系统。
- 用户应确认自己对导入、编辑和导出的字幕及媒体文件拥有合法使用权；本站不托管或分发字幕资源。
- TMDB 的标识和声明应保留在产品的“关于与隐私”页面中。
