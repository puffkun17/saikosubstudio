/**
 * Export presets v1 (plan P0-7 / §2.4 / §B) and filename conventions.
 *
 * Product rule (§B): a few fixed presets, no free parameter tuning. Each preset fixes fonts, sizes,
 * margins and the wrap width; the user only picks the preset (and a naming convention).
 *
 * Which preset is the DEFAULT is still pending Derek (§E-4). Until then the default is `current`,
 * which reproduces the pre-preset export behaviour (the sidebar style, ASS + SRT). Switching the
 * default is a one-line change of DEFAULT_EXPORT_PRESET_ID below.
 */
import type { StyleSettings } from './subtitleCore';
import { HDR_BUNDLE_FOLDER, isHdrLevelId, type HdrLevelId } from './hdrPresets';

export type ExportFormat = 'ass' | 'srt';
export type ExportPresetId = 'current' | 'plex-srt' | 'libass-ass' | 'navy-outline' | 'generic-srt';

export interface AssWrapPolicy {
  /** Fraction of (PlayResX − MarginL − MarginR) a CJK line may use. */
  cjkWidthRatio: number;
  /** Fraction of the usable width a Latin / secondary line may use. */
  latinWidthRatio: number;
  /**
   * Legacy cap for the `current` preset: also limit lines to maxLenZh full-width glyphs /
   * maxLenEn average Latin glyphs, so the existing style settings keep their meaning.
   */
  legacyCharCap: boolean;
}

export interface SrtRenderPolicy {
  /** Wrap SRT lines at all (the legacy SRT export never wrapped). */
  wrap: boolean;
  /** Nominal player frame used to estimate rendered width (SRT carries no font info). */
  frameWidth: number;
  marginH: number;
  fontPx: number;
  /** Fraction of the usable width a CJK line may use (CJK reads denser: ≈18 glyphs vs ≈42 Latin chars). */
  cjkWidthRatio: number;
  /** Keep `{\an8}` on screen text / notes so they stay at the top (most SRT parsers honour it). */
  keepAn8: boolean;
  /** Strip every inline tag (`<i>`, `<b>`, `<font>`, `{...}`) — plain-text SRT. */
  plainText: boolean;
  /** `style` = follow StyleSettings.lyricItalic; otherwise forced. */
  lyricItalic: boolean | 'style';
}

/**
 * Stacked two-event layout (「深蓝描边」): the Chinese line and the secondary line are separate
 * Dialogue events on different layers, so libass collision handling never moves them and the gap
 * between them is exact. All px values are at the 1080 reference and scale by PlayResY / 1080.
 */
export interface StackedAssLayout {
  referenceResY: number;
  /** ASS Fontsize of the Chinese line (≈ em × 1.45 for Source Han / Noto CJK metrics). */
  primaryFontSize: number;
  /** Secondary Fontsize = primaryFontSize × secondaryScale. */
  secondaryScale: number;
  primaryOutline: number;
  secondaryOutline: number;
  primaryOutlineColour: string;
  secondaryOutlineColour: string;
  fill: string;
  /** Primary family name (name ID 1 — the Medium weight is its own legacy family). */
  primaryFont: string;
  /** Primary family when the Chinese track is Traditional (zh-TW / zh-Hant glyph forms). */
  primaryFontTraditional: string;
  /** Secondary family per script of the secondary text. */
  secondaryFont: { latin: string; ja: string; ko: string };
  marginH: number;
  /** Secondary event MarginV: puts its ink bottom ≈ 5.6 % of the frame height above the bottom. */
  secondaryMarginV: number;
  /**
   * Chinese event MarginV = secondaryMarginV + secondaryLines × secondaryFontSize + this. With one
   * secondary line it gives an ink-to-ink gap of ≈ 1.7 % of the frame height.
   */
  interLineAdjust: number;
  /** Layers: Chinese above the secondary. */
  primaryLayer: number;
  secondaryLayer: number;
}

