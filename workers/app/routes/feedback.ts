import type { Env } from "../entry";
import { warnMissingBinding } from "../warn";

type FeedbackCategory = "issue" | "idea" | "other";
type FeedbackPayload = { category?: unknown; message?: unknown };

const allowedCategories = new Set<FeedbackCategory>(["issue", "idea", "other"]);

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });

const getClientAddress = (request: Request) =>
  request.headers.get("cf-connecting-ip")
  ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? "unknown";

export async function handleFeedbackPost(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const address = getClientAddress(request);
  if (env.FEEDBACK_RATE_LIMITER) {
    const { success } = await env.FEEDBACK_RATE_LIMITER.limit({ key: address });
    if (!success) return json({ error: "提交频率过高，请稍后再试。" }, 429);
  } else {
    warnMissingBinding("FEEDBACK_RATE_LIMITER", "requests are not rate limited");
  }

  let payload: FeedbackPayload;
  try {
    payload = (await request.json()) as FeedbackPayload;
  } catch {
    return json({ error: "反馈内容格式无效。" }, 400);
  }

  const category =
    typeof payload.category === "string" && allowedCategories.has(payload.category as FeedbackCategory)
      ? (payload.category as FeedbackCategory)
      : null;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!category || message.length < 10 || message.length > 3000) {
    return json({ error: "请填写 10 到 3000 个字符的反馈内容。" }, 400);
  }

  const mailer = env.FEEDBACK_MAILER;
  if (!mailer) {
    return json({ error: "反馈服务尚未完成部署，请稍后再试。" }, 503);
  }

  try {
    const response = await mailer.fetch("https://feedback-mailer.internal/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message }),
    });
    if (!response.ok) {
      console.error("Feedback mailer rejected submission", response.status);
      return json({ error: "反馈暂时未能送达，请稍后再试。" }, 502);
    }
    return json({ delivered: true }, 202);
  } catch (error) {
    console.error("Feedback mailer request failed", error);
    return json({ error: "反馈暂时未能送达，请稍后再试。" }, 502);
  }
}
