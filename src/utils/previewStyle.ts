import type { StyleSettings } from './subtitleCore';
import { EXPORT_PRESETS, type ExportPresetId } from './exportPresets';
import { getHdrLevel, hdrFillHex, type HdrLevelId } from './hdrPresets';

/**
 * Unified preset (spec: preview == export). The preview renders the same style the ASS export
 * will use; with HDR on, fills are dimmed exactly like the HDR copy (hdrFillHex).
 */
export function resolvePreviewStyle(base: StyleSettings, presetId: ExportPresetId, hdr: HdrLevelId | null): StyleSettings {
  const preset = EXPORT_PRESETS[presetId];
  const style = preset?.style ? { ...base, ...preset.style } : base;
  if (!hdr) return style;
  const level = getHdrLevel(hdr);
  return {
    ...style,
    zhColor: hdrFillHex(style.zhColor, level, 'primary'),
    enColor: hdrFillHex(style.enColor, level, 'secondary'),
    ...(style.lyricColor ? { lyricColor: hdrFillHex(style.lyricColor, level, 'secondary') } : {}),
  };
}