export interface ExportProfile {
  /** Font used when the style's CSS family list has no concrete family (system-ui, sans-serif…). */
  fallbackZhFont: string;
  fallbackEnFont: string;
  assWrap: AssWrapPolicy;
  srt: SrtRenderPolicy;
  /** Two-event stacked layout (navy preset). Absent → classic Han/EN single-event layout. */
  stacked?: StackedAssLayout;
}

export interface ExportPreset {
  id: ExportPresetId;
  /** Short label for the compact select. */
  label: string;
  description: string;
  formats: ExportFormat[];
  /** Fixed style overrides (fonts, sizes, margins, colours). `current` has none. */
  style?: Partial<StyleSettings>;
  profile: ExportProfile;
}

/**
 * Nominal SRT player: 1920 px frame, 10 % side margins, 76 px font → ≈42 Latin characters
 * (Netflix English 42) and, with the 0.9 CJK ratio, ≈18 full-width glyphs (Netflix zh-Hans 16–18).
 */
const NOMINAL_SRT = { frameWidth: 1920, marginH: 192, fontPx: 76, cjkWidthRatio: 0.9 } as const;

/**
 * Pre-preset behaviour: sidebar style, legacy fallbacks, ASS wrap capped by maxLen, SRT unwrapped.
 * Derek (PR #36): the「当前样式」SRT keeps `{\an8}` so signs stay at the top.
 */
export const LEGACY_EXPORT_PROFILE: ExportProfile = {
  fallbackZhFont: 'PingFang SC',
  fallbackEnFont: 'Arial',
  assWrap: { cjkWidthRatio: 1, latinWidthRatio: 1, legacyCharCap: true },
  srt: { wrap: false, ...NOMINAL_SRT, keepAn8: true, plainText: false, lyricItalic: 'style' },
};


const FIXED_ASS_STYLE: Partial<StyleSettings> = {
  zhFontFamily: 'Noto Sans CJK SC',
  enFontFamily: 'Arial',
  zhFontSize: 20,
  enFontSize: 12,
  enScale: 100,
  marginV: 20,
  resolution: '1080p',
  aspectRatio: '16:9',
  globalScale: 1,
  zhColor: '#FFFFFF',
  enColor: '#D0D0D0',
  zhOutline: '#000000',
  enOutline: '#000000',
  lyricFontSize: 16,
  lyricColor: '#E6E6FA',
  lyricItalic: true,
  lyricPosition: 'top',
};

/**
 * 「深蓝描边」— modelled on the YouTuber 满田's zh/ja hardsubs (/workspace/yt-style/analysis.md,
 * measured at 1080p and reproduced with libass to within 0–2 px):
 * zh white fill + navy #141B55 outline 5.5 px, Source Han Sans SC Medium, Fontsize 75 (em ≈ 52 px);
 * secondary white + black outline 4.5 px, Regular, 0.68 × (51); no shadow; zh on top;
 * ink gap ≈ 18 px (1.7 % H); secondary ink bottom ≈ 60 px (5.6 % H) above the frame bottom.
 */
export const NAVY_OUTLINE_LAYOUT: StackedAssLayout = {
  referenceResY: 1080,
  primaryFontSize: 75,
  secondaryScale: 0.68,
  primaryOutline: 5.5,
  secondaryOutline: 4.5,
  primaryOutlineColour: '#141B55',
  secondaryOutlineColour: '#000000',
  fill: '#FFFFFF',
  primaryFont: 'Source Han Sans SC Medium',
  primaryFontTraditional: 'Source Han Sans TC Medium',
  secondaryFont: { latin: 'Source Han Sans SC', ja: 'Source Han Sans JP', ko: 'Source Han Sans K' },
  marginH: 60,
  secondaryMarginV: 51,
  interLineAdjust: -5,
  primaryLayer: 1,
  secondaryLayer: 0,
};

