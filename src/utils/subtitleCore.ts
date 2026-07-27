// Subtitle Processing Core Engine in TypeScript
import {
  OFFSET_DIAGNOSIS_POLICY,
  estimateGlobalOffsetFromStarts,
  type GlobalOffsetDiagnosis,
} from './timeline/offsetDiagnosis';

export {
  type ParsedMediaFilename,
  type MediaIdentityLevel,
  type MediaIdentityAssessment,
  cleanFilename,
  parseMediaFilename,
  assessMediaIdentity,
  buildTmdbSearchQueries,
  smartDetectTitle,
} from './mediaIdentity';
export { OFFSET_DIAGNOSIS_POLICY, type GlobalOffsetDiagnosis } from './timeline/offsetDiagnosis';

export type CueKind = 'dialogue' | 'screen_text' | 'sound_caption' | 'narration' | 'lyrics' | 'commentary' | 'credit' | 'unknown';
export type AuxiliaryCueCategory = 'ambient_sdh' | 'semantic_sdh' | 'screen_text' | 'music' | 'speech_context' | 'unknown';
export type AuxiliaryCueAction = 'hide_by_default' | 'keep_auxiliary' | 'keep_visible';
export type AuxiliarySubtitleMode = 'smart' | 'keep' | 'clean';

/** Soft review hint only — never changes cueKind, merge gates, or smart/clean export. */
export type CueSuspicionKind = 'needs_review';

export interface CueSuspicion {
  kind: CueSuspicionKind;
  confidence: number;
  reasons: string[];
  detail: string;
}

export interface AuxiliaryCueClassification {
  category: AuxiliaryCueCategory;
  confidence: number;
  action: AuxiliaryCueAction;
  reasons: string[];
  suspicion?: CueSuspicion;
}

export interface CueClassification {
  kind: CueKind;
  confidence: number;
  reasons: string[];
  placement?: 'top' | 'positioned' | 'bottom';
  auxiliary?: AuxiliaryCueClassification;
}

export interface AlignmentSourceRef {
  cueIndex: number;
  ts: string;
  text: string;
}

export interface AlignmentProvenance {
  method: 'exact-match' | 'shifted-match' | 'expanded-dialogue' | 'single-track';
  timingSource: 'primary' | 'secondary';
  groupId?: string;
  confidence?: number;
  offsetMs?: number;
  primary?: AlignmentSourceRef;
  secondary?: AlignmentSourceRef;
}

export interface SubRow {
  ts: string;
  text: string;
  type?: string;
  cueKind?: CueKind;
  auxiliary?: AuxiliaryCueClassification;
  alignment?: 'expanded-dialogue' | 'shifted-match';
  provenance?: AlignmentProvenance;
  index: number;
}

export interface RawSub {
  ts: string;
  text: string;
  cueKind?: CueKind;
  cueMeta?: CueClassification;
  auxiliary?: AuxiliaryCueClassification;
}

export interface DecodeResult {
  text: string;
  encoding: string;
}

export type SubtitleLanguage =
  | 'zh-CN'
  | 'zh-TW'
  | 'en'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'es'
  | 'latin'
  | 'bilingual'
  | 'commentary'
  | 'unknown';

export interface SubtitleLanguagePair {
  primary: 'zh-CN' | 'zh-TW';
  /** Main-path secondary is English only; other languages are demoted before pairing. */
  secondary: 'en';
}

export interface SubtitleLanguageDetection {
  lang: SubtitleLanguage;
  isBilingual: boolean;
  languagePair?: SubtitleLanguagePair;
}

export type SubtitleAttributionRole = 'publisher' | 'translator' | 'editor' | 'timing' | 'proofreader' | 'encoder' | 'website' | 'producer';

export interface SubtitleAttribution {
  role: SubtitleAttributionRole;
  label: string;
  value: string;
  source: 'ass-header' | 'subtitle-cue';
}

/** Optional ASS Script Info fields written on export. */
export interface AssScriptMeta {
  originalScript?: string;
  comments?: string[];
  updateDetails?: string;
}

export interface StyleSettings {
  zhFontSize: number;
  enFontSize: number;
  zhColor: string;
  enColor: string;
  zhOutline: string;
  enOutline: string;
  enScale: number;
  maxLenZh: number;
  maxLenEn: number;
  marginV: number;
  resolution?: '1080p' | '4K' | 'SD';
  aspectRatio?: '16:9' | '4:3' | '2.39:1' | '1.9:1';
  globalScale?: number;
  lyricFontSize?: number;
  lyricColor?: string;
  lyricItalic?: boolean;
  lyricPosition?: 'top' | 'bottom';
  auxiliaryMode?: AuxiliarySubtitleMode;
  // 新增：字体家族选择（支持阅片环境下的专业 CJK 协调）
  zhFontFamily?: string;
  enFontFamily?: string;
}

/**
 * Try to decode file buffer with correct encoding.
 */
export function decodeBuffer(buffer: ArrayBuffer): DecodeResult {
  const arr = new Uint8Array(buffer);
  
  if (arr.length >= 2) {
    if (arr[0] === 0xFF && arr[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(buffer), encoding: 'utf-16le (BOM)' };
    if (arr[0] === 0xFE && arr[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(buffer), encoding: 'utf-16be (BOM)' };
  }
  if (arr.length >= 3 && arr[0] === 0xEF && arr[1] === 0xBB && arr[2] === 0xBF) {
    return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf-8 (BOM)' };
  }

  const decoders = ['utf-8', 'gbk', 'gb18030', 'big5', 'utf-16le', 'utf-16be'];
  for (const encoding of decoders) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      const text = decoder.decode(buffer);
      if (/[一-龥]/.test(text)) {
        return { text, encoding };
      }
      if (/\d{2}:\d{2}:\d{2}/.test(text)) {
        return { text, encoding: encoding + ' (Auto)' };
      }
    } catch {
      continue;
    }
  }
  
  return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf-8 (fallback)' };
}

/**
 * Determine language from text content.
 */
export function detectLanguageByContent(text: string): SubtitleLanguage {
  if (!text) return "unknown";

  const kanaCount = (text.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || []).length;
  if (kanaCount >= 2) return 'ja';

  const hangulCount = (text.match(/[\uac00-\ud7af\u1100-\u11ff]/g) || []).length;
  if (hangulCount >= 2) return 'ko';
  
  const tcChars = text.match(/[門設計這說著會後個過嗎從來對]/g);
  const scChars = text.match(/[门设计这说着会后个过吗从来对]/g);
  const tcCount = tcChars ? tcChars.length : 0;
  const scCount = scChars ? scChars.length : 0;
  
  const hanMatch = text.match(/[一-龥]/g);
  const hanCount = hanMatch ? hanMatch.length : 0;
  
  if (hanCount > 5 || (text.length > 0 && hanCount / text.length > 0.05)) {
    if (tcCount > scCount) {
      return "zh-TW";
    }
    return "zh-CN";
  }
  const clean = text
    .replace(/<[^>]*>|\{[^}]*\}/g, ' ')
    .replace(/[^\p{L}\p{M}'’\s-]/gu, ' ')
    .toLowerCase();
  const frenchSignals = (clean.match(/\b(le|la|les|des|une|dans|avec|pour|mais|est|pas|nous|vous|qui|que)\b/g) || []).length;
  const spanishSignals = (clean.match(/\b(el|la|los|las|un|una|unos|unas|de|del|con|por|para|pero|está|esta|que|qué|soy|eres|somos|usted|ustedes|gracias|hola|movimiento|detectado|supervisión|creativa|señor|señora)\b/g) || []).length;
  const englishSignals = (clean.match(/\b(the|and|you|that|this|with|for|have|not|are|was|what|where|why|hello|yes|no)\b/g) || []).length;
  const frenchAccents = (clean.match(/[àâçéèêëîïôùûüÿœæ]/g) || []).length;
  const spanishMarks = (clean.match(/[áíóñ¿¡]/g) || []).length;
  const latinCount = (clean.match(/[a-z\u00c0-\u024f]/g) || []).length;

  // 西欧语需明显强于英语信号，避免英文对白里偶发 le/que/pas 被判成法语/西语。
  if (spanishMarks > 0 || (spanishSignals >= 2 && spanishSignals > englishSignals)) return 'es';
  if (frenchAccents > 0 || (frenchSignals >= 2 && frenchSignals > englishSignals)) return 'fr';
  if (englishSignals >= 1) return 'en';
  if (latinCount >= 2) return 'latin';
  return 'unknown';
}

const hasFilenameToken = (name: string, tokens: string[]): boolean => {
  const normalized = name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[._()[\]{}+]+/g, ' ');
  return tokens.some(token => new RegExp(`(^|\\s|-)${token}(\\s|-|$)`, 'i').test(normalized));
};

/** Main-path secondary slot accepts English only. */
export function isMainPathSecondaryLanguage(language: string): language is 'en' {
  return language === 'en';
}

/** Prefer Simplified Chinese over Traditional when both are candidates. */
export function mainPathPrimaryRank(language: string): number {
  if (language === 'zh-CN' || language === 'zh') return 2;
  if (language === 'zh-TW') return 1;
  return 0;
}

export function detectLanguageByFilename(name: string): SubtitleLanguage {
  const normalized = name.toLowerCase();
  if (/(commentary|comment|director|解说|導評|导轨)/i.test(name)) return 'commentary';
  if (/(双语|雙語|中英|中日|中韩|中韓|中法|中西|bilingual|dual[-_.\s]?sub)/i.test(name)) return 'bilingual';
  if (/(chinese[._\s-]*traditional|traditional[._\s-]*chinese|zh[-_.\s]?tw|繁體|繁体|繁中|big5)/i.test(name) || hasFilenameToken(normalized, ['cht', 'tc'])) return 'zh-TW';
  if (/(chinese[._\s-]*simplified|simplified[._\s-]*chinese|zh[-_.\s]?cn|简体|簡體|简中|簡中|gbk|gb2312|gb18030)/i.test(name) || hasFilenameToken(normalized, ['chs', 'sc'])) return 'zh-CN';
  if (/(english|英语|英語|英文)/i.test(name) || hasFilenameToken(normalized, ['eng', 'en'])) return 'en';
  if (/(japanese|日本語|日语|日語|日文)/i.test(name) || hasFilenameToken(normalized, ['jpn', 'ja'])) return 'ja';
  if (/(korean|한국어|韩语|韓語|韩文|韓文)/i.test(name) || hasFilenameToken(normalized, ['kor', 'ko'])) return 'ko';
  if (/(french|français|francais|法语|法語|法文)/i.test(name) || hasFilenameToken(normalized, ['fre', 'fra', 'fr', 'vff', 'vfq'])) return 'fr';
  if (/(spanish|español|espanol|castellano|西班牙语|西班牙語|西语|西語)/i.test(name) || hasFilenameToken(normalized, ['spa', 'esp', 'es'])) return 'es';
  return 'unknown';
}

export function detectSubtitleLanguage(name: string, text: string): SubtitleLanguageDetection {
  const filenameLang = detectLanguageByFilename(name);
  const languagePair = detectSubtitleLanguagePair(text, name);
  // Main path: only zh(+TW) + English counts as bilingual; other secondaries are demoted.
  const isBilingual = Boolean(languagePair);
  const contentLang = detectLanguageByContent(text);
  const lang: SubtitleLanguage = isBilingual
    ? 'bilingual'
    : filenameLang === 'bilingual'
      // Filename claims bilingual (e.g. 中日) but no English secondary → demote to content/primary.
      ? (contentLang !== 'unknown' ? contentLang : 'zh-CN')
      : filenameLang !== 'unknown'
        ? filenameLang
        : contentLang;

  return languagePair
    ? { lang, isBilingual, languagePair }
    : { lang, isBilingual };
}

/**
 * Line wrap text intelligently.
 */
