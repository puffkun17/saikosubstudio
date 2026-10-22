import type { StateCreator } from 'zustand';
import { DEFAULT_EXPORT_PRESET_ID, type ExportPresetId } from '../../utils/exportPresets';
import { DEFAULT_HDR_LEVEL } from '../../utils/hdrPresets';
import { entryTarget, listStyleEntries, snapshotForSave, stripContent } from '../../utils/styleLibrary';
import type { StyleSettings } from '../../utils/subtitleCore';
import type { CustomTemplate, StudioState } from '../types';
import { persistStyles } from '../persistence';

export type StyleSlice = Pick<
  StudioState,
  | 'exportPresetId'
  | 'setExportPresetId'
  | 'styleOverrides'
  | 'setStyleOverrides'
  | 'hdrEnabled'
  | 'hdrLevel'
  | 'setHdr'
  | 'customStyle'
  | 'customTemplates'
  | 'activePreset'
  | 'setCustomStyle'
  | 'saveCustomTemplate'
  | 'applyStyleEntry'
  | 'deleteCustomTemplate'
  | 'setActivePreset'
  | 'isSettingsOpen'
  | 'setIsSettingsOpen'
>;

/** Per-slice reset partial for cancelCurrentUpload / restartSystem (S3). */
export function resetStyle(_kind: 'cancel' | 'restart'): Partial<StudioState> {
  return {};
}

export const createStyleSlice: StateCreator<StudioState, [], [], StyleSlice> = (set, get) => ({
  exportPresetId: DEFAULT_EXPORT_PRESET_ID,
  setExportPresetId: (exportPresetId) => {
    set({ exportPresetId, styleOverrides: {} });
    try {
      localStorage.setItem('saiko_export_preset', exportPresetId);
      localStorage.removeItem('saiko_style_overrides');
    } catch { /* ignore */ }
  },
  styleOverrides: {},
  setStyleOverrides: (patch) => {
    const styleOverrides = { ...get().styleOverrides, ...patch };
    set({ styleOverrides });
    try { localStorage.setItem('saiko_style_overrides', JSON.stringify(styleOverrides)); } catch { /* ignore */ }
  },
  hdrEnabled: false,
  hdrLevel: DEFAULT_HDR_LEVEL,
  setHdr: (hdrEnabled, level) => {
    const hdrLevel = level ?? get().hdrLevel;
    set({ hdrEnabled, hdrLevel });
    try { localStorage.setItem('saiko_export_hdr', hdrEnabled ? hdrLevel : `off:${hdrLevel}`); } catch { /* ignore */ }
  },
  customStyle: {
    zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20, resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', auxiliaryMode: 'keep',
    // 字体家族默认（系统级，跨平台较稳）
    zhFontFamily: 'system-ui, sans-serif',
    enFontFamily: 'Helvetica Neue, Arial, sans-serif'
  },
  customTemplates: [],
  activePreset: 'classic',
  isSettingsOpen: false,
  setCustomStyle: (customStyle) => {
    set({ customStyle });
    persistStyles(get());
  },
  saveCustomTemplate: (name, opts) => {
    const state = get();
    const snap = opts
      ? { presetId: 'current' as ExportPresetId, styles: stripContent(opts.styles) }
      : snapshotForSave(state.customStyle, state.exportPresetId, state.styleOverrides);
    const newTemplate: CustomTemplate = { id: `tpl_${Date.now()}`, name, ...snap, source: opts?.source ?? 'saved' };
    set({ customTemplates: [...state.customTemplates, newTemplate] });
    get().applyStyleEntry(newTemplate.id);
  },
  applyStyleEntry: (id) => {
    const state = get();
    const entry = listStyleEntries(state.customTemplates, state.foundAssStyle).find((e) => e.id === id);
    if (!entry) return;
    const target = entryTarget(entry, state.customStyle);
    set({ ...target, activePreset: id });
    try {
      localStorage.setItem('saiko_export_preset', target.exportPresetId);
      localStorage.setItem('saiko_style_overrides', JSON.stringify(target.styleOverrides));
    } catch { /* ignore */ }
    persistStyles(get());
  },
  deleteCustomTemplate: (id) => {
    set((state) => {
      const newTemplates = state.customTemplates.filter(t => t.id !== id);
      return { customTemplates: newTemplates, activePreset: state.activePreset === id ? 'classic' : state.activePreset };
    });
    persistStyles(get());
  },
  setActivePreset: (activePreset) => {
    set({ activePreset });
    persistStyles(get());
  },
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
});