const NAVY_OUTLINE_STYLE: Partial<StyleSettings> = {
  ...FIXED_ASS_STYLE,
  zhFontFamily: NAVY_OUTLINE_LAYOUT.primaryFont,
  enFontFamily: NAVY_OUTLINE_LAYOUT.secondaryFont.latin,
  zhColor: NAVY_OUTLINE_LAYOUT.fill,
  enColor: NAVY_OUTLINE_LAYOUT.fill,
  zhOutline: NAVY_OUTLINE_LAYOUT.primaryOutlineColour,
  enOutline: NAVY_OUTLINE_LAYOUT.secondaryOutlineColour,
  enScale: 100,
};

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPreset> = {
  current: {
    id: 'current',
    label: '当前样式',
    description: '沿用侧栏样式（SRT 保留 {\\an8} 顶置）',
    formats: ['ass', 'srt'],
    profile: LEGACY_EXPORT_PROFILE,
  },
  'plex-srt': {
    id: 'plex-srt',
    label: 'Plex 稳妥 SRT',
    description: '中上英下两行，画面文字保留 {\\an8} 顶置；Apple TV / 电视直接播放',
    formats: ['srt'],
    profile: {
      fallbackZhFont: 'PingFang SC',
      fallbackEnFont: 'Arial',
      assWrap: { cjkWidthRatio: 1, latinWidthRatio: 1, legacyCharCap: false },
      srt: { wrap: true, ...NOMINAL_SRT, keepAn8: true, plainText: false, lyricItalic: true },
    },
  },
  'libass-ass': {
    id: 'libass-ass',
    label: 'libass 完整 ASS',
    description: '多样式 ASS，Noto Sans CJK SC + Arial；mpv / IINA / VLC / Kodi / Jellyfin',
    formats: ['ass'],
    style: FIXED_ASS_STYLE,
    profile: {
      fallbackZhFont: 'Noto Sans CJK SC',
      fallbackEnFont: 'Arial',
      assWrap: { cjkWidthRatio: 0.82, latinWidthRatio: 0.62, legacyCharCap: false },
      srt: { wrap: true, ...NOMINAL_SRT, keepAn8: true, plainText: false, lyricItalic: true },
    },
  },
  'navy-outline': {
    id: 'navy-outline',
    label: '深蓝描边',
    description: '白字 + 深海军蓝描边，思源黑体 Medium；第二语言小一号、黑描边，中上外下双事件叠放；mpv / IINA / Jellyfin / Infuse',
    formats: ['ass'],
    style: NAVY_OUTLINE_STYLE,
    profile: {
      fallbackZhFont: NAVY_OUTLINE_LAYOUT.primaryFont,
      fallbackEnFont: NAVY_OUTLINE_LAYOUT.secondaryFont.latin,
      // Wrap widths are per language at each line's own size (zh 75, secondary 51 @1080).
      assWrap: { cjkWidthRatio: 0.82, latinWidthRatio: 0.62, legacyCharCap: false },
      srt: { wrap: true, ...NOMINAL_SRT, keepAn8: true, plainText: false, lyricItalic: true },
      stacked: NAVY_OUTLINE_LAYOUT,
    },
  },
  'generic-srt': {
    id: 'generic-srt',
    label: '通用 SRT',
    description: '纯文本，不带任何标签，只保留换行；任何设备',
    formats: ['srt'],
    profile: {
      fallbackZhFont: 'PingFang SC',
      fallbackEnFont: 'Arial',
      assWrap: { cjkWidthRatio: 1, latinWidthRatio: 1, legacyCharCap: false },
      srt: { wrap: true, ...NOMINAL_SRT, keepAn8: false, plainText: true, lyricItalic: false },
    },
  },
};

export const EXPORT_PRESET_ORDER: ExportPresetId[] = ['current', 'plex-srt', 'libass-ass', 'navy-outline', 'generic-srt'];

/**
 * Derek (§E-4, PR #36): the default download is ASS; SRT files are optional add-ons bundled into a
 * zip. The default ASS preset is「当前样式」; change this one line to switch to libass.
 */
export const DEFAULT_EXPORT_PRESET_ID: ExportPresetId = 'current';

