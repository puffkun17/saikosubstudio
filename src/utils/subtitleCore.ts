// Subtitle Processing Core Engine in TypeScript

export type CueKind = 'dialogue' | 'screen_text' | 'narration' | 'lyrics' | 'commentary' | 'unknown';

export interface CueClassification {
  kind: CueKind;
  confidence: number;
  reasons: string[];
  placement?: 'top' | 'positioned' | 'bottom';
}

export interface SubRow {
  ts: string;
  text: string;
  type?: string;
  cueKind?: CueKind;
  index: number;
}

export interface RawSub {
  ts: string;
  text: string;
  cueKind?: CueKind;
  cueMeta?: CueClassification;
}

export interface DecodeResult {
  text: string;
  encoding: string;
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
export function detectLanguageByContent(text: string): 'zh-CN' | 'zh-TW' | 'en' | 'unknown' {
  if (!text) return "unknown";
  
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
  return "en";
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
  if (!text || !text.includes('[V4+ Styles]')) return null;
  
  const sections = text.split('\n\n');
  const styleSection = sections.find(s => s.includes('[V4+ Styles]'));
  if (!styleSection) return null;

  const lines = styleSection.split('\n').map(l => l.trim()).filter(Boolean);
  const formatLine = lines.find(l => l.startsWith('Format:'));
  const styleLines = lines.filter(l => l.startsWith('Style:'));
  
  if (!formatLine || styleLines.length === 0) return null;

  const targetStyle = styleLines.find(l => l.includes('Default') || l.includes('Han')) || styleLines[0];
  const formatKeys = formatLine.replace('Format:', '').split(',').map(k => k.trim());
  const styleValues = targetStyle.replace('Style:', '').split(',').map(v => v.trim());

  const getVal = (key: string): string | null => {
    const idx = formatKeys.indexOf(key);
    return idx !== -1 ? styleValues[idx] : null;
  };

  const assToHex = (assColor: string | null): string => {
    if (!assColor) return '#FFFFFF';
    const match = assColor.match(/&H[0-9a-fA-F]{2}([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
    if (match) return `#${match[3]}${match[2]}${match[1]}`.toUpperCase();
    return '#FFFFFF';
  };

  return {
    zhFontSize: Math.round(parseInt(getVal('Fontsize') || '22') / 3.75) || 22,
    enFontSize: Math.round(parseInt(getVal('Fontsize') || '12') / 3.75 * 0.7) || 12,
    zhColor: assToHex(getVal('PrimaryColour')),
    enColor: assToHex(getVal('SecondaryColour')),
    zhOutline: assToHex(getVal('OutlineColour')),
    marginV: Math.round(parseInt(getVal('MarginV') || '20') / 3.75) || 20
  };
}

const stripSourceBracketTags = (value: string): string => value.replace(
  /[\[【(（][^\]】)）]*(?:zmk|zimuku|subhd|assrt|shooter|opensubtitles|字幕库|收藏级|精修)[^\]】)）]*[\]】)）]/gi,
  ' '
);