export function smartLineWrap(text: string, isChinese = true, maxChars = 20): string {
  if (!text) return "";
  const lines = text.split('\n');
  const wrappedLines = lines.map(line => {
    if (isChinese) {
      if (line.length <= maxChars) return line;
      
      const breakRegex = /[，。！？；、\s]/g;
      let match;
      const breakPoints: number[] = [];
      while ((match = breakRegex.exec(line)) !== null) {
        breakPoints.push(match.index);
      }
      
      const center = line.length / 2;
      let bestBreakPoint = -1;
      let minDistance = Infinity;
      
      for (const bp of breakPoints) {
        const ratio = bp / line.length;
        if (ratio >= 0.25 && ratio <= 0.75) {
          const distance = Math.abs(bp - center);
          if (distance < minDistance) {
            minDistance = distance;
            bestBreakPoint = bp;
          }
        }
      }
      
      if (bestBreakPoint !== -1) {
        const breakIndex = bestBreakPoint + 1;
        return line.slice(0, breakIndex) + "\\N" + line.slice(breakIndex).trim();
      }
      
      const balancedMiddle = Math.ceil(line.length / 2);
      return line.slice(0, balancedMiddle) + "\\N" + line.slice(balancedMiddle);
    } else {
      if (line.length <= maxChars * 3) return line;
      const words = line.split(' ');
      let currentLen = 0;
      const result: string[] = [];
      let currentLine: string[] = [];
      
      words.forEach(word => {
        if (currentLen + word.length > maxChars * 3) {
          result.push(currentLine.join(' '));
          currentLine = [word];
          currentLen = word.length;
        } else {
          currentLine.push(word);
          currentLen += word.length + 1;
        }
      });
      result.push(currentLine.join(' '));
      return result.join('\\N');
    }
  });
  return wrappedLines.join('\\N');
}

/**
 * Extract ASS styles.
 */
export function extractStylesFromAss(text: string): Partial<StyleSettings> | null {
  if (!text) return null;

  const normalizedText = text.replace(/\r\n?/g, '\n');
  const lines = normalizedText.split('\n').map(line => line.trim());
  const styleStart = lines.findIndex(line => line.toLowerCase() === '[v4+ styles]');
  if (styleStart === -1) return null;
  const styleEndOffset = lines.slice(styleStart + 1).findIndex(line => /^\[[^\]]+\]$/.test(line));
  const styleEnd = styleEndOffset === -1 ? lines.length : styleStart + 1 + styleEndOffset;
  const styleLinesInSection = lines.slice(styleStart + 1, styleEnd).filter(Boolean);
  const scriptInfoEnd = lines.findIndex((line, index) => index > 0 && /^\[[^\]]+\]$/.test(line));
  const scriptInfoLines = lines.slice(0, scriptInfoEnd === -1 ? styleStart : scriptInfoEnd);
  const playResY = Number.parseFloat(
    scriptInfoLines.find(line => /^PlayResY\s*:/i.test(line))?.split(':').slice(1).join(':').trim() || '288',
  );
  const baseScale = Number.isFinite(playResY) && playResY > 0 ? playResY / 288 : 1;

  const formatLine = styleLinesInSection.find(line => /^Format:/i.test(line));
  const styleLines = styleLinesInSection.filter(line => /^Style:/i.test(line));
  
  if (!formatLine || styleLines.length === 0) return null;

  const formatKeys = formatLine.replace(/^Format:/i, '').split(',').map(key => key.trim());
  const parseStyle = (line: string) => line.replace(/^Style:/i, '').split(',').map(value => value.trim());
  const styleName = (line: string) => parseStyle(line)[formatKeys.indexOf('Name')] || '';
  const targetStyle = styleLines.find(line => /^(han|chinese|zh|chs|cht)$/i.test(styleName(line)))
    || styleLines.find(line => /^default$/i.test(styleName(line)))
    || styleLines[0];
  const secondaryStyle = styleLines.find(line => /^(en|eng|english|latin)$/i.test(styleName(line)));
  const styleValues = parseStyle(targetStyle);
  const secondaryValues = secondaryStyle ? parseStyle(secondaryStyle) : null;

  const getVal = (key: string, values = styleValues): string | null => {
    const idx = formatKeys.indexOf(key);
    return idx !== -1 ? values[idx] : null;
  };

  const assToHex = (assColor: string | null): string => {
    if (!assColor) return '#FFFFFF';
    const digits = assColor.replace(/^&H/i, '').replace(/&$/, '');
    const bgr = digits.length >= 6 ? digits.slice(-6) : '';
    if (/^[0-9a-fA-F]{6}$/.test(bgr)) {
      return `#${bgr.slice(4, 6)}${bgr.slice(2, 4)}${bgr.slice(0, 2)}`.toUpperCase();
    }
    return '#FFFFFF';
  };

  const zhFontSize = Number.parseFloat(getVal('Fontsize') || '22') / baseScale;
  const enFontSize = Number.parseFloat(secondaryValues ? getVal('Fontsize', secondaryValues) || '' : '') / baseScale;
  const marginV = Number.parseFloat(getVal('MarginV') || '20') / baseScale;

  return {
    zhFontSize: Math.round(zhFontSize) || 22,
    enFontSize: Math.round(enFontSize) || Math.max(10, Math.round(zhFontSize * 0.7)) || 12,
    zhColor: assToHex(getVal('PrimaryColour')),
    enColor: assToHex(secondaryValues ? getVal('PrimaryColour', secondaryValues) : getVal('PrimaryColour')),
    zhOutline: assToHex(getVal('OutlineColour')),
    enOutline: assToHex(secondaryValues ? getVal('OutlineColour', secondaryValues) : getVal('OutlineColour')),
    zhFontFamily: getVal('Fontname') || undefined,
    enFontFamily: secondaryValues ? getVal('Fontname', secondaryValues) || undefined : undefined,
    marginV: Math.round(marginV) || 20,
  };
}

// Filename / TMDB identity lives in mediaIdentity.ts (re-exported above).

export function cleanSubtitleContent(text: string, isEnglish = false): string {
  if (!text) return "";
  let cleaned = text.replace(/\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/\[字幕组\]|\[制作\]|\[压制\]/g, '');
  cleaned = cleaned.replace(/^-+\s*/, '');
  cleaned = cleaned.replace(/\s*-+$/, '');
  
  if (isEnglish) {
    cleaned = cleaned.replace(/^[A-Z\s]+:\s*/, '');
  }
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

const timestampRegex = /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/;

const stripSubtitleInlineTags = (text: string): string => text
  .replace(/\{\\[^}]*\}/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/\\N/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stripWrappingBrackets = (text: string): string => text
  .trim()
  .replace(/^\s*[\[(（【]\s*/, '')
  .replace(/\s*[\])）】]\s*$/, '')
  .trim();

/** Named confidence floors for auxiliary cue classification (tune here, not inline). */
export const AUXILIARY_CLASSIFY_SCORES = {
  unknownBase: 38,
  music: 78,
  screenText: 86,
  speechContext: 82,
  ambient: 76,
  bracket: 58,
} as const;

const isFullyWrappedAuxiliaryCue = (cleanText: string): boolean => (
  /^[\[(（【][\s\S]*[\])）】]$/.test(cleanText) || /^<[^>]+>$/.test(cleanText)
);

/** High-confidence sound EVENTS only. Bare nouns like "phone" /「电话」stay screen text (keep). */
// EN seeds: Netflix/CC reaction + impact (Lucky / Prada). No bare nouns (phone/TEXT stay screen).
const CONFIRMED_AMBIENT_EN_RE = /\b(?:(?:phone|telephone|cell(?:phone)?|doorbell)\s+(?:rings?|ringing|buzzes?|buzzing|vibrat(?:e|es|ing)|chimes?)|(?:door|gate)\s+(?:opens?|closes?|slams?|creaks?|knocking)|(?:soft |faint |distant |loud |strained )?(?:beeps?|beeping|knocking|creaking)|footsteps?|wind(?:\s+howling)?|thunder|sirens?|engines?\s+revving|applause|applauding|laughter|no\s+audible\s+dialogue|(?:sighs?|groans?|grunts?|gasps?|gasping|panting|pants|whimpers?|gulps?|moans?|crying|sniffling|chuckles?|chuckling|laughs?|laughing|scoffs?|tuts?|coughs?|exhales?|inhales?|screams?|exclaims?|stammers?|vocaliz(?:es|ing)|muttering|mumbling|shuffling|clears\s+throat|breathes?(?:\s+deeply)?)\b|(?:cheering|clamoring|chattering|whistling)\b|(?:honks?|honking|clatter|clatters?|dings?|chimes?|thuds?|bangs?|crashes?|clanks?|kisses?|clicks?|clicking)\b|(?:horns?\s+honks?|horns?\s+honking|keys?\s+clatter|elevator\s+bell\s+dings?|bell\s+tolling|keyboard\s+clicking|pen\s+clicks?|pages?\s+shuffling)\b|(?:rings?|ringing)\b)/i;
const CONFIRMED_AMBIENT_ZH_RE = /(脚步声|腳步聲|风声|風聲|雨声|雨聲|雷声|雷聲|电话铃声|電話鈴聲|铃声|鈴聲|敲门声|敲門聲|开门声|開門聲|关门声|關門聲|笑声|笑聲|掌声|掌聲|哭声|哭聲|引擎声|引擎聲|警笛(?:声|聲)?|叹息声|嘆息聲|呼吸声|呼吸聲|嗡嗡声|滴滴声|咔嚓声)|(?:声|聲|响|響)$/;
const SPEECH_CONTEXT_EN_RE = /\b(?:speaking|speaks|language|alien|robot|machine|computer|ai|voice|radio|intercom|announcer|broadcast|chatter|chirps?|responds?|whispers?|murmurs?)\b/i;
const SPEECH_CONTEXT_ZH_RE = /(外星|语言|語言|机器|機器|人工智能|广播|廣播|电台|電台|对讲机|對講機|播报|播報|说话|說話|低语|低語)/;
const MUSIC_KEYWORD_RE = /\b(?:song|singing|lyrics?|playing)\b/i;
const MUSIC_ZH_RE = /(歌词|歌声|唱歌|哼唱|音乐|音樂|歌声|歌聲)/;
const TITLE_CARD_INNER_RE = /^(?:\d{4}年|\d{1,2}月|\d{1,2}日|[一二三四五六七八九十\d]+个月后|[一二三四五六七八九十\d]+年后|第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+幕)/;

const isConfirmedAmbientSound = (innerText: string): boolean => (
  CONFIRMED_AMBIENT_EN_RE.test(innerText) || CONFIRMED_AMBIENT_ZH_RE.test(innerText)
);

/** Peel CC/Netflix speaker or group prefix inside [] so "Amari gasps" → "gasps". */
const stripEnglishSdhSpeakerPrefix = (innerText: string): string => {
  const text = innerText.trim();
  if (!text) return text;
  let next = text
    .replace(/^person\s+\d+\s+/i, '')
    .replace(/^[A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+)?\s*:\s*/, '')
    .replace(/^(?:both|all|crowd|guests?|staff|mourners?|patrons?|people|singer)\s+/i, '')
    // Capitalized character name(s) before a lowercase sound phrase
    .replace(/^[A-Z][\w.'’\-]{0,20}(?:\s+[A-Z][\w.'’\-]{0,20})?\s+(?=[a-z])/u, '');
  next = next.trim();
  return next || text;
};

const isAsciiSquareWrappedCue = (cleanText: string): boolean => /^\[[\s\S]*\]$/.test(cleanText);

/** Human-readable trace for why an auxiliary cue was classified. */
export function describeAuxiliaryReason(reason: string): string {
  switch (reason) {
    case 'ambient-sound':
      return '括号内为明确音效事件，智能精简可剥离';
    case 'music-or-lyric':
      return '歌词/音乐标记';
    case 'screen-text':
      return '屏幕文字关键词';
    case 'title-card-pattern':
      return '标题卡/时间卡形态';
    case 'sign-like-uppercase':
      return '全大写标牌形态';
    case 'bracket-screen-text':
      return '括号内容默认按画面文字保留（非明确音效）';
    case 'semantic-speech-context':
      return '括号内为发言语境说明';
    case 'lyric-symbol':
      return '音符歌词标记';
    case 'subtitle-credit':
      return '字幕制作署名';
    default:
      return reason;
  }
}

