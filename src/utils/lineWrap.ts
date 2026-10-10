/**
 * Smart subtitle line-wrapping by *rendered width* (plan §G).
 *
 * - Width is estimated from a deterministic glyph-width table: CJK / kana / Hangul / full-width
 *   punctuation = 1em, Latin = Arial/Helvetica-like proportional advances. The same table is used
 *   in the browser and in tests, so exports are reproducible (a canvas `measureText` can be injected
 *   via `measure`, but exports intentionally default to the table: the target is the viewer's
 *   player, not the editing browser).
 * - Lines that already fit are never touched (source line breaks are kept unless a line overflows).
 * - At most two lines; when even two lines overflow we still emit two and report `overflow` so the
 *   caller can surface it for review instead of cramming a third line.
 * - Break preference: sentence end > comma / 顿号 / semicolon > before a conjunction > word gap >
 *   between ideographs. Latin words, numbers and URLs are never split; basic kinsoku (避头尾) is
 *   enforced; a single CJK character / tiny word is never left alone on a line; lines are balanced
 *   with a slight preference for a shorter top line (pyramid).
 * All parameters (font px, available width) come from the export preset — nothing user-tunable.
 */

export type TextMeasure = (text: string, fontPx: number) => number;

export interface WrapOptions {
  /** Rendered font size in px of the target frame (e.g. ASS Fontsize × ScaleX/100). */
  fontPx: number;
  /** Available line width in the same px space (PlayResX − MarginL − MarginR, × preset ratio). */
  maxWidth: number;
  /** Hard cap; only 2 is supported (Netflix / plan §G). */
  maxLines?: 2;
  measure?: TextMeasure;
  /**
   * Keep every source line as its own line (wrap only lines that overflow, each into ≤2).
   * Used for signs / notes whose multi-line layout is deliberate (e.g. a 3-line on-screen card).
   */
  keepSourceLines?: boolean;
}

export interface WrapResult {
  lines: string[];
  /** True when the output differs from the input line structure. */
  changed: boolean;
  /** True when some output line is still wider than maxWidth (needs human review). */
  overflow: boolean;
}

// Arial advance widths (1/1000 em) for ASCII 0x20..0x7E.
const ASCII_ADVANCE = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // ␠ ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,      // p-z { | } ~
];

const isWideCodePoint = (cp: number): boolean => (
  (cp >= 0x1100 && cp <= 0x115f)
  || (cp >= 0x2e80 && cp <= 0x303e)
  || (cp >= 0x3041 && cp <= 0x33ff)
  || (cp >= 0x3400 && cp <= 0x4dbf)
  || (cp >= 0x4e00 && cp <= 0x9fff)
  || (cp >= 0xa000 && cp <= 0xa4cf)
  || (cp >= 0xac00 && cp <= 0xd7a3)
  || (cp >= 0xf900 && cp <= 0xfaff)
  || (cp >= 0xfe30 && cp <= 0xfe4f)
  || (cp >= 0xff00 && cp <= 0xff60)
  || (cp >= 0xffe0 && cp <= 0xffe6)
  || (cp >= 0x1f300 && cp <= 0x1f64f)
  || (cp >= 0x1f900 && cp <= 0x1f9ff)
  || (cp >= 0x20000 && cp <= 0x3fffd)
);

const isHangul = (cp: number): boolean => (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f);

/** Width of one code point in em. */
export function glyphWidthEm(cp: number): number {
  if (cp >= 0x20 && cp <= 0x7e) return ASCII_ADVANCE[cp - 0x20] / 1000;
  if ((cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x200b && cp <= 0x200d) || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x2028) return 0;
  if (isWideCodePoint(cp)) return 1;
  if (cp >= 0xff61 && cp <= 0xff9f) return 0.5; // half-width katakana
  if (cp === 0x2026 || cp === 0x2014 || cp === 0x2015) return 1; // … — ―
  if (cp === 0x2013) return 0.556;
  if (cp >= 0x2018 && cp <= 0x201f) return 0.333;
  if (cp === 0x266a || cp === 0x266b || cp === 0x266c || cp === 0x2669) return 1; // ♪ ♫ ♬ ♩
  if (cp >= 0x00a0 && cp <= 0x024f) return 0.6;
  return 0.6;
}

const TAG_RE = /\{[^}]*\}|<\/?(?:i|b|u|s|font)(?:\s[^>]*)?>/gi;

/** Strip ASS override blocks and SRT inline tags (zero rendered width). */
export const stripInlineTags = (text: string): string => text.replace(TAG_RE, '');

/** Deterministic width estimate in px. */
export const estimateTextWidth: TextMeasure = (text, fontPx) => {
  let em = 0;
  for (const ch of stripInlineTags(text)) em += glyphWidthEm(ch.codePointAt(0) ?? 0x20);
  return em * fontPx;
};