export function cleanFilename(n: string): string {
  if (!n) return '';
  let title = n.replace(/_merged_\d{8}_\d{6}/gi, '');
  title = title.replace(/\.(srt|ass|txt|zip|rar|7z|vtt)$/i, '');
  title = stripSourceBracketTags(title);
  const parsedTitle = parseMediaFilename(title);
  const hasEpisodeKey = Boolean(parsedTitle.episodeKey);
  
  // Movie year match. Episode filenames often include documentary/source years
  // before SxxExx; those should not become part of the searchable series title.
  if (!hasEpisodeKey) {
    const yearTagMatch = title.match(/^(.*?)(?:\b(19\d{2}|20\d{2})\b)(.*)$/i);
    if (yearTagMatch) {
      const beforeYear = yearTagMatch[1];
      const year = yearTagMatch[2];
      const afterYear = yearTagMatch[3];
      if (/[\s.\-_(【\[]*(1080p|720p|2160p|4k|web|bluray|hevc|x265|x264|eng|chs|cht|gbk|utf8|中英)/i.test(afterYear)) {
          title = beforeYear + year;
      }
    }
  }

  // TV Show episode match (S01E01, S01, EP01)
  const tvMatch = title.match(/^(.*?)(?:[\s.\-_(【\[]*(?:s\d{1,4}e\d{1,4}|s\d{1,4}|ep\d{1,4})\b)(.*)$/i);
  if (tvMatch) {
      title = tvMatch[1];
      const colonParts = title.split(/\s*[:：]\s*/).filter(Boolean);
      if (colonParts.length > 1) {
        const tail = colonParts[colonParts.length - 1];
        if (tail.split(/[\s.\-_]+/).filter(Boolean).length >= 2) {
          title = tail;
        }
      }
      title = title.replace(/\b(19\d{2}|20\d{2})\b/g, ' ');
  }

  const tags = [
    '1080p', '4k', '2160p', '720p', 'web-dl', 'webdl', 'webrip', 'web', 'atmos', 'x264', 'h264', 'x265', 'h265', 'hevc', '10bit', '8bit',
    'ddp5\\.1', 'dd5\\.1', '5\\.1', '7\\.1', '6ch', 'bluray', 'brrip', 'bdrip', 'hdrip', 'dvdrip', 'psa', 'rarbg', 'yts', 'tgx', 'yify', 'cakes', 'am',
    'director', 'commentary', 'comment', '解说', '导轨',
    '简体', '繁体', '中英特效字幕', '中英双语字幕', '中英字幕', '双语字幕', '中文字幕', '英文字幕', '特效字幕', '中英双语', '官译双语', '中英', '双语', '双语种', '特效', '字幕',
    'zh-cn', 'zh_cn', 'zh-tw', 'zh-hk', 'chs', 'cht', 'gbk', 'utf8', 'eng', 'en', 'zh', 'cn', 'kr', 'jp',
    '英文', '中字', '英字', 'h\\.264', 'h\\.265', 'atvp', 'flux'
  ];
  
  const tagRegex = new RegExp(`[\\s.\\-_(（\\[【]+(?:${tags.join('|')})(?=[\\s.\\-_)）\\]】]|$)`, 'gi');
  let prev = '';
  while (title !== prev) {
    prev = title;
    title = title.replace(tagRegex, ' ');
  }
  
  // Strip trailing release group e.g. -SuccessfulCrab
  title = title.replace(/-[a-zA-Z0-9]+$/g, '');
  
  title = title.replace(/[([【（][\s)*\]】）]/g, ' ');
  title = title.replace(/[\s.\-_/\\:+]+/g, ' ');
  return title.trim();
}

const HAN_NUMERAL_MAP: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const parseLooseNumber = (value: string): number | null => {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);

  let total = 0;
  let section = 0;
  let hasUnit = false;

  for (const char of raw) {
    if (char === '十') {
      hasUnit = true;
      section = (section || 1) * 10;
      total += section;
      section = 0;
      continue;
    }
    const digit = HAN_NUMERAL_MAP[char];
    if (digit === undefined) return null;
    section = digit;
  }

  const parsed = total + section;
  return hasUnit || raw.length === 1 ? parsed : null;
};

const normalizeEpisodeKey = (season: number | null, episode: number | null) => {
  if (!episode && !season) return undefined;
  if (season && episode) return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  if (season) return `S${String(season).padStart(2, '0')}`;
  if (episode) return `E${String(episode).padStart(2, '0')}`;
  return undefined;
};

const stripKnownMediaTags = (value: string) => {
  const tags = [
    '1080p', '4k', '2160p', '720p', 'web-dl', 'webdl', 'webrip', 'web', 'atmos', 'x264', 'h264', 'x265', 'h265', 'hevc', '10bit', '8bit',
    'ddp5\\.1', 'dd5\\.1', '5\\.1', '7\\.1', '6ch', 'bluray', 'brrip', 'bdrip', 'hdrip', 'dvdrip', 'psa', 'rarbg', 'yts', 'tgx', 'yify',
    'director', 'commentary', 'comment', '解说', '导轨',
    '简体', '繁体', '中英特效字幕', '中英双语字幕', '中英字幕', '双语字幕', '中文字幕', '英文字幕', '特效字幕', '中英双语', '官译双语', '中英', '双语', '双语种', '特效', '字幕',
    'zh-cn', 'zh_cn', 'zh-tw', 'zh-hk', 'chs', 'cht', 'gbk', 'utf8', 'eng', 'en', 'zh', 'cn', 'kr', 'jp',
    '英文', '中字', '英字', 'h\\.264', 'h\\.265', 'atvp', 'flux'
  ];
  const tagRegex = new RegExp(`[\\s.\\-_(（\\[【]+(?:${tags.join('|')})(?=[\\s.\\-_)）\\]】]|$)`, 'gi');
  let clean = value;
  let prev = '';
  while (clean !== prev) {
    prev = clean;
    clean = clean.replace(tagRegex, ' ');
  }
  return clean;
};

export type ParsedMediaFilename = {
  rawBase: string;
  title: string;
  episodeKey?: string;
  season?: number;
  episode?: number;
  year?: string;
  hasUsableTitle: boolean;
  mediaHint: 'tv' | 'movie' | 'unknown';
};

const normalizeSearchText = (value: string): string => value
  .replace(/[._\-_/\\:+]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isLikelySearchNoiseToken = (token: string): boolean => {
  const normalized = token.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  if (!normalized) return true;
  return [
    'xxx', 'proper', 'repack', 'rerip', 'internal', 'extended', 'uncut',
    'web', 'webdl', 'webrip', 'bluray', 'bdrip', 'brrip', 'hdtv',
    'nf', 'amzn', 'atvp', 'dsnp', 'hulu', 'max', 'aptv',
    'h264', 'h265', 'x264', 'x265', 'hevc', 'av1',
    'ddp', 'dd', 'atmos', 'aac', 'dts', 'hdr', 'dv', 'sdr',
    'playweb', 'ethel', 'successfulcrab', 'flux', 'cakes',
  ].includes(normalized) || /^\d{3,4}p$/.test(normalized) || /^\d+(?:bit|ch)$/.test(normalized);
};

const meaningfulTokenCount = (value: string): number => value
  .split(/\s+/)
  .filter(token => token && !isLikelySearchNoiseToken(token))
  .length;

export function buildTmdbSearchQueries(input: string, maxQueries = 10): string[] {
  const base = normalizeSearchText(cleanFilename(input));
  if (!base) return [];

  const parsed = parseMediaFilename(base);
  const candidates: string[] = [];
  const add = (value: string) => {
    const clean = normalizeSearchText(cleanFilename(value));
    if (!clean || clean.length < 2) return;
    if (meaningfulTokenCount(clean) === 0) return;
    if (!candidates.some(item => item.toLowerCase() === clean.toLowerCase())) {
      candidates.push(clean);
    }
  };

  add(base);
  if (parsed.hasUsableTitle) add(parsed.title);

  const tokens = base.split(/\s+/).filter(Boolean);
  const hasHan = /[\u4e00-\u9fff]/.test(base);
  if (!hasHan && tokens.length >= 3) {
    let trimmedTokens = [...tokens];
    while (trimmedTokens.length >= 2 && isLikelySearchNoiseToken(trimmedTokens[trimmedTokens.length - 1])) {
      trimmedTokens = trimmedTokens.slice(0, -1);
      add(trimmedTokens.join(' '));
    }

    for (let len = Math.min(tokens.length - 1, 6); len >= 2; len -= 1) {
      add(tokens.slice(0, len).join(' '));
    }

    for (let len = Math.min(tokens.length - 1, 6); len >= 2; len -= 1) {
      add(tokens.slice(tokens.length - len).join(' '));
    }

    for (let len = Math.min(5, tokens.length - 1); len >= 2; len -= 1) {
      for (let start = 1; start + len <= tokens.length - 1; start += 1) {
        const window = tokens.slice(start, start + len);
        if (window.some(token => !isLikelySearchNoiseToken(token))) {
          add(window.join(' '));
        }
      }
    }
  }

  return candidates.slice(0, maxQueries);
}

export function parseMediaFilename(name: string): ParsedMediaFilename {
  const rawBase = (name || '')
    .replace(/_merged_\d{8}_\d{6}/gi, '')
    .replace(/\.(srt|ass|txt|zip|rar|7z|vtt)$/i, '')
    .trim();

  let working = stripSourceBracketTags(rawBase);
  let season: number | null = null;
  let episode: number | null = null;

  const seasonEpisodeMatch = working.match(/\bS(\d{1,4})[\s._-]*E(\d{1,4})\b/i);
  if (seasonEpisodeMatch) {
    season = parseInt(seasonEpisodeMatch[1], 10);
    episode = parseInt(seasonEpisodeMatch[2], 10);
    working = working.replace(seasonEpisodeMatch[0], ' ');
  }

  if (!episode) {
    const seasonOnlyMatch = working.match(/\bS(\d{1,4})\b/i);
    const episodeOnlyMatch = working.match(/\b(?:EP|E)(\d{1,4})\b/i);
    if (seasonOnlyMatch) {
      season = parseInt(seasonOnlyMatch[1], 10);
      working = working.replace(seasonOnlyMatch[0], ' ');
    }
    if (episodeOnlyMatch) {
      episode = parseInt(episodeOnlyMatch[1], 10);
      working = working.replace(episodeOnlyMatch[0], ' ');
    }
  }

  const chineseSeasonEpisodeMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})季\s*第?([零〇一二两三四五六七八九十\d]{1,4})[集话話]/);
  if (chineseSeasonEpisodeMatch) {
    season = parseLooseNumber(chineseSeasonEpisodeMatch[1]);
    episode = parseLooseNumber(chineseSeasonEpisodeMatch[2]);
    working = working.replace(chineseSeasonEpisodeMatch[0], ' ');
  } else {
    const chineseSeasonMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})季/);
    const chineseEpisodeMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})[集话話]/);
    if (chineseSeasonMatch) {
      season = parseLooseNumber(chineseSeasonMatch[1]);
      working = working.replace(chineseSeasonMatch[0], ' ');
    }
    if (chineseEpisodeMatch) {
      episode = parseLooseNumber(chineseEpisodeMatch[1]);
      working = working.replace(chineseEpisodeMatch[0], ' ');
    }
  }

  const bracketEpisodeMatch = working.match(/[\[【](\d{1,4})[\]】]/);
  if (!episode && bracketEpisodeMatch) {
    episode = parseInt(bracketEpisodeMatch[1], 10);
    working = working.replace(bracketEpisodeMatch[0], ' ');
  }

  const episodeKey = normalizeEpisodeKey(season, episode);
  const isEpisode = Boolean(episodeKey);
  let year = '';
  const yearMatch = !isEpisode ? working.match(/\b(19\d{2}|20\d{2})\b/) : null;
  if (yearMatch) {
    year = yearMatch[1];
    working = working.replace(yearMatch[0], ' ');
  } else if (isEpisode) {
    working = working.replace(/\b(19\d{2}|20\d{2})\b/g, ' ');
  }

  const colonParts = working.split(/\s*[:：]\s*/).filter(Boolean);
  if (colonParts.length > 1) {
    const tail = colonParts[colonParts.length - 1];
    if (tail.split(/[\s.\-_]+/).filter(Boolean).length >= 2) {
      working = tail;
    }
  }

  let title = stripKnownMediaTags(working);
  title = title.replace(/[\[【(（][^\]】)）]*[\]】)）]/g, ' ');
  title = title.replace(/-[a-zA-Z0-9]+$/g, ' ');
  title = title.replace(/[([【（][\s)*\]】）]/g, ' ');
  title = title.replace(/[\s.\-_/\\:+]+/g, ' ').trim();

  const hasLettersOrChinese = /[a-zA-Z\u4e00-\u9fff]/.test(title);
  const looksOnlyEpisode = /^(?:s?\d{1,4}|e?\d{1,4})$/i.test(title.replace(/\s+/g, ''));
  const hasUsableTitle = title.length >= 2 && hasLettersOrChinese && !looksOnlyEpisode;

  return {
    rawBase,
    title,
    episodeKey,
    season: season || undefined,
    episode: episode || undefined,
    year: year || undefined,
    hasUsableTitle,
    mediaHint: isEpisode ? 'tv' : year ? 'movie' : 'unknown',
  };
}

