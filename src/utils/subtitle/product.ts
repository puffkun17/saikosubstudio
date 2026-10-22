/** Subtitle product: export, credits, auxiliary policy, wrap report. */
import {
  estimateTextWidth,
  hasCjk,
  splitLanguageBlocks,
  stripInlineTags,
  wrapSubtitleBlock,
  applyFrenchSpacing,
  normalizeNarrowNoBreakSpace,
} from '../lineWrap';
import {
  LEGACY_EXPORT_PROFILE,
  normalizeAssFontName,
  needsFullLatinFont,
  FULL_LATIN_FALLBACK_FONT,
  type ExportProfile,
} from '../exportPresets';
import {
  dimInlineFillTags,
  getHdrLevel,
  hdrFillHex,
  isHdrLevelId,
  type FillRole,
  type HdrLevelId,
} from '../hdrPresets';
import {
  type AssScriptMeta,
  type AuxiliarySubtitleMode,
  type StyleSettings,
  type SubRow,
  type SubtitleLanguage,
} from './model';
import {
  classifyLineKind,
  cleanAttributionValue,
  detectLanguageByContent,
  type LineKindRow,
} from './analysis';

export function smartLineWrap(text: string, isChinese = true, maxChars = 20): string {
  if (!text) return "";
  void isChinese; // script is detected per character by the engine
  const measure = (value: string) => [...stripInlineTags(value)].length;
  const limit = Math.max(1, maxChars);
  return text
    .split('\n')
    .map((line) => wrapSubtitleBlock([line], { fontPx: 1, maxWidth: limit, measure }).lines.join('\\N'))
    .join('\\N');
}


const timestampToMs = (timestamp: string) => {
  const match = timestamp.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{2,3})/);
  if (!match) return 0;
  const milliseconds = Number(match[4].padEnd(3, '0'));
  return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 + milliseconds;
};

