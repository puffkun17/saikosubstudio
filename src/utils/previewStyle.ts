import type { StyleSettings } from './subtitleCore';
import { EXPORT_PRESETS, type ExportPreset, type ExportPresetId } from './exportPresets';
import { getHdrLevel, hdrFillHex, type HdrLevelId } from './hdrPresets';

/**
 * Unified preset (spec: preview == export). The preview renders the same style the ASS export
 * will use; with HDR on, fills are dimmed exactly like the HDR copy (hdrFillHex).
 */
/** The one style state behind preview and export: sidebar style → preset (fixed fields) → user overrides. */
export function resolveEffectiveStyle(base: StyleSettings, presetId: ExportPresetId, overrides: Partial<StyleSettings> = {}): StyleSettings {
  const preset = EXPORT_PRESETS[presetId];
  return { ...(preset?.style ? { ...base, ...preset.style } : base), ...overrides };
}

export function resolvePreviewStyle(base: StyleSettings, presetId: ExportPresetId, hdr: HdrLevelId | null, overrides: Partial<StyleSettings> = {}): StyleSettings {
  const style = resolveEffectiveStyle(base, presetId, overrides);
  if (!hdr) return style;
  const level = getHdrLevel(hdr);
  return {
    ...style,
    zhColor: hdrFillHex(style.zhColor, level, 'primary'),
    enColor: hdrFillHex(style.enColor, level, 'secondary'),
    ...(style.lyricColor ? { lyricColor: hdrFillHex(style.lyricColor, level, 'secondary') } : {}),
  };
}

/**
 * Fixed stacked layouts (深蓝描边) draw from their measured layout, not from StyleSettings. When the user
 * edits 样式参数 on top of such a preset, carry those edits into the layout so the export matches the
 * preview. Values scale relative to the preset's own style (zh 20 / en 12 / marginV 20).
 */
export function applyOverridesToProfile(preset: ExportPreset, overrides: Partial<StyleSettings>): ExportPreset['profile'] {
  const stacked = preset.profile?.stacked;
  if (!stacked || !preset.style || Object.keys(overrides).length === 0) return preset.profile;
  const ps = preset.style;
  const merged = { ...ps, ...overrides };
  const g = (merged.globalScale ?? 1) / (ps.globalScale ?? 1);
  const zhRatio = ((merged.zhFontSize ?? 20) / (ps.zhFontSize ?? 20)) * g;
  const enRatio = ((merged.enFontSize ?? 12) / (ps.enFontSize ?? 12)) * g;
  const mvRatio = (merged.marginV ?? 20) / (ps.marginV ?? 20);
  return {
    ...preset.profile,
    stacked: {
      ...stacked,
      primaryFontSize: stacked.primaryFontSize * zhRatio,
      secondaryScale: stacked.secondaryScale * (enRatio / zhRatio),
      secondaryMarginV: stacked.secondaryMarginV * mvRatio,
      fill: overrides.zhColor ?? stacked.fill,
      primaryOutlineColour: overrides.zhOutline ?? stacked.primaryOutlineColour,
      secondaryOutlineColour: overrides.enOutline ?? stacked.secondaryOutlineColour,
      ...(overrides.zhFontFamily ? { primaryFont: overrides.zhFontFamily, primaryFontTraditional: overrides.zhFontFamily } : {}),
      ...(overrides.enFontFamily ? { secondaryFont: { ...stacked.secondaryFont, latin: overrides.enFontFamily } } : {}),
    },
  };
}
