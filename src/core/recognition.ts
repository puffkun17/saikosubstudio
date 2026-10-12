/**
 * Act-1 recognition fixes from the 2026-10-12 real-sample log (subhd-tests/log.md).
 * Pure functions; wired into import in useStudioStore via a thin adapter.
 */

/* ---------- 1. zh+ja / zh+ko bilingual ASS split by style names (葬送的芙莉莲 AI-Raws case) ---------- */

export type StyleLang = 'zh' | 'ja' | 'ko' | 'en';
const STYLE_LANG_TOKENS: [StyleLang, RegExp][] = [
  ['ja', /(?:^|[_\-\s.])(?:jp|jpn|ja|jap|日|日文|日语)(?:\d*)$/i],
  ['zh', /(?:^|[_\-\s.])(?:ch|chs|cht|cn|zh|sc|tc|chn|中|中文|简|繁)(?:\d*)$/i],
  ['ko', /(?:^|[_\-\s.])(?:kr|kor|ko|韩|韓)(?:\d*)$/i],
  ['en', /(?:^|[_\-\s.])(?:en|eng)(?:\d*)$/i],
];

export function styleLanguage(style: string): StyleLang | null {
  const s = (style || '').trim();
  for (const [lang, re] of STYLE_LANG_TOKENS) if (re.test(s)) return lang;
  return null;
}

export interface StyleSplitTrack { lang: StyleLang; styles: string[]; text: string; events: number }
export interface StyleSplit { primary: StyleSplitTrack; secondary: StyleSplitTrack; neutralStyles: string[] }

/**
 * When an ASS file carries Chinese and another language as separate events on paired styles
 * (Dial_CH/Dial_JP, OP_CH/OP_JP …), produce two virtual ASS files. Neutral styles (Screen,
 * Title, Staff) go with the Chinese track. Returns null for ordinary files.
 */
export function splitAssByLanguageStyles(text: string, minShare = 0.25): StyleSplit | null {
  if (!text || !text.includes('[Events]')) return null;
  const lines = text.split(/\r?\n/);
  const eventsAt = lines.findIndex((l) => l.trim() === '[Events]');
  if (eventsAt < 0) return null;
  let formatKeys: string[] = [];
  const counts = new Map<StyleLang, Map<string, number>>();
  let total = 0;
  const styleOf = (line: string) => {
    const idx = formatKeys.indexOf('style');
    return line.replace(/^Dialogue:\s*/, '').split(',')[idx >= 0 ? idx : 3]?.trim() || '';
  };
  for (const l of lines.slice(eventsAt)) {
    const t = l.trim();
    if (t.startsWith('Format:')) formatKeys = t.slice(7).split(',').map((k) => k.trim().toLowerCase());
    if (!t.startsWith('Dialogue:')) continue;
    total++;
    const style = styleOf(t);
    const lang = styleLanguage(style);
    if (!lang) continue;
    const m = counts.get(lang) || new Map<string, number>();
    m.set(style, (m.get(style) || 0) + 1);
    counts.set(lang, m);
  }
  const sum = (lang: StyleLang) => [...(counts.get(lang)?.values() || [])].reduce((a, b) => a + b, 0);
  if (!counts.has('zh')) return null;
  const other = (['ja', 'ko', 'en'] as StyleLang[]).filter((l) => counts.has(l)).sort((a, b) => sum(b) - sum(a))[0];
  if (!other || total === 0) return null;
  if (sum('zh') / total < minShare || sum(other) / total < minShare) return null;
  const zhStyles = new Set(counts.get('zh')!.keys());
  const otherStyles = new Set(counts.get(other)!.keys());
  const build = (keep: (style: string) => boolean) => {
    let n = 0;
    const out = lines.map((l, i) => {
      if (i <= eventsAt || !l.trim().startsWith('Dialogue:')) return l;
      if (keep(styleOf(l.trim()))) { n++; return l; }
      return null;
    }).filter((l): l is string => l !== null).join('\n');
    return { out, n };
  };
  const zh = build((s) => !otherStyles.has(s));
  const sec = build((s) => otherStyles.has(s));
  const neutral = new Set<string>();
  for (const l of lines.slice(eventsAt)) {
    if (!l.trim().startsWith('Dialogue:')) continue;
    const s = styleOf(l.trim());
    if (!zhStyles.has(s) && !otherStyles.has(s)) neutral.add(s);
  }
  return {
    primary: { lang: 'zh', styles: [...zhStyles], text: zh.out, events: zh.n },
    secondary: { lang: other, styles: [...otherStyles], text: sec.out, events: sec.n },
    neutralStyles: [...neutral],
  };
}

/* ---------- 2. SDH by content (人性本兽 Animals case: SDH not recognised) ---------- */

