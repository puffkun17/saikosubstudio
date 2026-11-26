/**
 * Pure helpers for homepage desk keyboard / shake gestures (no React/DOM I/O).
 */

export const SHAKE_MIN_STROKE_PX = 72;
export const SHAKE_WINDOW_MS = 900;
export const SHAKE_REVERSALS_NEEDED = 3;

export type ShakeTracker = {
  lastX: number | null;
  dir: 0 | 1 | -1;
  stroke: number;
  reversals: number[];
};

export type ShakeMoveResult = 'none' | 'cue' | 'trigger';

export const createShakeTracker = (): ShakeTracker => ({
  lastX: null,
  dir: 0,
  stroke: 0,
  reversals: [],
});

export const resetShakeTracker = (state: ShakeTracker): void => {
  state.lastX = null;
  state.dir = 0;
  state.stroke = 0;
  state.reversals = [];
};

/** Record one pointer sample. Counting a reversal requires a long enough stroke. */
export const recordShakeMove = (state: ShakeTracker, x: number, now: number): ShakeMoveResult => {
  if (state.lastX == null) {
    state.lastX = x;
    return 'none';
  }

  const dx = x - state.lastX;
  state.lastX = x;
  if (dx === 0) return 'none';

  const dir = (dx > 0 ? 1 : -1) as 1 | -1;
  if (state.dir === 0 || state.dir === dir) {
    state.dir = dir;
    state.stroke += Math.abs(dx);
    return 'none';
  }

  if (state.stroke < SHAKE_MIN_STROKE_PX) {
    state.dir = dir;
    state.stroke = Math.abs(dx);
    return 'none';
  }

  state.reversals = [...state.reversals.filter((ts) => now - ts < SHAKE_WINDOW_MS), now];
  state.dir = dir;
  state.stroke = Math.abs(dx);

  if (state.reversals.length >= SHAKE_REVERSALS_NEEDED) {
    resetShakeTracker(state);
    return 'trigger';
  }
  if (state.reversals.length >= 2) return 'cue';
  return 'none';
};

/** True when a keyboard shortcut should leave typing / select fields alone. */
export const isEditableKeyboardTarget = (target: EventTarget | null | undefined): boolean => {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};