const msToSrtTimestamp = (milliseconds: number) => {
  const safe = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const ms = safe % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

/** Create a non-mutating, optional end-credit cue for exported subtitle files. */
export type CreatorCreditPlacement = 'after-last' | 'before-end';

export function appendCreatorCredit(
  subs: SubRow[],
  creatorCredit: string,
  placement: CreatorCreditPlacement = 'after-last',
  raw = false,
): SubRow[] {
  const cleanCredit = raw ? creatorCredit.trim() : cleanAttributionValue(creatorCredit);
  if (!cleanCredit || subs.length === 0) return subs;

  // Decided (A2): the user's own line reads 「双语合并：…」 and sits after the original credits.
  const displayText = raw || /^(?:双语合并|字幕制作|制作(?:者)?|Subtitles?\s*(?:by|制作))\s*[:：]/i.test(cleanCredit)
    ? cleanCredit
    : `双语合并：${cleanCredit}`;
  const lastEnd = Math.max(...subs.map(sub => timestampToMs(sub.ts.split(' --> ')[1] || sub.ts)));
  const duration = 5000;
  const start = placement === 'before-end'
    ? Math.max(0, lastEnd - duration)
    : lastEnd + 1500;
  const end = placement === 'before-end' ? lastEnd : start + duration;

  return [...subs, {
    index: Math.max(...subs.map(sub => sub.index), 0) + 1,
    ts: `${msToSrtTimestamp(start)} --> ${msToSrtTimestamp(end)}`,
    text: displayText,
    type: 'credit',
  }];
}

/** 特殊行分类（唯一来源，优先级：署名 > 歌词 > 音效 > 标题告示 > 旁白 > 对白）。 */
/** 署名位置 → ASS/SRT \\an 对齐（numpad）。 */
export const CREDIT_ALIGN = { center: 5, bottom: 2, top: 8 } as const;


/**
 * Does the auxiliary policy hide this line? Credits are owned by the credits plan (never by the
 * policy), lyrics and dialogue are never hidden. 智能 hides only ambient / music SDH, so it can
 * never hide more than the 音效 count.
 */
export function isHiddenByPolicy(row: LineKindRow, mode: AuxiliarySubtitleMode): boolean {
  if (mode === 'keep') return false;
  const kind = classifyLineKind(row);
  const category = row.auxiliary?.category;
  if (kind === 'sound') {
    if (mode === 'smart') return category === 'ambient_sdh' || category === 'music';
    return Boolean(category) && category !== 'semantic_sdh';
  }
  if (mode === 'clean' && kind === 'narration') {
    return Boolean(category) && category !== 'semantic_sdh' && category !== 'speech_context' && category !== 'screen_text';
  }
  return false;
}

const shouldKeepSubtitleForAuxiliaryMode = (sub: SubRow, mode: AuxiliarySubtitleMode): boolean => !isHiddenByPolicy(sub, mode);

export function applyAuxiliarySubtitleMode(subs: SubRow[], mode: AuxiliarySubtitleMode = 'keep', alwaysKeep?: (sub: SubRow) => boolean): SubRow[] {
  return subs
    .filter(sub => (alwaysKeep?.(sub) ?? false) || shouldKeepSubtitleForAuxiliaryMode(sub, mode))
    .map((sub, index) => ({ ...sub, index: index + 1 }));
}

export interface WrapReport {
  /** Cues whose line structure was changed by smart wrapping. */
  rewrapped: number;
  /** Cues that still overflow two lines at the preset width (surface for review). */
  overflow: number;
  overflowIndexes: number[];
}

export const createWrapReport = (): WrapReport => ({ rewrapped: 0, overflow: 0, overflowIndexes: [] });

export interface ExportRunOptions {
  /** Export preset profile (fonts fallback, wrap policy, SRT rules). Defaults to legacy behaviour. */
  profile?: ExportProfile;
  /** Optional mutable counters filled while exporting. */
  report?: WrapReport;
  /** ASS only: HDR variant level (warm-grey fills, `YCbCr Matrix: None`). Absent → SDR. */
  hdr?: HdrLevelId | null;
}

const KANA_RE = /[\u3040-\u30ff\u31f0-\u31ff]/;
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff]/;

/** Script of the secondary lines in an export (picks the matching Source Han regional family). */
const detectSecondaryScript = (subs: SubRow[]): 'latin' | 'ja' | 'ko' => {
  let ja = 0;
  let ko = 0;
  let latin = 0;
  for (const row of subs) {
    const blocks = splitLanguageBlocks(row.text.replace(/^\{\\an8\}/, ''));
    for (const line of blocks.slice(1).flat()) {
      if (KANA_RE.test(line)) ja += 1;
      else if (HANGUL_RE.test(line)) ko += 1;
      else if (/[A-Za-z]/.test(line)) latin += 1;
    }
  }
  if (ja > latin && ja >= ko) return 'ja';
  if (ko > latin && ko > ja) return 'ko';
  return 'latin';
};

/**
 * Language of the Latin-script second language in an export ('en', 'es', 'fr', …), decided once over
 * all secondary lines (merged cues' second block, or whole Latin-only cues).
 */
export const detectSecondaryLatinLanguage = (subs: SubRow[]): SubtitleLanguage => {
  const lines: string[] = [];
  for (const row of subs.slice(0, 400)) {
    const text = row.text.replace(/^\{\\an8\}/, '');
    const blocks = splitLanguageBlocks(text);
    const candidates = blocks.length > 1 ? blocks.slice(1).flat() : (hasCjk(text) ? [] : blocks.flat());
    for (const line of candidates) if (/[A-Za-z\u00c0-\u024f]/.test(line) && !hasCjk(line)) lines.push(line);
  }
  return lines.length ? detectLanguageByContent(lines.join('\n')) : 'unknown';
};

/** Typography applied to Latin (non-CJK) lines before wrapping: French no-break spaces, U+202F → U+00A0. */
const latinTypographyFor = (subs: SubRow[]): ((line: string) => string) =>
  detectSecondaryLatinLanguage(subs) === 'fr' ? applyFrenchSpacing : normalizeNarrowNoBreakSpace;

