export type FeedbackTone = 'message' | 'success' | 'notice' | 'warning' | 'alert';

export type FeedbackAction = 'openTmdbManual';

/** Toast = transient; inline = MessageBar in-step; contextual = owned by a surface. */
export type NoticeChannel = 'toast' | 'inline' | 'contextual';

export interface StatusNotice {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
  meta?: string;
  action?: FeedbackAction;
  actionLabel?: string;
  /** Override auto channel routing. */
  channel?: NoticeChannel;
  /** Toast auto-dismiss ms; ignored for inline/contextual. */
  durationMs?: number;
  createdAt: number;
}

/** Surface-owned notices — never also rendered in the toast dock or generic MessageBar. */
export const CONTEXTUAL_NOTICE_IDS = new Set([
  'media-match',
  'media-identity',
  'forward-action-blocked',
]);

/** Persistent in-step MessageBars (manual dismiss; errors assertive). */
export const INLINE_NOTICE_IDS = new Set([
  'import-attention',
  'same-script-pair-blocked',
]);

export function resolveNoticeChannel(notice: Pick<StatusNotice, 'id' | 'tone' | 'channel'>): NoticeChannel {
  if (notice.channel) return notice.channel;
  if (CONTEXTUAL_NOTICE_IDS.has(notice.id)) return 'contextual';
  if (INLINE_NOTICE_IDS.has(notice.id)) return 'inline';
  if (notice.id.startsWith('error-') || notice.tone === 'alert') return 'inline';
  return 'toast';
}
