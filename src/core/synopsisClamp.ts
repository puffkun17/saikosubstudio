/**
 * 第 2 页左侧作品卡：封面优先的简介布局（纯函数，单测见 scripts/tests/synopsis-clamp.test.mjs）。
 *
 * 规则（lg 桌面）：
 * 1. 封面优先：按栏宽完整 2:3 显示，不裁切。简介只拿剩下的空间。
 * 2. 剩余空间放得下全文 → 全文，无「展开」。
 * 3. 放不下 → 先扣掉「展开」按钮（排版高 28px，触控区用伪元素扩到 44px），折叠到能完整放下的整行数，至少 minLines（默认 2）行。
 * 4. 连「最少行数 + 展开按钮」都放不下（极矮窗口）→ 才让封面等比缩小（deficitPx 告诉调用方要让多少）。
 */
export interface SynopsisLayoutOptions {
  /** 折叠时至少显示的行数。 */
  minLines?: number;
  /** 折叠后「展开」按钮占的高度（px）。 */
  toggleReservePx?: number;
}

export interface SynopsisLayoutResult {
  /** 折叠到几行；null = 显示全文。 */
  clamp: number | null;
  /** 封面需要让出的高度（px），0 = 封面保持完整尺寸。 */
  deficitPx: number;
}

export const SYNOPSIS_MIN_LINES = 2;
/** 「展开 / 收起」按钮在版面里占的高度（px）。触控区由 CSS ::before 上下各扩 8px，达到 44px。 */
export const SYNOPSIS_TOGGLE_PX = 28;
/** 「展开 / 收起」按钮的触控高度（px）。 */
export const SYNOPSIS_TOGGLE_HIT_PX = 44;

/** 半像素容差：行高常是小数（14px × 1.45 = 20.3px），避免 4.999 行被算成 4 行。 */
const EPS = 0.5;

const NONE: SynopsisLayoutResult = { clamp: null, deficitPx: 0 };

/**
 * @param availablePx 封面按完整尺寸摆好、标题/标签/底部都扣掉之后，留给简介（含展开按钮）的高度。
 */
export function computeSynopsisLayout(
  availablePx: number,
  lineHeightPx: number,
  totalLines: number,
  options: SynopsisLayoutOptions = {},
): SynopsisLayoutResult {
  const minLines = Math.max(1, options.minLines ?? SYNOPSIS_MIN_LINES);
  const reserve = Math.max(0, options.toggleReservePx ?? 0);
  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return NONE;
  if (!Number.isFinite(totalLines) || totalLines <= 0) return NONE;
  const avail = Number.isFinite(availablePx) ? availablePx : 0;

  const fitAll = Math.floor((Math.max(0, avail) + EPS) / lineHeightPx);
  if (totalLines <= fitAll) return NONE;

  // 全文不超过最少行数：不折叠（折叠也省不了几行），不够的从封面让。
  if (totalLines <= minLines) {
    return { clamp: null, deficitPx: Math.max(0, Math.ceil(totalLines * lineHeightPx - avail)) };
  }

  const fitWithToggle = Math.floor((Math.max(0, avail - reserve) + EPS) / lineHeightPx);
  if (fitWithToggle >= minLines) return { clamp: fitWithToggle, deficitPx: 0 };
  return { clamp: minLines, deficitPx: Math.max(0, Math.ceil(minLines * lineHeightPx + reserve - avail)) };
}

/** 从实测高度换算总行数（四舍五入吸收亚像素误差）。 */
export function countLines(heightPx: number, lineHeightPx: number): number {
  if (!(lineHeightPx > 0) || !(heightPx > 0)) return 0;
  return Math.max(1, Math.round(heightPx / lineHeightPx));
}

/**
 * 「手动匹配」收成封面角上的放大镜：在「完整按钮」口径下简介会被折叠（全文放不下）就收，
 * 把按钮那一行还给简介。
 *
 * 只吃「完整按钮」口径的输入（与当前模式无关），所以模式切换本身不会反过来改变判断，不会来回跳。
 */
export function shouldCompactRematch(
  availableWithFullButtonPx: number,
  lineHeightPx: number,
  totalLines: number,
): boolean {
  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return false;
  if (!Number.isFinite(totalLines) || totalLines <= 0) return false;
  const avail = Number.isFinite(availableWithFullButtonPx) ? Math.max(0, availableWithFullButtonPx) : 0;
  return totalLines > Math.floor((avail + EPS) / lineHeightPx);
}
