/** Subtitle I/O: parse, clean, normalize wrappers, language detect that needs parse. */
import {
  type RawSub,
  type StyleSettings,
  type SubtitleLanguage,
  type SubtitleLanguageDetection,
  type SubtitleLanguagePair,
  LATIN_SECONDARY_LANGUAGES,
  areTimeRangesNearEqual,
  cleanSubtitleContent,
  isLatinSecondaryLanguage,
  normalizeParsedCues,
  timeToMs,
} from './model';
import {
  BILINGUAL_SECONDARY_SHARE,
  BILINGUAL_SECONDARY_SHARE_WITH_HINT,
  classifySubtitleCue,
  detectCueLanguage,
  detectLanguageByContent,
  detectLanguageByFilename,
  isSdhOrCcSubtitleFilename,
  isSentenceLevelLatinLine,
  splitSingleBilingualText,
} from './analysis';

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


const timestampRegex = /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/;

/** Cheap cue-count estimate for bind-time dialogue quality (SRT blocks / ASS Dialogue lines). */
export function estimateSubtitleCueCount(text: string): number {
  if (!text) return 0;
  if (text.includes('[Events]') && text.includes('Dialogue:')) {
    return text.split(/\r?\n/).filter((line) => line.trim().startsWith('Dialogue:')).length;
  }
  const srtBlocks = text.match(/\d{2}:\d{2}:\d{2}[,.]\d{2,3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{2,3}/g);
  return srtBlocks ? srtBlocks.length : 0;
}


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
 * Sort cues by start/end (stable). Used after parse and before merge (V6).
 * ASS layer is a tie-break so lower layers stay first for later dedupe (V7).


/** Convert ASS H:MM:SS.cc (centiseconds) to SRT-style HH:MM:SS,mmm. */
function assClockToSrtTimestamp(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})[.:](\d{1,2})$/);
  if (!match) return trimmed.replace('.', ',');
  const [, h, m, s, cs] = match;
  const ms = (cs + '00').slice(0, 3);
  const pad = (n: string, len: number) => n.padStart(len, '0');
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${ms}`;
}


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
        // Keep newlines so dual-speaker SRT ("-A\n-B") matches ASS \N packing (V9).
        const cueText = contentLines.join("\n");
        const cueMeta = classifySubtitleCue(cueText, { timingLine: line });
        subtitles.push({ ts: timestamp, text: cueText, cueKind: cueMeta.kind, cueMeta, auxiliary: cueMeta.auxiliary });
      }
    } else {
      i++;
    }
  }
  return normalizeParsedCues(subtitles);
}

/**
 * Remove ASS vector-drawing payloads. Inside `{\\pN}` with N > 0, text is drawing commands
 * (`m 0 0 l 100 0 …`) until `{\\p0}`. Override blocks are kept so classification still sees
 * tags such as `\\pos`; only the drawing coordinates are dropped.
 */
export function stripAssDrawingCommands(assText: string): string {
  let drawing = false;
  let out = '';
  for (const segment of assText.match(/\{[^}]*\}|[^{]+|\{/g) || []) {
    if (segment.startsWith('{') && segment.endsWith('}')) {
      const scales = [...segment.matchAll(/\\p(\d+)/g)];
      if (scales.length > 0) drawing = Number(scales[scales.length - 1][1]) > 0;
      out += segment;
    } else if (!drawing) {
      out += segment;
    }
  }
  return out;
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
        // Text is always the last Format field — join remainder so commas inside Text stay intact.
        // Style names with commas still shift early fields; prefer Format indices when present.
        const parts = l.split(',');
        if (parts.length >= 10) {
          const startIdx = formatKeys.indexOf('start') >= 0 ? formatKeys.indexOf('start') : 1;
          const endIdx = formatKeys.indexOf('end') >= 0 ? formatKeys.indexOf('end') : 2;
          const styleIdx = formatKeys.indexOf('style') >= 0 ? formatKeys.indexOf('style') : 3;
          const textIdx = formatKeys.indexOf('text') >= 0 ? formatKeys.indexOf('text') : 9;
          if (parts.length > textIdx) {
            const ts = `${assClockToSrtTimestamp(parts[startIdx])} --> ${assClockToSrtTimestamp(parts[endIdx])}`;
            // Vector drawings ({\\p1} m 0 0 l …) are shapes, not text: drop their coordinates.
            const fullDiag = parts.slice(textIdx).join(',');
            const rawDiag = stripAssDrawingCommands(fullDiag);
            const cleanDiag = rawDiag.replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, '').trim();
            if (!cleanDiag && rawDiag !== fullDiag) return; // drawing-only event: nothing to show
            const layerIdx = formatKeys.indexOf('layer') >= 0 ? formatKeys.indexOf('layer') : 0;
            const layerRaw = (parts[layerIdx] || '').replace(/^Dialogue:\s*/i, '').trim();
            const layer = Number.parseInt(layerRaw, 10);
            const cueMeta = classifySubtitleCue(rawDiag, { assStyle: parts[styleIdx] || '' });
            parsed.push({
              ts,
              text: cleanDiag,
              cueKind: cueMeta.kind,
              cueMeta,
              auxiliary: cueMeta.auxiliary,
              layer: Number.isFinite(layer) ? layer : 0,
            });
          }
        }
      }
    });
    return normalizeParsedCues(parsed);
  }
  return parseSrt(text);
}


export function detectSubtitleLanguage(name: string, text: string): SubtitleLanguageDetection {
  const filenameLang = detectLanguageByFilename(name);
  const languagePair = detectSubtitleLanguagePair(text, name);
  // Single-file bilingual still requires zh + English pair detection.
  const isBilingual = Boolean(languagePair);
  const contentLang = detectLanguageByContent(text);
  const sdhFilename = isSdhOrCcSubtitleFilename(name);

  let lang: SubtitleLanguage;
  if (isBilingual) {
    lang = 'bilingual';
  } else if (filenameLang === 'bilingual') {
    // Filename claims bilingual (e.g. 中日) but no English secondary → demote to content/primary.
    lang = contentLang !== 'unknown' ? contentLang : 'zh-CN';
  } else if (filenameLang !== 'unknown') {
    lang = filenameLang;
  } else if (sdhFilename && (contentLang === 'en' || contentLang === 'latin' || contentLang === 'unknown')) {
    // Content-fallback: unmarked SDH with Latin/English body → English (still demoted vs plain eng).
    lang = 'en';
  } else {
    lang = contentLang;
  }

  return languagePair
    ? { lang, isBilingual, languagePair }
    : { lang, isBilingual };
}


const hasSecondarySentenceLine = (text: string): boolean =>
  text.split(/\\N|\\n|\r?\n/).some((line) =>
    /[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af\u1100-\u11ff]/.test(line) || isSentenceLevelLatinLine(line));

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
    const splitText = splitSingleBilingualText(cleanSubText);
    const lang = detectCueLanguage(splitText);
    validCount++;

    // Inline tokens (「我新买的iPhone」) are 'mixed' too; only a separate secondary line counts.
    if (lang === 'mixed' && hasSecondarySentenceLine(splitText)) {
      bilingualSignals++;
      continue;
    }

    const next = validRows[i + 1];
    if (!next) continue;
    const nextText = splitSingleBilingualText(next.text);
    const nextLang = detectCueLanguage(nextText);
    const adjacentBilingualPair = areTimeRangesNearEqual(sub.ts, next.ts)
      && ((lang === 'zh' && nextLang === 'foreign' && hasSecondarySentenceLine(nextText))
        || (lang === 'foreign' && nextLang === 'zh' && hasSecondarySentenceLine(splitText)));

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


export function detectSubtitleLanguagePair(text: string, name = ''): SubtitleLanguagePair | undefined {
  const rows = parseSubtitle(text);
  if (rows.length === 0) return undefined;

  const filenameLang = name ? detectLanguageByFilename(name) : 'unknown';
  // Explicit ja / ko filenames cannot form a zh + Latin-script pair.
  if (filenameLang === 'ja' || filenameLang === 'ko') {
    return undefined;
  }

  const counts = new Map<SubtitleLanguage, number>();
  let zhRows = 0; // cues with a Chinese line
  let secondaryRows = 0; // cues with a sentence-level Latin line (inline tokens excluded)
  const secondaryText: string[] = []; // sentence-level Latin lines → one language decision for the file
  for (const row of rows.slice(0, 160)) {
    const normalized = splitSingleBilingualText(row.text);
    let rowHasZh = false;
    let rowHasSecondary = false;
    for (const line of normalized.split(/\\N|\\n|\r?\n/)) {
      const language = detectLanguageByContent(line);
      if (language === 'unknown' || language === 'bilingual' || language === 'commentary') continue;
      if (language === 'zh-CN' || language === 'zh-TW') {
        rowHasZh = true;
        counts.set(language, (counts.get(language) || 0) + 1);
        continue;
      }
      if (language === 'ja' || language === 'ko') {
        // Kana / Hangul lines are always sentence-level for the foreign-language demotion check.
        counts.set(language, (counts.get(language) || 0) + 1);
        continue;
      }
      if (!isSentenceLevelLatinLine(line)) continue;
      rowHasSecondary = true;
      secondaryText.push(line);
      counts.set(language, (counts.get(language) || 0) + 1);
    }
    if (rowHasZh) zhRows += 1;
    if (rowHasSecondary) secondaryRows += 1;
  }

  const zhCn = counts.get('zh-CN') || 0;
  const zhTw = counts.get('zh-TW') || 0;
  if (zhCn + zhTw === 0) return undefined;

  // 简中优先：无文件名提示时，平局取 zh-CN。
  const primary: 'zh-CN' | 'zh-TW' = filenameLang === 'zh-TW' || filenameLang === 'zh-CN'
    ? filenameLang
    : zhCn >= zhTw ? 'zh-CN' : 'zh-TW';

  // Secondary = every sentence-level Latin line (English or es / fr / pt / de / it, decided per file
  // below); kana / Hangul lines only count against the pair (zh + ja / ko is a two-file job).
  const latinSentenceLines = ['en', 'latin', ...LATIN_SECONDARY_LANGUAGES]
    .reduce((sum, language) => sum + (counts.get(language as SubtitleLanguage) || 0), 0);
  if (latinSentenceLines === 0) return undefined;
  const cjkForeignCount = (counts.get('ja') || 0) + (counts.get('ko') || 0);
  if (cjkForeignCount > latinSentenceLines) return undefined;

  // Substantial share: a real bilingual file carries a secondary sentence for most Chinese cues.
  const hint = filenameLang === 'bilingual' || /(双语|雙語|中英|中西|中法|中葡|中德|中意|bilingual|dual[-_.\s]?sub)/i.test(name);
  const threshold = hint ? BILINGUAL_SECONDARY_SHARE_WITH_HINT : BILINGUAL_SECONDARY_SHARE;
  if (secondaryRows < Math.min(2, zhRows) || secondaryRows / Math.max(1, zhRows) < threshold) return undefined;

  // One decision over all secondary lines: an English side that quotes a few Spanish lines stays 'en'.
  const secondaryLanguage = detectLanguageByContent(secondaryText.join('\n'));
  return { primary, secondary: isLatinSecondaryLanguage(secondaryLanguage) ? secondaryLanguage : 'en' };
}

export { sortCuesByTime, dedupeIdenticalCues, normalizeParsedCues, cleanSubtitleContent } from './model';