export function classifyAuxiliaryCue(text: string): AuxiliaryCueClassification {
  const rawText = text || '';
  const cleanText = stripSubtitleInlineTags(rawText);
  const innerText = stripWrappingBrackets(cleanText);
  const fullyWrapped = isFullyWrappedAuxiliaryCue(cleanText);
  // EN [] only: peel speaker/group prefix before ambient match (中文括号不走此剥皮).
  const ambientInner = fullyWrapped && isAsciiSquareWrappedCue(cleanText)
    ? stripEnglishSdhSpeakerPrefix(innerText)
    : innerText;
  const reasons: string[] = [];
  let category: AuxiliaryCueCategory = 'unknown';
  let confidence: number = AUXILIARY_CLASSIFY_SCORES.unknownBase;
  let action: AuxiliaryCueAction = 'keep_auxiliary';

  // High confidence only: lyric symbols, or music keywords inside structural brackets.
  if (isLyricText(rawText) || (fullyWrapped && (MUSIC_KEYWORD_RE.test(innerText) || MUSIC_ZH_RE.test(innerText)))) {
    category = 'music';
    confidence = AUXILIARY_CLASSIFY_SCORES.music;
    action = 'keep_auxiliary';
    reasons.push('music-or-lyric');
  }

  // Short English tokens need word boundaries — otherwise SIGN matches "signed"/"designed",
  // and TEXT matches "treatment"/"context", which wrongly blocks dialogue pairing.
  if (/\b(?:ON[\s-]?SCREEN|SCREEN[\s-]?TEXT|TITLE[\s-]?CARD|CAPTION|SUBTITLE|TEXT|SIGN)\b|sign reads|text reads|牌匾|招牌|标识|路牌|屏幕|短信|邮件|标题|告示|字幕显示/i.test(innerText)) {
    category = 'screen_text';
    confidence = AUXILIARY_CLASSIFY_SCORES.screenText;
    action = 'keep_visible';
    reasons.push('screen-text');
  }

  // Speech-context keywords are structural only when bracket-gated.
  if (
    category === 'unknown'
    && fullyWrapped
    && (SPEECH_CONTEXT_EN_RE.test(innerText) || SPEECH_CONTEXT_ZH_RE.test(innerText))
  ) {
    category = 'speech_context';
    confidence = Math.max(confidence, AUXILIARY_CLASSIFY_SCORES.speechContext);
    action = 'keep_auxiliary';
    reasons.push('semantic-speech-context');
  }

  // Only 100%-confirmed sound events may become strippable ambient SDH.
  // 「电话」keep as screen text; 「电话铃声响」/ [phone ringing] may strip.
  // EN [] uses ambientInner (prefix-stripped); 中文 （） still uses raw innerText.
  if (
    (category === 'unknown' || category === 'music')
    && fullyWrapped
    && isConfirmedAmbientSound(ambientInner)
  ) {
    const isMusicAmbient = /\b(?:music|song|singing|playing)\b/i.test(innerText) || /(音乐|音樂|歌声|歌聲)/.test(innerText);
    category = isMusicAmbient ? 'music' : 'ambient_sdh';
    confidence = Math.max(confidence, isMusicAmbient ? AUXILIARY_CLASSIFY_SCORES.music : AUXILIARY_CLASSIFY_SCORES.ambient);
    action = isMusicAmbient ? 'keep_auxiliary' : 'hide_by_default';
    reasons.push('ambient-sound');
  }

  // All other bracketed content defaults to keep-visible screen text.
  // 中文 （） 与未命中的 EN [] 仍走此保守回落（本轮不改默认分叉）。
  if (category === 'unknown' && fullyWrapped) {
    if (TITLE_CARD_INNER_RE.test(innerText)) {
      reasons.push('title-card-pattern');
    } else if (/^[A-Z0-9][A-Z0-9\s.'’:&-]{0,28}$/.test(innerText) && /[A-Z]/.test(innerText)) {
      reasons.push('sign-like-uppercase');
    } else {
      reasons.push('bracket-screen-text');
    }
    category = 'screen_text';
    confidence = AUXILIARY_CLASSIFY_SCORES.screenText;
    action = 'keep_visible';
  }

  return { category, confidence, action, reasons };
}

export function classifySubtitleCue(
  text: string,
  context: { timingLine?: string; assStyle?: string } = {}
): CueClassification {
  const rawText = text || '';
  const cleanText = stripSubtitleInlineTags(rawText);
  const timingLine = context.timingLine || '';
  const style = context.assStyle || '';
  const reasons: string[] = [];
  let screenScore = 0;
  let narrationScore = 0;
  let placement: CueClassification['placement'];

  if (isLyricText(rawText)) {
    return { kind: 'lyrics', confidence: 92, reasons: ['lyric-symbol'] };
  }

  if (isSubtitleCreditText(rawText)) {
    return { kind: 'credit', confidence: 94, reasons: ['subtitle-credit'] };
  }

  const auxiliary = classifyAuxiliaryCue(rawText);
  if (auxiliary.category === 'screen_text') {
    return {
      kind: 'screen_text',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      placement: auxiliary.action === 'keep_visible' ? 'top' : undefined,
      auxiliary,
    };
  }
  if (auxiliary.category === 'ambient_sdh' || auxiliary.category === 'music') {
    return {
      kind: 'sound_caption',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      auxiliary,
    };
  }
  if (auxiliary.category === 'semantic_sdh' || auxiliary.category === 'speech_context') {
    return {
      kind: 'narration',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      auxiliary,
    };
  }

  if (/\\an[789]\b/i.test(rawText) || /\balign\s*:\s*top\b/i.test(timingLine) || /\bline\s*:\s*(?:[0-2]?\d%?|top)\b/i.test(timingLine)) {
    screenScore += 28;
    placement = 'top';
    reasons.push('top-position');
  }
  if (/\\pos\s*\(|\\move\s*\(/i.test(rawText) || /\bX1\s*:\s*\d+|\bY1\s*:\s*\d+|\bposition\s*:/i.test(timingLine)) {
    screenScore += 34;
    placement = placement || 'positioned';
    reasons.push('explicit-position');
  }
  if (/\b(signs?|screen|title|top|text|onscreen|caption|location)\b/i.test(style)) {
    screenScore += 42;
    placement = placement || 'top';
    reasons.push('ass-style');
  }

  if (/^[A-Z0-9][A-Z0-9\s.'’:&-]{1,28}$/.test(cleanText) && /[A-Z]/.test(cleanText)) {
    screenScore += 22;
    reasons.push('sign-like-uppercase');
  }
  if (/(牌匾|招牌|标识|路牌|字幕|屏幕|短信|邮件|标题|文件|海报|报纸|新闻标题|告示|警告|禁止|入口|出口|EXIT|WARNING|POLICE|NOTICE)/i.test(cleanText)) {
    screenScore += 24;
    reasons.push('screen-text-keyword');
  }
  if (/^(?:\d{4}年|\d{1,2}月|\d{1,2}日|[一二三四五六七八九十\d]+个月后|[一二三四五六七八九十\d]+年后|第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+幕)/.test(cleanText)) {
    screenScore += 20;
    reasons.push('title-card-pattern');
  }

  const hasDialoguePunctuation = /[。！？!?]$/.test(cleanText);
  const hasCommonDialogueWords = /(我|你|他|她|我们|你们|他们|是|有|在|去|来|说|做|看|听|想|要|会|能|了|吗|呢|吧|yeah|yes|no|you|i|we|they|he|she|what|why|how)/i.test(cleanText);
  if (cleanText.length > 0 && cleanText.length <= 14 && !hasDialoguePunctuation && !hasCommonDialogueWords) {
    screenScore += 12;
    reasons.push('short-label-like');
  }

  if (/^\([^)]+\)$|^（[^）]+）$|^\[[^\]]+\]$|^【[^】]+】$/.test(cleanText)) {
    narrationScore += 34;
    reasons.push('bracket-note');
  }
  if (/(旁白|画外音|广播|播报|通知|音效|声音|脚步声|笑声|掌声|音乐)/.test(cleanText)) {
    narrationScore += 38;
    reasons.push('narration-or-sound-keyword');
  }

  if (screenScore >= 38 && screenScore >= narrationScore) {
    return {
      kind: 'screen_text',
      confidence: Math.min(96, 52 + screenScore),
      reasons,
      placement,
      auxiliary: auxiliary.category !== 'unknown' ? auxiliary : undefined,
    };
  }

  if (narrationScore >= 38) {
    return {
      kind: 'narration',
      confidence: Math.min(92, 48 + narrationScore),
      reasons,
      placement,
      auxiliary,
    };
  }

  // Keep soft suspicions on ordinary dialogue so UI can flag them without blocking merge.
  const dialogueAuxiliary = auxiliary.suspicion
    || (auxiliary.category !== 'unknown' && auxiliary.reasons.length > 0)
    ? auxiliary
    : undefined;

  return { kind: 'dialogue', confidence: 55, reasons: auxiliary.suspicion?.reasons ?? [], placement, auxiliary: dialogueAuxiliary };
}

/**
 * Clean SRT raw text.
 */
export function enhancedSrtCleaner(text: string, isEnglish = false, addLog: (msg: string, type: 'info' | 'success' | 'error') => void = () => {}): string {
  text = text.replace(/[\uFEFF\u200B]/g, '');
  const lines = text.split(/\r?\n/);
  const cleanedBlocks: string[] = [];
  let index = 1;
  let i = 0;
  
  const totalLines = lines.length;
  const rawBlocks = (text.match(new RegExp(timestampRegex, 'g')) || []).length;
  
  addLog(`[${isEnglish ? '英文' : '中文'}字幕] 识别到 ${rawBlocks} 条原始块，共 ${totalLines} 行内容`, "info");

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    
    if (timestampRegex.test(line)) {
      const timestampLine = line.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2");
      const content: string[] = [];
      i++;
      
      while (i < lines.length) {
        const contentLine = lines[i].trim();
        if (!contentLine) break;
        if (timestampRegex.test(contentLine)) break;
        if (/^\d+$/.test(contentLine) && i + 1 < lines.length && timestampRegex.test(lines[i+1].trim())) {
          break;
        }
        content.push(contentLine);
        i++;
      }
      
      if (content.length > 0) {
        const cleanedContent = cleanSubtitleContent(content.join(" "), isEnglish);
        if (cleanedContent) {
          cleanedBlocks.push(`${index}\n${timestampLine}\n${cleanedContent}`);
          index++;
        }
      }
    } else {
      i++;
    }
  }
  return cleanedBlocks.join("\n\n") + "\n\n";
}

/**
 * Parse SRT text to rows.
 */
export function parseSrt(text: string): RawSub[] {
  text = text.replace(/[\uFEFF\u200B]/g, '');
  const lines = text.split(/\r?\n/);
  const subtitles: RawSub[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    
    const timestampMatch = line.match(timestampRegex);
    if (timestampMatch) {
      const timestamp = timestampMatch[0].replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2");
      i++;
      const contentLines: string[] = [];
      
      while (i < lines.length) {
        const contentLine = lines[i].trim();
        if (!contentLine) break;
        if (timestampRegex.test(contentLine)) break;
        if (/^\d+$/.test(contentLine) && i + 1 < lines.length && timestampRegex.test(lines[i+1].trim())) {
          break;
        }
        contentLines.push(contentLine);
        i++;
      }
      
      if (contentLines.length > 0) {
        const cueText = contentLines.join(" ");
        const cueMeta = classifySubtitleCue(cueText, { timingLine: line });
        subtitles.push({ ts: timestamp, text: cueText, cueKind: cueMeta.kind, cueMeta, auxiliary: cueMeta.auxiliary });
      }
    } else {
      i++;
    }
  }
  return subtitles;
}

/**
 * Universal Subtitle Parser (SRT & ASS).
 */
export function parseSubtitle(text: string): RawSub[] {
  if (!text) return [];
  const isAss = text.includes('[Events]') && text.includes('Dialogue:');
  if (isAss) {
    const lines = text.split(/\r?\n/);
    const parsed: RawSub[] = [];
    let formatKeys: string[] = [];
    lines.forEach(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith('Format:')) {
        formatKeys = trimmed.replace('Format:', '').split(',').map(key => key.trim().toLowerCase());
      }
      if (trimmed.startsWith('Dialogue:')) {
        const parts = l.split(',');
        if (parts.length >= 10) {
          const startIdx = formatKeys.indexOf('start') >= 0 ? formatKeys.indexOf('start') : 1;
          const endIdx = formatKeys.indexOf('end') >= 0 ? formatKeys.indexOf('end') : 2;
          const styleIdx = formatKeys.indexOf('style') >= 0 ? formatKeys.indexOf('style') : 3;
          const textIdx = formatKeys.indexOf('text') >= 0 ? formatKeys.indexOf('text') : 9;
          const ts = `${parts[startIdx].replace('.', ',')} --> ${parts[endIdx].replace('.', ',')}`;
          const rawDiag = parts.slice(textIdx).join(',');
          const cleanDiag = rawDiag.replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, '').trim();
          const cueMeta = classifySubtitleCue(rawDiag, { assStyle: parts[styleIdx] || '' });
          parsed.push({ ts, text: cleanDiag, cueKind: cueMeta.kind, cueMeta, auxiliary: cueMeta.auxiliary });
        }
      }
    });
    return parsed;
  }
  return parseSrt(text);
}

