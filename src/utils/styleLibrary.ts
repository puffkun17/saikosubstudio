import type { StyleSettings } from './subtitleCore';
import { EXPORT_PRESETS, type ExportPresetId } from './exportPresets';
import { resolveEffectiveStyle } from './previewStyle';

/**
 * 「样式」= 一个列表：固定预设 + 用户保存的配置 + 「从文件获取」的结果 + 源文件内嵌样式。
 * 选中一项后，滑块是在它之上的微调；「重置」回到该项本身。预览与导出都读同一份状态。
 * 辅助字幕策略（auxiliaryMode）是内容决定，归第二幕，不属于任何样式条目。
 */
export type StyleEntrySource = 'fixed' | 'saved' | 'ass' | 'image' | 'source';

export interface StyleTemplateRecord {
  id: string;
  name: string;
  styles: Partial<StyleSettings>;
  /** Base preset. Fixed presets store only the user's edits on top of the preset. */
  presetId?: ExportPresetId;
  source?: Exclude<StyleEntrySource, 'fixed' | 'source'>;
}

export interface StyleEntry {
  id: string;
  name: string;
  source: StyleEntrySource;
  presetId: ExportPresetId;
  patch: Partial<StyleSettings>;
  hint?: string;
}

export const CLASSIC_STYLE: Partial<StyleSettings> = {
  zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#4B5563', enOutline: '#000000',
  marginV: 20, lyricFontSize: 16, lyricColor: '#E6E6FA', lyricItalic: true, lyricPosition: 'top', enScale: 90,
  maxLenZh: 20, maxLenEn: 80, resolution: '1080p', aspectRatio: '16:9', globalScale: 1.0,
  // 与 store 初始样式一致，首次打开时「默认经典」不显示「已微调」。
  zhFontFamily: 'system-ui, sans-serif',
  enFontFamily: 'Helvetica Neue, Arial, sans-serif',
};

export const FIXED_STYLE_ENTRIES: StyleEntry[] = [
  { id: 'classic', name: '默认经典', source: 'fixed', presetId: 'current', patch: CLASSIC_STYLE, hint: '系统字体，灰色描边' },
  { id: 'libass-ass', name: EXPORT_PRESETS['libass-ass'].label, source: 'fixed', presetId: 'libass-ass', patch: {}, hint: 'Noto Sans CJK，黑色描边' },
  { id: 'navy-outline', name: EXPORT_PRESETS['navy-outline'].label, source: 'fixed', presetId: 'navy-outline', patch: {}, hint: '思源黑体 Medium，深蓝描边' },
];

const SOURCE_HINT: Record<StyleEntrySource, string> = {
  fixed: '', saved: '已保存', ass: '来自 ASS 文件', image: '截图估计', source: '导入字幕自带',
};

export const stripContent = (style: Partial<StyleSettings>): Partial<StyleSettings> => {
  const copy: Partial<StyleSettings> = { ...style };
  delete copy.auxiliaryMode;
  return copy;
};

export function listStyleEntries(templates: StyleTemplateRecord[], sourceStyle?: Partial<StyleSettings> | null): StyleEntry[] {
  const entries = [...FIXED_STYLE_ENTRIES];
  if (sourceStyle) entries.push({ id: 'source', name: '源文件内嵌样式', source: 'source', presetId: 'current', patch: sourceStyle, hint: SOURCE_HINT.source });
  for (const t of templates) {
    const source = t.source ?? 'saved';
    const base = t.presetId && t.presetId !== 'current' ? EXPORT_PRESETS[t.presetId]?.label : '';
    entries.push({ id: t.id, name: t.name, source, presetId: t.presetId ?? 'current', patch: t.styles, hint: [SOURCE_HINT[source], base && `基于${base}`].filter(Boolean).join(' · ') });
  }
  return entries;
}

export const isFixedPreset = (id: ExportPresetId) => Boolean(EXPORT_PRESETS[id]?.style);

/** State to write when an entry is selected (or reset). */
export function entryTarget(entry: StyleEntry, base: StyleSettings) {
  const patch = stripContent(entry.patch);
  if (isFixedPreset(entry.presetId)) return { exportPresetId: entry.presetId, customStyle: base, styleOverrides: patch };
  return { exportPresetId: 'current' as ExportPresetId, customStyle: { ...base, ...patch } as StyleSettings, styleOverrides: {} };
}

/** Has the user fine-tuned on top of the selected entry? */
export function isEntryTuned(entry: StyleEntry, base: StyleSettings, presetId: ExportPresetId, overrides: Partial<StyleSettings>): boolean {
  const target = entryTarget(entry, base);
  const now = stripContent(resolveEffectiveStyle(base, presetId, overrides));
  const want = stripContent(resolveEffectiveStyle(target.customStyle, target.exportPresetId, target.styleOverrides));
  if (presetId !== target.exportPresetId) return true;
  const keys = new Set([...Object.keys(now), ...Object.keys(want)]) as Set<keyof StyleSettings>;
  for (const k of keys) if (JSON.stringify(now[k]) !== JSON.stringify(want[k])) return true;
  return false;
}

/** What to store when the user saves the current look as a new entry. */
export function snapshotForSave(base: StyleSettings, presetId: ExportPresetId, overrides: Partial<StyleSettings>): Pick<StyleTemplateRecord, 'styles' | 'presetId'> {
  if (isFixedPreset(presetId)) return { presetId, styles: stripContent(overrides) };
  return { presetId: 'current', styles: stripContent(base) };
}
