import type { StateCreator } from 'zustand';
import { ERROR_CODES, codeErrorMessage, rememberErrorCode } from '../../core/errorCodes';
import {
  resolveNoticeChannel,
  type StatusNotice,
} from '../../core/noticeChannel';
import type { StudioState } from '../types';

export type FeedbackSlice = Pick<
  StudioState,
  | 'logs'
  | 'statusNotices'
  | 'addLog'
  | 'clearLogs'
  | 'setStatusNotice'
  | 'dismissStatusNotice'
  | 'clearStatusNotices'
>;

export const createFeedbackSlice: StateCreator<StudioState, [], [], FeedbackSlice> = (set, get) => ({
  logs: [],
  statusNotices: [],
  addLog: (rawMsg, type = 'info') => {
    const msg = type === 'error' ? codeErrorMessage(rawMsg) : rawMsg;
    if (type === 'error') {
      // Errors stay until closed (decided A9): what happened + what to do + E-xx for feedback.
      const code = rememberErrorCode(msg);
      get().setStatusNotice({
        id: `error-${code ?? 'x'}`,
        tone: 'alert',
        title: code ? `${ERROR_CODES[code]}（${code}）` : '出错了',
        message: `${msg.replace(/^\[E-\d{2}\]\s*/, '')}${code ? ' · 反馈时可附上这个代码' : ''}`,
      });
    }
    const id = Date.now() + Math.random();
    const time = new Date().toLocaleTimeString();
    set(state => ({
      logs: [...state.logs.slice(-2), { id, time, msg, type, fade: false }]
    }));
    setTimeout(() => {
      set(state => ({
        logs: state.logs.map(l => l.id === id ? { ...l, fade: true } : l)
      }));
    }, 4200);
    setTimeout(() => {
      set(state => ({
        logs: state.logs.filter(l => l.id !== id)
      }));
    }, 5000);
  },
  clearLogs: () => set({ logs: [] }),
  setStatusNotice: (notice) => {
    set(state => {
      const nextNotice: StatusNotice = { ...notice, createdAt: Date.now() };
      const channel = resolveNoticeChannel(nextNotice);
      const existing = state.statusNotices.filter(item => item.id !== notice.id);
      // Cap toast stack at 3; inline/contextual are not stacked in the toaster.
      if (channel === 'toast') {
        const otherToasts = existing.filter((item) => resolveNoticeChannel(item) === 'toast');
        const nonToasts = existing.filter((item) => resolveNoticeChannel(item) !== 'toast');
        const toasts = [...otherToasts, nextNotice].slice(-3);
        return { statusNotices: [...nonToasts, ...toasts] };
      }
      return { statusNotices: [...existing, nextNotice] };
    });
  },
  dismissStatusNotice: (id) => set(state => ({
    statusNotices: state.statusNotices.filter(item => item.id !== id)
  })),
  clearStatusNotices: () => set({ statusNotices: [] }),
});
