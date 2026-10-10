/**
 * HDR subtitle levels (hdr-subtitle-guide.md §三.4 / §五「建议落地」).
 *
 * In HDR playback many chains put subtitle white at or near the display peak, so a full #FFFFFF
 * line glares in dark scenes. The HDR variants keep every style as-is and only lower the fill
 * (PrimaryColour) to a slightly warm grey — never transparency (alpha lets the picture eat the
 * text in bright scenes and blends differently per renderer). Outlines are unchanged, and the
 * script header gets `YCbCr Matrix: None` so VSFilter-family renderers do not re-matrix colours.
 *
 * ⚠️ PROVISIONAL VALUES. The fills below are calculated starting points (sRGB → linear × 203 nit
 * graphics white), not measurements. They stay provisional until Derek's real-screen test on the
 * LG 27UN880 with /workspace/dualsubs/hdr-test/gray-ladder.ass (guide §四.2 / §六). Retune only
 * the constants in HDR_LEVELS_PROVISIONAL; tests read them from here.
 */

export type HdrLevelId = 'soft' | 'dim' | 'cinema';
export type FillRole = 'primary' | 'secondary';

export interface HdrLevel {
  id: HdrLevelId;
  /** UI label. */
  label: string;
  /** Short hint shown next to the choice. */
  hint: string;
  /** Fill for the primary (Chinese) line, #RRGGBB, opaque. Warm grey: R ≥ G > B. */
  primaryFill: string;
  /** Fill for the secondary line (one step darker so the hierarchy survives). */
  secondaryFill: string;
}

/** PROVISIONAL — pending Derek's real-screen test (gray-ladder.ass). ≈ nits at 203-nit graphics white. */
export const HDR_LEVELS_PROVISIONAL: Record<HdrLevelId, HdrLevel> = {
  // ≈160 / 125 nit on a correct (sRGB → 203 nit) chain: mpv / IINA / Infuse / browsers.
  soft: { id: 'soft', label: '柔和', hint: '默认；mpv、IINA、Infuse、网页播放器', primaryFill: '#EBE6DC', secondaryFill: '#D2CEC6' },
  // ≈120 / 92 nit: unknown chains, PotPlayer / madVR, OLED in a dark room.
  dim: { id: 'dim', label: '更暗', hint: '仍觉刺眼时；PotPlayer、madVR、暗房 OLED', primaryFill: '#CCC8C0', secondaryFill: '#B4B1AA' },
  // ≈76 / 58 nit on a correct chain — meant for chains that push subtitles to peak / burn in as PQ (Plex burn-in).
  cinema: { id: 'cinema', label: '影院', hint: 'Plex 烧录、字幕被拉到峰值、全黑房间', primaryFill: '#A6A39C', secondaryFill: '#918F89' },
};

export const HDR_LEVEL_ORDER: HdrLevelId[] = ['soft', 'dim', 'cinema'];
export const DEFAULT_HDR_LEVEL: HdrLevelId = 'soft';
/** Folder inside the zip; HDR files keep the SDR filenames so a player picks them up after a swap. */
export const HDR_BUNDLE_FOLDER = 'HDR';

export const isHdrLevelId = (value: unknown): value is HdrLevelId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(HDR_LEVELS_PROVISIONAL, value);

export const getHdrLevel = (id: unknown): HdrLevel => HDR_LEVELS_PROVISIONAL[isHdrLevelId(id) ? id : DEFAULT_HDR_LEVEL];

// ---------------------------------------------------------------------------------------------
// Colour maths (sRGB transfer, 8-bit).

const toLinear = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (l: number): number => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

const parseHex = (hex: string): [number, number, number] | null => {
  let clean = (hex || '').trim().replace(/^#/, '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
};

const toHex = (rgb: number[]): string => `#${rgb.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;

/** Relative luminance (linear, 0–1). */
export const relativeLuminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Linear-light dimming factor of a level for a role (luminance of its fill vs white). */
export const hdrDimFactor = (level: HdrLevel, role: FillRole): number =>
  relativeLuminance(role === 'primary' ? level.primaryFill : level.secondaryFill);

/** Scale an sRGB colour's brightness in linear light (keeps hue; never adds alpha). */
export const scaleColourLinear = (hex: string, factor: number): string => {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((v) => fromLinear(toLinear(v) * factor)));
};

/**
 * HDR fill for one style colour: pure white becomes the level's warm grey for that role; any other
 * colour (lyrics lavender, a user-picked yellow…) is dimmed by the same linear factor.
 */
export const hdrFillHex = (hex: string, level: HdrLevel, role: FillRole): string => {
  const rgb = parseHex(hex);
  if (!rgb) return role === 'primary' ? level.primaryFill : level.secondaryFill;
  if (rgb.every((v) => v === 255)) return role === 'primary' ? level.primaryFill : level.secondaryFill;
  return scaleColourLinear(hex, hdrDimFactor(level, role));
};

/** ASS `&HBBGGRR` (no alpha) ↔ #RRGGBB helpers for inline `\c` / `\1c` override tags. */
const assBgrToHex = (bgr: string): string => {
  const padded = bgr.padStart(6, '0');
  return `#${padded.slice(4, 6)}${padded.slice(2, 4)}${padded.slice(0, 2)}`.toUpperCase();
};
const hexToAssBgr = (hex: string): string => {
  const clean = hex.replace('#', '').toUpperCase();
  return `${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
};

/**
 * Dim inline primary-colour overrides (`\c&H…&`, `\1c&H…&`) in an event text by the level's
 * linear factor — scaled, not replaced, so a deliberately coloured lyric stays that hue.
 * Outline / shadow overrides (`\3c`, `\4c`) and alpha tags are left untouched.
 */
export const dimInlineFillTags = (text: string, level: HdrLevel, role: FillRole = 'primary'): string =>
  text.replace(/\\(1?c)&H([0-9A-Fa-f]{1,6})&?/g, (_match, tag: string, bgr: string) => {
    const scaled = scaleColourLinear(assBgrToHex(bgr), hdrDimFactor(level, role));
    return `\\${tag}&H${hexToAssBgr(scaled)}&`;
  });