export function timeToMs(t: string): number {
  if (!t) return 0;
  const [hms, ms] = t.split(',');
  const [h, m, s] = hms.split(':');
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms || '0');
}

export function msToTime(ms: number): string {
  ms = Math.max(0, ms);
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  const pad = (n: number, len: number) => n.toString().padStart(len, '0');
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

export function isLyricText(text: string): boolean {
  if (!text) return false;
  return /[♪♫♬♩🎵🎶]/.test(text);
}

function analyzeContentType(text: string): number {
  let score = 0;
  text = text.trim();
  if (/^\([^)]+\)$/.test(text)) score += 50;
  if (/^（[^）]+）$/.test(text)) score += 50;
  if (/^\[[^\]]+\]$/.test(text)) score += 50;
  if (/^【[^】]+】$/.test(text)) score += 50;
  if (/[♪♫♬♩🎵🎶]/.test(text)) score += 45;
  if (/^\*[^*]*\*$/.test(text)) score += 40;
  if (/^《[^》]*》$/.test(text)) score += 35;
  if (/(研究中心|医院|学校|公司|大学|机构|中心|办公室|实验室)/.test(text)) score += 25;
  if (/(音效|背景音乐|音乐|声音|响声|铃声|脚步声)/.test(text)) score += 30;
  if (/(旁白|画外音|独白|心想|回忆|闪回|字幕|解说)/.test(text)) score += 35;
  if (/(电视|广播|新闻|公告|通知|播报)/.test(text)) score += 20;
  if (/^\d+年\d+月\d+日/.test(text)) score += 15;
  if (/第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+集/.test(text)) score += 20;
  if (text.length <= 15 && !/[.!?。！？]/.test(text)) score += 15;
  if (!/(是|有|在|去|来|说|做|看|听|想|要|会|能|的|了|着|过)/.test(text)) score += 10;
  const specChars = text.match(/[^\w\u4e00-\u9fff\s]/g) || [];
  if (specChars.length / Math.max(text.length, 1) > 0.3) score += 8;
  if (text.length <= 8) score += 5;
  return score;
}

interface Extraction {
  dialogue: string;
  notes: string;
  type: 'note' | 'mixed' | 'dialogue';
}

function extractDialogueAndNotes(text: string): Extraction {
  text = cleanSubtitleContent(text.trim());
  if (!text) return { dialogue: "", notes: "", type: "dialogue" };
  const score = analyzeContentType(text);
  if (score >= 40) return { dialogue: "", notes: text, type: "note" };
  if (score >= 20 && score < 40) {
    let dialogue = text;
    const notes: string[] = [];
    const noteMatches = text.match(/\([^)]+\)|（[^）]+）|\[[^\]]+\]|【[^】]+】|♪[^♪]*♪|\*[^*]*\*/g) || [];
    for (const note of noteMatches) {
      notes.push(note);
      dialogue = dialogue.replace(note, '').trim();
    }
    dialogue = dialogue.replace(/\s+/g, ' ').replace(/^[^\w\u4e00-\u9fff]+/, '').replace(/[^\w\u4e00-\u9fff]+$/, '');
    if (notes.length > 0 && !dialogue) return { dialogue: "", notes: notes.join(" "), type: "note" };
    if (notes.length > 0 && dialogue) return { dialogue, notes: notes.join(" "), type: "mixed" };
    return { dialogue, notes: "", type: "dialogue" };
  }
  return { dialogue: text, notes: "", type: "dialogue" };
}

const resolveCueKind = (text: string, explicit?: CueKind): CueKind => explicit || classifySubtitleCue(text).kind;

const combineCueKind = (...kinds: Array<CueKind | undefined>): CueKind | undefined => {
  const known = kinds.filter(Boolean) as CueKind[];
  if (known.includes('lyrics')) return 'lyrics';
  if (known.includes('credit')) return 'credit';
  if (known.length > 0 && known.every(kind => kind === 'screen_text')) return 'screen_text';
  if (known.length > 0 && known.every(kind => kind === 'sound_caption')) return 'sound_caption';
  if (known.length > 0 && known.every(kind => kind === 'narration')) return 'narration';
  if (known.includes('commentary')) return 'commentary';
  return known.length > 0 ? 'dialogue' : undefined;
};

const combineAuxiliaryCue = (...items: Array<AuxiliaryCueClassification | undefined>): AuxiliaryCueClassification | undefined => {
  const known = items.filter(Boolean) as AuxiliaryCueClassification[];
  if (known.length === 0) return undefined;
  const priority: AuxiliaryCueCategory[] = ['screen_text', 'semantic_sdh', 'speech_context', 'unknown', 'music', 'ambient_sdh'];
  const selected = [...known].sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category))[0];
  const suspicion = known.find(item => item.suspicion)?.suspicion
    || known.find(item => item.category === 'ambient_sdh' || item.category === 'speech_context')?.suspicion;
  const withSuspicion = suspicion && !selected.suspicion
    ? { ...selected, suspicion }
    : selected;
  // Drop empty unknown noise, but keep suspicion-only hints for user review.
  if (withSuspicion.category === 'unknown' && withSuspicion.confidence < 50 && !withSuspicion.suspicion) {
    return undefined;
  }
  return withSuspicion;
};

interface PreprocessedRow {
  ts: string;
  text: string;
  type: 'note' | 'dialogue';
  cueKind?: CueKind;
  auxiliary?: AuxiliaryCueClassification;
  sourceIndex: number;
  // 保留原始来源
  sourceText?: string;
}

function preprocessMixedContent(subs: RawSub[]): PreprocessedRow[] {
  const processed: PreprocessedRow[] = [];
  for (const [sourceOffset, sub] of subs.entries()) {
    const { ts, text } = sub;
    const sourceIndex = sourceOffset + 1;
    const cueKind = resolveCueKind(text, sub.cueKind);
    const auxiliary = sub.auxiliary || sub.cueMeta?.auxiliary || classifyAuxiliaryCue(text);
    const ex = extractDialogueAndNotes(text);
    if (ex.notes && !ex.dialogue) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics', auxiliary, sourceIndex, sourceText: text });
      } else {
        const noteMeta = classifySubtitleCue(ex.notes);
        const noteKind = noteMeta.kind === 'dialogue'
          ? (cueKind === 'screen_text' || cueKind === 'sound_caption' || cueKind === 'narration' ? cueKind : 'narration')
          : noteMeta.kind;
        processed.push({ ts, text: ex.notes, type: "note", cueKind: noteKind, auxiliary: noteMeta.auxiliary || auxiliary, sourceIndex, sourceText: text });
      }
    } else if (ex.dialogue && !ex.notes) {
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    } else if (ex.dialogue && ex.notes) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics', auxiliary, sourceIndex, sourceText: text });
      } else {
        const noteMeta = classifySubtitleCue(ex.notes);
        const noteKind = noteMeta.kind === 'dialogue'
          ? (cueKind === 'screen_text' || cueKind === 'sound_caption' || cueKind === 'narration' ? cueKind : 'narration')
          : noteMeta.kind;
        processed.push({ ts, text: ex.notes, type: "note", cueKind: noteKind, auxiliary: noteMeta.auxiliary || auxiliary, sourceIndex, sourceText: text });
      }
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    } else {
      processed.push({ ts, text, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    }
  }
  return processed;
}

function calculateOverlapRatio(s1: number, e1: number, s2: number, e2: number): number {
  const oS = Math.max(s1, s2);
  const oE = Math.min(e1, e2);
  if (oS < oE) {
    const oD = oE - oS;
    const tD = Math.max(e1, e2) - Math.min(s1, s2);
    return tD > 0 ? oD / tD : 0;
  }
  return 0;
}

const isStructuralCueKind = (kind?: CueKind): boolean => (
  kind === 'screen_text'
  || kind === 'sound_caption'
  || kind === 'narration'
  || kind === 'lyrics'
  || kind === 'commentary'
  || kind === 'credit'
);

interface CueMergeCompatibility {
  canMerge: boolean;
  scoreAdjustment: number;
}

const getAuxiliaryCategory = (row: PreprocessedRow): AuxiliaryCueCategory | undefined => {
  const category = row.auxiliary?.category;
  return category && category !== 'unknown' ? category : undefined;
};

const isLyricsTranslationPair = (primaryKind: CueKind, secondaryKind: CueKind): boolean => (
  (primaryKind === 'lyrics' && secondaryKind === 'dialogue')
  || (primaryKind === 'dialogue' && secondaryKind === 'lyrics')
  || (primaryKind === 'lyrics' && secondaryKind === 'lyrics')
);

const getCueMergeCompatibility = (primary: PreprocessedRow, secondary: PreprocessedRow): CueMergeCompatibility => {
  const primaryKind = primary.cueKind || 'dialogue';
  const secondaryKind = secondary.cueKind || 'dialogue';
  if (!isStructuralCueKind(primaryKind) && !isStructuralCueKind(secondaryKind)) {
    return { canMerge: true, scoreAdjustment: 0 };
  }
  // 歌词原文（♪）与无音符译词：允许合并，并提高对齐分。
  if (isLyricsTranslationPair(primaryKind, secondaryKind)) {
    return { canMerge: true, scoreAdjustment: primaryKind === secondaryKind ? 10 : 8 };
  }
  // 其余辅助信息不混对白
  if (primaryKind !== secondaryKind) return { canMerge: false, scoreAdjustment: -40 };

  const primaryCategory = getAuxiliaryCategory(primary);
  const secondaryCategory = getAuxiliaryCategory(secondary);
  if (primaryCategory && secondaryCategory && primaryCategory !== secondaryCategory) {
    return { canMerge: false, scoreAdjustment: -36 };
  }
  if (primaryKind === 'screen_text') return { canMerge: true, scoreAdjustment: 2 };
  if (primaryCategory === 'semantic_sdh' || primaryCategory === 'speech_context') return { canMerge: true, scoreAdjustment: 1 };
  if (primaryCategory === 'ambient_sdh' || primaryCategory === 'music') return { canMerge: true, scoreAdjustment: -4 };
  if (primaryKind === 'lyrics') return { canMerge: true, scoreAdjustment: 10 };
  return { canMerge: true, scoreAdjustment: -1 };
};

const shouldAttemptCueMerge = (primary: PreprocessedRow, secondary: PreprocessedRow): boolean => (
  getCueMergeCompatibility(primary, secondary).canMerge
);

const getStartMs = (row: PreprocessedRow): number => timeToMs(row.ts.split(' --> ')[0] || '');

const estimateGlobalOffset = (
  primaryRows: PreprocessedRow[],
  secondaryRows: PreprocessedRow[],
): GlobalOffsetDiagnosis => estimateGlobalOffsetFromStarts(
  primaryRows.map(getStartMs),
  secondaryRows.map(getStartMs),
);

interface AlignmentStep {
  zhIdx: number | null;
  enIdx: number | null;
}

interface ExpandedDialogueRow {
  ts: string;
  text: string;
  type: 'merged';
  cueKind?: CueKind;
  auxiliary?: AuxiliaryCueClassification;
  alignment: 'expanded-dialogue';
  provenance: AlignmentProvenance;
}