/** Traditional Chinese primary text (picks the TC regional family). */
const isTraditionalTrack = (subs: SubRow[]): boolean =>
  detectLanguageByContent(subs.slice(0, 200).map((row) => splitLanguageBlocks(row.text)[0]?.join('') ?? '').join('\n')) === 'zh-TW';

/** ASS numbers: integers stay integers, others keep one decimal. */
const assNumber = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** Average Latin advance (em) used to translate a legacy maxLenEn character budget into px. */
const LATIN_AVERAGE_EM = 0.5;

const isTopPlacedCue = (s: SubRow): boolean =>
  s.type === "note" || s.type === "commentary" || s.cueKind === 'screen_text';

/**
 * Wrap each language block of a cue by rendered width. Returns the blocks' output lines.
 * `params(isCjk, blockIndex)` supplies font px and available width for that block.
 */
function wrapCueBlocks(
  text: string,
  params: (isCjk: boolean, blockIndex: number) => { fontPx: number; maxWidth: number },
  report: WrapReport | undefined,
  index: number,
  keepSourceLines = false,
  latinTypography: (line: string) => string = normalizeNarrowNoBreakSpace,
): string[][] {
  let changed = false;
  let overflow = false;
  const blocks = splitLanguageBlocks(text).map((block, blockIndex) => {
    const isCjk = block.some(hasCjk);
    const { fontPx, maxWidth } = params(isCjk, blockIndex);
    const lines = isCjk ? block : block.map(latinTypography);
    const result = wrapSubtitleBlock(lines, { fontPx, maxWidth, measure: estimateTextWidth, keepSourceLines });
    changed = changed || result.changed;
    overflow = overflow || result.overflow;
    return result.lines;
  });
  if (report) {
    if (changed) report.rewrapped += 1;
    if (overflow) {
      report.overflow += 1;
      report.overflowIndexes.push(index);
    }
  }
  return blocks;
}

export function generateSrtContent(subs: SubRow[], styleSettings?: StyleSettings, options: ExportRunOptions = {}): string {
  const { auxiliaryMode = 'keep' } = styleSettings || {};
  const srt = (options.profile ?? LEGACY_EXPORT_PROFILE).srt;
  const lyricItalic = srt.lyricItalic === 'style' ? (styleSettings?.lyricItalic ?? true) : srt.lyricItalic;
  const maxWidth = Math.max(1, srt.frameWidth - 2 * srt.marginH);
  const latinTypography = latinTypographyFor(subs);
  return applyAuxiliarySubtitleMode(subs, auxiliaryMode).map(s => {
    let text = s.text.replace(/\{\\[^}]+\}/g, '');
    if (srt.plainText) text = stripInlineTags(text);
    if (srt.wrap) {
      text = wrapCueBlocks(text, (isCjk) => ({ fontPx: srt.fontPx, maxWidth: isCjk ? maxWidth * srt.cjkWidthRatio : maxWidth }), options.report, s.index, isTopPlacedCue(s), latinTypography)
        .map((lines) => lines.join('\n'))
        .filter(Boolean)
        .join('\n');
    }
    if (s.type === 'lyrics' && lyricItalic) {
      const cleanText = text.replace(/<\/?i>/g, '');
      text = `<i>${cleanText}</i>`;
    }
    // SRT 默认不加对齐（兼容旧版）；用户在「样式 · 署名」里选过位置才写 \\an。
    const creditPos = styleSettings?.creditPosition;
    if (creditPos && creditPos !== 'bottom' && classifyLineKind(s) === 'credit') text = `{\\an${CREDIT_ALIGN[creditPos]}}${text}`;
    else if (srt.keepAn8 && isTopPlacedCue(s)) text = `{\\an8}${text}`;
    return `${s.index}\n${s.ts}\n${text}`;
  }).join("\n\n") + "\n";
}