/**
 * Intelligent Title Detector.
 */
export function smartDetectTitle(name1: string, name2: string, content1 = '', content2 = ''): string {
  const scan = (text: string): string | null => {
    if (!text) return null;
    const lines = text.split('\n');
    const head = lines.slice(0, 100);
    const tail = lines.slice(-100);
    const all = [...head, ...tail];
    
    for (const line of all) {
      const match = line.match(/(?:Title|Name|Series|Film|Works|作品|标题)\s*[:：=]\s*(.+)/i);
      if (match && match[1]) {
        const t = match[1].trim().replace(/\{[^}]+\}/g, '').replace(/[\[\]]/g, '');
        if (t.length > 2 && t.length < 50) return t;
      }
    }
    return null;
  };

  const metadataTitle = scan(content1) || scan(content2);
  
  const s1 = cleanFilename(name1).split(/[.\s_\-]/).filter(Boolean);
  const s2 = cleanFilename(name2).split(/[.\s_\-]/).filter(Boolean);
  
  const commonWords = s1.filter(w => s2.includes(w));
  const suggested = commonWords.join(' ');

  // 1. If we have common words between filenames, prioritize it
  if (suggested.length > 3) return suggested;
  
  // 2. If one of the filenames is non-empty, prioritize its cleaned filename over dirty metadata
  const clean1 = cleanFilename(name1);
  const clean2 = cleanFilename(name2);
  const primaryClean = clean1 || clean2;
  if (primaryClean && primaryClean.length > 3) {
    return primaryClean;
  }

  // 3. Fallback to subtitle internal metadata
  if (metadataTitle && metadataTitle.length > 3) return metadataTitle;
  
  return cleanFilename(name1 || name2);
}

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
    };
  }

  if (narrationScore >= 38) {
    return {
      kind: 'narration',
      confidence: Math.min(92, 48 + narrationScore),
      reasons,
      placement,
    };
  }

  return { kind: 'dialogue', confidence: 55, reasons: [], placement };
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
        subtitles.push({ ts: timestamp, text: cueText, cueKind: cueMeta.kind, cueMeta });
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
          parsed.push({ ts, text: cleanDiag, cueKind: cueMeta.kind, cueMeta });
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
  if (known.length > 0 && known.every(kind => kind === 'screen_text')) return 'screen_text';
  if (known.length > 0 && known.every(kind => kind === 'narration')) return 'narration';
  if (known.includes('commentary')) return 'commentary';
  return known.length > 0 ? 'dialogue' : undefined;
};

