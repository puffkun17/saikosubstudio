/**
 * Shared TMDB candidate ranking for manual (and UI default) selection.
 * Prefer exact title / original-title hits and well-known films over
 * substring parodies ("Bikini Inception" when query is "Inception").
 */

export type TmdbRankable = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
  media_type?: string;
};

export type TmdbRankResult = {
  item: TmdbRankable;
  score: number;
  exactTitle: boolean;
  /** Query appears only as a substring inside a longer title (not equal). */
  queryOnlySubstring: boolean;
  rejected: boolean;
};

const normalizeLatin = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeLoose = (str: string) =>
  str.toLowerCase().replace(/[\s._\-:：'"“”‘’（）()[\]【】]/g, '');

const displayTitles = (item: TmdbRankable) => {
  const primary = (item.title || item.name || '').trim();
  const original = (item.original_title || item.original_name || '').trim();
  return { primary, original };
};

/** Title-match score for one query against one candidate. */
export const scoreTitleAgainstQuery = (
  item: TmdbRankable,
  query: string,
): { points: number; exact: boolean; queryOnlySubstring: boolean } => {
  const q = query.trim();
  if (!q) return { points: 0, exact: false, queryOnlySubstring: false };

  const { primary, original } = displayTitles(item);
  const normQ = normalizeLatin(q);
  const looseQ = normalizeLoose(q);
  const titles = [
    { raw: primary, norm: normalizeLatin(primary), loose: normalizeLoose(primary) },
    { raw: original, norm: normalizeLatin(original), loose: normalizeLoose(original) },
  ].filter((t) => t.raw.length > 0);

  let exact = false;
  let queryOnlySubstring = false;
  let best = 0;

  for (const t of titles) {
    if (normQ && t.norm && t.norm === normQ) {
      exact = true;
      best = Math.max(best, 50);
      continue;
    }
    if (looseQ && t.loose && t.loose === looseQ) {
      exact = true;
      best = Math.max(best, 48);
      continue;
    }
    // Guard empty strings: ''.includes(x) / x.includes('') are true in JS and must not score.
    if (normQ && t.norm) {
      if (t.norm.includes(normQ) && t.norm !== normQ) {
        queryOnlySubstring = true;
        best = Math.max(best, 12);
      } else if (normQ.includes(t.norm) && t.norm !== normQ && t.norm.length >= 3) {
        best = Math.max(best, 20);
      }
    }
    if (looseQ && t.loose) {
      if (t.loose.includes(looseQ) && t.loose !== looseQ) {
        queryOnlySubstring = true;
        best = Math.max(best, 14);
      } else if (looseQ.includes(t.loose) && t.loose !== looseQ && t.loose.length >= 3) {
        best = Math.max(best, 22);
      }
    }
  }

  // Exact wins over any substring flag from a sibling title field.
  if (exact) queryOnlySubstring = false;
  return { points: best, exact, queryOnlySubstring };
};

export const popularityBoost = (item: TmdbRankable): number => {
  const popularity = Math.max(0, item.popularity || 0);
  const votes = Math.max(0, item.vote_count || 0);
  const rating = Math.max(0, item.vote_average || 0);
  // Log-scaled so mega-hits beat obscure substring matches without drowning year math.
  const popPart = Math.min(40, Math.log10(popularity + 1) * 18);
  const votePart = Math.min(25, Math.log10(votes + 1) * 8);
  const ratingPart = rating >= 6.5 && votes >= 200 ? 8 : rating >= 7 && votes >= 50 ? 4 : 0;
  return popPart + votePart + ratingPart;
};

export const rankTmdbCandidates = (
  items: TmdbRankable[],
  queries: string[],
  opts?: {
    year?: string;
    yearScore?: (item: TmdbRankable, year: string) => { delta: number; rejected: boolean };
  },
): TmdbRankResult[] => {
  const scoringQueries = queries.map((q) => q.trim()).filter((q, i, arr) => q.length >= 2 && arr.indexOf(q) === i);
  const year = opts?.year?.trim() || '';

  return items.map((item) => {
    let score = 0;
    let exactTitle = false;
    let queryOnlySubstring = false;
    let rejected = Boolean(item.adult);

    for (const query of scoringQueries) {
      const match = scoreTitleAgainstQuery(item, query);
      if (match.points > score || (match.points === score && match.exact)) {
        score = match.points;
        exactTitle = match.exact;
        queryOnlySubstring = match.queryOnlySubstring;
      } else if (match.exact) {
        exactTitle = true;
        queryOnlySubstring = false;
        score = Math.max(score, match.points);
      }
      if (match.queryOnlySubstring && !match.exact) queryOnlySubstring = true;
    }

    if (queryOnlySubstring && !exactTitle) {
      score -= 35;
    }

    if (year && opts?.yearScore) {
      const yearResult = opts.yearScore(item, year);
      score += yearResult.delta;
      if (yearResult.rejected) rejected = true;
    }

    score += popularityBoost(item);

    return { item, score, exactTitle, queryOnlySubstring, rejected };
  });
};

export const compareTmdbRank = (a: TmdbRankResult, b: TmdbRankResult): number => {
  if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
  if (a.exactTitle !== b.exactTitle) return a.exactTitle ? -1 : 1;
  if (a.queryOnlySubstring !== b.queryOnlySubstring) return a.queryOnlySubstring ? 1 : -1;
  if (b.score !== a.score) return b.score - a.score;
  const pop = (b.item.popularity || 0) - (a.item.popularity || 0);
  if (pop !== 0) return pop;
  return (b.item.vote_count || 0) - (a.item.vote_count || 0);
};

/**
 * Only auto-highlight a result when the title match is exact (or loose-exact)
 * and the candidate is not a weak substring parody.
 */
export const isHighConfidenceTmdbPick = (entry: TmdbRankResult | null | undefined): boolean => {
  if (!entry || entry.rejected || entry.queryOnlySubstring || !entry.exactTitle) return false;
  const popularity = entry.item.popularity || 0;
  const votes = entry.item.vote_count || 0;
  const rating = entry.item.vote_average || 0;
  // Famous films clear this easily; obscure exact-title shorts still need a tap.
  return popularity >= 8 || votes >= 80 || (rating >= 7 && votes >= 20);
};
