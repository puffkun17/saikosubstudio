/**
 * Episode reference parsing for same-episode grouping.
 * Unknown stays unknown: never invent an episode number (Derek, 2026-10-12).
 */
export interface EpisodeRef {
  season: number | null;
  episode: number | null;
}

const HAN: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

export function parseHanNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (!value) return null;
  let total = 0;
  let current = 0;
  for (const ch of value) {
    if (ch === '十') { total += (current || 1) * 10; current = 0; continue; }
    if (ch === '百') { total += (current || 1) * 100; current = 0; continue; }
    if (!(ch in HAN)) return null;
    current = HAN[ch];
  }
  return total + current || null;
}

const stripExt = (name: string) => name.replace(/\.(srt|ass|ssa|vtt|txt|mkv|mp4|m4v|mov|avi|ts|webm)$/i, '');
// Hashes like [3E26061D] and resolutions like 1920x1080 must not read as episodes.
const stripNoise = (name: string) => name
  .replace(/\[[0-9A-F]{8}\]/gi, ' ')
  .replace(/\b\d{3,4}\s*[x×]\s*\d{3,4}\b/gi, ' ')
  .replace(/\b(?:480|576|720|1080|2160)[pi]\b/gi, ' ')
  .replace(/\b[xh]\.?26[45]\b/gi, ' ')
  .replace(/\b(?:19|20)\d{2}\b/g, ' ');

/** Ordered from most to least explicit. First hit wins. */
export function parseEpisodeRef(filename: string): EpisodeRef {
  const base = stripNoise(stripExt(filename || ''));
  let m = base.match(/(?:^|[^A-Za-z0-9])S(\d{1,3})[\s._-]*E[Pp]?(\d{1,4})(?![0-9])/i);
  if (m) return { season: +m[1], episode: +m[2] };
  m = base.match(/(?:^|[^A-Za-z0-9])(\d{1,2})x(\d{2,3})(?![0-9])/i);
  if (m) return { season: +m[1], episode: +m[2] };
  m = base.match(/第\s*([零〇一二两三四五六七八九十百\d]{1,4})\s*季[\s._-]*第?\s*([零〇一二两三四五六七八九十百\d]{1,4})\s*[集话話]/);
  if (m) return { season: parseHanNumber(m[1]), episode: parseHanNumber(m[2]) };
  const seasonOnly = base.match(/(?:^|[^A-Za-z0-9])S(\d{1,3})(?![0-9A-Za-z])/i) || base.match(/第\s*([零〇一二两三四五六七八九十\d]{1,4})\s*季/);
  const season = seasonOnly ? parseHanNumber(seasonOnly[1]) : null;
  m = base.match(/第\s*([零〇一二两三四五六七八九十百\d]{1,4})\s*[集话話]/);
  if (m) return { season, episode: parseHanNumber(m[1]) };
  m = base.match(/(?:^|[^A-Za-z0-9])E[Pp]?(\d{1,4})(?![0-9])/);
  if (m) return { season, episode: +m[1] };
  m = base.match(/#\s?(\d{1,4})(?![0-9])/);
  if (m) return { season, episode: +m[1] };
  m = base.match(/\s-\s(\d{1,4})(?:v\d)?(?:\s|$|[[(])/);
  if (m) return { season, episode: +m[1] };
  m = base.match(/[[【](\d{1,3})(?:v\d)?[\]】]/);
  if (m) return { season, episode: +m[1] };
  return { season, episode: null };
}

/** S01E02 when both known; E02 when season unknown; undefined when episode unknown. */
export function episodeKeyOf(ref: EpisodeRef, defaultSeason: number | null = null): string | undefined {
  if (ref.episode == null) return undefined;
  const s = ref.season ?? defaultSeason;
  const e = `E${String(ref.episode).padStart(2, '0')}`;
  return s != null ? `S${String(s).padStart(2, '0')}${e}` : e;
}

export type EpisodeRelation = 'equal' | 'different' | 'unknown';

export function compareEpisodes(a: EpisodeRef, b: EpisodeRef): EpisodeRelation {
  if (a.episode == null || b.episode == null) return 'unknown';
  if (a.episode !== b.episode) return 'different';
  if (a.season != null && b.season != null && a.season !== b.season) return 'different';
  return 'equal';
}
