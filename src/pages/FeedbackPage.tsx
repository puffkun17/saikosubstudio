
import { FormEvent, useRef, useState, useSyncExternalStore } from 'react';
import { ERROR_CODES, LAST_ERROR_KEY, type ErrorCode } from '@/core/errorCodes';

const readLastErrorCode = (): ErrorCode | null => {
  try {
    const v = sessionStorage.getItem(LAST_ERROR_KEY);
    return v && v in ERROR_CODES ? (v as ErrorCode) : null;
  } catch {
    return null;
  }
};
const noopSubscribe = () => () => undefined;
import { Bug, CheckCircle2, Lightbulb, LoaderCircle, MessageSquareText, Send, ThumbsUp } from 'lucide-react';

type FeedbackCategory = 'issue' | 'idea' | 'other';

const categories: Array<{ id: FeedbackCategory; label: string; description: string; icon: typeof Bug }> = [
  { id: 'issue', label: '问题反馈', description: '功能异常或结果与预期不符', icon: Bug },
  { id: 'idea', label: '功能建议', description: '新功能或改进建议', icon: Lightbulb },
  { id: 'other', label: '其他意见', description: '其他意见与建议', icon: MessageSquareText },
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
  // Last E-xx code from this tab (code only, never subtitle text); opt-in.
  const lastErrorCode = useSyncExternalStore(noopSubscribe, readLastErrorCode, () => null);
  const [attachCode, setAttachCode] = useState(true);
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
        body: JSON.stringify({ category, message: lastErrorCode && attachCode ? `错误代码：${lastErrorCode}\n${text}` : text }),
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
    <main className="flex-1 overflow-y-auto bg-[var(--v4-canvas)] px-[var(--ds-page-x)] py-[var(--ds-gap-section)] md:py-8">
      <div className="mx-auto w-full max-w-3xl pb-[var(--ds-gap-section)]">
        <header className="mt-3">
          <div className="flex items-center gap-3 text-[var(--v4-accent-strong)]">
            <MessageSquareText className="h-7 w-7 stroke-[2]" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.12em]">SAIKOSUBSTUDIO / FEEDBACK</span>
          </div>
          <h1 className="ds-title !text-[24px] mt-[var(--ds-gap-item)]">提交反馈</h1>
          <p className="mt-1 text-sm font-medium tracking-[0.04em] text-[var(--v4-text-faint)]">Send feedback</p>
          <p className="ds-body mt-[var(--ds-gap-group)] max-w-[68ch] text-[var(--v4-text-muted)]">
            反馈将直接发送给开发者。仅提交表单中填写的内容。
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--v4-text-faint)]">
            Submitted text is delivered directly to the developer. Only form content is transmitted.
          </p>
        </header>

        <form onSubmit={submitFeedback} className="mt-[var(--ds-gap-section)] space-y-[var(--ds-gap-section)]">
          <fieldset>
            <legend className="text-base font-semibold text-[var(--v4-text)]">
              反馈类型 <span className="ml-2 text-sm font-medium text-[var(--v4-text-faint)]">Category</span>
            </legend>
            <div className="mt-[var(--ds-gap-item)] grid gap-[var(--ds-gap-item)] sm:grid-cols-3">
              {categories.map((item) => {
                const Icon = item.icon;
                const selected = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setCategory(item.id); setState('idle'); setError(''); }}
                    className={`flex min-h-28 cursor-pointer flex-col items-start gap-3 rounded-xl border p-[var(--ds-pad-card)] text-left transition-colors
                      ${selected
                        ? 'border-[var(--v4-accent)]/45 bg-[var(--v4-accent-soft)] text-[var(--v4-text)]'
                        : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)] hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)]'}`}
                    aria-pressed={selected}
                  >
                    <Icon className={`h-5 w-5 stroke-[2] ${selected ? 'text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-faint)]'}`} aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--v4-text)]">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--v4-text-muted)]">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="feedback-message" className="text-base font-semibold text-[var(--v4-text)]">
              反馈内容 <span className="ml-2 text-sm font-medium text-[var(--v4-text-faint)]">Message</span>
            </label>
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
              placeholder="请描述遇到的情况，或希望改进的方向。"
              className="mt-[var(--ds-gap-item)] w-full resize-y rounded-xl border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-4 py-3.5 text-base font-medium leading-7 text-[var(--v4-text)] outline-none transition-colors placeholder:text-[var(--v4-text-faint)] focus:border-[var(--v4-accent)]/55 focus:bg-[var(--v4-accent-soft)]/40"
            />
            <p className="mt-2 text-sm font-medium text-[var(--v4-text-faint)]">{message.length} / 3000</p>
            {lastErrorCode && (
              <label className="ds-check mt-2">
                <input type="checkbox" checked={attachCode} onChange={(event) => setAttachCode(event.target.checked)} />
                附上最近的错误代码 {lastErrorCode}（{ERROR_CODES[lastErrorCode]}），不含字幕内容
              </label>
            )}
          </div>

          {showSupportPrompt && (
            <div
              ref={supportPromptRef}
              className="ds-well flex flex-col gap-[var(--ds-gap-group)] border border-[var(--v4-accent)]/25 bg-[var(--v4-accent-soft)] sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--v4-text)]">想表达支持，也已经很珍贵。</p>
                <p className="mt-1 text-sm leading-6 text-[var(--v4-text-muted)]">如果这只是想点个赞，不必勉强补充内容。</p>
              </div>
              <button
                type="button"
                onClick={registerSupport}
                disabled={hasLiked}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--v4-accent)]/35 bg-[var(--v4-panel-raised)] px-4 text-sm font-semibold text-[var(--v4-accent-strong)] transition-colors hover:bg-[var(--v4-accent-soft)] disabled:cursor-default disabled:border-[var(--v4-line)] disabled:bg-[var(--v4-panel-muted)] disabled:text-[var(--v4-text-faint)]"
              >
                <ThumbsUp className="h-5 w-5 stroke-[2]" aria-hidden="true" />
                {hasLiked ? '已点赞支持' : '点赞支持'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-[var(--ds-gap-group)] border-t border-[var(--v4-line)] pt-[var(--ds-gap-section)]">
            <button
              type="submit"
              disabled={state === 'sending' || message.trim().length === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--v4-accent)] px-5 text-base font-semibold text-[var(--v4-accent-ink)] transition-colors hover:bg-[var(--v4-accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {state === 'sending'
                ? <LoaderCircle className="h-5 w-5 animate-spin stroke-[2]" aria-hidden="true" />
                : <Send className="h-5 w-5 stroke-[2]" aria-hidden="true" />}
              发送反馈 <span className="opacity-70">/ Send</span>
            </button>

            {state === 'sent' && (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--v4-accent-strong)]" role="status">
                <CheckCircle2 className="h-5 w-5 stroke-[2]" aria-hidden="true" />
                反馈已送达，感谢参与。
              </p>
            )}
            {state === 'error' && <p className="text-sm font-medium text-[var(--v4-danger)]" role="alert">{error}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