/** Presets offered for the main ASS file. */
export const ASS_PRESET_IDS: ExportPresetId[] = EXPORT_PRESET_ORDER.filter((id) => EXPORT_PRESETS[id].formats.includes('ass'));
/** SRT variants offered as optional add-ons (each checked one adds a file to the bundle). */
export const SRT_ADDON_IDS: ExportPresetId[] = EXPORT_PRESET_ORDER.filter((id) => EXPORT_PRESETS[id].formats.includes('srt'));
/** Short labels for the SRT add-on checkboxes. */
export const SRT_ADDON_LABELS: Record<string, string> = {
  current: '当前样式 SRT',
  'plex-srt': 'Plex 稳妥 SRT',
  'generic-srt': '通用 SRT',
};

export const isExportPresetId = (value: unknown): value is ExportPresetId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EXPORT_PRESETS, value);

export function getExportPreset(id: unknown): ExportPreset {
  return EXPORT_PRESETS[isExportPresetId(id) ? id : DEFAULT_EXPORT_PRESET_ID];
}

/** Style actually used for export: preset overrides win over the sidebar style. */
export function resolvePresetStyle(base: StyleSettings, preset: ExportPreset): StyleSettings {
  return preset.style ? { ...base, ...preset.style } : base;
}

// ---------------------------------------------------------------------------------------------
// Font names (P0-6): ASS Fontname must be the English family name (name ID 1) — no CSS quotes,
// no generic families, no weight/style suffixes, no PostScript names.

const GENERIC_FAMILIES = new Set([
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'sans-serif', 'serif',
  'monospace', 'cursive', 'fantasy', 'emoji', 'math', 'fangsong', '-apple-system',
  'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'revert', 'default',
]);

const FAMILY_ALIASES: Record<string, string> = {
  pingfangsc: 'PingFang SC',
  pingfangtc: 'PingFang TC',
  pingfanghk: 'PingFang HK',
  '苹方': 'PingFang SC',
  '苹方-简': 'PingFang SC',
  '蘋方-繁': 'PingFang TC',
  helveticaneue: 'Helvetica Neue',
  arialmt: 'Arial',
  microsoftyahei: 'Microsoft YaHei',
  '微软雅黑': 'Microsoft YaHei',
  microsoftjhenghei: 'Microsoft JhengHei',
  '微軟正黑體': 'Microsoft JhengHei',
  notosanscjksc: 'Noto Sans CJK SC',
  notosanscjktc: 'Noto Sans CJK TC',
  notosanscjkjp: 'Noto Sans CJK JP',
  notosanscjkkr: 'Noto Sans CJK KR',
  notoserifcjksc: 'Noto Serif CJK SC',
  notosanssc: 'Noto Sans SC',
  notoserifsc: 'Noto Serif SC',
  sourcehansanssc: 'Source Han Sans SC',
  sourcehansanscn: 'Source Han Sans CN',
  sourcehanserifsc: 'Source Han Serif SC',
  '思源黑体': 'Source Han Sans SC',
  '思源宋体': 'Source Han Serif SC',
};

const WEIGHT_SUFFIX = /(?:[\s_-]+)(?:thin|hairline|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|heavy|italic|oblique|w\d)$/i;

const splitFamilyList = (value: string): string[] => {
  const out: string[] = [];
  let current = '';
  let quote = '';
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ',') { out.push(current); current = ''; }
    else current += ch;
  }
  out.push(current);
  return out;
};

/**
 * Source Han / Noto CJK ship every non-RIBBI weight as its own legacy family (name ID 1), e.g.
 * 「Source Han Sans SC Medium」. That is the name GDI (VSFilter) and fontconfig (libass) match, so
 * these weights are kept instead of being stripped like an ordinary style suffix. Regular / Bold
 * remain styles of the base family (Bold → the Bold flag).
 */
