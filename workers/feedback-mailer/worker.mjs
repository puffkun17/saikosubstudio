const categoryLabels = {
  issue: '问题反馈',
  idea: '功能建议',
  other: '其他意见',
};

const securityHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const response = (body, status) => new Response(JSON.stringify(body), { status, headers: securityHeaders });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/submit') {
      return response({ error: 'Not found' }, 404);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return response({ error: 'Invalid feedback payload' }, 400);
    }

    const category = typeof payload.category === 'string' && categoryLabels[payload.category] ? payload.category : null;
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!category || message.length < 10 || message.length > 3000) {
      return response({ error: 'Invalid feedback content' }, 400);
    }
    if (!env.FEEDBACK_RECIPIENT || !env.FEEDBACK_SENDER) {
      console.error('Feedback mailer secrets are missing');
      return response({ error: 'Feedback mailer is unavailable' }, 503);
    }

    try {
      await env.FEEDBACK_EMAIL.send({
        to: env.FEEDBACK_RECIPIENT,
        from: { name: 'SaikoSubStudio Feedback', email: env.FEEDBACK_SENDER },
        subject: `[SaikoSubStudio] ${categoryLabels[category]}`,
        text: `反馈类型：${categoryLabels[category]}\n\n${message}`,
      });
      return response({ delivered: true }, 202);
    } catch (error) {
      console.error('Feedback email delivery failed', error);
      return response({ error: 'Feedback delivery failed' }, 502);
    }
  },
};
