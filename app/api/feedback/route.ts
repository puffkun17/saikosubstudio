import { getOptionalRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

type FeedbackCategory = 'issue' | 'idea' | 'other';
type FeedbackPayload = { category?: unknown; message?: unknown };
type FeedbackMailer = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };

declare global {
  interface CloudflareEnv {
    FEEDBACK_MAILER?: FeedbackMailer;
  }
}

const RATE_WINDOW_MS = 15 * 60_000;
const RATE_LIMIT_PER_WINDOW = 3;
const MAX_RATE_BUCKETS = 1_000;
const feedbackBuckets = new Map<string, { startedAt: number; count: number }>();
const allowedCategories = new Set<FeedbackCategory>(['issue', 'idea', 'other']);

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  },
});

const getClientAddress = (request: NextRequest) =>
  request.headers.get('cf-connecting-ip')
  ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? 'unknown';

const isRateLimited = (address: string) => {
  const now = Date.now();
  const current = feedbackBuckets.get(address);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    feedbackBuckets.set(address, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  if (feedbackBuckets.size > MAX_RATE_BUCKETS) {
    for (const [key, bucket] of feedbackBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) feedbackBuckets.delete(key);
      if (feedbackBuckets.size <= MAX_RATE_BUCKETS) break;
    }
  }
  return current.count > RATE_LIMIT_PER_WINDOW;
};

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientAddress(request))) {
    return json({ error: '提交频率过高，请稍后再试。' }, 429);
  }

  let payload: FeedbackPayload;
  try {
    payload = await request.json() as FeedbackPayload;
  } catch {
    return json({ error: '反馈内容格式无效。' }, 400);
  }

  const category = typeof payload.category === 'string' && allowedCategories.has(payload.category as FeedbackCategory)
    ? payload.category as FeedbackCategory
    : null;
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!category || message.length < 10 || message.length > 3000) {
    return json({ error: '请填写 10 到 3000 个字符的反馈内容。' }, 400);
  }

  const context = getOptionalRequestContext();
  const mailer = context?.env.FEEDBACK_MAILER;
  if (!mailer) {
    return json({ error: '反馈服务尚未完成部署，请稍后再试。' }, 503);
  }

  try {
    const response = await mailer.fetch('https://feedback-mailer.internal/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message }),
    });
    if (!response.ok) {
      console.error('Feedback mailer rejected submission', response.status);
      return json({ error: '反馈暂时未能送达，请稍后再试。' }, 502);
    }
    return json({ delivered: true }, 202);
  } catch (error) {
    console.error('Feedback mailer request failed', error);
    return json({ error: '反馈暂时未能送达，请稍后再试。' }, 502);
  }
}
