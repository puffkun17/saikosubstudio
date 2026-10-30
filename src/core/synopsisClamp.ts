/**
 * 第 2 页左侧作品卡：简介自适应折叠阈值（纯函数，单测见 scripts/tests/synopsis-clamp.test.mjs）。
 *
 * 规则：
 * 1. 全文放得下（totalLines ≤ 可用整行数）→ null，不折叠、不出「展开」。
 * 2. 放不下，但只多出 ≤ slackLines（默认 2）行 → 也返回 null：宁可让封面让出这 1–2 行，
 *    也不让用户为了一两行去点「展开」。
 * 3. 否则折叠到「扣掉展开按钮高度后还能完整放下的整行数」，至少 minLines（默认 3）行。
 */
export interface SynopsisClampOptions {
  /** 折叠时至少显示的行数。 */
  minLines?: number;
  /** 溢出不超过这么多行时直接显示全文。 */
  slackLines?: number;
  /** 折叠后「展开」按钮占的高度（px），从可用空间里扣掉。 */
  toggleReservePx?: number;
}

export const SYNOPSIS_MIN_LINES = 3;
export const SYNOPSIS_SLACK_LINES = 2;

/** 半像素容差：行高常是小数（14px × 1.45 = 20.3px），避免 4.999 行被算成 4 行。 */
const EPS = 0.5;

export function computeSynopsisClamp(
  availablePx: number,
  lineHeightPx: number,
  totalLines: number,
  options: SynopsisClampOptions = {},
): number | null {
  const minLines = options.minLines ?? SYNOPSIS_MIN_LINES;
  const slackLines = options.slackLines ?? SYNOPSIS_SLACK_LINES;
  const reserve = Math.max(0, options.toggleReservePx ?? 0);
  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return null;
  if (!Number.isFinite(totalLines) || totalLines <= 0) return null;
  const avail = Number.isFinite(availablePx) ? Math.max(0, availablePx) : 0;

  const fitAll = Math.floor((avail + EPS) / lineHeightPx);
  if (totalLines <= fitAll) return null;
  if (totalLines - fitAll <= slackLines) return null;

  const fitWithToggle = Math.floor((Math.max(0, avail - reserve) + EPS) / lineHeightPx);
  const lines = Math.max(minLines, fitWithToggle);
  return lines >= totalLines ? null : lines;
}

/** 从实测高度换算总行数（四舍五入吸收亚像素误差）。 */
export function countLines(heightPx: number, lineHeightPx: number): number {
  if (!(lineHeightPx > 0) || !(heightPx > 0)) return 0;
  return Math.max(1, Math.round(heightPx / lineHeightPx));
}