interface DialogueTiming {
  start: number;
  end: number;
}

const PACKED_DIALOGUE_TURN = /(^|\n|[。！？!?…][”’」』】）\]]*\s*)[-—–]\s*/g;

/**
 * Split only explicit multi-speaker dialogue markers. Ordinary visual line wraps
 * are intentionally left untouched, so a wrapped French sentence never becomes
 * two invented subtitle turns.
 */
function splitPackedDialogueTurns(sourceText?: string): string[] | null {
  if (!sourceText) return null;

  const raw = sourceText
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\\N/gi, '\n')
    .trim();

  if (!raw) return null;

  let markerCount = 0;
  const separated = raw.replace(PACKED_DIALOGUE_TURN, (match, prefix: string) => {
    markerCount += 1;
    return `${prefix}\u0000`;
  });

  if (markerCount !== 2) return null;

  const turns = separated
    .split('\u0000')
    .map(turn => cleanSubtitleContent(turn))
    .filter(Boolean);

  return turns.length === 2 ? turns : null;
}

function canExpandPackedDialogue(
  packed: PreprocessedRow,
  firstCounterpart: PreprocessedRow,
  secondCounterpart: PreprocessedRow,
): boolean {
  // 歌词/译词行含 "A - B" 唱句，不得当密排双人对话展开。
  if (
    packed.cueKind === 'lyrics'
    || firstCounterpart.cueKind === 'lyrics'
    || secondCounterpart.cueKind === 'lyrics'
    || isLyricText(packed.text)
    || isLyricText(firstCounterpart.text)
    || isLyricText(secondCounterpart.text)
  ) {
    return false;
  }
  // 时间包络校验
  if (!shouldAttemptCueMerge(packed, firstCounterpart) || !shouldAttemptCueMerge(packed, secondCounterpart)) return false;
  const turns = splitPackedDialogueTurns(packed.sourceText);
  if (!turns) return false;

  const [packedStart, packedEnd] = packed.ts.split(' --> ').map(timeToMs);
  const [firstStart, firstEnd] = firstCounterpart.ts.split(' --> ').map(timeToMs);
  const [secondStart, secondEnd] = secondCounterpart.ts.split(' --> ').map(timeToMs);
  if ([packedStart, packedEnd, firstStart, firstEnd, secondStart, secondEnd].some(Number.isNaN)) return false;

  const envelopeToleranceMs = 1200;
  const maxInterCueGapMs = 1400;
  const isWithinPackedEnvelope = firstStart >= packedStart - envelopeToleranceMs
    && secondEnd <= packedEnd + envelopeToleranceMs;
  const isContinuous = firstStart <= secondStart
    && secondStart - firstEnd <= maxInterCueGapMs;

  return isWithinPackedEnvelope && isContinuous;
}

const createSourceRef = (row: PreprocessedRow): AlignmentSourceRef => ({
  cueIndex: row.sourceIndex,
  ts: row.ts,
  text: row.sourceText || row.text,
});

const createSingleTrackRow = (row: PreprocessedRow, timingSource: 'primary' | 'secondary') => ({
  ts: row.ts,
  text: row.text,
  type: 'dialogue',
  cueKind: row.cueKind,
  auxiliary: combineAuxiliaryCue(row.auxiliary),
  provenance: {
    method: 'single-track' as const,
    timingSource,
    [timingSource]: createSourceRef(row),
  },
});

const getRowTiming = (row: PreprocessedRow, offsetMs = 0): DialogueTiming => {
  const [start, end] = row.ts.split(' --> ').map(timeToMs);
  return { start: start - offsetMs, end: end - offsetMs };
};

const createMergedRow = (
  primary: PreprocessedRow,
  secondary: PreprocessedRow,
  primaryTiming: DialogueTiming,
  secondaryTiming: DialogueTiming,
  diagnosis?: GlobalOffsetDiagnosis,
) => {
  const shifted = Boolean(diagnosis?.shouldApply);
  const cueKind = combineCueKind(primary.cueKind, secondary.cueKind);
  const isLyricsRow = cueKind === 'lyrics'
    || isLyricText(primary.text)
    || isLyricText(secondary.text);
  return {
    ts: `${msToTime(Math.min(primaryTiming.start, secondaryTiming.start))} --> ${msToTime(Math.max(primaryTiming.end, secondaryTiming.end))}`,
    text: `${primary.text}\n${secondary.text}`,
    type: isLyricsRow ? 'lyrics' : 'merged',
    cueKind: isLyricsRow ? 'lyrics' as CueKind : cueKind,
    auxiliary: combineAuxiliaryCue(primary.auxiliary, secondary.auxiliary),
    alignment: shifted ? 'shifted-match' as const : undefined,
    provenance: {
      method: shifted ? 'shifted-match' as const : 'exact-match' as const,
      timingSource: 'primary' as const,
      confidence: diagnosis?.confidence ?? 1,
      offsetMs: diagnosis?.shouldApply ? diagnosis.offsetMs : undefined,
      primary: createSourceRef(primary),
      secondary: createSourceRef(secondary),
    },
  };
};

function buildExpandedDialogueRows(
  packed: PreprocessedRow,
  firstCounterpart: PreprocessedRow,
  secondCounterpart: PreprocessedRow,
  packedIsZh: boolean,
): ExpandedDialogueRow[] | null {
  if (!canExpandPackedDialogue(packed, firstCounterpart, secondCounterpart)) return null;
  const turns = splitPackedDialogueTurns(packed.sourceText);
  if (!turns) return null;

  const primarySource = packedIsZh ? packed : firstCounterpart;
  const groupId = `dialogue-${packed.sourceIndex}-${firstCounterpart.sourceIndex}-${secondCounterpart.sourceIndex}`;

  const makeRow = (turn: string, counterpart: PreprocessedRow): ExpandedDialogueRow => ({
    // 以副轨细分
    ts: counterpart.ts,
    text: packedIsZh ? `${turn}\n${counterpart.text}` : `${counterpart.text}\n${turn}`,
    type: 'merged',
    cueKind: combineCueKind(packed.cueKind, counterpart.cueKind),
    auxiliary: combineAuxiliaryCue(packed.auxiliary, counterpart.auxiliary),
    alignment: 'expanded-dialogue',
    provenance: {
      method: 'expanded-dialogue',
      timingSource: packedIsZh ? 'secondary' : 'primary',
      groupId,
      primary: createSourceRef(primarySource),
      secondary: createSourceRef(packedIsZh ? counterpart : packed),
    },
  });

  return [
    makeRow(turns[0], firstCounterpart),
    makeRow(turns[1], secondCounterpart),
  ];
}

/** Shared temporal match policy for fast merge and industrial DP (keep in sync via this table only). */
export const CUE_MATCH_POLICY = {
  strongOverlap: 0.5,
  nearStartMs: 300,
  looseOverlap: 0.2,
  looseStartMs: 1500,
  maxAlignmentCells: 8_000_000,
  /** Sakoe–Chiba half-width when the full M×N matrix exceeds maxAlignmentCells. */
  minBandHalfWidth: 48,
  maxBandHalfWidth: 160,
} as const;

export function isTemporalCueMatch(overlap: number, startDiffMs: number): boolean {
  return (
    overlap > CUE_MATCH_POLICY.strongOverlap
    || startDiffMs < CUE_MATCH_POLICY.nearStartMs
    || (overlap > CUE_MATCH_POLICY.looseOverlap && startDiffMs < CUE_MATCH_POLICY.looseStartMs)
  );
}

export type AlignmentFallbackInfo = {
  reason: 'matrix_too_large' | 'banded';
  cells: number;
  limit: number;
  bandHalfWidth?: number;
};

export type AlignSubtitlesOptions = {
  onFallback?: (info: AlignmentFallbackInfo) => void;
};

const ALIGNMENT_NEG = -1e15;

/** Expected secondary column on the proportional diagonal for DP row `row` (1..M). */
function expectedAlignmentColumn(row: number, M: number, N: number): number {
  if (M <= 0) return 0;
  return Math.round((row * N) / M);
}

function resolveBandHalfWidth(M: number, N: number): number | null {
  const cells = M * N;
  if (cells <= CUE_MATCH_POLICY.maxAlignmentCells) return null;

  const slope = Math.max(
    1,
    Math.ceil(Math.max(N, 1) / Math.max(M, 1)),
    Math.ceil(Math.max(M, 1) / Math.max(N, 1)),
  );
  let half = Math.min(
    CUE_MATCH_POLICY.maxBandHalfWidth,
    Math.max(CUE_MATCH_POLICY.minBandHalfWidth, slope * 3 + 32),
  );
  const bandCells = M * (2 * half + 1);
  if (bandCells > CUE_MATCH_POLICY.maxAlignmentCells) {
    half = Math.max(
      CUE_MATCH_POLICY.minBandHalfWidth,
      Math.floor(CUE_MATCH_POLICY.maxAlignmentCells / (2 * Math.max(M, 1))),
    );
  }
  return half;
}

/**
 * Needleman–Wunsch path. When `halfBand` is set, only cells near the proportional
 * diagonal are scored (Sakoe–Chiba), keeping large tracks in industrial mode.
 */
function computeAlignmentPath(
  M: number,
  N: number,
  getPairScore: (zhIdx: number, enIdx: number) => number,
  halfBand: number | null,
): AlignmentStep[] {
  const gapPenalty = -6;
  let previousScores = new Float64Array(N + 1);
  let currentScores = new Float64Array(N + 1);
  previousScores[0] = 0;
  for (let column = 1; column <= N; column += 1) {
    previousScores[column] = column * gapPenalty;
  }

  const useBand = halfBand != null;
  const bandWidth = useBand ? 2 * halfBand + 1 : N + 1;
  const jLo = new Int32Array(M + 1);
  const directions = new Int8Array((M + 1) * bandWidth);
  directions.fill(-1);

  const setDir = (row: number, col: number, dir: number) => {
    if (!useBand) {
      directions[row * (N + 1) + col] = dir;
      return;
    }
    const idx = col - jLo[row];
    if (idx < 0 || idx >= bandWidth) return;
    directions[row * bandWidth + idx] = dir;
  };

  const getDir = (row: number, col: number): number => {
    if (!useBand) return directions[row * (N + 1) + col];
    const idx = col - jLo[row];
    if (idx < 0 || idx >= bandWidth) return -1;
    return directions[row * bandWidth + idx];
  };

  if (!useBand) {
    jLo[0] = 0;
    for (let column = 1; column <= N; column += 1) setDir(0, column, 2);
    for (let row = 1; row <= M; row += 1) {
      jLo[row] = 0;
      currentScores[0] = row * gapPenalty;
      setDir(row, 0, 1);
      for (let column = 1; column <= N; column += 1) {
        const scoreMatch = previousScores[column - 1] + getPairScore(row - 1, column - 1);
        const scoreGapZh = previousScores[column] + gapPenalty;
        const scoreGapEn = currentScores[column - 1] + gapPenalty;
        if (scoreMatch >= scoreGapZh && scoreMatch >= scoreGapEn) {
          currentScores[column] = scoreMatch;
          setDir(row, column, 0);
        } else if (scoreGapZh >= scoreGapEn) {
          currentScores[column] = scoreGapZh;
          setDir(row, column, 1);
        } else {
          currentScores[column] = scoreGapEn;
          setDir(row, column, 2);
        }
      }
      [previousScores, currentScores] = [currentScores, previousScores];
    }
  } else {
    jLo[0] = 0;
    for (let row = 1; row <= M; row += 1) {
      const center = expectedAlignmentColumn(row, M, N);
      const storeLo = Math.max(0, center - halfBand);
      const storeHi = Math.min(N, center + halfBand);
      jLo[row] = storeLo;

      currentScores.fill(ALIGNMENT_NEG);
      currentScores[0] = row * gapPenalty;
      if (storeLo === 0) setDir(row, 0, 1);

      for (let column = Math.max(1, storeLo); column <= storeHi; column += 1) {
        const prevDiag = previousScores[column - 1];
        const prevUp = previousScores[column];
        const prevLeft = currentScores[column - 1];
        const scoreMatch = prevDiag > ALIGNMENT_NEG / 2
          ? prevDiag + getPairScore(row - 1, column - 1)
          : ALIGNMENT_NEG;
        const scoreGapZh = prevUp > ALIGNMENT_NEG / 2 ? prevUp + gapPenalty : ALIGNMENT_NEG;
        const scoreGapEn = prevLeft > ALIGNMENT_NEG / 2 ? prevLeft + gapPenalty : ALIGNMENT_NEG;

        if (scoreMatch >= scoreGapZh && scoreMatch >= scoreGapEn && scoreMatch > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreMatch;
          setDir(row, column, 0);
        } else if (scoreGapZh >= scoreGapEn && scoreGapZh > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreGapZh;
          setDir(row, column, 1);
        } else if (scoreGapEn > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreGapEn;
          setDir(row, column, 2);
        }
      }
      [previousScores, currentScores] = [currentScores, previousScores];
    }
  }

  const path: AlignmentStep[] = [];
  let i = M;
  let j = N;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const direction = getDir(i, j);
      if (direction === 0) {
        path.push({ zhIdx: i - 1, enIdx: j - 1 });
        i -= 1;
        j -= 1;
      } else if (direction === 1) {
        path.push({ zhIdx: i - 1, enIdx: null });
        i -= 1;
      } else if (direction === 2) {
        path.push({ zhIdx: null, enIdx: j - 1 });
        j -= 1;
      } else {
        // Outside the scored band: walk toward the proportional diagonal.
        const center = expectedAlignmentColumn(i, M, N);
        if (j > center) {
          path.push({ zhIdx: null, enIdx: j - 1 });
          j -= 1;
        } else {
          path.push({ zhIdx: i - 1, enIdx: null });
          i -= 1;
        }
      }
    } else if (i > 0) {
      path.push({ zhIdx: i - 1, enIdx: null });
      i -= 1;
    } else {
      path.push({ zhIdx: null, enIdx: j - 1 });
      j -= 1;
    }
  }
  path.reverse();
  return path;
}

