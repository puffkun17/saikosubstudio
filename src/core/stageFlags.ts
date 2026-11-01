import { flushSync } from 'react-dom';

/**
 * Act 1 舞台过渡开关（dragzone-proposal §5 方案 B）。
 *
 * - `STAGE_SHARED_HANDOFF`：第 1 页（清单 + 等待态）→ 第 2 页（任务页）用共享元素接续。
 *   默认关（方案 C）：先退场再进场（AnimatePresence mode="wait"）。4× CPU 下交接约多掉 2 帧。
 *   URL `?handoff=on` 临时打开做对比；`?handoff=off` 强制关闭。不写进任何存储。
 *   打开时只给将出现在任务主/副/旁白轨上的 objectId 保留 layoutId，包壳与未入轨叶不投影。
 */
export const STAGE_SHARED_HANDOFF = false;

export const stageSharedHandoffEnabled = (): boolean => {
  let query: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      query = new URLSearchParams(window.location.search).get('handoff');
    } catch {
      query = null;
    }
  }
  if (query === 'on') return true;
  if (query === 'off') return false;
  return STAGE_SHARED_HANDOFF;
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
  // flushSync 在回调返回前提交 React，VT 截到新画面。不再等 setTimeout(0)。
  const transition = doc.startViewTransition(() => {
    flushSync(update);
  });
  void transition.finished.finally(() => {
    if (root.dataset.actTransition === 'enter-workbench') delete root.dataset.actTransition;
  });
};
