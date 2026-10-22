import type { StateCreator } from 'zustand';
import { clearAllLocalData, deleteTask, putHistoryEntry } from '../../core/taskStore';
import { historyIdFor, identityFromStorageKey, mintTaskId, workIdentityFromFileName } from '../../core/identity';
import { getExportPreset, DEFAULT_EXPORT_PRESET_ID } from '../../utils/exportPresets';
import { isHdrLevelId } from '../../utils/hdrPresets';
import { readJsonStorage } from '../../utils/localPersistence';
import type { StyleSettings } from '../../utils/subtitleCore';
import type { CustomTemplate, LibraryItem, StudioState } from '../types';
import {
  STYLE_STORAGE_KEY,
  clearStaleLocalStorage,
  libraryItemToTask,
  loadHistoryFromIdb,
} from '../persistence';

export type HistorySlice = Pick<
  StudioState,
  | 'historyReady'
  | 'libraryList'
  | 'isLibraryOpen'
  | 'setLibraryOpen'
  | 'initializeLibrary'
  | 'clearHistory'
  | 'saveToLibrary'
  | 'deleteFromLibrary'
  | 'loadFromLibrary'
>;

export const createHistorySlice: StateCreator<StudioState, [], [], HistorySlice> = (set, get) => ({
  historyReady: false,
  libraryList: [],
  isLibraryOpen: false,
  setLibraryOpen: (isLibraryOpen) => set({ isLibraryOpen }),
  initializeLibrary: () => {
    if (typeof window === 'undefined') return;
    clearStaleLocalStorage();
    try {
      const storedPreset = getExportPreset(localStorage.getItem('saiko_export_preset'));
      const storedHdr = localStorage.getItem('saiko_export_hdr') || '';
      const level = storedHdr.replace(/^off:/, '');
      set({
        exportPresetId: storedPreset.formats.includes('ass') ? storedPreset.id : DEFAULT_EXPORT_PRESET_ID,
        hdrEnabled: Boolean(storedHdr) && !storedHdr.startsWith('off:') && isHdrLevelId(level),
        ...(isHdrLevelId(level) ? { hdrLevel: level } : {}),
      });
      const storedOverrides = readJsonStorage<unknown>('saiko_style_overrides', {});
      if (storedOverrides && typeof storedOverrides === 'object' && !Array.isArray(storedOverrides)) {
        set({ styleOverrides: storedOverrides as Partial<StyleSettings> });
      }
    } catch { /* ignore */ }
    // History lives in IndexedDB (taskStore). Prior schema versions are discarded on open.
    void loadHistoryFromIdb().then((list) => {
      if (list) set({ libraryList: list, historyReady: true });
      else set({ libraryList: [], historyReady: true });
    });
    const savedStyles = readJsonStorage<{ preset?: string; style?: Partial<StyleSettings>; templates?: CustomTemplate[] }>(STYLE_STORAGE_KEY, {});
    if (savedStyles.preset) set({ activePreset: savedStyles.preset });
    if (savedStyles.style) set({ customStyle: { resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', ...savedStyles.style } as StyleSettings });
    if (Array.isArray(savedStyles.templates)) set({ customTemplates: savedStyles.templates });
    // TMDB key is now handled server-side via /api/tmdb proxy (no client-side key required).
    // Old localStorage key 'saiko_tmdb_api_key' is no longer used.
  },
  clearHistory: async () => {
    try {
      await clearAllLocalData();
    } catch {
      /* fall through: still clear the legacy key */
    }
    clearStaleLocalStorage();
    set({ libraryList: [] });
    get().addLog('已清空本机历史（任务、合并结果与源字幕）', 'success');
  },
  saveToLibrary: () => {
    const { processedSubs, customFilename, tmdbData, tmdbBackdrop, tmdbBackdropList, customStyle, libraryList, selectedTaskId } = get();
    if (!processedSubs || processedSubs.length === 0) return;
    const name = customFilename
      || (tmdbData ? [tmdbData.title, tmdbData.year].filter(Boolean).join('.') : '')
      || '未命名字幕';
    // One entry per task (re-merging the same task replaces it instead of piling up duplicates).
    // LibraryItem.id is a storage key; IndexedDB Task.id stays the identity.
    const taskIdentity = selectedTaskId || mintTaskId(workIdentityFromFileName(name));
    const historyId = historyIdFor(taskIdentity);
    const newItem: LibraryItem = {
      id: historyId,
      name: name,
      date: new Date().toLocaleString('zh-CN', { hour12: false }),
      subs: processedSubs,
      backdrop: tmdbBackdrop,
      backdropList: tmdbBackdropList,
      customStyle: customStyle
    };
    set({ libraryList: [newItem, ...libraryList.filter((item) => item.id !== historyId)] });
    void putHistoryEntry({ ...libraryItemToTask(newItem), id: taskIdentity }, processedSubs, {
      backdrop: tmdbBackdrop, backdropList: tmdbBackdropList, customStyle,
    }).then(
      () => get().addLog(`[历史] 已保存到本机：${name}`, 'success'),
      (error: unknown) => get().addLog(`本机历史保存失败：${error instanceof Error ? error.message : String(error)}`, 'error'),
    );
  },
  deleteFromLibrary: (id) => {
    set(state => ({ libraryList: state.libraryList.filter(item => item.id !== id) }));
    const taskIdentity = identityFromStorageKey(id, 'history') || id;
    void deleteTask(taskIdentity).catch(() => undefined);
    get().addLog('已删除这条历史', 'info');
  },
  loadFromLibrary: (item) => {
    set({
      processedSubs: item.subs,
      customFilename: item.name,
      filenameSource: 'library',
      tmdbBackdrop: item.backdrop,
      tmdbBackdropList: item.backdropList || (item.backdrop ? [item.backdrop] : []),
      customStyle: item.customStyle,
      previewIndex: 0,
      workflowStep: 2,
      editHistory: [],
      editFuture: []
    });
    get().addLog(`已载入字幕库项目: ${item.name}`, "success");
  },
});