const SOUND_TAG = /^\s*(?:-\s*)?[[(（【][^\])）】]{1,40}[\])）】]\s*$|^\s*(?:-\s*)?[[(（][A-Z\s'’.-]{2,30}[\])）]/;
const SPEAKER_TAG = /^\s*(?:-\s*)?[A-Z][A-Z0-9 .'’-]{1,24}:\s+\S/;
const MUSIC_LINE = /^[\s-]*[♪♫#]/;

export interface SdhSignal { isSdh: boolean; soundShare: number; speakerShare: number; sampled: number }

/**
 * SDH tracks carry many sound cues ([door creaks], (SIGHS)) and speaker labels (JOHN:).
 * Signs/on-screen text are NOT SDH: they come from ASS positioning/styles (see isPositionedSign).
 */
export function detectSdhByContent(rows: { text: string }[], threshold = 0.08): SdhSignal {
  const sample = rows.slice(0, 400);
  let sound = 0;
  let speaker = 0;
  for (const r of sample) {
    const lines = (r.text || '').split(/\r?\n|\\N/);
    if (lines.some((l) => SOUND_TAG.test(l) || /[[(][a-z][a-z\s'’,-]{2,40}[\])]/.test(l))) sound++;
    if (lines.some((l) => SPEAKER_TAG.test(l))) speaker++;
  }
  const n = Math.max(1, sample.length);
  const soundShare = sound / n;
  const speakerShare = speaker / n;
  return { isSdh: soundShare >= threshold || soundShare + speakerShare >= threshold * 1.5, soundShare, speakerShare, sampled: sample.length };
}

/* ---------- 3. Signs vs SDH: positioned / rotated on-screen text ---------- */

export const isPositionedSign = (rawAssText: string, style = ''): boolean =>
  /\\(?:frz|frx|fry)-?\d|\\pos\(|\\move\(|\\org\(/.test(rawAssText || '') || /^(?:sign|screen|title|note|caption)s?\b|画面|屏幕|标牌/i.test(style);

/** Rotated signs must not be re-wrapped (怪换行 in the Frieren case). */
export const isRotated = (rawAssText: string) => /\\fr[zxy]?-?\d/.test(rawAssText || '');

/* ---------- 4. Two-speaker dash lines (H-1: "- A - B" flattened) ---------- */

/**
 * "- Where were you? - Out." → "- Where were you?\n- Out." Only when the line starts with a dash
 * and a second " - " follows sentence punctuation; hyphenated words are untouched.
 */
export function restoreDashDialogue(text: string): string {
  if (!text || text.includes('\n')) return text;
  const t = text.trim();
  if (!/^[-–—]\s?\S/.test(t)) return text;
  const m = t.match(/^([-–—]\s?.+?[.!?。！？…"”’)])\s+([-–—]\s?\S.*)$/);
  return m ? `${m[1]}\n${m[2]}` : text;
}

/* ---------- 5. Uploader watermark lines (暗潮之下 Below case) ---------- */

export const isUploaderWatermark = (text: string): boolean => {
  const c = (text || '').replace(/\{[^}]*\}/g, '').trim();
  if (!c || c.length > 80) return false;
  return /(?:www\.|https?:\/\/|\b[a-z0-9-]+\.(?:com|net|tv|org|cn|me|cc)\b|subhd|射手网|伪射手|assrt|opensubtitles|字幕(?:下载|下載|分享)站|上传者|上傳者|uploaded by|downloaded from|sync(?:ed)? (?:and corrected )?by|微博\s*@|公众号|公眾號|(?:合并|合併|转载|轉載)分享|更多资源|更多資源)/i.test(c);
};

/* ---------- 6. English lyrics ---------- */

/** ♪ text ♪ / # text # lines are lyrics in every language (English lyrics were missed). */
export const isMusicLyricLine = (text: string): boolean => {
  const c = (text || '').replace(/\{[^}]*\}/g, '').trim();
  return /^[-\s]*[♪♫♬#]/.test(c) && c.replace(/[♪♫♬#\s-]/g, '').length > 1;
};

/* ---------- 7. Title key for grouping across language tags ---------- */

const LANG_TOKENS = /(?:^|[\s._\-[\]()（）【】])(?:sdh|cc|hi|forced|eng?|english|chs|cht|chi|zh(?:-hans|-hant|-cn|-tw)?|sc|tc|gb|big5|简中|繁中|简体|繁體|繁体|简繁|中英|双语|雙語|日语|日本語字幕|日文|jpn?|kor?|spa?|fre?|ger|ita|por|es|fr|de|it|pt)(?=$|[\s._\-[\]()（）【】])/gi;

export function titleKeyOf(fileName: string): string {
  return (fileName || '')
    .replace(/\.[A-Za-z0-9]{2,4}$/, '')
    .replace(/\b\d{3,4}\s*[x×]\s*\d{3,4}\b/gi, ' ')
    .replace(/\[[0-9A-F]{8}\]/gi, '')
    .replace(LANG_TOKENS, ' ')
    .replace(LANG_TOKENS, ' ')
    .replace(/S\d{1,3}[\s._-]*E\d{1,4}|\d{1,2}x\d{2,3}|#\s?\d{1,4}|第.{1,4}[集话話季]/gi, ' ')
    .replace(/[._\-[\]()（）【】]+/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:\d{3,4}p|bd|web(?:-?dl|rip)?|bluray|hevc|x26[45]|h\.?26[45]|flac|aac|\d{3,4}x\d{3,4})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* ---------- 8. Trailing song (end-credit lyrics without ♪ markers; 暗潮之下 Below case) ---------- */

/**
 * 推测-level heuristic, tested on synthetic fixtures: a run of ≥ minRun secondary-only cues that
 * starts after the last primary cue is an end-credit song. Returns secondary cue indexes.
 */
export function findTrailingSongRun(primaryLastEndMs: number, secondary: { start: number; end: number }[], minRun = 3): number[] {
  const idx: number[] = [];
  secondary.forEach((c, i) => { if (c.start >= primaryLastEndMs - 500) idx.push(i); });
  return idx.length >= minRun ? idx : [];
}
