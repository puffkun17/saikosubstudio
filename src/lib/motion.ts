import type { Transition } from 'framer-motion';

/**
 * Ridgeline 动效预设 —— 与 globals.css 的 --v5-dur / --v5-ease 对齐。
 * 组件内不再手写魔法数字，节奏统一从这里取。
 */

/** cubic-bezier(0.16, 1, 0.3, 1) —— 与 --v5-ease 相同。 */
export const EASE_OUT_QUINT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** 160ms —— 悬停 / 按压等即时反馈。 */
export const transitionFast: Transition = { duration: 0.16, ease: EASE_OUT_QUINT };

/** 240ms —— 常规元素进出场。 */
export const transitionBase: Transition = { duration: 0.24, ease: EASE_OUT_QUINT };

/** 420ms —— 大面积面板 / 场景切换。 */
export const transitionSlow: Transition = { duration: 0.42, ease: EASE_OUT_QUINT };

/** 轻弹簧 —— 徽章吸合、小元件归位。 */
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 30 };

/** 面板弹簧 —— 抽屉、侧栏。 */
export const springPanel: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** 列表条目错峰入场：index → delay（封顶避免长列表拖沓）。 */
export const staggerDelay = (index: number, step = 0.04, max = 0.2) =>
  Math.min(index * step, max);