/** Characters that must not start a line (避头). */
const NO_LINE_START = new Set([...'，。！？、；：,.!?;:)]}）】》〉」』〕〗〙〛’”"\'…‥ー〜～・·%％ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〻ゝゞヽヾ']);
/** Characters that must not end a line (避尾). */
const NO_LINE_END = new Set([...'([{（【《〈「『〔〖〘〚‘“$￥¥£€#＃']);

const SENTENCE_END = /[。！？!?…‥]$/;
const CLAUSE_END = /[，、；：,;:—–]$/;
const TRAILING_CLOSERS = /[)\]}）】》〉」』〕’”"']+$/;
const LATIN_ABBREVIATION = /^(?:mr|mrs|ms|dr|st|jr|sr|vs|mt|no|prof|gen|col|lt|sgt|capt|e\.g|i\.e|etc)\.$/i;
const EN_CONJUNCTIONS = new Set(['and', 'but', 'or', 'nor', 'so', 'yet', 'because', 'that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'while', 'if', 'unless', 'until', 'although', 'though', 'since', 'than', 'whether', 'before', 'after']);
const EN_PREPOSITIONS = new Set(['to', 'for', 'with', 'of', 'in', 'on', 'at', 'from', 'about', 'into', 'like', 'over', 'without', 'as', 'by']);
const EN_DANGLING = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'these', 'those', 'to', 'of', 'mr.', 'mrs.', 'ms.', 'dr.', 'i']);
/** Ideographs that bind to the NEXT one (determiners / numerals before a measure word). */
const CJK_BIND_NEXT = new Set([...'一二两几这那每某各该本此哪第']);
/** Ideographs that bind to the PREVIOUS one (particles / aspect markers / plural). */
const CJK_BIND_PREV = new Set([...'的了着过们吗呢吧啊呀嘛么地得儿']);
const ZH_CONJUNCTIONS = /^(?:但是|可是|不过|因为|所以|而且|并且|如果|要是|然后|还是|或者|虽然|即使|只要|除非|于是|因此|然而|而是|就是|以及|但|而|却|可|或)/;

type AtomKind = 'cjk' | 'word' | 'space';
interface Atom { text: string; kind: AtomKind; soft?: boolean }

const SOFT_BREAK = '\u2028';

function tokenize(text: string): Atom[] {
  const atoms: Atom[] = [];
  let pendingTags = '';
  const pushAtom = (atom: Atom) => {
    if (pendingTags) {
      atom = { ...atom, text: pendingTags + atom.text };
      pendingTags = '';
    }
    const prev = atoms[atoms.length - 1];
    if (atom.kind === 'word' && prev?.kind === 'word') prev.text += atom.text;
    else if (atom.kind === 'space' && prev?.kind === 'space') {
      prev.text += atom.text;
      prev.soft = Boolean(prev.soft && atom.soft);
    } else atoms.push(atom);
  };
  let i = 0;
  while (i < text.length) {
    TAG_RE.lastIndex = i;
    const tag = TAG_RE.exec(text);
    if (tag && tag.index === i) {
      if (/^<\//.test(tag[0]) && atoms.length > 0 && !pendingTags) {
        atoms[atoms.length - 1].text += tag[0]; // closing tag sticks to the left
      } else {
        pendingTags += tag[0]; // opening / override tag sticks to the right
      }
      i += tag[0].length;
      continue;
    }
    const cp = text.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(cp);
    i += ch.length;
    if (ch === SOFT_BREAK) pushAtom({ text: '', kind: 'space', soft: true });
    else if (/\s/.test(ch)) pushAtom({ text: ch, kind: 'space' });
    else if (isWideCodePoint(cp) && !isHangul(cp)) pushAtom({ text: ch, kind: 'cjk' });
    else pushAtom({ text: ch, kind: 'word' });
  }
  if (pendingTags) {
    if (atoms.length > 0) atoms[atoms.length - 1].text += pendingTags;
    else atoms.push({ text: pendingTags, kind: 'word' });
  }
  return atoms;
}

const visible = (s: string) => stripInlineTags(s);
const firstChar = (s: string) => [...visible(s)][0] ?? '';
const lastChar = (s: string) => { const chars = [...visible(s)]; return chars[chars.length - 1] ?? ''; };

const renderAtoms = (atoms: Atom[]): string => {
  let start = 0;
  let end = atoms.length;
  while (start < end && atoms[start].kind === 'space') start++;
  while (end > start && atoms[end - 1].kind === 'space') end--;
  let out = '';
  for (let k = start; k < end; k++) {
    const atom = atoms[k];
    if (atom.kind === 'space') {
      // A soft source break between two ideographs renders as nothing; between Latin words as a space.
      out += atom.soft ? ((atoms[k - 1]?.kind === 'cjk' && atoms[k + 1]?.kind === 'cjk') ? '' : ' ') : atom.text;
    } else out += atom.text;
  }
  return out;
};