interface PreprocessedRow {
  ts: string;
  text: string;
  type: 'note' | 'dialogue';
  cueKind?: CueKind;
}

function preprocessMixedContent(subs: RawSub[]): PreprocessedRow[] {
  const processed: PreprocessedRow[] = [];
  for (const sub of subs) {
    const { ts, text } = sub;
    const cueKind = resolveCueKind(text, sub.cueKind);
    const ex = extractDialogueAndNotes(text);
    if (ex.notes && !ex.dialogue) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics' });
      } else {
        processed.push({ ts, text: ex.notes, type: "note", cueKind: cueKind === 'screen_text' ? 'screen_text' : 'narration' });
      }
    } else if (ex.dialogue && !ex.notes) {
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind });
    } else if (ex.dialogue && ex.notes) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics' });
      } else {
        processed.push({ ts, text: ex.notes, type: "note", cueKind: cueKind === 'screen_text' ? 'screen_text' : 'narration' });
      }
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind });
    } else {
      processed.push({ ts, text, type: "dialogue", cueKind });
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
  
  const mergedDialogues: { ts: string; text: string; type: string; cueKind?: CueKind }[] = [];
  let i = 0, j = 0;
  while (i < zhDialogues.length && j < enDialogues.length) {
    const zh = zhDialogues[i];
    const en = enDialogues[j];
    const [zhS, zhE] = zh.ts.split(" --> ").map(timeToMs);
    const [enS, enE] = en.ts.split(" --> ").map(timeToMs);
    const overlap = calculateOverlapRatio(zhS, zhE, enS, enE);
    const diff = Math.abs(zhS - enS);
    
    if (overlap > 0.5 || diff < 300 || (overlap > 0.2 && diff < 1500)) {
      mergedDialogues.push({
        ts: `${msToTime(Math.min(zhS, enS))} --> ${msToTime(Math.max(zhE, enE))}`,
        text: `${zh.text}\n${en.text}`,
        type: "merged",
        cueKind: combineCueKind(zh.cueKind, en.cueKind)
      });
      i++; j++;
    } else if (zhS <= enS) {
      mergedDialogues.push({ ts: zh.ts, text: zh.text, type: "dialogue", cueKind: zh.cueKind }); i++;
    } else {
      mergedDialogues.push({ ts: en.ts, text: en.text, type: "dialogue", cueKind: en.cueKind }); j++;
    }
  }
  while (i < zhDialogues.length) {
    mergedDialogues.push({ ts: zhDialogues[i].ts, text: zhDialogues[i].text, type: "dialogue", cueKind: zhDialogues[i].cueKind });
    i++;
  }
  while (j < enDialogues.length) {
    mergedDialogues.push({ ts: enDialogues[j].ts, text: enDialogues[j].text, type: "dialogue", cueKind: enDialogues[j].cueKind });
    j++;
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      if (isLyricText(item.text)) {
        type = "lyrics";
      }
      return { ...item, type, cueKind: item.cueKind || resolveCueKind(item.text), index: idx + 1 };
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

  const M = zhDialogues.length;
  const N = enDialogues.length;
  
  const ALIGN_THRESHOLD = 2000;
  if (M > ALIGN_THRESHOLD || N > ALIGN_THRESHOLD) {
    addLog(`[工业级合并] 数据量 (中: ${M} 行, 英: ${N} 行) 超过 ${ALIGN_THRESHOLD} 行阈值，自动降级为快速合并模式`, 'info');
    return mergeSubtitles(zhSubs, enSubs, commSubs, addLog);
  }
  
  // DP Table for Needleman-Wunsch sequence alignment
  const dp: number[][] = Array.from({ length: M + 1 }, () => new Array(N + 1).fill(0));
  
  const gapPenalty = -6;
  const mismatchPenalty = -15;
  
  // Base cases initialization
  for (let i = 0; i <= M; i++) dp[i][0] = i * gapPenalty;
  for (let j = 0; j <= N; j++) dp[0][j] = j * gapPenalty;
  
  // Score matrix calculation between Chinese and English nodes
  const getPairScore = (zhIdx: number, enIdx: number) => {
    const zh = zhDialogues[zhIdx];
    const en = enDialogues[enIdx];
    const [zhS, zhE] = zh.ts.split(" --> ").map(timeToMs);
    const [enS, enE] = en.ts.split(" --> ").map(timeToMs);
    const overlap = calculateOverlapRatio(zhS, zhE, enS, enE);
    const diff = Math.abs(zhS - enS);
    
    const isMatch = (overlap > 0.5 || diff < 300 || (overlap > 0.2 && diff < 1500));
    if (isMatch) {
      // Optimal alignment bonus based on similarity and time proximity
      return 15 + overlap * 10 - (diff / 1500) * 5;
    }
    // Moderate penalty if they are relatively close (within 3s) but don't overlap
    if (diff < 3000) {
      return -2 - (diff / 3000) * 4;
    }
    return mismatchPenalty;
  };
  
  // Fill DP Table
  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      const scoreMatch = dp[i-1][j-1] + getPairScore(i-1, j-1);
      const scoreGapZh = dp[i-1][j] + gapPenalty;
      const scoreGapEn = dp[i][j-1] + gapPenalty;
      dp[i][j] = Math.max(scoreMatch, scoreGapZh, scoreGapEn);
    }
  }
  
  // Backtracking path extraction
  const path: { zhIdx: number | null; enIdx: number | null }[] = [];
  let i = M;
  let j = N;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const scoreMatch = dp[i-1][j-1] + getPairScore(i-1, j-1);
      const scoreGapZh = dp[i-1][j] + gapPenalty;
      const scoreGapEn = dp[i][j-1] + gapPenalty;
      const current = dp[i][j];
      
      if (current === scoreMatch) {
        path.push({ zhIdx: i - 1, enIdx: j - 1 });
        i--; j--;
      } else if (current === scoreGapZh) {
        path.push({ zhIdx: i - 1, enIdx: null });
        i--;
      } else if (current === scoreGapEn) {
        path.push({ zhIdx: null, enIdx: j - 1 });
        j--;
      } else {
        path.push({ zhIdx: null, enIdx: j - 1 });
        j--;
      }
    } else if (i > 0) {
      path.push({ zhIdx: i - 1, enIdx: null });
      i--;
    } else {
      path.push({ zhIdx: null, enIdx: j - 1 });
      j--;
    }
  }
  
  path.reverse();
  
  const mergedDialogues: { ts: string; text: string; type: string; cueKind?: CueKind }[] = [];
  
  for (const step of path) {
    if (step.zhIdx !== null && step.enIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      const en = enDialogues[step.enIdx];
      const [zhS, zhE] = zh.ts.split(" --> ").map(timeToMs);
      const [enS, enE] = en.ts.split(" --> ").map(timeToMs);
      const overlap = calculateOverlapRatio(zhS, zhE, enS, enE);
      const diff = Math.abs(zhS - enS);
      const isMatch = (overlap > 0.5 || diff < 300 || (overlap > 0.2 && diff < 1500));
      
      if (isMatch) {
        // Genuinely matching timelines, merge into bilingual row
        mergedDialogues.push({
          ts: `${msToTime(Math.min(zhS, enS))} --> ${msToTime(Math.max(zhE, enE))}`,
          text: `${zh.text}\n${en.text}`,
          type: "merged",
          cueKind: combineCueKind(zh.cueKind, en.cueKind)
        });
      } else {
        // Aligned globally by sequence DP, but too far to merge (e.g. ad insertion on one track).
        // Separate as individual tracks to avoid mismatch.
        mergedDialogues.push({ ts: zh.ts, text: zh.text, type: "dialogue", cueKind: zh.cueKind });
        mergedDialogues.push({ ts: en.ts, text: en.text, type: "dialogue", cueKind: en.cueKind });
      }
    } else if (step.zhIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      mergedDialogues.push({ ts: zh.ts, text: zh.text, type: "dialogue", cueKind: zh.cueKind });
    } else if (step.enIdx !== null) {
      const en = enDialogues[step.enIdx];
      mergedDialogues.push({ ts: en.ts, text: en.text, type: "dialogue", cueKind: en.cueKind });
    }
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      if (isLyricText(item.text)) {
        type = "lyrics";
      }
      return { ...item, type, cueKind: item.cueKind || resolveCueKind(item.text), index: idx + 1 };
    });
  addLog(`[工业级合并] 处理完成，生成 ${result.length} 条对齐块`, "success");
  return result;
}

