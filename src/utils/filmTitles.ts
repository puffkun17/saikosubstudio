/**
 * Resolve display titles so CN / original / Latin each appear at most once.
 * Handles TMDB titles that glue CJK + Latin into one string.
 */

export type ResolvedFilmTitles = {
  /** Primary line — prefer localized / Chinese title. */
  main: string;
  /** Optional original-script line (e.g. 攻殻機動隊), never equals main. */
  originalScript: string | null;
  /** Optional Latin / EN line, never equals main or originalScript. */
  originalLatin: string | null;
};

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const LATIN_START = /^[A-Za-z0-9]/;

/** Split a single string that prefixes CJK then Latin. */
export const splitMixedTitle = (raw?: string | null): { script: string | null; latin: string | null; plain: string | null } => {
  if (!raw?.trim()) return { script: null, latin: null, plain: null };
  const trimmed = raw.trim();
  const mixed = trimmed.match(/^(.+?[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff])\s+([A-Za-z0-9].+)$/);
  if (mixed) {
    return { script: mixed[1].trim(), latin: mixed[2].trim(), plain: null };
  }
  if (LATIN_START.test(trimmed) && !CJK.test(trimmed)) {
    return { script: null, latin: trimmed, plain: null };
  }
  return { script: null, latin: null, plain: trimmed };
};

const distinct = (value: string | null | undefined, ...seen: Array<string | null | undefined>) => {
  const v = value?.trim() || null;
  if (!v) return null;
  const lower = v.toLowerCase();
  if (seen.some((s) => s?.trim().toLowerCase() === lower)) return null;
  return v;
};

/**
 * @param title Localized / primary TMDB title (may be mixed CN+EN)
 * @param originalTitle TMDB original_title / original_name
 * @param fallback When neither title is present
 */
export const resolveFilmTitles = (
  title?: string | null,
  originalTitle?: string | null,
  fallback = '待匹配影片',
): ResolvedFilmTitles => {
  const fromTitle = splitMixedTitle(title);
  const fromOriginal = splitMixedTitle(
    originalTitle && originalTitle.trim() !== title?.trim() ? originalTitle : null,
  );

  // Prefer a clean CJK main: unmixed title, else script half of a mixed title, else plain/latin.
  const main =
    fromTitle.plain
    || fromTitle.script
    || fromOriginal.script
    || fromTitle.latin
    || fromOriginal.latin
    || fromOriginal.plain
    || fallback;

  const originalScript = distinct(
    fromOriginal.script || (fromTitle.script && fromTitle.script !== main ? fromTitle.script : null),
    main,
  );

  const originalLatin = distinct(
    fromOriginal.latin || fromTitle.latin || (fromOriginal.plain && !CJK.test(fromOriginal.plain) ? fromOriginal.plain : null),
    main,
    originalScript,
  );

  return { main, originalScript, originalLatin };
};