type ExpandedDialoguePlan = {
  rows: ExpandedDialogueRow[];
  /** Extra path steps to skip after consuming the current match (0 or 1). */
  advancePath: number;
  skipEnIdx?: number;
  skipZhIdx?: number;
};

/**
 * Expand a packed two-speaker cue when the path (or array neighbors) expose two counterpart turns.
 * Prefer the next path step; fall back to idx+1 when the path ends or an intervening unpaired cue blocks it.
 */
function tryExpandPackedDialogueAtPath(
  path: AlignmentStep[],
  pathIndex: number,
  zhDialogues: PreprocessedRow[],
  enDialogues: PreprocessedRow[],
): ExpandedDialoguePlan | null {
  const current = path[pathIndex];
  if (!current || current.zhIdx === null || current.enIdx === null) return null;
  const next = path[pathIndex + 1];

  if (next && next.zhIdx === null && next.enIdx !== null) {
    const rows = buildExpandedDialogueRows(
      zhDialogues[current.zhIdx],
      enDialogues[current.enIdx],
      enDialogues[next.enIdx],
      true,
    );
    if (rows) return { rows, advancePath: 1 };
  }

  if (next && next.enIdx === null && next.zhIdx !== null) {
    const rows = buildExpandedDialogueRows(
      enDialogues[current.enIdx],
      zhDialogues[current.zhIdx],
      zhDialogues[next.zhIdx],
      false,
    );
    if (rows) return { rows, advancePath: 1 };
  }

  const nextEnIdx = current.enIdx + 1;
  const nextZhIdx = current.zhIdx + 1;

  if (enDialogues[nextEnIdx]) {
    const laterPaired = path.slice(pathIndex + 1).some(
      (step) => step.enIdx === nextEnIdx && step.zhIdx !== null,
    );
    if (!laterPaired) {
      const rows = buildExpandedDialogueRows(
        zhDialogues[current.zhIdx],
        enDialogues[current.enIdx],
        enDialogues[nextEnIdx],
        true,
      );
      if (rows) {
        const advancePath = next?.zhIdx === null && next.enIdx === nextEnIdx ? 1 : 0;
        return { rows, advancePath, skipEnIdx: nextEnIdx };
      }
    }
  }

  if (zhDialogues[nextZhIdx]) {
    const laterPaired = path.slice(pathIndex + 1).some(
      (step) => step.zhIdx === nextZhIdx && step.enIdx !== null,
    );
    if (!laterPaired) {
      const rows = buildExpandedDialogueRows(
        enDialogues[current.enIdx],
        zhDialogues[current.zhIdx],
        zhDialogues[nextZhIdx],
        false,
      );
      if (rows) {
        const advancePath = next?.enIdx === null && next.zhIdx === nextZhIdx ? 1 : 0;
        return { rows, advancePath, skipZhIdx: nextZhIdx };
      }
    }
  }

  return null;
}

/**
 * Merge two subtitle tracks.
 */
export function mergeSubtitles(
  zhSubs: RawSub[], 
  enSubs: RawSub[], 
  commSubs: RawSub[] = [], 
  addLog: (msg: string, type: 'info' | 'success' | 'error') => void = () => {}
): SubRow[] {
  const zhProc = preprocessMixedContent(zhSubs);
  const enProc = preprocessMixedContent(enSubs);
  const zhNotes = zhProc.filter(s => s.type === "note");
  const zhDialogues = zhProc.filter(s => s.type === "dialogue");
  const enNotes = enProc.filter(s => s.type === "note");
  const enDialogues = enProc.filter(s => s.type === "dialogue");
  
  const commProc = commSubs.map(s => ({
    ...s,
    type: "commentary",
    cueKind: 'commentary' as CueKind
  }));
  
  const mergedDialogues: Array<{ ts: string; text: string; type: string; cueKind?: CueKind; auxiliary?: AuxiliaryCueClassification; alignment?: SubRow['alignment']; provenance?: AlignmentProvenance }> = [];
  let i = 0, j = 0;
  while (i < zhDialogues.length && j < enDialogues.length) {
    const zh = zhDialogues[i];
    const en = enDialogues[j];
    const [zhS, zhE] = zh.ts.split(" --> ").map(timeToMs);
    const [enS, enE] = en.ts.split(" --> ").map(timeToMs);
    const overlap = calculateOverlapRatio(zhS, zhE, enS, enE);
    const diff = Math.abs(zhS - enS);
    const compatibleCueKinds = shouldAttemptCueMerge(zh, en);
    
    if (compatibleCueKinds && isTemporalCueMatch(overlap, diff)) {
      const expandedZh = enDialogues[j + 1]
        ? buildExpandedDialogueRows(zh, en, enDialogues[j + 1], true)
        : null;
      if (expandedZh) {
        mergedDialogues.push(...expandedZh);
        i += 1;
        j += 2;
        continue;
      }

      const expandedForeign = zhDialogues[i + 1]
        ? buildExpandedDialogueRows(en, zh, zhDialogues[i + 1], false)
        : null;
      if (expandedForeign) {
        mergedDialogues.push(...expandedForeign);
        i += 2;
        j += 1;
        continue;
      }

      mergedDialogues.push(createMergedRow(
        zh,
        en,
        { start: zhS, end: zhE },
        { start: enS, end: enE },
      ));
      i++; j++;
    } else if (zhS <= enS) {
      mergedDialogues.push(createSingleTrackRow(zh, 'primary')); i++;
    } else {
      mergedDialogues.push(createSingleTrackRow(en, 'secondary')); j++;
    }
  }
  while (i < zhDialogues.length) {
    mergedDialogues.push(createSingleTrackRow(zhDialogues[i], 'primary'));
    i++;
  }
  while (j < enDialogues.length) {
    mergedDialogues.push(createSingleTrackRow(enDialogues[j], 'secondary'));
    j++;
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      let cueKind = item.cueKind === 'lyrics' || isLyricText(item.text)
        ? 'lyrics' as CueKind
        : (item.cueKind || resolveCueKind(item.text));
      if (cueKind === 'credit' || (!item.cueKind && isSubtitleCreditText(item.text))) {
        cueKind = 'credit';
        type = 'credit';
      } else if (cueKind === 'lyrics' || isLyricText(item.text)) {
        type = 'lyrics';
      }
      return { ...item, type, cueKind, index: idx + 1 };
    });
  
  addLog(`[合并] 处理完成，生成 ${result.length} 条对齐块`, "success");
  return result;
}

/**
 * Industrial sequence alignment algorithm using Needleman-Wunsch dynamic programming.
 * Detects insertions/deletions/shifts to prevent misalignment cascades.
 */
