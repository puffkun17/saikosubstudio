/**
 * 动效常量（DESIGN.md §7）。秒，供 motion/react 使用；B 舞台与列表共用。
 *
 * - 一般过渡上限 0.25 s，弹簧无回弹（bounce 0）。
 * - 唯一例外（2026-10-30 Nias 批准）：Act 1 舞台里的跨区远距离移动，visualDuration ≤ 0.35 s，
 *   仍然 bounce 0、只动 transform。
 * - 减少动效时：时长压到 0.15 s，位移归零（调用方用 useReducedMotion 判断）。
 */
export const MOTION_S = {
  fast: 0.15,
  base: 0.2,
  slow: 0.25,
  exit: 0.15,
  /** 只给跨区远距离移动用（B 舞台）。 */
  longMove: 0.35,
  reduced: 0.15,
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** 无回弹弹簧。visualDuration 超过 0.25 s 只允许 longMove。 */
export const springNoBounce = (visualDuration: number = MOTION_S.slow) => ({
  type: 'spring' as const,
  visualDuration,
  bounce: 0,
});
