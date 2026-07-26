// Media filename identity & TMDB query helpers (extracted from subtitleCore).
import {
  type ReleaseNamingProfile,
  RELEASE_NAMING_TAGS,
  createReleaseTagPattern,
  extractReleaseNamingProfile,
  isReleaseNoiseToken,
  normalizeReleaseToken,
  stripContextualReleaseTail,
} from './releaseNamingRules';

const stripSourceBracketTags = (value: string): string => value.replace(
  /[\[【(（][^\]】)）]*(?:zmk|zimuku|subhd|assrt|shooter|opensubtitles|字幕库|收藏级|精修)[^\]】)）]*[\]】)）]/gi,
  ' '
);

const RELEASE_TAG_PATTERN = createReleaseTagPattern(RELEASE_NAMING_TAGS);
const RELEASE_TAG_BOUNDARY = '[\\s.\\-_/&+_(（\\[【]+';
const RELEASE_TAG_LOOKAHEAD = '(?=[\\s.\\-_/&+_)）\\]】]|$)';
const RELEASE_SPEC_AFTER_YEAR_PATTERN = new RegExp(
  `^[\\s.\\-_(【\\[]*(?:${RELEASE_TAG_PATTERN})${RELEASE_TAG_LOOKAHEAD}`,
  'i',
);

const NUMERIC_TITLE_SUFFIXES = new Set(['1917', '1984', '2001', '2012', '2046', '2049']);

const shouldKeepNumericTitleSuffix = (beforeYear: string, yearToken: string): boolean =>
  NUMERIC_TITLE_SUFFIXES.has(yearToken)
  && beforeYear.split(/[\s.\-_/\\:+&]+/).filter(Boolean).length >= 1;

const RELEASE_YEAR_TOKEN_PATTERN = /(^|[\s._\-_(【\[])(19\d{2}|20\d{2})(?=$|[\s._\-_)）\]】])/gi;

const findReleaseYearAnchor = (value: string): { year: string; start: number } | null => {
  RELEASE_YEAR_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RELEASE_YEAR_TOKEN_PATTERN.exec(value)) !== null) {
    const separator = match[1] || '';
    const yearToken = match[2];
    const yearStart = match.index + separator.length;
    const afterYear = value.slice(yearStart + yearToken.length);
    const beforeYear = value.slice(0, yearStart);
    if (RELEASE_SPEC_AFTER_YEAR_PATTERN.test(afterYear) && !shouldKeepNumericTitleSuffix(beforeYear, yearToken)) {
      return { year: yearToken, start: yearStart };
    }
  }
  return null;
};

const stripReleaseTags = (value: string): string => {
  const tagRegex = new RegExp(`${RELEASE_TAG_BOUNDARY}(?:${RELEASE_TAG_PATTERN})${RELEASE_TAG_LOOKAHEAD}`, 'gi');
  let clean = value;
  let prev = '';
  while (clean !== prev) {
    prev = clean;
    clean = clean.replace(tagRegex, ' ');
  }
  return stripContextualReleaseTail(clean);
};

/**
 * Display / search title derived from the single parseMediaFilename path
 * (keeps movie years; drops episode keys and release noise).
 */
export function cleanFilename(n: string): string {
  if (!n) return '';
  const parsed = parseMediaFilename(n);
  if (!parsed.title && !parsed.year) return '';
  if (parsed.year && parsed.mediaHint !== 'tv') {
    const combined = normalizeSearchText(`${parsed.title} ${parsed.year}`);
    return combined || parsed.title;
  }
  return parsed.title;
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
  return stripReleaseTags(value);
};

export type ParsedMediaFilename = {
  rawBase: string;
  title: string;
  releaseProfile: ReleaseNamingProfile;
  episodeKey?: string;
  season?: number;
  episode?: number;
  year?: string;
  hasUsableTitle: boolean;
  mediaHint: 'tv' | 'movie' | 'unknown';
};

export type MediaIdentityLevel = 'strong' | 'partial' | 'weak';

export type MediaIdentityAssessment = {
  level: MediaIdentityLevel;
  title: string;
  episodeKey?: string;
  reason: string;
  shouldAutoSearchTmdb: boolean;
};