export function generateAssContent(
  subs: SubRow[],
  styleSettings: StyleSettings,
  title = "Bilingual Subtitles",
  scriptMeta?: AssScriptMeta,
  options: ExportRunOptions = {},
): string {
  const profile = options.profile ?? LEGACY_EXPORT_PROFILE;
  const {
    zhFontSize = 22,
    enFontSize = 12,
    zhColor = '#FFFFFF',
    enColor = '#FFFFFF',
    zhOutline = '#000000',
    enOutline = '#000000',
    enScale = 100,
    maxLenZh = 22,
    maxLenEn = 90,
    marginV = 25,
    resolution = '1080p',
    globalScale = 1.0,
    aspectRatio = '16:9',
    lyricFontSize = 16,
    lyricColor = '#E6E6FA',
    lyricItalic = true,
    lyricPosition = 'top',
    auxiliaryMode = 'keep',
    zhFontFamily,
    enFontFamily,
  } = styleSettings || {};

  let resY = 1080;
  if (resolution === '4K') {
    resY = 2160;
  } else if (resolution === '1080p') {
    resY = 1080;
  } else {
    resY = 288;
  }

  let resX = Math.round(resY * 16 / 9);
  if (aspectRatio === '4:3') {
    resX = Math.round(resY * 4 / 3);
  } else if (aspectRatio === '1.9:1') {
    resX = Math.round(resY * 1.9);
  } else if (aspectRatio === '2.39:1') {
    resX = Math.round(resY * 2.39);
  }

  const multiplier = resY / 288;
  const m = multiplier * globalScale;

  const mZhFont = Math.round(zhFontSize * m);
  const mEnFont = Math.round(enFontSize * m);
  const mMarginV = Math.round(marginV * m);
  const mOutline = Math.round(1.5 * m);
  const mShadow = Math.round(1.5 * m);
  const mEnOutline = Math.round(1.0 * m);
  const mNoteFont = Math.round(18 * m);
  const mBaseMargin = Math.round(10 * m);
  const mLyricFont = Math.round(lyricFontSize * m);
  const mLyricEnFont = Math.round(Math.max(10, lyricFontSize * 0.75) * m);
  const usableLineWidth = Math.max(1, resX - 2 * mBaseMargin);
  const assLineWidth = (fontPx: number, isCjk: boolean): number => {
    const { cjkWidthRatio, latinWidthRatio, legacyCharCap } = profile.assWrap;
    let width = usableLineWidth * (isCjk ? cjkWidthRatio : latinWidthRatio);
    if (legacyCharCap) {
      width = Math.min(width, isCjk ? maxLenZh * fontPx : maxLenEn * fontPx * LATIN_AVERAGE_EM);
    }
    return width;
  };

  // Convert Hex colors (e.g. #FFFFFF) to ASS Colors (e.g. &H00FFFFFF)
  const hexToAssRaw = (hex: string): string => {
    if (!hex) return '&H00FFFFFF';
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length === 6) {
      // #RRGGBB -> &H00BBGGRR
      const r = cleanHex.substring(0, 2);
      const g = cleanHex.substring(2, 4);
      const b = cleanHex.substring(4, 6);
      return `&H00${b}${g}${r}`;
    }
    return '&H00FFFFFF';
  };
  const hexToAss = hexToAssRaw;
  // HDR variant: only fills (PrimaryColour) change — warm grey for white, linear dimming otherwise.
  const hdrLevel = isHdrLevelId(options.hdr) ? getHdrLevel(options.hdr) : null;
  const fillAss = (hex: string, role: FillRole): string =>
    hexToAss(hdrLevel ? hdrFillHex(hex || '#FFFFFF', hdrLevel, role) : hex);

  const assZhColor = fillAss(zhColor, 'primary');
  const assEnColor = fillAss(enColor, 'secondary');
  const assZhOutline = hexToAss(zhOutline);
  const assEnOutline = hexToAss(enOutline);
  const assLyricColor = fillAss(lyricColor, 'primary');
  const assLyricEnColor = fillAss(lyricColor, 'secondary');
  const assWhitePrimary = fillAss('#FFFFFF', 'primary');
  // P0-6: English family name, no CSS quotes / generic families / weight suffixes; the fallback
  // (when the style names no concrete family) is driven by the export preset.
  const assZhFont = normalizeAssFontName(zhFontFamily, profile.fallbackZhFont);
  const assEnFont = normalizeAssFontName(enFontFamily, profile.fallbackEnFont);
  const baseTitle = title.replace(/[\r\n]/g, ' ').trim() || 'Bilingual Subtitles';
  const safeTitle = hdrLevel ? `${baseTitle} (HDR ${hdrLevel.label})` : baseTitle;
  const safeOriginal = (scriptMeta?.originalScript || '').replace(/[\r\n]/g, ' ').trim();
  const safeUpdateDetails = (scriptMeta?.updateDetails || '').replace(/[\r\n]/g, ' ').trim();
  const creditFieldLines = ([
    ['Original Translation', scriptMeta?.originalTranslation],
    ['Original Editing', scriptMeta?.originalEditing],
    ['Original Timing', scriptMeta?.originalTiming],
    ['Script Updated By', scriptMeta?.scriptUpdatedBy],
  ] as const)
    .map(([key, value]) => [key, (value || '').replace(/[\r\n]/g, ' ').trim()] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}\n`)
    .join('');
  const commentLines = (scriptMeta?.comments || [])
    .map((line) => line.replace(/[\r\n]/g, ' ').trim())
    .filter(Boolean);

  // 「深蓝描边」 (stacked two-event layout): every px value scales from the 1080 reference by PlayResY.
  const stacked = profile.stacked;
  const k = stacked ? resY / stacked.referenceResY : 1;
  const navy = stacked ? (() => {
    const primarySize = Math.round(stacked.primaryFontSize * k);
    const secondarySize = Math.round(stacked.primaryFontSize * stacked.secondaryScale * k);
    const script = detectSecondaryScript(subs);
    return {
      primarySize,
      secondarySize,
      marginH: Math.round(stacked.marginH * k),
      secondaryMarginV: Math.round(stacked.secondaryMarginV * k),
      /** Chinese MarginV for a given number of secondary lines (0 → same height as with one). */
      primaryMarginV: (secondaryLines: number) => Math.round(
        (stacked.secondaryMarginV + Math.max(1, secondaryLines) * stacked.primaryFontSize * stacked.secondaryScale + stacked.interLineAdjust) * k,
      ),
      primaryFont: normalizeAssFontName(isTraditionalTrack(subs) ? stacked.primaryFontTraditional : stacked.primaryFont, profile.fallbackZhFont),
      // Source Han Sans covers Latin-1 (es / fr / pt / de / it) but not all of Extended-A (Ÿ, ł, ş…):
      // when the secondary text needs one of those, the Latin line switches to a full-coverage font.
      secondaryFont: script === 'latin' && needsFullLatinFont(subs.map((row) => row.text))
        ? FULL_LATIN_FALLBACK_FONT
        : normalizeAssFontName(stacked.secondaryFont[script], profile.fallbackEnFont),
      primaryOutline: assNumber(stacked.primaryOutline * k),
      secondaryOutline: assNumber(stacked.secondaryOutline * k),
      primaryOutlineColour: hexToAss(stacked.primaryOutlineColour),
      secondaryOutlineColour: hexToAss(stacked.secondaryOutlineColour),
      primaryFill: fillAss(stacked.fill, 'primary'),
      secondaryFill: fillAss(stacked.fill, 'secondary'),
    };
  })() : null;
  const shadow = navy ? 0 : mShadow;
  const auxZhFont = navy ? navy.primaryFont : assZhFont;
  const auxEnFont = navy ? navy.secondaryFont : assEnFont;
  const enShadow = navy ? 0 : mEnOutline;
  const dialogueStyles = navy
    ? `Style: ZH,${navy.primaryFont},${navy.primarySize},${navy.primaryFill},&H000000FF,${navy.primaryOutlineColour},&H00000000,0,0,0,0,100,100,0,0,1,${navy.primaryOutline},0,2,${navy.marginH},${navy.marginH},${navy.primaryMarginV(1)},1