export function alignSubtitlesIndustrial(
  zhSubs: RawSub[], 
  enSubs: RawSub[], 
  commSubs: RawSub[] = [], 
  addLog: (msg: string, type: 'info' | 'success' | 'error') => void = () => {},
  options: AlignSubtitlesOptions = {},
): SubRow[] {
  const zhProc = preprocessMixedContent(zhSubs);
  const enProc = preprocessMixedContent(enSubs);
  const zhNotes = zhProc.filter(s => s.type === "note");
  const zhDialogues = zhProc.filter(s => s.type === "dialogue");
  const enNotes = enProc.filter(s => s.type === "note");
  const enDialogues = enProc.filter(s => s.type === "dialogue");
  
  const commProc = commSubs.map(s => ({
    ...s,
    type: "commentary",
    cueKind: 'commentary' as CueKind
  }));

  const M = zhDialogues.length;
  const N = enDialogues.length;
  const offsetDiagnosis = estimateGlobalOffset(zhDialogues, enDialogues);
  const secondaryOffsetMs = offsetDiagnosis.shouldApply ? offsetDiagnosis.offsetMs : 0;
  
  const alignmentCells = M * N;
  const halfBand = resolveBandHalfWidth(M, N);
  if (halfBand != null) {
    const bandCells = M * (2 * halfBand + 1);
    // Extreme tracks: banded fill still exceeds the cell budget → low-memory escape hatch.
    if (bandCells > CUE_MATCH_POLICY.maxAlignmentCells) {
      addLog(`[工业级合并] 对齐矩阵约 ${Math.round(alignmentCells / 1_000_000)}M 单元，已切换为低内存快速合并`, 'info');
      options.onFallback?.({
        reason: 'matrix_too_large',
        cells: alignmentCells,
        limit: CUE_MATCH_POLICY.maxAlignmentCells,
      });
      return mergeSubtitles(zhSubs, enSubs, commSubs, addLog);
    }
    addLog(
      `[工业级合并] 对齐矩阵约 ${Math.round(alignmentCells / 1_000_000)}M 单元，启用带宽 ${2 * halfBand + 1} 的带状 DP`,
      'info',
    );
    options.onFallback?.({
      reason: 'banded',
      cells: alignmentCells,
      limit: CUE_MATCH_POLICY.maxAlignmentCells,
      bandHalfWidth: halfBand,
    });
  }
  if (Math.abs(offsetDiagnosis.offsetMs) >= OFFSET_DIAGNOSIS_POLICY.logAbsMs) {
    addLog(
      offsetDiagnosis.shouldApply
        ? `[时间轴诊断] 检测到稳定整体偏移 ${offsetDiagnosis.offsetMs}ms，已用于对齐判断`
        : `[时间轴诊断] 发现疑似偏移 ${offsetDiagnosis.offsetMs}ms，但${offsetDiagnosis.reason}，未自动平移`,
      'info',
    );
  }
  
  const mismatchPenalty = -15;
  
  // Score matrix calculation between Chinese and English nodes
  const getPairScore = (zhIdx: number, enIdx: number) => {
    const zh = zhDialogues[zhIdx];
    const en = enDialogues[enIdx];
    const compatibility = getCueMergeCompatibility(zh, en);
    if (!compatibility.canMerge) return mismatchPenalty - 25;
    const zhTiming = getRowTiming(zh);
    const enTiming = getRowTiming(en, secondaryOffsetMs);
    const overlap = calculateOverlapRatio(zhTiming.start, zhTiming.end, enTiming.start, enTiming.end);
    const diff = Math.abs(zhTiming.start - enTiming.start);
    
    const isMatch = isTemporalCueMatch(overlap, diff);
    if (isMatch) {
      // Optimal alignment bonus based on similarity and time proximity
      return 15 + overlap * 10 - (diff / CUE_MATCH_POLICY.looseStartMs) * 5 + compatibility.scoreAdjustment;
    }
    // Moderate penalty if they are relatively close (within 3s) but don't overlap
    if (diff < 3000) {
      return -2 - (diff / 3000) * 4 + Math.min(0, compatibility.scoreAdjustment);
    }
    return mismatchPenalty;
  };

  const path = computeAlignmentPath(M, N, getPairScore, halfBand);
  
  const mergedDialogues: Array<{ ts: string; text: string; type: string; cueKind?: CueKind; auxiliary?: AuxiliaryCueClassification; alignment?: SubRow['alignment']; provenance?: AlignmentProvenance }> = [];
  const skippedEn = new Set<number>();
  const skippedZh = new Set<number>();

  for (let pathIndex = 0; pathIndex < path.length; pathIndex++) {
    const step = path[pathIndex];
    if (step.enIdx !== null && skippedEn.has(step.enIdx)) continue;
    if (step.zhIdx !== null && skippedZh.has(step.zhIdx)) continue;

    const expanded = tryExpandPackedDialogueAtPath(path, pathIndex, zhDialogues, enDialogues);
    if (expanded) {
      mergedDialogues.push(...expanded.rows);
      if (expanded.skipEnIdx != null) skippedEn.add(expanded.skipEnIdx);
      if (expanded.skipZhIdx != null) skippedZh.add(expanded.skipZhIdx);
      pathIndex += expanded.advancePath;
      continue;
    }

    if (step.zhIdx !== null && step.enIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      const en = enDialogues[step.enIdx];
      const zhTiming = getRowTiming(zh);
      const enTiming = getRowTiming(en, secondaryOffsetMs);
      const overlap = calculateOverlapRatio(zhTiming.start, zhTiming.end, enTiming.start, enTiming.end);
      const diff = Math.abs(zhTiming.start - enTiming.start);
      const compatibility = getCueMergeCompatibility(zh, en);
      const isMatch = compatibility.canMerge && isTemporalCueMatch(overlap, diff);
      
      if (isMatch) {
        mergedDialogues.push(createMergedRow(
          zh,
          en,
          zhTiming,
          enTiming,
          offsetDiagnosis.shouldApply ? offsetDiagnosis : undefined,
        ));
      } else {
        // Aligned globally by sequence DP, but too far to merge (e.g. ad insertion on one track).
        // Separate as individual tracks to avoid mismatch.
        mergedDialogues.push(createSingleTrackRow(zh, 'primary'));
        mergedDialogues.push(createSingleTrackRow(en, 'secondary'));
      }
    } else if (step.zhIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      mergedDialogues.push(createSingleTrackRow(zh, 'primary'));
    } else if (step.enIdx !== null) {
      const en = enDialogues[step.enIdx];
      mergedDialogues.push(createSingleTrackRow(en, 'secondary'));
    }
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      let cueKind = item.cueKind === 'lyrics' || isLyricText(item.text)
        ? 'lyrics' as CueKind
        : (item.cueKind || resolveCueKind(item.text));
      if (cueKind === 'credit' || (!item.cueKind && isSubtitleCreditText(item.text))) {
        cueKind = 'credit';
        type = 'credit';
      } else if (cueKind === 'lyrics' || isLyricText(item.text)) {
        type = 'lyrics';
      }
      return { ...item, type, cueKind, index: idx + 1 };
    });
  addLog(`[工业级合并] 处理完成，生成 ${result.length} 条对齐块`, "success");
  return result;
}