const normalizeSearchText = (value: string): string => value
  .replace(/&amp;/gi, ' ')
  .replace(/[._\-_/\\:+&]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isLikelySearchNoiseToken = (token: string): boolean => {
  const normalized = normalizeReleaseToken(token);
  if (!normalized) return true;
  return normalized === 'xxx' || isReleaseNoiseToken(token);
};

const meaningfulTokenCount = (value: string): number => value
  .split(/\s+/)
  .filter(token => token && !isLikelySearchNoiseToken(token))
  .length;

export function buildTmdbSearchQueries(input: string, maxQueries = 10): string[] {
  const base = normalizeSearchText(cleanFilename(input));
  if (!base) return [];

  const rawParsed = parseMediaFilename(input);
  const baseParsed = parseMediaFilename(base);
  const parsed = rawParsed.mediaHint === 'movie' && rawParsed.hasUsableTitle ? rawParsed : baseParsed;
  if (!parsed.hasUsableTitle) return [];

  const candidates: string[] = [];
  const add = (value: string) => {
    const clean = normalizeSearchText(cleanFilename(value));
    if (!clean || clean.length < 2) return;
    if (meaningfulTokenCount(clean) === 0) return;
    if (!candidates.some(item => item.toLowerCase() === clean.toLowerCase())) {
      candidates.push(clean);
    }
  };

  add(parsed.title);
  add(base);

  const tokens = base.split(/\s+/).filter(Boolean);
  const hasHan = /[\u4e00-\u9fff]/.test(base);
  // Mixed Chinese + Latin titles: also search each script alone (e.g. 新攻壳… + Ghost in the Shell).
  if (hasHan) {
    const hanOnly = normalizeSearchText((base.match(/[\u4e00-\u9fff]+/g) || []).join(' '));
    const latinOnly = normalizeSearchText((base.match(/[A-Za-z][A-Za-z'’]*(?:\s+[A-Za-z][A-Za-z'’]*)*/g) || []).join(' '));
    add(hanOnly);
    add(latinOnly);
  }
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
  const releaseProfile = extractReleaseNamingProfile(rawBase);

  let working = stripSourceBracketTags(rawBase);
  let season: number | null = null;
  let episode: number | null = null;

  // Keep only the series prefix before Latin episode markers so release-style
  // "Show.S01E02.Episode.Title.1080p" does not leak the episode title into TMDB queries.
  const seasonEpisodeMatch = working.match(/(^|[\s._\-_(【\[])(S(\d{1,4})[\s._-]*E(\d{1,4}))(?=$|[\s._\-_)）\]】])/i);
  if (seasonEpisodeMatch && seasonEpisodeMatch.index != null) {
    season = parseInt(seasonEpisodeMatch[3], 10);
    episode = parseInt(seasonEpisodeMatch[4], 10);
    working = working.slice(0, seasonEpisodeMatch.index + seasonEpisodeMatch[1].length);
  }

  if (!episode) {
    const seasonOnlyMatch = working.match(/(^|[\s._\-_(【\[])(S(\d{1,4}))(?=$|[\s._\-_)）\]】])/i);
    const episodeOnlyMatch = working.match(/(^|[\s._\-_(【\[])((?:EP|E)(\d{1,4}))(?=$|[\s._\-_)）\]】])/i);
    const marker = [seasonOnlyMatch, episodeOnlyMatch]
      .filter((match): match is RegExpMatchArray => Boolean(match && match.index != null))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
    if (seasonOnlyMatch) season = parseInt(seasonOnlyMatch[3], 10);
    if (episodeOnlyMatch) episode = parseInt(episodeOnlyMatch[3], 10);
    if (marker && marker.index != null) {
      working = working.slice(0, marker.index + marker[1].length);
    }
  }

  const chineseSeasonEpisodeMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})季\s*第?([零〇一二两三四五六七八九十\d]{1,4})[集话話]/);
  if (chineseSeasonEpisodeMatch && chineseSeasonEpisodeMatch.index != null) {
    season = parseLooseNumber(chineseSeasonEpisodeMatch[1]);
    episode = parseLooseNumber(chineseSeasonEpisodeMatch[2]);
    working = working.slice(0, chineseSeasonEpisodeMatch.index);
  } else {
    const chineseSeasonMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})季/);
    const chineseEpisodeMatch = working.match(/第?([零〇一二两三四五六七八九十\d]{1,4})[集话話]/);
    const chineseMarker = [chineseSeasonMatch, chineseEpisodeMatch]
      .filter((match): match is RegExpMatchArray => Boolean(match && match.index != null))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
    if (chineseSeasonMatch) season = parseLooseNumber(chineseSeasonMatch[1]);
    if (chineseEpisodeMatch) episode = parseLooseNumber(chineseEpisodeMatch[1]);
    if (chineseMarker && chineseMarker.index != null) {
      working = working.slice(0, chineseMarker.index);
    }
  }

  const bracketEpisodeMatch = working.match(/[\[【](\d{1,4})[\]】]/);
  if (!episode && bracketEpisodeMatch && bracketEpisodeMatch.index != null) {
    episode = parseInt(bracketEpisodeMatch[1], 10);
    working = working.slice(0, bracketEpisodeMatch.index);
  }

  const episodeKey = normalizeEpisodeKey(season, episode);
  const isEpisode = Boolean(episodeKey);
  let year = '';
  if (!isEpisode) {
    const yearAnchor = findReleaseYearAnchor(working);
    if (yearAnchor) {
      year = yearAnchor.year;
      working = working.slice(0, yearAnchor.start);
    }
  } else {
    // Scene/WEB TV: Title.Year.SxxExx — episode cut leaves the year in the prefix.
    const trailingYear = working.match(/(^|[\s._\-_(【\[])((?:19|20)\d{2})[\s._\-]*$/);
    if (trailingYear && trailingYear.index != null) {
      const yearToken = trailingYear[2];
      const yearStart = trailingYear.index + trailingYear[1].length;
      const beforeYear = working.slice(0, yearStart);
      if (!shouldKeepNumericTitleSuffix(beforeYear, yearToken)) {
        year = yearToken;
        working = beforeYear;
      }
    }
    if (!year) {
      const bracketYear = working.match(/[\s._\-(（\[]*((?:19|20)\d{2})[)）\]]\s*$/);
      if (bracketYear && bracketYear.index != null) {
        year = bracketYear[1];
        working = working.slice(0, bracketYear.index);
      }
    }
    // Drop leftover release years from the title; keep numeric title suffixes (2049, etc.).
    working = working.replace(
      /(^|[\s._\-])(?!(?:1917|1984|2001|2012|2046|2049)(?=$|[\s._\-]))((?:19|20)\d{2})(?=$|[\s._\-])/g,
      '$1',
    );
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
    releaseProfile,
    episodeKey,
    season: season || undefined,
    episode: episode || undefined,
    year: year || undefined,
    hasUsableTitle,
    mediaHint: isEpisode ? 'tv' : year ? 'movie' : 'unknown',
  };
}

const isSearchableTitle = (value: string): boolean => {
  const title = normalizeSearchText(value);
  if (!title) return false;
  const hasText = /[a-zA-Z\u4e00-\u9fff]/.test(title);
  const looksLikeBareYear = /^(?:19\d{2}|20\d{2})$/.test(title);
  const looksOnlyEpisode = /^(?:s?\d{1,4}|e?\d{1,4}|s\d{1,4}e\d{1,4})$/i.test(title.replace(/\s+/g, ''));
  return title.length >= 2 && hasText && !looksLikeBareYear && !looksOnlyEpisode && meaningfulTokenCount(title) > 0;
};

export function assessMediaIdentity(input: string, fallbackTitle = ''): MediaIdentityAssessment {
  const parsed = parseMediaFilename(input);
  const fallbackParsed = fallbackTitle ? parseMediaFilename(fallbackTitle) : null;
  const title = isSearchableTitle(parsed.title)
    ? parsed.title
    : fallbackParsed && isSearchableTitle(fallbackParsed.title)
      ? fallbackParsed.title
      : '';
  const episodeKey = parsed.episodeKey || fallbackParsed?.episodeKey;

  if (title) {
    return {
      level: 'strong',
      title,
      episodeKey,
      reason: episodeKey ? '已识别片名与集数信息' : '已识别可检索片名',
      shouldAutoSearchTmdb: true,
    };
  }

  if (episodeKey) {
    return {
      level: 'partial',
      title: '',
      episodeKey,
      reason: '仅识别到集数，缺少片名',
      shouldAutoSearchTmdb: false,
    };
  }

  return {
    level: 'weak',
    title: '',
    episodeKey: undefined,
    reason: '文件名只包含年份、规格或发布参数',
    shouldAutoSearchTmdb: false,
  };
}

/**
 * Prefer strong media-identity titles; only then fall back to shared tokens / metadata.
 * Avoids noisy common-token joins from mismatched release filenames.
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

  const id1 = assessMediaIdentity(name1);
  const id2 = assessMediaIdentity(name2);
  // Prefer cleanFilename (keeps movie years) over bare parsed titles.
  if (id1.level === 'strong' && id2.level === 'strong') {
    const c1 = cleanFilename(name1);
    const c2 = cleanFilename(name2);
    const a = normalizeSearchText(c1).toLowerCase();
    const b = normalizeSearchText(c2).toLowerCase();
    if (a === b) return c1;
    if (a.includes(b)) return c1;
    if (b.includes(a)) return c2;
  }
  if (id1.level === 'strong') return cleanFilename(name1);
  if (id2.level === 'strong') return cleanFilename(name2);

  const tokens1 = cleanFilename(name1).split(/\s+/).filter((token) => token && !isLikelySearchNoiseToken(token));
  const tokens2 = cleanFilename(name2).split(/\s+/).filter((token) => token && !isLikelySearchNoiseToken(token));
  const commonWords = tokens1.filter((word) => tokens2.some((other) => other.toLowerCase() === word.toLowerCase()));
  const suggested = commonWords.join(' ');
  if (suggested.length > 3 && meaningfulTokenCount(suggested) >= 2) return suggested;

  const primaryClean = cleanFilename(name1) || cleanFilename(name2);
  if (primaryClean && primaryClean.length > 3 && isSearchableTitle(primaryClean)) {
    return primaryClean;
  }

  const metadataTitle = scan(content1) || scan(content2);
  if (metadataTitle && metadataTitle.length > 3) return metadataTitle;

  return cleanFilename(name1 || name2);
}