Style: SEC,${navy.secondaryFont},${navy.secondarySize},${navy.secondaryFill},&H000000FF,${navy.secondaryOutlineColour},&H00000000,0,0,0,0,100,100,0,0,1,${navy.secondaryOutline},0,2,${navy.marginH},${navy.marginH},${navy.secondaryMarginV},1`
    : `Style: Han,${assZhFont},${mZhFont},${assZhColor},&H00FF9C41,${assZhOutline},&H00000000,1,0,0,0,100,100,0,0,1,${mOutline},${mShadow},2,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: EN,${assEnFont},${mEnFont},${assEnColor},&H00FFFFFF,${assEnOutline},&H00000000,1,0,0,0,${enScale},${enScale},0,0,1,${mEnOutline},${mEnOutline},2,${mBaseMargin},${mBaseMargin},${Math.floor(mMarginV * 0.6)},1`;

  const header = `[Script Info]
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: yes
ScriptType: v4.00+
${hdrLevel ? 'YCbCr Matrix: None\n' : ''}Title: ${safeTitle}
${safeOriginal ? `Original Script: ${safeOriginal}\n` : ''}${creditFieldLines}${commentLines.map((line) => `Comment: ${line}`).join('\n')}${commentLines.length ? '\n' : ''}${safeUpdateDetails ? `Update Details: ${safeUpdateDetails}\n` : ''}
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${dialogueStyles}
Style: Note,${auxZhFont},${mNoteFont},${assWhitePrimary},&H000000FF,&H0000FBFF,&H00000000,0,0,0,0,100,100,0,0,1,${mOutline},${shadow},8,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: Credit,${auxZhFont},${mNoteFont},${assZhColor},&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${mOutline},${shadow},${CREDIT_ALIGN[styleSettings?.creditPosition ?? 'center']},${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: Lyrics,${auxZhFont},${mLyricFont},${assLyricColor},&H00000000,&H00000000,&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mOutline},${shadow},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.8) : mMarginV},1
Style: Lyrics_EN,${auxEnFont},${mLyricEnFont},${assLyricEnColor},&H00000000,${assEnOutline},&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mEnOutline},${enShadow},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.5) : Math.floor(mMarginV * 0.6)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const srtToAssTime = (t: string) => {
    const [hms, ms] = t.split(',');
    const [h, m, s] = hms.split(':');
    return `${parseInt(h)}:${m}:${s}.${Math.floor(parseInt(ms) / 10).toString().padStart(2, '0')}`;
  };

  const navyLineWidth = (fontPx: number, isCjk: boolean): number => {
    const usable = Math.max(1, resX - 2 * (navy?.marginH ?? mBaseMargin));
    return usable * (isCjk ? profile.assWrap.cjkWidthRatio : profile.assWrap.latinWidthRatio);
  };
  const finishText = (text: string): string => (hdrLevel ? dimInlineFillTags(text, hdrLevel) : text);
  const latinTypography = latinTypographyFor(subs);

  const events = applyAuxiliarySubtitleMode(subs, auxiliaryMode).flatMap((s): string[] => {
    const [start, end] = s.ts.split(" --> ").map(srtToAssTime);
    let style = "Han";
    if (s.type === "credit" || classifyLineKind(s) === 'credit') {
      style = "Credit";
    } else if (s.type === "lyrics") {
      style = /[一-龥]/.test(s.text) ? "Lyrics" : "Lyrics_EN";
    } else if (s.type === "note" || s.type === "commentary" || s.cueKind === 'screen_text' || s.cueKind === 'credit') {
      // Subtitle credits (翻译/制作…) are detected upstream as cueKind 'credit'. Never match
      // single characters such as 合/并/作 — they appear in ordinary dialogue（「我们合作吧」）.
      style = "Note";
    } else if (s.type === "merged") {
      style = "Han";
    } else {
      style = /[一-龥]/.test(s.text) ? "Han" : "EN";
    }

    let sourceText = s.text;
    let topPlaced = isTopPlacedCue(s);
    if (sourceText.startsWith("{\\an8}")) {
      sourceText = sourceText.slice(6);
      topPlaced = true;
    }

    // 「深蓝描边」: ordinary dialogue → Chinese event (upper layer) + secondary event (lower layer),
    // each wrapped at its own font size. Signs / notes / lyrics / credits keep their own styles.
    if (navy && !topPlaced && (style === "Han" || style === "EN")) {
      const blocks = wrapCueBlocks(sourceText, (isCjk, blockIndex) => {
        const secondaryBlock = blockIndex > 0 || style === "EN" || !isCjk;
        const fontPx = secondaryBlock ? navy.secondarySize : navy.primarySize;
        return { fontPx, maxWidth: navyLineWidth(fontPx, isCjk) };
      }, options.report, s.index, false, latinTypography);
      const firstIsPrimary = style === "Han" && blocks.length > 0 && blocks[0].some(hasCjk) && !blocks[0].some((line) => KANA_RE.test(line) || HANGUL_RE.test(line));
      const primaryLines = firstIsPrimary ? blocks[0] : [];
      const secondaryLines = (firstIsPrimary ? blocks.slice(1) : blocks).flat().filter((line) => line.trim());
      const out: string[] = [];
      if (primaryLines.length) {
        // Default MarginV fits one secondary line; taller secondary blocks push the Chinese line up.
        const marginV = secondaryLines.length > 1 ? navy.primaryMarginV(secondaryLines.length) : 0;
        out.push(`Dialogue: ${stacked!.primaryLayer},${start},${end},ZH,,0,0,${marginV},,${finishText(primaryLines.join("\\N"))}`);
      }
      if (secondaryLines.length) {
        out.push(`Dialogue: ${stacked!.secondaryLayer},${start},${end},SEC,,0,0,0,,${finishText(secondaryLines.join("\\N"))}`);
      }
      return out;
    }

    // Smart wrap by rendered width: per-style font px against PlayResX − MarginL − MarginR.
    const isPair = (s.type === "lyrics" || s.type === "merged") && sourceText.includes('\n');
    const primaryPx = style === "Note" || style === "Credit" ? mNoteFont
      : style === "Lyrics" ? mLyricFont
      : style === "Lyrics_EN" ? mLyricEnFont
      : style === "EN" ? mEnFont * enScale / 100
      : mZhFont;
    const secondaryPx = s.type === "lyrics" ? mLyricEnFont : mEnFont * enScale / 100;
    const blocks = wrapCueBlocks(sourceText, (isCjk, blockIndex) => {
      const fontPx = Math.max(1, isPair && blockIndex > 0 ? secondaryPx : primaryPx);
      return { fontPx, maxWidth: assLineWidth(fontPx, isCjk) };
    }, options.report, s.index, topPlaced, latinTypography);

    let processedText: string;
    if (isPair && blocks.length === 2) {
      processedText = blocks[0].join("\\N") + `\\N{\\r${s.type === "lyrics" ? "Lyrics_EN" : "EN"}}` + blocks[1].join("\\N");
    } else {
      processedText = blocks.flat().join("\\N");
    }
    if (topPlaced) processedText = "{\\an8}" + processedText;

    return [`Dialogue: 0,${start},${end},${style},,0,0,0,,${finishText(processedText)}`];
  });

  return header + events.join("\n") + "\n";
}

/**
 * Check if the text is bilingual.
 */
