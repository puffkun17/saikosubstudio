'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, Bug, CheckCircle2, Lightbulb, LoaderCircle, MessageSquareText, Send } from 'lucide-react';

type FeedbackCategory = 'issue' | 'idea' | 'other';

const categories: Array<{ id: FeedbackCategory; label: string; description: string; icon: typeof Bug }> = [
  { id: 'issue', label: '问题反馈', description: '功能异常或结果不符合预期', icon: Bug },
  { id: 'idea', label: '功能建议', description: '希望新增或改进的体验', icon: Lightbulb },
  { id: 'other', label: '其他意见', description: '任何想告诉我们的事情', icon: MessageSquareText },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>('issue');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (text.length < 10) {
      setError('请至少写下 10 个字符，让我们能理解你的反馈。');
      setState('error');
      return;
    }

    setState('sending');
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: text }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || '反馈暂时未能送达，请稍后再试。');

      setMessage('');
      setState('sent');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '反馈暂时未能送达，请稍后再试。');
      setState('error');
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#050507] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-2xl pb-12 pt-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#b9ddd8] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
          返回字幕工作台
        </Link>

        <header className="mt-10">
          <div className="flex items-center gap-3 text-[#b9ddd8]">
            <MessageSquareText className="h-7 w-7 stroke-[2.25]" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-[0.08em]">SAIKOSUBSTUDIO</span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">提交反馈</h1>
          <p className="mt-3 text-base leading-7 text-white/62">你的意见会直接送达开发者。这里仅提交你主动填写的文字内容。</p>
        </header>

        <form onSubmit={submitFeedback} className="mt-10 space-y-8">
          <fieldset>
            <legend className="text-base font-semibold text-white">反馈类型</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {categories.map((item) => {
                const Icon = item.icon;
                const selected = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setCategory(item.id); setState('idle'); setError(''); }}
                    className={`flex min-h-28 flex-col items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors cursor-pointer
                      ${selected
                        ? 'border-[#b9ddd8]/50 bg-[#b9ddd8]/[0.09] text-white'
                        : 'border-white/[0.08] bg-white/[0.018] text-white/70 hover:border-white/[0.18] hover:bg-white/[0.035]'}`}
                    aria-pressed={selected}
                  >
                    <Icon className={`h-5 w-5 stroke-[2.25] ${selected ? 'text-[#b9ddd8]' : 'text-white/58'}`} aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/48">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="feedback-message" className="text-base font-semibold text-white">想告诉我们什么？</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => { setMessage(event.target.value); setState('idle'); setError(''); }}
              maxLength={3000}
              minLength={10}
              required
              rows={9}
              placeholder="请描述你遇到的情况，或你希望它怎样变得更好。"
              className="mt-3 w-full resize-y rounded-xl border border-white/[0.1] bg-[#090a0c] px-4 py-3.5 text-base leading-7 text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#b9ddd8]/55 focus:bg-[#b9ddd8]/[0.025]"
            />
            <p className="mt-2 text-sm text-white/42">{message.length} / 3000</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-6">
            <button
              type="submit"
              disabled={state === 'sending' || message.trim().length < 10}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#b9ddd8] px-5 text-base font-semibold text-[#08201d] transition-colors hover:bg-[#d3eee8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {state === 'sending'
                ? <LoaderCircle className="h-5 w-5 animate-spin stroke-[2.25]" aria-hidden="true" />
                : <Send className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />}
              发送反馈
            </button>

            {state === 'sent' && (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[#b9ddd8]" role="status">
                <CheckCircle2 className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
                已送达，感谢你的反馈。
              </p>
            )}
            {state === 'error' && <p className="text-sm font-medium text-rose-300" role="alert">{error}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