/** Cost of breaking *before* atom index k (lower is better); Infinity = forbidden. */
function breakQuality(atoms: Atom[], k: number): number {
  // Locate the visible atoms on each side of the break.
  let left = k - 1;
  let gap: Atom | undefined;
  while (left >= 0 && atoms[left].kind === 'space') { gap = atoms[left]; left--; }
  let right = k;
  while (right < atoms.length && atoms[right].kind === 'space') { gap = atoms[right]; right++; }
  if (left < 0 || right >= atoms.length) return Infinity;
  const prev = atoms[left];
  const next = atoms[right];
  const prevLast = lastChar(prev.text);
  const nextFirst = firstChar(next.text);
  if (NO_LINE_START.has(nextFirst) || NO_LINE_END.has(prevLast)) return Infinity;
  if (!gap && prev.kind === 'word' && next.kind === 'word') return Infinity; // never split a Latin token
  const prevCore = visible(prev.text).replace(TRAILING_CLOSERS, '');
  if (prev.kind === 'word' && LATIN_ABBREVIATION.test(prevCore)) return 2.5;
  if (SENTENCE_END.test(prevCore) || (prev.kind === 'word' && /[A-Za-z\u00c0-\u024f)\]'"’”]\.$/.test(visible(prev.text)) && !/\d\.$/.test(prevCore))) return 0;
  if (CLAUSE_END.test(prevCore)) return 0.15;
  if (gap && prev.kind === 'cjk' && next.kind === 'cjk') return 0.1; // 中文空格 = 停顿或原字幕换行
  const nextWord = visible(next.text).toLowerCase().replace(/[^a-z']/g, '');
  const prevWord = visible(prev.text).toLowerCase();
  if (next.kind === 'word' && EN_DANGLING.has(prevWord)) return 1.2;
  if (next.kind === 'word' && EN_CONJUNCTIONS.has(nextWord)) return 0.3;
  if (next.kind === 'word' && EN_PREPOSITIONS.has(nextWord)) return 0.4;
  if (next.kind === 'cjk') {
    const rest = atoms.slice(right, right + 3).map((atom) => visible(atom.text)).join('');
    if (ZH_CONJUNCTIONS.test(rest)) return 0.3;
  }
  if (gap) return 0.5;
  if (prev.kind === 'cjk' && next.kind === 'cjk' && (CJK_BIND_NEXT.has(prevLast) || CJK_BIND_PREV.has(nextFirst))) return 1.15;
  if (next.kind === 'cjk' && CJK_BIND_NEXT.has(nextFirst)) return 0.55; // 「…我|一整年…」: phrase starts at a numeral / determiner
  return 0.65; // between ideographs / CJK↔Latin without punctuation
}

function isOrphan(atoms: Atom[]): boolean {
  const content = atoms.filter((atom) => atom.kind !== 'space');
  if (content.length !== 1) return false;
  const only = visible(content[0].text);
  if (content[0].kind === 'cjk') return true;
  return only.replace(/[^\p{L}\p{N}]/gu, '').length <= 2;
}

function lineWidth(atoms: Atom[], measure: TextMeasure, fontPx: number): number {
  return measure(renderAtoms(atoms), fontPx);
}

/** Wrap one logical line into ≤2 lines by rendered width. */
export function wrapSingleLine(text: string, options: WrapOptions): WrapResult {
  const measure = options.measure ?? estimateTextWidth;
  const atoms = tokenize(text);
  const whole = renderAtoms(atoms);
  const totalWidth = measure(whole, options.fontPx);
  if (totalWidth <= options.maxWidth || atoms.length < 2) {
    return { lines: whole ? [whole] : [], changed: whole !== text, overflow: totalWidth > options.maxWidth };
  }
  let best: { k: number; cost: number; w1: number; w2: number } | null = null;
  for (let k = 1; k < atoms.length; k++) {
    if (atoms[k].kind === 'space' && atoms[k - 1].kind === 'space') continue;
    const quality = breakQuality(atoms, k);
    if (!Number.isFinite(quality)) continue;
    const top = atoms.slice(0, k);
    const bottom = atoms.slice(k);
    const w1 = lineWidth(top, measure, options.fontPx);
    const w2 = lineWidth(bottom, measure, options.fontPx);
    if (w1 === 0 || w2 === 0) continue;
    const imbalance = Math.abs(w1 - w2) / (w1 + w2);
    // Quadratic: small differences barely matter (break quality decides), lopsided splits are expensive.
    let cost = quality + 1.5 * imbalance * imbalance;
    if (w1 > w2) cost += 0.05; // pyramid: prefer the shorter line on top
    const widest = Math.max(w1, w2);
    if (widest > options.maxWidth) cost += 100 + (widest - options.maxWidth) / options.maxWidth;
    if (isOrphan(top) || isOrphan(bottom)) cost += 3;
    if (!best || cost < best.cost - 1e-9) best = { k, cost, w1, w2 };
  }
  if (!best) return { lines: [whole], changed: whole !== text, overflow: true };
  const lines = [renderAtoms(atoms.slice(0, best.k)), renderAtoms(atoms.slice(best.k))];
  return { lines, changed: true, overflow: Math.max(best.w1, best.w2) > options.maxWidth };
}

const DASH_LINE = /^[-‐–—]\s?\S/;
const endsCjk = (s: string) => { const c = lastChar(s).codePointAt(0) ?? 0; return isWideCodePoint(c) && !isHangul(c); };
const startsCjk = (s: string) => { const c = firstChar(s).codePointAt(0) ?? 0; return isWideCodePoint(c) && !isHangul(c); };

/**
 * Wrap a block of source lines (one language). Keeps the source line breaks when every line fits
 * and there are ≤2 lines; otherwise re-flows the whole block into ≤2 balanced lines.
 */
export function wrapSubtitleBlock(sourceLines: string[], options: WrapOptions): WrapResult {
  const measure = options.measure ?? estimateTextWidth;
  const lines = sourceLines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (lines.length === 0) return { lines: [], changed: sourceLines.length > 0, overflow: false };
  const fits = (line: string) => measure(line, options.fontPx) <= options.maxWidth;
  const normalizedChanged = lines.length !== sourceLines.length || lines.some((line, idx) => line !== sourceLines[idx]);
  if (lines.length <= 2 && lines.every(fits)) return { lines, changed: normalizedChanged, overflow: false };
  if (options.keepSourceLines) {
    const parts = lines.map((line) => (fits(line) ? { lines: [line], changed: false, overflow: false } : wrapSingleLine(line, options)));
    return {
      lines: parts.flatMap((part) => part.lines),
      changed: normalizedChanged || parts.some((part) => part.changed),
      overflow: parts.some((part) => part.overflow),
    };
  }
  // Two-speaker dash lines（- 你好 / - 再见）: never merge speakers; keep as-is and report overflow.
  if (lines.length === 2 && lines.every((line) => DASH_LINE.test(line))) {
    return { lines, changed: normalizedChanged, overflow: !lines.every(fits) };
  }
  if (lines.length === 1) return wrapSingleLine(lines[0], options);
  let joined = lines[0];
  for (let idx = 1; idx < lines.length; idx++) {
    const glue = endsCjk(joined) && startsCjk(lines[idx]) ? SOFT_BREAK : ' ';
    joined += glue + lines[idx];
  }
  const result = wrapSingleLine(joined, options);
  return { ...result, changed: true };
}

const CJK_TEXT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7a3\uf900-\ufaff]/;
/** True when the text contains CJK ideographs, kana or Hangul. */
export const hasCjk = (text: string): boolean => CJK_TEXT.test(stripInlineTags(text));

const KANA_TEXT = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;
const HANGUL_TEXT = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;

type LineScript = 'han' | 'ja' | 'ko' | 'latin';

const lineScript = (line: string): LineScript => {
  const plain = stripInlineTags(line);
  if (KANA_TEXT.test(plain)) return 'ja';
  if (HANGUL_TEXT.test(plain)) return 'ko';
  return CJK_TEXT.test(plain) ? 'han' : 'latin';
};

/**
 * Split a bilingual cue's lines into [primary block, secondary block]. The primary block is the run
 * of leading lines in the first line's script (Chinese, Japanese, Korean); the rest is the secondary
 * language — so zh + ja / zh + ko pairs are never glued into one CJK paragraph. Source line breaks
 * inside each language are preserved (ASS sources keep \N as '\n'). Monolingual text → one block.
 */
export function splitLanguageBlocks(text: string): string[][] {
  const lines = text.split('\n');
  if (lines.length <= 1) return [lines];
  const first = lineScript(lines[0]);
  if (first === 'latin') {
    // Latin first: split only when a CJK line follows (secondary-first layouts); else one block.
    return lines.slice(1).some(hasCjk) ? [[lines[0]], lines.slice(1)] : [lines];
  }
  let idx = 1;
  while (idx < lines.length && lineScript(lines[idx]) === first) idx++;
  if (idx === lines.length) return [lines];
  return [lines.slice(0, idx), lines.slice(idx)];
}
