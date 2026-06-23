'use client';

import { FormEvent, useRef, useState, useSyncExternalStore } from 'react';
import { Bug, CheckCircle2, Lightbulb, LoaderCircle, MessageSquareText, Send, ThumbsUp } from 'lucide-react';

type FeedbackCategory = 'issue' | 'idea' | 'other';

const categories: Array<{ id: FeedbackCategory; label: string; description: string; icon: typeof Bug }> = [
  { id: 'issue', label: '问题反馈', description: '功能异常或结果不符合预期', icon: Bug },
  { id: 'idea', label: '功能建议', description: '希望新增或改进的体验', icon: Lightbulb },
  { id: 'other', label: '其他意见', description: '任何想告诉我们的事情', icon: MessageSquareText },
];

const subscribeToLocalSupport = (onStoreChange: () => void) => {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
};
const getLocalSupportSnapshot = () => window.localStorage.getItem('saiko-feedback-support') === 'liked';
const getServerSupportSnapshot = () => false;

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>('issue');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [showSupportPrompt, setShowSupportPrompt] = useState(false);
  const hasLiked = useSyncExternalStore(subscribeToLocalSupport, getLocalSupportSnapshot, getServerSupportSnapshot);
  const supportPromptRef = useRef<HTMLDivElement>(null);

  const registerSupport = () => {
    window.localStorage.setItem('saiko-feedback-support', 'liked');
    window.dispatchEvent(new StorageEvent('storage', { key: 'saiko-feedback-support', newValue: 'liked' }));
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (text.length < 10) {
      setShowSupportPrompt(true);
      setState('idle');
      setError('');
      window.requestAnimationFrame(() => supportPromptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
      setShowSupportPrompt(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '反馈暂时未能送达，请稍后再试。');
      setState('error');
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#050507] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-2xl pb-12 pt-3">
        <header className="mt-3">
          <div className="flex items-center gap-3 text-[#b9ddd8]">
            <MessageSquareText className="h-7 w-7 stroke-[2.25]" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.12em]">SAIKOSUBSTUDIO / FEEDBACK</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">提交反馈</h1>
          <p className="mt-1 text-sm font-medium tracking-[0.04em] text-white/46">Send feedback</p>
          <p className="mt-4 text-sm leading-7 text-white/62 md:text-base">你的意见会直接送达开发者。这里仅提交你主动填写的文字内容。</p>
          <p className="mt-1 text-sm leading-6 text-white/38">Your message is delivered directly to the developer. Only the text you enter is submitted.</p>
        </header>

        <form onSubmit={submitFeedback} className="mt-10 space-y-8">
          <fieldset>
            <legend className="text-base font-semibold text-white">反馈类型 <span className="ml-2 text-sm font-medium text-white/38">Category</span></legend>
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
            <label htmlFor="feedback-message" className="text-base font-semibold text-white">想告诉我们什么？ <span className="ml-2 text-sm font-medium text-white/38">Your message</span></label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setState('idle');
                setError('');
                if (event.target.value.trim().length >= 10) setShowSupportPrompt(false);
              }}
              maxLength={3000}
              required
              rows={9}
              placeholder="请描述你遇到的情况，或你希望它怎样变得更好。"
              className="mt-3 w-full resize-y rounded-xl border border-white/[0.1] bg-[#090a0c] px-4 py-3.5 text-base leading-7 text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#b9ddd8]/55 focus:bg-[#b9ddd8]/[0.025]"
            />
            <p className="mt-2 text-sm text-white/42">{message.length} / 3000</p>
          </div>

          {showSupportPrompt && (
            <div
              ref={supportPromptRef}
              className="flex flex-col gap-4 rounded-xl border border-[#b9ddd8]/20 bg-[#b9ddd8]/[0.055] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="text-sm font-semibold text-white">想表达支持，也已经很珍贵。</p>
                <p className="mt-1 text-sm leading-6 text-white/58">如果这只是想点个赞，不必勉强补充内容。</p>
              </div>
              <button
                type="button"
                onClick={registerSupport}
                disabled={hasLiked}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#b9ddd8]/35 bg-[#b9ddd8]/[0.09] px-4 text-sm font-semibold text-[#c9ebe5] transition-colors hover:bg-[#b9ddd8]/[0.16] disabled:cursor-default disabled:border-white/[0.12] disabled:bg-white/[0.04] disabled:text-white/58"
              >
                <ThumbsUp className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
                {hasLiked ? '已点赞支持' : '点赞支持'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-6">
            <button
              type="submit"
              disabled={state === 'sending' || message.trim().length === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#b9ddd8] px-5 text-base font-semibold text-[#08201d] transition-colors hover:bg-[#d3eee8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {state === 'sending'
                ? <LoaderCircle className="h-5 w-5 animate-spin stroke-[2.25]" aria-hidden="true" />
                : <Send className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />}
              发送反馈 <span className="text-black/55">/ Send</span>
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
