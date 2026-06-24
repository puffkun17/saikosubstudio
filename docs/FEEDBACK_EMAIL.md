# 反馈邮件投递

反馈页只会提交用户主动填写的反馈类型与文字正文。不会读取或发送字幕内容、文件名、本地路径或浏览器诊断信息。

## Cloudflare 配置

1. 在 Email Service 中为 `feedback@dualsubs.quest` 保留已启用的邮件路由。
2. 在 Worker `saikosubstudio-feedback-mailer` 中创建 Email Service 绑定 `FEEDBACK_EMAIL`。
3. 在同一 Worker 的 Variables and Secrets 中配置两个 Secret：
   - `FEEDBACK_RECIPIENT`：真实收件邮箱。
   - `FEEDBACK_SENDER`：`feedback@dualsubs.quest`。
4. 部署 Worker：

```bash
npx wrangler deploy --config workers/feedback-mailer/wrangler.toml
```

5. 部署 Pages 时，根目录 `wrangler.toml` 会把 `FEEDBACK_MAILER` Service Binding 指向该 Worker。

若你在 Cloudflare 修改了 Worker 名称，必须同步修改根目录和 `workers/feedback-mailer` 中两个 `wrangler.toml` 的 `service` / `name` 值，再部署。

## 发送边界

- Email Worker 不使用公开 URL，`workers_dev = false`。
- Pages API 仅允许三种反馈类型，正文长度限制为 10 至 3000 字符。
- Pages API 按 IP 限制为每 15 分钟最多 3 次提交。