const CJK_SUPERFAMILY_WEIGHT = /^(source\s*han\s*(?:sans|serif)|noto\s*(?:sans|serif)\s*cjk|思源黑体|思源宋体)[\s_-]*(sc|tc|hc|jp|k|kr|cn|tw|hk)?[\s_-]+(extralight|light|normal|medium|semibold|heavy|black)$/i;
const CJK_SUPERFAMILY_BASE: Record<string, string> = {
  sourcehansans: 'Source Han Sans',
  sourcehanserif: 'Source Han Serif',
  notosanscjk: 'Noto Sans CJK',
  notoserifcjk: 'Noto Serif CJK',
  '思源黑体': 'Source Han Sans',
  '思源宋体': 'Source Han Serif',
};
const WEIGHT_NAMES: Record<string, string> = {
  extralight: 'ExtraLight', light: 'Light', normal: 'Normal', medium: 'Medium', semibold: 'SemiBold', heavy: 'Heavy', black: 'Black',
};

const canonicalCjkWeightedFamily = (name: string): string | null => {
  const match = name.replace(/([a-z])([A-Z])/g, '$1 $2').match(CJK_SUPERFAMILY_WEIGHT);
  if (!match) return null;
  const base = CJK_SUPERFAMILY_BASE[match[1].toLowerCase().replace(/\s+/g, '')];
  if (!base) return null;
  const isChineseAlias = /^思源/.test(match[1]);
  const region = (match[2] || (isChineseAlias ? 'sc' : '')).toUpperCase();
  if (!region) return null;
  return `${base} ${region} ${WEIGHT_NAMES[match[3].toLowerCase()]}`;
};

