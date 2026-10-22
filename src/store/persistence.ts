import type { Task } from '../core/taskModel';
import {
  listMerged,
  listTasks,
  purgeExpiredSources,
  purgeExpiredTasks,
} from '../core/taskStore';
import { historyIdFor } from '../core/identity';
import { writeJsonStorage } from '../utils/localPersistence';
import type { StyleSettings, SubRow } from '../utils/subtitleCore';
import type { CustomTemplate, LibraryItem } from './types';
import { useStudioStore } from './useStudioStore';

/** Stale keys from pre-downtime builds — cleared on boot, never hydrated. */
export const STALE_LOCAL_KEYS = [
  'nexus_subtitle_library',
  'saiko_tmdb_api_key',
] as const;

export const STYLE_STORAGE_KEY = 'nexus_subtitle_styles_v4';

export const clearStaleLocalStorage = () => {
  if (typeof localStorage === 'undefined') return;
  for (const key of STALE_LOCAL_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};

/**
 * 样式持久化唯一出口：preset / style / templates 三者始终一起落盘，
 * 避免任何调用点单独覆盖（曾经 ControlDeck 写入 templates: [] 清空过用户模板）。
 */
export const persistStyles = (state: {
  activePreset: string;
  customStyle: StyleSettings;
  customTemplates: CustomTemplate[];
}) => {
  if (typeof window === 'undefined') return;
  writeJsonStorage(STYLE_STORAGE_KEY, {
    preset: state.activePreset,
    style: state.customStyle,
    templates: state.customTemplates,
  });
};

export const libraryItemToTask = (item: LibraryItem): Task => {
  const now = Date.now();
  return {
    id: item.id,
    createdAt: now,
    updatedAt: now,
    stage: 'merged',
    episode: { season: null, episode: null },
    name: { value: item.name, state: 'locked' },
    exportBaseName: { value: item.name.replace(/\s+/g, '.'), state: 'locked' },
    slots: [],
    singleLanguage: !item.subs.some((row) => row.text.includes('\n')),
    review: [],
  };
};

/** Load history from IndexedDB (purge first). Null when IndexedDB is unavailable. Schema upgrades wipe prior data. */
export const loadHistoryFromIdb = async (): Promise<LibraryItem[] | null> => {
  try {
    await purgeExpiredTasks();
    await purgeExpiredSources();
    const [tasks, merged] = await Promise.all([listTasks(), listMerged()]);
    const byId = new Map(merged.map((m) => [m.taskId, m]));
    const list: LibraryItem[] = tasks.flatMap((task) => {
      const m = byId.get(task.id);
      if (!m || !Array.isArray(m.rows) || m.rows.length === 0) return [];
      const extra = (m.extra || {}) as { backdrop?: string | null; backdropList?: string[] | null; customStyle?: StyleSettings | null };
      return [{
        id: historyIdFor(task.id),
        name: task.name.value,
        date: new Date(task.updatedAt).toLocaleString('zh-CN', { hour12: false }),
        subs: m.rows as SubRow[],
        backdrop: extra.backdrop ?? null,
        backdropList: extra.backdropList ?? null,
        customStyle: (extra.customStyle ?? useStudioStore.getState().customStyle) as StyleSettings,
      }];
    });
    return list;
  } catch {
    return null;
  }
};
