/**
 * Act 1 舞台过渡开关（dragzone-proposal §5 方案 B）。
 *
 * - `STAGE_SHARED_HANDOFF`：第 1 页（清单 + 等待态）→ 第 2 页（任务页）用共享元素接续：
 *   文件行带 objectId 作 layoutId，从清单里的位置移到任务页的轨道行。关掉 = 回到
 *   「先退场再进场」（AnimatePresence mode="wait"），即方案 C 的退路起点。
 * - URL `?handoff=off` 临时关掉（对比 / 性能基线用），不写进任何存储。
 */
export const STAGE_SHARED_HANDOFF = true;

export const stageSharedHandoffEnabled = (): boolean => {
  if (!STAGE_SHARED_HANDOFF) return false;
  if (typeof window === 'undefined') return true;
  try {
    return new URLSearchParams(window.location.search).get('handoff') !== 'off';
  } catch {
    return true;
  }
};

/** 交接窗口：放行后这么久内挂载的任务页才带 layoutId（之后去掉，免得换轨时又飞一次）。 */
export const STAGE_HANDOFF_WINDOW_MS = 900;

/**
 * Act 1 → Act 2（进入工作台）用 View Transition 交叉淡入（plan B §5：只在这一处用 VT）。
 * 浏览器不支持 / 页面在后台 / `?vt=off` 时直接切换。时长在 globals.css：0.25 s，减少动态 0.15 s。
 */
export const ACT_VIEW_TRANSITION = true;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> };
};

export const enterWorkbenchTransition = (update: () => void): void => {
  const doc = typeof document === 'undefined' ? null : (document as ViewTransitionDocument);
  let enabled = ACT_VIEW_TRANSITION;
  try {
    if (new URLSearchParams(window.location.search).get('vt') === 'off') enabled = false;
  } catch {
    // no window (unit tests): plain update
  }
  if (!enabled || !doc || typeof doc.startViewTransition !== 'function' || doc.visibilityState === 'hidden') {
    update();
    return;
  }
  const root = doc.documentElement;
  root.dataset.actTransition = 'enter-workbench';
  const transition = doc.startViewTransition(async () => {
    update();
    // zustand → React 的同步提交在微任务里完成；等一个宏任务，保证新页面已经写进 DOM 再截「新」画面。
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
  });
  void transition.finished.finally(() => {
    if (root.dataset.actTransition === 'enter-workbench') delete root.dataset.actTransition;
  });
};