const ATTRIBUTION_PATTERNS: Array<{ role: SubtitleAttributionRole; label: string; pattern: RegExp }> = [
  { role: 'publisher', label: '发布 / 字幕组', pattern: /^(?:发行(?:方)?|发布(?:者)?|字幕组|字幕(?:制作)?组|Publisher|Release(?:d)?\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'translator', label: '翻译', pattern: /^(?:字幕翻译|翻译|译者|听译|Translator|Translation|Translated\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'editor', label: '编校', pattern: /^(?:编辑|编者|后期|润色|Editor|Editing)\s*[:：]\s*(.+)$/i },
  { role: 'timing', label: '时间轴', pattern: /^(?:时间轴|校轴|轴(?:制)?|Timing|Sync(?:hronization)?)\s*[:：]\s*(.+)$/i },
  { role: 'proofreader', label: '校对', pattern: /^(?:校对|校订|Proofread(?:er)?)\s*[:：]\s*(.+)$/i },
  { role: 'encoder', label: '压制 / 合并', pattern: /^(?:压制|编码|合并|Encoder|Encode(?:d)?\s*By|Mux(?:ed)?\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'website', label: '来源', pattern: /^(?:网站|来源|主页|Website|Web|URL)\s*[:：]\s*(.+)$/i },
  { role: 'producer', label: '制作', pattern: /^(?:制作(?:者)?|字幕制作|Produced\s*By|Author|Subtitles?\s*By)\s*[:：]\s*(.+)$/i },
];

/** True for standalone subtitle-credit cues such as「字幕翻译：凌武翎」. */
export function isSubtitleCreditText(text: string): boolean {
  const clean = stripSubtitleInlineTags(text || '')
    .replace(/\\N/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || clean.length > 80) return false;
  if (ATTRIBUTION_PATTERNS.some((definition) => definition.pattern.test(clean))) return true;
  return /^(?:字幕(?:翻译|制作|组|校对|时间轴|听译)|翻译|译者|校对|时间轴|压制|制作)\s*[:：]/.test(clean);
}

const cleanAttributionValue = (value: string) => value
  .replace(/\{\\[^}]+\}/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\\N/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120);

/**
 * Extract production credits from ASS header fields and credit-like subtitle cues.
 * It deliberately reads only the beginning and end of subtitle files to avoid
 * interpreting ordinary dialogue that happens to mention a translator or publisher.
 */
export function extractSubtitleAttributions(text: string): SubtitleAttribution[] {
  if (!text) return [];

  const normalized = text.replace(/\r\n?/g, '\n');
  const scriptInfo = normalized.match(/\[Script Info\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/i)?.[1] || '';
  const cueLines = normalized.split('\n');
  const samples: Array<{ line: string; source: SubtitleAttribution['source'] }> = [
    ...scriptInfo.split('\n').map(line => ({ line, source: 'ass-header' as const })),
    ...cueLines.slice(0, 72).map(line => ({ line, source: 'subtitle-cue' as const })),
    ...cueLines.slice(-72).map(line => ({ line, source: 'subtitle-cue' as const })),
  ];
  const collected: SubtitleAttribution[] = [];

  for (const sample of samples) {
    const line = cleanAttributionValue(sample.line.replace(/^Dialogue:[^,]*,(?:[^,]*,){8}/i, ''));
    if (!line || /^\d+$/.test(line) || /^\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}/.test(line)) continue;
    for (const definition of ATTRIBUTION_PATTERNS) {
      const match = line.match(definition.pattern);
      if (!match) continue;
      const value = cleanAttributionValue(match[1]);
      if (!value) continue;
      collected.push({ role: definition.role, label: definition.label, value, source: sample.source });
      break;
    }
  }

  return collected.filter((item, index) =>
    collected.findIndex(candidate => candidate.role === item.role && candidate.value.toLowerCase() === item.value.toLowerCase()) === index
  );
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
): SubRow[] {
  const cleanCredit = cleanAttributionValue(creatorCredit);
  if (!cleanCredit || subs.length === 0) return subs;

  const displayText = /^(?:字幕制作|制作(?:者)?|Subtitles?\s*(?:by|制作))\s*[:：]/i.test(cleanCredit)
    ? cleanCredit
    : `字幕制作：${cleanCredit}`;
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

const shouldKeepSubtitleForAuxiliaryMode = (sub: SubRow, mode: AuxiliarySubtitleMode): boolean => {
  if (mode === 'keep') return true;
  // 歌词正文（含译词合并行）不因 music 辅助类被 smart/clean 剥掉。
  if (sub.type === 'lyrics' || sub.cueKind === 'lyrics' || isLyricText(sub.text)) return true;
  // 署名信息默认不进观看轨
  if (sub.type === 'credit' || sub.cueKind === 'credit' || isSubtitleCreditText(sub.text)) {
    return false;
  }
  const category = sub.auxiliary?.category;
  if (!category) return true;
  if (mode === 'clean') {
    return category === 'screen_text' || category === 'semantic_sdh' || category === 'speech_context';
  }
  if (mode === 'smart') {
    return category !== 'ambient_sdh' && category !== 'music';
  }
  return true;
};

export function applyAuxiliarySubtitleMode(subs: SubRow[], mode: AuxiliarySubtitleMode = 'keep'): SubRow[] {
  return subs
    .filter(sub => shouldKeepSubtitleForAuxiliaryMode(sub, mode))
    .map((sub, index) => ({ ...sub, index: index + 1 }));
}

export function generateSrtContent(subs: SubRow[], styleSettings?: StyleSettings): string {
  const { lyricItalic = true, auxiliaryMode = 'keep' } = styleSettings || {};
  return applyAuxiliarySubtitleMode(subs, auxiliaryMode).map(s => {
    let text = s.text.replace(/\{\\[^}]+\}/g, '');
    if (s.type === 'lyrics') {
      if (lyricItalic) {
        const cleanText = text.replace(/<\/?i>/g, '');
        text = `<i>${cleanText}</i>`;
      }
    }
    return `${s.index}\n${s.ts}\n${text}`;
  }).join("\n\n") + "\n";
}

export function generateAssContent(
  subs: SubRow[],
  styleSettings: StyleSettings,
  title = "Bilingual Subtitles",
  scriptMeta?: AssScriptMeta,
): string {
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
    zhFontFamily = 'PingFang SC',
    enFontFamily = 'Helvetica Neue',
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

  // Convert Hex colors (e.g. #FFFFFF) to ASS Colors (e.g. &H00FFFFFF)
  const hexToAss = (hex: string): string => {
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

  const assZhColor = hexToAss(zhColor);
  const assEnColor = hexToAss(enColor);
  const assZhOutline = hexToAss(zhOutline);
  const assEnOutline = hexToAss(enOutline);
  const assLyricColor = hexToAss(lyricColor);
  const toAssFontName = (fontFamily: string, fallback: string): string => {
    const firstFamily = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    if (!firstFamily || /^(system-ui|sans-serif|serif|monospace)$/i.test(firstFamily)) return fallback;
    return firstFamily.replace(/[\r\n,]/g, ' ').trim() || fallback;
  };
  const assZhFont = toAssFontName(zhFontFamily, 'PingFang SC');
  const assEnFont = toAssFontName(enFontFamily, 'Arial');
  const safeTitle = title.replace(/[\r\n]/g, ' ').trim() || 'Bilingual Subtitles';
  const safeOriginal = (scriptMeta?.originalScript || '').replace(/[\r\n]/g, ' ').trim();
  const safeUpdateDetails = (scriptMeta?.updateDetails || '').replace(/[\r\n]/g, ' ').trim();
  const commentLines = (scriptMeta?.comments || [])
    .map((line) => line.replace(/[\r\n]/g, ' ').trim())
    .filter(Boolean);

  const header = `[Script Info]
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: no
ScriptType: v4.00+
Title: ${safeTitle}
${safeOriginal ? `Original Script: ${safeOriginal}\n` : ''}${commentLines.map((line) => `Comment: ${line}`).join('\n')}${commentLines.length ? '\n' : ''}${safeUpdateDetails ? `Update Details: ${safeUpdateDetails}\n` : ''}
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Han,${assZhFont},${mZhFont},${assZhColor},&H00FF9C41,${assZhOutline},&H00000000,1,0,0,0,100,100,0,0,1,${mOutline},${mShadow},2,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: EN,${assEnFont},${mEnFont},${assEnColor},&H00FFFFFF,${assEnOutline},&H00000000,1,0,0,0,${enScale},${enScale},0,0,1,${mEnOutline},${mEnOutline},2,${mBaseMargin},${mBaseMargin},${Math.floor(mMarginV * 0.6)},1
Style: Note,${assZhFont},${mNoteFont},&H00FFFFFF,&H000000FF,&H0000FBFF,&H00000000,0,0,0,0,100,100,0,0,1,${mOutline},${mShadow},8,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: Credit,${assZhFont},${mNoteFont},${assZhColor},&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${mOutline},${mShadow},5,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: Lyrics,${assZhFont},${mLyricFont},${assLyricColor},&H00000000,&H00000000,&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mOutline},${mShadow},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.8) : mMarginV},1
Style: Lyrics_EN,${assEnFont},${mLyricEnFont},${assLyricColor},&H00000000,${assEnOutline},&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mEnOutline},${mEnOutline},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.5) : Math.floor(mMarginV * 0.6)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const srtToAssTime = (t: string) => {
    const [hms, ms] = t.split(',');
    const [h, m, s] = hms.split(':');
    return `${parseInt(h)}:${m}:${s}.${Math.floor(parseInt(ms) / 10).toString().padStart(2, '0')}`;
  };

  const events = applyAuxiliarySubtitleMode(subs, auxiliaryMode).map(s => {
    const [start, end] = s.ts.split(" --> ").map(srtToAssTime);
    let style = "Han";
    if (s.type === "credit") {
      style = "Credit";
    } else if (s.type === "lyrics") {
      style = /[一-龥]/.test(s.text) ? "Lyrics" : "Lyrics_EN";
    } else if (s.type === "note" || s.type === "commentary" || s.cueKind === 'screen_text' || /[翻译制作合并]/.test(s.text)) {
      style = "Note";
    } else if (s.type === "merged") {
      style = "Han";
    } else {
      style = /[一-龥]/.test(s.text) ? "Han" : "EN";
    }

    let processedText = s.text;
    if (s.type === "note" || s.type === "commentary" || s.cueKind === 'screen_text') {
      if (!processedText.startsWith("{\\an8}")) {
        processedText = "{\\an8}" + processedText;
      }
    }

    if (s.type === "lyrics" && s.text.includes('\n')) {
      const [zh, en] = s.text.split('\n');
      processedText = smartLineWrap(zh, true, maxLenZh) + "\\N{\\rLyrics_EN}" + smartLineWrap(en, false, maxLenEn);
    } else if (s.type === "merged" && s.text.includes('\n')) {
      const [zh, en] = s.text.split('\n');
      processedText = smartLineWrap(zh, true, maxLenZh) + "\\N{\\rEN}" + smartLineWrap(en, false, maxLenEn);
    } else {
      if (processedText.startsWith("{\\an8}")) {
        const actualText = processedText.slice(6);
        processedText = "{\\an8}" + smartLineWrap(actualText, /[一-龥]/.test(actualText), maxLenZh);
      } else {
        processedText = smartLineWrap(processedText, /[一-龥]/.test(processedText), (style === "Han" || style === "Lyrics") ? maxLenZh : maxLenEn);
      }
    }

    return `Dialogue: 0,${start},${end},${style},,0,0,0,,${processedText}`;
  });

  return header + events.join("\n") + "\n";
}

/**
 * Check if the text is bilingual.
 */
export function checkIsBilingual(text: string): boolean {
  if (!text) return false;
  
  const cleanText = text.replace(/[\uFEFF\u200B]/g, '');
  const subtitles = parseSubtitle(cleanText);
  
  if (subtitles.length === 0) return false;
  
  const validRows = subtitles.filter(sub => cleanSubtitleContent(sub.text).trim());
  let bilingualSignals = 0;
  let validCount = 0;
  
  for (let i = 0; i < validRows.length; i += 1) {
    const sub = validRows[i];
    const cleanSubText = cleanSubtitleContent(sub.text);
    const lang = detectCueLanguage(splitSingleBilingualText(cleanSubText));
    validCount++;

    if (lang === 'mixed') {
      bilingualSignals++;
      continue;
    }

    const next = validRows[i + 1];
    if (!next) continue;
    const nextLang = detectCueLanguage(splitSingleBilingualText(next.text));
    const adjacentBilingualPair = areTimeRangesNearEqual(sub.ts, next.ts)
      && ((lang === 'zh' && nextLang === 'foreign') || (lang === 'foreign' && nextLang === 'zh'));

    if (adjacentBilingualPair) {
      bilingualSignals += 2;
      validCount++;
      i += 1;
    }
  }
  
  if (validCount === 0) return false;
  const ratio = bilingualSignals / validCount;
  return ratio >= 0.6;
}

export function safeParseSubtitle(text: unknown): RawSub[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  try {
    const result = parseSubtitle(text);
    return result.filter(s => {
      if (!s.ts || !s.text) return false;
      const firstPart = s.ts.split(' --> ')[0];
      if (!firstPart) return false;
      const ms = timeToMs(firstPart);
      return !isNaN(ms);
    });
  } catch {
    return [];
  }
}

export function safeTimeToMs(t: unknown): number {
  if (typeof t !== 'string') return 0;
  const result = timeToMs(t);
  return isNaN(result) ? 0 : result;
}

export function splitSingleBilingualText(text: string): string {
  if (!text) return "";
  
  if (text.includes('\n') || text.includes('\\N') || text.includes('\\n')) {
    return text;
  }

  const hasZh = /[一-龥]/.test(text);
  const hasEn = /[a-zA-Z]/.test(text);
  if (!hasZh || !hasEn) {
    return text;
  }

  const latinWords = (value: string): string[] => value.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const latinChars = (value: string): number => (value.match(/[A-Za-z]/g) || []).length;
  const hanChars = (value: string): number => (value.match(/[一-龥]/g) || []).length;
  const isSubtitleLikeEnglish = (value: string): boolean => {
    const words = latinWords(value);
    if (words.length >= 2) return true;
    return words.length === 1 && latinChars(value) >= 10 && hanChars(value) === 0;
  };
  const isSubtitleLikeChinese = (value: string): boolean => hanChars(value) >= 2;

  const zhFirstMatch = text.match(/^([\s\S]*?[一-龥][，。！？）】」；：”’"'.,!?\s-]*)([A-Za-z][\s\S]*)$/);
  if (zhFirstMatch) {
    const zhPart = zhFirstMatch[1].trim();
    const enPart = zhFirstMatch[2].trim();
    if (isSubtitleLikeChinese(zhPart) && isSubtitleLikeEnglish(enPart)) {
      return `${zhPart}\n${enPart}`;
    }
  }

  const enFirstMatch = text.match(/^([A-Za-z][\s\S]*?[A-Za-z][，。！？）】」；：”"'.,!?\s-]*)([一-龥][\s\S]*)$/);
  if (enFirstMatch) {
    const enPart = enFirstMatch[1].trim();
    const zhPart = enFirstMatch[2].trim();
    if (isSubtitleLikeEnglish(enPart) && isSubtitleLikeChinese(zhPart)) {
      return `${zhPart}\n${enPart}`;
    }
  }

  return text;
}

type CueLanguage = 'zh' | 'foreign' | 'mixed' | 'unknown';

const detectCueLanguage = (text: string): CueLanguage => {
  const clean = cleanSubtitleContent(text).replace(/[♪♫♬]/g, '').trim();
  const hasKana = /[\u3040-\u30ff\u31f0-\u31ff]/.test(clean);
  const hasHangul = /[\uac00-\ud7af\u1100-\u11ff]/.test(clean);
  const hasZh = /[一-龥]/.test(clean) && !hasKana;
  const hasLatin = /[A-Za-z]/.test(clean);
  if (hasZh && (hasLatin || hasKana || hasHangul)) return 'mixed';
  if (hasZh) return 'zh';
  if (hasLatin || hasKana || hasHangul) return 'foreign';
  return 'unknown';
};

const areTimeRangesNearEqual = (a: string, b: string, toleranceMs = 120): boolean => {
  const [aStart, aEnd] = a.split(' --> ').map(timeToMs);
  const [bStart, bEnd] = b.split(' --> ').map(timeToMs);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return a === b;
  return Math.abs(aStart - bStart) <= toleranceMs && Math.abs(aEnd - bEnd) <= toleranceMs;
};

const combineRowCueKind = (...kinds: Array<CueKind | undefined>): CueKind | undefined => {
  const known = kinds.filter(Boolean) as CueKind[];
  if (known.length === 0) return undefined;
  if (known.includes('lyrics')) return 'lyrics';
  if (known.includes('credit')) return 'credit';
  if (known.every(kind => kind === 'screen_text')) return 'screen_text';
  if (known.every(kind => kind === 'narration')) return 'narration';
  if (known.includes('commentary')) return 'commentary';
  return known.includes('screen_text') ? 'screen_text' : known[0];
};

export function normalizeSingleBilingualRows(rows: RawSub[]): SubRow[] {
  const result: SubRow[] = [];
  let i = 0;

  while (i < rows.length) {
    const current = rows[i];
    const next = rows[i + 1];
    const currentText = splitSingleBilingualText(current.text);
    const currentLang = detectCueLanguage(currentText);
    const nextText = next ? splitSingleBilingualText(next.text) : '';
    const nextLang = next ? detectCueLanguage(nextText) : 'unknown';

    const canFoldPair = next
      && areTimeRangesNearEqual(current.ts, next.ts)
      && ((currentLang === 'zh' && nextLang === 'foreign') || (currentLang === 'foreign' && nextLang === 'zh'));

    if (canFoldPair) {
      const zhText = currentLang === 'zh' ? currentText : nextText;
      const foreignText = currentLang === 'foreign' ? currentText : nextText;
      result.push({
        ts: current.ts,
        text: `${zhText}\n${foreignText}`,
        type: 'merged',
        cueKind: combineRowCueKind(current.cueKind, next.cueKind),
        index: result.length + 1,
      });
      i += 2;
      continue;
    }

    result.push({
      ts: current.ts,
      text: currentText,
      type: currentLang === 'mixed' || currentText.includes('\n') ? 'merged' : 'dialogue',
      cueKind: current.cueKind,
      index: result.length + 1,
    });
    i += 1;
  }

  return result;
}

export function detectSubtitleLanguagePair(text: string, name = ''): SubtitleLanguagePair | undefined {
  const rows = parseSubtitle(text);
  if (rows.length === 0) return undefined;

  const counts = new Map<SubtitleLanguage, number>();
  for (const row of rows.slice(0, 160)) {
    const normalized = splitSingleBilingualText(row.text);
    for (const line of normalized.split(/\\N|\\n|\r?\n/)) {
      const language = detectLanguageByContent(line);
      if (language === 'unknown' || language === 'bilingual' || language === 'commentary') continue;
      counts.set(language, (counts.get(language) || 0) + 1);
    }
  }

  const filenameLang = name ? detectLanguageByFilename(name) : 'unknown';
  // Explicit non-English foreign filenames cannot form a main-path language pair.
  if (filenameLang === 'ja' || filenameLang === 'ko' || filenameLang === 'fr' || filenameLang === 'es') {
    return undefined;
  }

  const zhCn = counts.get('zh-CN') || 0;
  const zhTw = counts.get('zh-TW') || 0;
  if (zhCn + zhTw === 0) return undefined;

  // 简中优先：无文件名提示时，平局取 zh-CN。
  const primary: 'zh-CN' | 'zh-TW' = filenameLang === 'zh-TW' || filenameLang === 'zh-CN'
    ? filenameLang
    : zhCn >= zhTw ? 'zh-CN' : 'zh-TW';

  const enCount = counts.get('en') || 0;
  const latinCount = counts.get('latin') || 0;
  const demotedForeignCount = (['ja', 'ko', 'fr', 'es'] as const)
    .reduce((sum, language) => sum + (counts.get(language) || 0), 0);

  // English only. Latin-script lines without lexicon hits may count as English when no
  // demoted foreign language is present (keeps short EN lines like "Lets begin." eligible).
  const englishEligible = isMainPathSecondaryLanguage(filenameLang)
    || enCount > 0
    || (latinCount > 0 && demotedForeignCount === 0);

  if (!englishEligible) return undefined;
  if (demotedForeignCount > enCount + latinCount) return undefined;

  return { primary, secondary: 'en' };
}
