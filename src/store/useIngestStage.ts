import { create } from 'zustand';
import type { PreflightItem } from '@/components/Ingest/dragzone/preflight';

/**
 * Act 1 舞台状态（plan B 骨架）：本次清单 + 暂存区。
 *
 * 从 DragZone 组件里提出来，页面切换（DragZone 卸载 → 任务页 → 回来）时暂存区不丢。
 * 只在内存里（File 对象不能持久化），刷新页面即清空——与原来的清单一致。
 */
type Updater<T> = T | ((current: T) => T);
const resolve = <T,>(next: Updater<T>, current: T): T =>
  (typeof next === 'function' ? (next as (value: T) => T)(current) : next);

export interface IngestStageState {
  queuedItems: PreflightItem[];
  stagedItems: PreflightItem[];
  /** 用户点了「都留在这里」时的作品组合签名；组合不变就不再提示。 */
  multiWorkDismissed: string | null;
  setQueuedItems: (next: Updater<PreflightItem[]>) => void;
  setStagedItems: (next: Updater<PreflightItem[]>) => void;
  /** 本次清单 → 暂存区（按 objectId，保持原顺序）。 */
  stageObjects: (objectIds: string[]) => void;
  /** 暂存区 → 本次清单（缺省 = 全部移回）。 */
  unstageObjects: (objectIds?: string[]) => void;
  clearStaged: () => void;
  dismissMultiWork: (signature: string | null) => void;
}

export const useIngestStage = create<IngestStageState>((set) => ({
  queuedItems: [],
  stagedItems: [],
  multiWorkDismissed: null,
  setQueuedItems: (next) => set((state) => ({ queuedItems: resolve(next, state.queuedItems) })),
  setStagedItems: (next) => set((state) => ({ stagedItems: resolve(next, state.stagedItems) })),
  stageObjects: (objectIds) => set((state) => {
    const ids = new Set(objectIds);
    const moving = state.queuedItems.filter((item) => ids.has(item.objectId));
    if (moving.length === 0) return state;
    return {
      queuedItems: state.queuedItems.filter((item) => !ids.has(item.objectId)),
      stagedItems: [...state.stagedItems, ...moving],
      multiWorkDismissed: null,
    };
  }),
  unstageObjects: (objectIds) => set((state) => {
    const ids = objectIds ? new Set(objectIds) : null;
    const moving = ids ? state.stagedItems.filter((item) => ids.has(item.objectId)) : state.stagedItems;
    if (moving.length === 0) return state;
    const present = new Set(state.queuedItems.map((item) => item.key));
    return {
      queuedItems: [...state.queuedItems, ...moving.filter((item) => !present.has(item.key))],
      stagedItems: ids ? state.stagedItems.filter((item) => !ids.has(item.objectId)) : [],
    };
  }),
  clearStaged: () => set({ stagedItems: [] }),
  dismissMultiWork: (signature) => set({ multiWorkDismissed: signature }),
}));