/** Canonical family name for one CSS family entry, or '' when it is generic / unusable. */
export function canonicalFontFamily(entry: string): string {
  let name = entry.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/^['"\s]+|['"\s]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!name || /^var\(/i.test(name) || GENERIC_FAMILIES.has(name.toLowerCase())) return '';
  const weighted = canonicalCjkWeightedFamily(name);
  if (weighted) return weighted;
  for (let guard = 0; guard < 4 && WEIGHT_SUFFIX.test(name); guard++) name = name.replace(WEIGHT_SUFFIX, '').trim();
  const key = name.toLowerCase().replace(/[\s_-]+/g, '');
  return FAMILY_ALIASES[key] ?? FAMILY_ALIASES[name] ?? name;
}

/** First concrete family of a CSS font-family list, normalised for ASS; otherwise `fallback`. */
export function normalizeAssFontName(fontFamily: string | undefined, fallback: string): string {
  for (const entry of splitFamilyList(fontFamily || '')) {
    const name = canonicalFontFamily(entry);
    if (name) return name;
  }
  return fallback;
}

// ---------------------------------------------------------------------------------------------
// Filenames: naming conventions per player (plan §2.4). Language tags for the Chinese primary.

export type NamingScheme = 'plain' | 'plex' | 'jellyfin' | 'infuse' | 'generic';
export type NamingFlag = 'none' | 'sdh' | 'forced';

export interface NamingOption {
  id: string;
  scheme: NamingScheme;
  flag: NamingFlag;
  label: string;
}

export const NAMING_OPTIONS: NamingOption[] = [
  { id: 'plain', scheme: 'plain', flag: 'none', label: '原文件名' },
  { id: 'plex', scheme: 'plex', flag: 'none', label: 'Plex · .zh' },
  { id: 'plex-sdh', scheme: 'plex', flag: 'sdh', label: 'Plex · .zh.sdh' },
  { id: 'plex-forced', scheme: 'plex', flag: 'forced', label: 'Plex · .zh.forced' },
  { id: 'jellyfin', scheme: 'jellyfin', flag: 'none', label: 'Jellyfin · .zh-Hans' },
  { id: 'jellyfin-sdh', scheme: 'jellyfin', flag: 'sdh', label: 'Jellyfin · .zh-Hans.sdh' },
  { id: 'jellyfin-forced', scheme: 'jellyfin', flag: 'forced', label: 'Jellyfin · .zh-Hans.forced' },
  { id: 'infuse', scheme: 'infuse', flag: 'none', label: 'Infuse · .zh-Hans' },
  { id: 'infuse-sdh', scheme: 'infuse', flag: 'sdh', label: 'Infuse · .zh-Hans.sdh' },
  { id: 'generic', scheme: 'generic', flag: 'none', label: '通用 · .zh-Hans.en' },
];

export const DEFAULT_NAMING_ID = 'plain';

export const getNamingOption = (id: unknown): NamingOption =>
  NAMING_OPTIONS.find((option) => option.id === id) ?? NAMING_OPTIONS[0];

const sanitizeBaseName = (name: string): string =>
  name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'subtitles';

/**
 * Build the download filename. `traditional` switches zh-Hans → zh-Hant (Plex keeps the ISO 639-1
 * `zh`, which is all it understands; a bilingual file can only hang under one language).
 */
export function buildExportFilename(
  baseName: string,
  extension: ExportFormat | 'zip',
  namingId: string,
  options: { traditional?: boolean } = {},
): string {
  const base = sanitizeBaseName(baseName).replace(new RegExp(`\\.${extension}$`, 'i'), '');
  const option = getNamingOption(namingId);
  const script = options.traditional ? 'zh-Hant' : 'zh-Hans';
  const parts: string[] = [base];
  switch (option.scheme) {
    case 'plain':
      break;
    case 'plex':
      parts.push('zh');
      break;
    case 'jellyfin':
    case 'infuse':
      parts.push(script);
      break;
    case 'generic':
      parts.push(script, 'en');
      break;
  }
  if (option.scheme !== 'plain' && option.flag !== 'none') parts.push(option.flag);
  return `${parts.join('.')}.${extension}`;
}

// ---------------------------------------------------------------------------------------------
// Bundle download (打包下载): ASS (+ optional SRT add-ons) → one zip, all names from the naming rule.

export interface PlannedExportFile {
  presetId: ExportPresetId;
  format: ExportFormat;
  /** HDR level of an ASS variant (null / absent = SDR). */
  hdr?: HdrLevelId | null;
  /** Path inside the zip (or the download name when not bundled). */
  filename: string;
}

export interface ExportBundlePlan {
  files: PlannedExportFile[];
  /** Zip name when more than one file is produced; null → single direct download. */
  zipName: string | null;
}

/**
 * Plan the files of one export. The ASS and the first SRT add-on take the naming rule's exact
 * names (so a player picks them up straight from the unzipped folder); further SRT variants would
 * collide with that name, so they go into a sub-folder named after the variant.
 */
export function planExportBundle(
  baseName: string,
  namingId: string,
  assPresetId: unknown,
  srtAddonIds: readonly unknown[],
  options: { traditional?: boolean; hdr?: HdrLevelId | null } = {},
): ExportBundlePlan {
  const assPreset = getExportPreset(assPresetId);
  const assId: ExportPresetId = assPreset.formats.includes('ass') ? assPreset.id : DEFAULT_EXPORT_PRESET_ID;
  const assName = buildExportFilename(baseName, 'ass', namingId, options);
  const files: PlannedExportFile[] = [{ presetId: assId, format: 'ass', filename: assName }];
  // 同时生成 HDR 版: the same ASS with HDR fills, under HDR/ with the identical filename (guide §三.5 —
  // `.hdr` tags are not a standard player tag, so the user swaps files instead). SRT has no HDR form.
  if (isHdrLevelId(options.hdr)) {
    files.push({ presetId: assId, format: 'ass', hdr: options.hdr, filename: `${HDR_BUNDLE_FOLDER}/${assName}` });
  }
  const addons = SRT_ADDON_IDS.filter((id) => srtAddonIds.includes(id));
  const srtName = buildExportFilename(baseName, 'srt', namingId, options);
  addons.forEach((id, index) => {
    const folder = (SRT_ADDON_LABELS[id] || EXPORT_PRESETS[id].label).replace(/[\\/:*?"<>|]/g, ' ').trim();
    files.push({ presetId: id, format: 'srt', filename: index === 0 ? srtName : `${folder}/${srtName}` });
  });
  return { files, zipName: files.length > 1 ? buildExportFilename(baseName, 'zip', namingId, options) : null };
}
