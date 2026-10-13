/**
 * Review-reason codes (R-xx) for checks the algorithm could not resolve.
 * Stored per task; UI (badges, 待复核 filter, copy) comes in PR #2.
 * Codes are stable: never renumber, only append.
 */
export const REVIEW_REASONS = {
  'R-01': '同集判断不确定（集号或时间轴不一致），需要确认是否合并',
  'R-02': 'TMDB 匹配可信度低，需要确认影片',
  'R-03': '集号未识别，导出名缺少 SxxExx',
  'R-04': '双语文件按样式名拆分（如 Dial_CH / Dial_JP），请确认语言',
  'R-05': '第二语言轨是 SDH，已按 SDH 处理',
  'R-06': '检测到上传者水印 / 宣传行，已移出时间轴',
  'R-07': '零散的二级声明已移出时间轴，汇总为匿名致谢',
  'R-08': '旋转或定位的标题告示，保留原样未换行',
  'R-09': '双人对话行，保留分行',
  'R-10': '只有一种语言，按单语快速路径处理',
  'R-11': '仅一种语言的行（未配对）',
} as const;

export type ReviewReasonCode = keyof typeof REVIEW_REASONS;

export interface ReviewReason {
  code: ReviewReasonCode;
  /** Cue indexes affected, if any. */
  cues?: number[];
  detail?: string;
  resolved?: boolean;
}

export const addReviewReason = (list: ReviewReason[], reason: ReviewReason): ReviewReason[] =>
  list.some((r) => r.code === reason.code && !r.resolved) ? list.map((r) => (r.code === reason.code && !r.resolved ? { ...r, cues: [...new Set([...(r.cues || []), ...(reason.cues || [])])] } : r)) : [...list, reason];