export function generateSrtContent(subs: SubRow[], styleSettings?: StyleSettings): string {
  const { lyricPosition = 'top', lyricItalic = true } = styleSettings || {};
  return subs.map(s => {
    let text = s.text;
    if (s.type === 'note' || s.type === 'commentary' || s.cueKind === 'screen_text') {
      if (!text.startsWith("{\\an8}")) {
        text = "{\\an8}" + text;
      }
    } else if (s.type === 'lyrics') {
      if (lyricPosition === 'top' && !text.startsWith("{\\an8}")) {
        text = "{\\an8}" + text;
      }
      if (lyricItalic) {
        const cleanText = text.replace(/<\/?i>/g, '');
        if (text.startsWith("{\\an8}")) {
          text = "{\\an8}<i>" + cleanText.slice(6) + "</i>";
        } else {
          text = `<i>${cleanText}</i>`;
        }
      }
    }
    return `${s.index}\n${s.ts}\n${text}`;
  }).join("\n\n") + "\n";
}

export function generateAssContent(subs: SubRow[], styleSettings: StyleSettings, title = "Bilingual Subtitles"): string {
  const {
    zhFontSize = 22,
    enFontSize = 12,
    zhColor = '#FFFFFF',
    enColor = '#FFFFFF',
    zhOutline = '#000000',
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
    lyricPosition = 'top'
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
  const assLyricColor = hexToAss(lyricColor);

  const header = `[Script Info]
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: no
ScriptType: v4.00+
Title: ${title}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Han,PingFang SC,${mZhFont},${assZhColor},&H00FF9C41,${assZhOutline},&H00000000,1,0,0,0,100,100,0,0,1,${mOutline},${mShadow},2,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: EN,Helvetica Neue,${mEnFont},${assEnColor},&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,${enScale},${enScale},0,0,1,${mEnOutline},${mEnOutline},2,${mBaseMargin},${mBaseMargin},${Math.floor(mMarginV * 0.6)},1
Style: Note,PingFang SC,${mNoteFont},&H00FFFFFF,&H000000FF,&H0000FBFF,&H00000000,0,0,0,0,100,100,0,0,1,${mOutline},${mShadow},8,${mBaseMargin},${mBaseMargin},${mMarginV},1
Style: Lyrics,PingFang SC,${mLyricFont},${assLyricColor},&H00000000,&H00000000,&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mOutline},${mShadow},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.8) : mMarginV},1
Style: Lyrics_EN,Helvetica Neue,${mLyricEnFont},${assLyricColor},&H00000000,&H00000000,&H00000000,0,${lyricItalic ? 1 : 0},0,0,100,100,0,0,1,${mEnOutline},${mEnOutline},${lyricPosition === 'top' ? 8 : 2},${mBaseMargin},${mBaseMargin},${lyricPosition === 'top' ? Math.floor(mMarginV * 0.5) : Math.floor(mMarginV * 0.6)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const srtToAssTime = (t: string) => {
    const [hms, ms] = t.split(',');
    const [h, m, s] = hms.split(':');
    return `${parseInt(h)}:${m}:${s}.${Math.floor(parseInt(ms) / 10).toString().padStart(2, '0')}`;
  };

  const events = subs.map(s => {
    const [start, end] = s.ts.split(" --> ").map(srtToAssTime);
    let style = "Han";
    if (s.type === "lyrics") {
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
  let subtitles: { text: string }[] = [];
  
  if (cleanText.includes('[Events]') && cleanText.includes('Dialogue:')) {
    const lines = cleanText.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith('Dialogue:')) {
        const parts = line.split(',');
        if (parts.length >= 10) {
          const dialogueText = parts.slice(9).join(',');
          subtitles.push({ text: dialogueText });
        }
      }
    }
  } else {
    subtitles = parseSrt(cleanText);
  }
  
  if (subtitles.length === 0) return false;
  
  let bilingualCount = 0;
  let validCount = 0;
  
  for (const sub of subtitles) {
    const cleanSubText = sub.text.replace(/\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
    if (!cleanSubText) continue;
    
    validCount++;
    const hasZh = /[一-龥]/.test(cleanSubText);
    const hasEn = /[a-zA-Z]/.test(cleanSubText);
    
    if (hasZh && hasEn) {
      bilingualCount++;
    }
  }
  
  if (validCount === 0) return false;
  const ratio = bilingualCount / validCount;
  return ratio >= 0.8;
}

export function autoSignature(subs: SubRow[]): SubRow[] {
  if (subs.length === 0) return subs;
  const clone = [...subs];
  const END_SIG = "双语合并：SubStudioX V1.0";
  const lastTime = clone[clone.length - 1].ts.split(" --> ")[1];
  clone.push({
    index: clone.length + 1,
    ts: `${msToTime(timeToMs(lastTime) + 2000)} --> ${msToTime(timeToMs(lastTime) + 5000)}`,
    text: END_SIG,
    type: "note"
  });
  return clone;
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
