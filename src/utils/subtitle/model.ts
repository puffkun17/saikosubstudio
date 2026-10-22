/** Subtitle model: types, language constants, pure time + cue-list helpers. */
export type { DecodeResult } from '../textEncoding';

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
  method: 'exact-match' | 'shifted-match' | 'expanded-dialogue' | 'coverage-merge' | 'single-track';
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
  alignment?: 'expanded-dialogue' | 'coverage-merge' | 'shifted-match';
  provenance?: AlignmentProvenance;
  index: number;
}

export interface RawSub {
  ts: string;
  text: string;
  cueKind?: CueKind;
  cueMeta?: CueClassification;
  auxiliary?: AuxiliaryCueClassification;
  /** ASS layer (lower wins when deduping identical same-time cues). */
  layer?: number;
}

export type SubtitleLanguage =
  | 'zh-CN'
  | 'zh-TW'
  | 'en'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'it'
  | 'latin'
  | 'bilingual'
  | 'commentary'
  | 'unknown';

/**
 * Latin-alphabet languages accepted as the SECOND language (Derek, PR #39 decision 1).
 * Priority: Spanish first (most common alongside US shows), French second, then pt / de / it.
 */
export const LATIN_SECONDARY_LANGUAGES = ['es', 'fr', 'pt', 'de', 'it'] as const;
export type LatinSecondaryLanguage = (typeof LATIN_SECONDARY_LANGUAGES)[number];

export const isLatinSecondaryLanguage = (language: string): language is LatinSecondaryLanguage =>
  (LATIN_SECONDARY_LANGUAGES as readonly string[]).includes(language);

export interface SubtitleLanguagePair {
  primary: 'zh-CN' | 'zh-TW';
  /** Single-file bilingual pair secondary: English, or a Latin-alphabet language (es / fr / pt / de / it). */
  secondary: 'en' | LatinSecondaryLanguage;
}

/** Languages allowed in the 原文 slot (auto + manual): English, Latin-alphabet es/fr/pt/de/it, ja / ko. */
export const MAIN_PATH_SECONDARY_LANGUAGES = ['en', ...LATIN_SECONDARY_LANGUAGES, 'ja', 'ko'] as const;
export type MainPathSecondaryLanguage = (typeof MAIN_PATH_SECONDARY_LANGUAGES)[number];

/** Cue-count ratio below which an English track is treated as non-dialogue (on-screen/sparse). */
export const SPARSE_SECONDARY_CUE_RATIO = 0.25;

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
  /** Original author of the script. Never the merging user (use scriptUpdatedBy). */
  originalScript?: string;
  originalTranslation?: string;
  originalEditing?: string;
  originalTiming?: string;
  /** The person who produced this bilingual merge. */
  scriptUpdatedBy?: string;
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
  /** 署名行在画面上的位置（样式）：居中（默认）/ 底部 / 顶部。时间点不受影响。 */
  creditPosition?: 'center' | 'bottom' | 'top';
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


/** Strip ASS/HTML chrome for cleaning (shared by io / analysis / engine). */
export function cleanSubtitleContent(text: string, isEnglish = false): string {
  if (!text) return "";
  let cleaned = text.replace(/\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/\[字幕组\]|\[制作\]|\[压制\]/g, '');
  // Do not strip speaker dashes when the cue looks like packed multi-speaker dialogue
  // ("-A-B" / "-A\n-B"); packed-turn expansion reads those markers from source text.
  const packedSpeakerDashes = (cleaned.match(/(^|\n)\s*[-—–]\s*\S/g) || []).length >= 2
    || /^[-—–]\s*\S[\s\S]*[-—–]\s*\S/.test(cleaned);
  if (!packedSpeakerDashes) {
    cleaned = cleaned.replace(/^-+\s*/, '');
    cleaned = cleaned.replace(/\s*-+$/, '');
  }
  
  if (isEnglish) {
    cleaned = cleaned.replace(/^[A-Z\s]+:\s*/, '');
  }
  
  // Collapse ordinary spaces/tabs only — keep real newlines so ASS \N (already turned into \n
  // by parseSubtitle) and SRT multi-line cues survive for packed-dialogue expansion (V9).
  cleaned = cleaned
    .replace(/\r\n|\r/g, '\n')
    .replace(/[^\S\n\u00a0\u202f]+/g, ' ')
    .replace(/[ \t\u00a0\u202f]*\n[ \t\u00a0\u202f]*/g, '\n')
    .trim();
  return cleaned;
}


export function timeToMs(t: string): number {
  if (!t) return 0;
  const normalized = t.trim().replace('.', ',');
  const [hms, fracRaw = '0'] = normalized.split(',');
  const [h, m, s] = hms.split(':');
  // ASS centiseconds are 1–2 digits; SRT milliseconds are 3. Pad/truncate to ms.
  const frac = (fracRaw.replace(/\D/g, '') + '000').slice(0, 3);
  return (parseInt(h || '0', 10) * 3600 + parseInt(m || '0', 10) * 60 + parseInt(s || '0', 10)) * 1000
    + parseInt(frac || '0', 10);
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


export function sortCuesByTime(subs: RawSub[]): RawSub[] {
  return subs
    .map((sub, index) => ({
      sub,
      index,
      start: timeToMs(sub.ts.split(' --> ')[0] || ''),
      end: timeToMs(sub.ts.split(' --> ')[1] || ''),
      layer: sub.layer ?? 0,
    }))
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.index - b.index;
    })
    .map((entry) => entry.sub);
}

/**
 * Drop identical same-time same-text cues (ASS glow+body layers). Keeps the
 * lowest layer thanks to sortCuesByTime ordering (V7). Distinct text is kept.
 */
export function dedupeIdenticalCues(subs: RawSub[]): RawSub[] {
  const sorted = sortCuesByTime(subs);
  const out: RawSub[] = [];
  const seen = new Set<string>();
  for (const sub of sorted) {
    const start = timeToMs(sub.ts.split(' --> ')[0] || '');
    const end = timeToMs(sub.ts.split(' --> ')[1] || '');
    const key = `${start}|${end}|${sub.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sub);
  }
  return out;
}

/** Parse-time / merge-entry normalization: time sort + identical-cue dedupe. */
export function normalizeParsedCues(subs: RawSub[]): RawSub[] {
  return dedupeIdenticalCues(subs);
}

/** True when two `start --> end` timestamps match within tolerance (ms). */
export const areTimeRangesNearEqual = (a: string, b: string, toleranceMs = 120): boolean => {
  const [aStart, aEnd] = a.split(' --> ').map(timeToMs);
  const [bStart, bEnd] = b.split(' --> ').map(timeToMs);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return a === b;
  return Math.abs(aStart - bStart) <= toleranceMs && Math.abs(aEnd - bEnd) <= toleranceMs;
};
