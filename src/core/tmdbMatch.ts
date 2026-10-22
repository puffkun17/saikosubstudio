/**
 * TMDB auto-match scoring and disambiguation (pure).
 * Used by searchTmdb in the studio store; no network / store I/O here.
 */

import { assessTvYearFit, shouldDemoteBySeasonSpan } from '../utils/tmdbCandidateFit';
import { popularityBoost } from '../utils/tmdbSearchRank';
import type {
  TmdbConfirmationDecision,
  TmdbMediaType,
  TmdbSuggestion,
} from '../store/types';

export type TmdbMatchContext = {
  isEpisodeQuery: boolean;
  year: string;
  seasonHint?: number;
  scoringQueries: string[];
  expectedMediaType?: TmdbMediaType;
};

export type ScoredTmdbCandidate = {
  item: TmdbSuggestion;
  score: number;
  decision: TmdbConfirmationDecision;
};

export type TmdbDisambiguationResult = {
  canLuckyDisambiguate: boolean;
  needsYearDisambiguation: boolean;
  /** Mutated scored list (close-score / need-year applied). */
  scored: ScoredTmdbCandidate[];
  luckyPair: ScoredTmdbCandidate[] | null;
  sortedResults: TmdbSuggestion[];
  bestScored: ScoredTmdbCandidate | undefined;
  luckyAlternate: TmdbSuggestion | null;
};

const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeLoose = (str: string) => str.toLowerCase().replace(/[\s._\-:：'"“”‘’（）()[\]【】]/g, '');

export const isAncillaryMovieCandidate = (item: TmdbSuggestion): boolean => {
  const textBlob = `${item.title || ''} ${item.name || ''} ${item.original_title || ''} ${item.original_name || ''} ${item.overview || ''} ${item.known_for_department || ''}`;
  return /\b(making[-\s]?of|behind\s+the\s+scenes|documentary|docu|featurette|interview|special)\b/i.test(textBlob)
    || /(纪录片|紀錄片|幕后|幕後|花絮|特别篇|特別篇|特辑|特輯|访谈|訪談|采访|採訪|制作特辑|製作特輯)/.test(textBlob)
    || (item.genre_ids || []).includes(99);
};

export const evaluateCandidate = (
  item: TmdbSuggestion,
  ctx: TmdbMatchContext,
): TmdbConfirmationDecision => {
  const { isEpisodeQuery, year, seasonHint, scoringQueries, expectedMediaType } = ctx;
  let score = 0;
  const reasons: string[] = [];
  let titleMatchStrength = 0;
  const relDate = item.release_date || item.first_air_date || '';
  const itemYear = relDate.substring(0, 4);
  if (isEpisodeQuery) {
    if (item.media_type === 'tv') {
      score += 180;
      reasons.push('type:tv');
    } else {
      score -= 180;
      reasons.push('type-mismatch');
    }
  }
  if (isEpisodeQuery && year) {
    const fit = assessTvYearFit({ userYear: year, itemYear, season: seasonHint });
    if (fit.match) {
      score += 100;
      reasons.push('year:match');
    } else if (fit.veto) {
      score -= 220;
      reasons.push(fit.veto);
    } else if (fit.soft) {
      score += 40;
      reasons.push('year:soft');
    } else if (!itemYear) {
      reasons.push('year:missing');
    }
  } else if (isEpisodeQuery && !year && itemYear && shouldDemoteBySeasonSpan({ itemYear, season: seasonHint })) {
    // 无年份：用「今天」估季跨度，本地降权撑不起 Sxx 的同名剧（不 reject，留给「更换候选」）
    score -= 200;
    reasons.push('season-span:demote');
  } else if (year && itemYear === year) {
    score += 100;
    reasons.push('year:match');
  } else if (year && itemYear && itemYear !== year) {
    score -= 120;
    reasons.push('year:mismatch');
  } else if (year && !itemYear) {
    reasons.push('year:missing');
  }
  const normTitle = normalize(item.title || item.name || '');
  const normOrigTitle = normalize(item.original_title || item.original_name || '');
  const looseTitle = normalizeLoose(item.title || item.name || '');
  const looseOrigTitle = normalizeLoose(item.original_title || item.original_name || '');
  // contains 方向：query⊂title 为系列名误吸（Elite Force→Lab Rats）；title⊂query 为后缀恢复（…XXX→正片名）。
  let queryContainedInTitle = false;
  let titleContainedInQuery = false;
  const noteContainsDirection = (titleHasQuery: boolean, queryHasTitle: boolean) => {
    if (titleHasQuery) queryContainedInTitle = true;
    if (queryHasTitle) titleContainedInQuery = true;
  };
  const directedContains = (title: string, orig: string, q: string) => {
    if (!q) return null;
    const titleHasQuery = (Boolean(title) && title.includes(q) && title !== q)
      || (Boolean(orig) && orig.includes(q) && orig !== q);
    const queryHasTitle = (Boolean(title) && q.includes(title) && q !== title)
      || (Boolean(orig) && q.includes(orig) && q !== orig);
    if (!titleHasQuery && !queryHasTitle) return null;
    return { titleHasQuery, queryHasTitle };
  };
  const queryScores = scoringQueries.map((query) => {
    const normQ = normalize(query);
    const looseQ = normalizeLoose(query);
    if (normTitle && normQ && (normTitle === normQ || normOrigTitle === normQ)) {
      reasons.push('title:exact');
      titleMatchStrength = 2;
      return isEpisodeQuery ? 180 : 60;
    }
    if (looseQ && (looseTitle === looseQ || looseOrigTitle === looseQ)) {
      reasons.push('title:loose-exact');
      titleMatchStrength = 2;
      return isEpisodeQuery ? 170 : 55;
    }
    const strictContains = directedContains(normTitle, normOrigTitle, normQ);
    if (strictContains) {
      reasons.push('title:contains');
      noteContainsDirection(strictContains.titleHasQuery, strictContains.queryHasTitle);
      if (titleMatchStrength === 0) titleMatchStrength = 1;
      return 20;
    }
    const looseContains = directedContains(looseTitle, looseOrigTitle, looseQ);
    if (looseContains) {
      reasons.push('title:loose-contains');
      noteContainsDirection(looseContains.titleHasQuery, looseContains.queryHasTitle);
      if (titleMatchStrength === 0) titleMatchStrength = 1;
      return 24;
    }
    return 0;
  });
  score += Math.max(0, ...queryScores);
  // Prefer well-known titles when title scores are close (avoids parody/substring tops).
  score += Math.round(popularityBoost(item) * 0.85);

  const autoConfirmThreshold = isEpisodeQuery ? 100 : year ? 80 : 50;
  const vetoes: string[] = [];
  if (expectedMediaType && item.media_type && item.media_type !== expectedMediaType) {
    vetoes.push('veto:type');
  }
  if (isEpisodeQuery && year) {
    const fit = assessTvYearFit({ userYear: year, itemYear, season: seasonHint });
    if (fit.veto) vetoes.push(fit.veto);
    if (fit.soft) vetoes.push('veto:year-soft');
  } else if (year && itemYear && itemYear !== year) {
    vetoes.push('veto:year');
  }
  if (!isEpisodeQuery && isAncillaryMovieCandidate(item)) {
    vetoes.push('veto:ancillary');
  }
  // 仅「查询被片名包含」的 contains 禁止自动（系列/副标题误吸）。
  // 「片名被查询包含」保留自动（垃圾后缀恢复，如 Down Cemetery Road XXX）。
  if (titleMatchStrength === 1 && queryContainedInTitle && !titleContainedInQuery) {
    vetoes.push('veto:title-contains-only');
  }
  if (vetoes.includes('veto:type')) {
    return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
  }
  if (vetoes.includes('veto:year-after') || vetoes.includes('veto:season-span')) {
    return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
  }
  if (vetoes.includes('veto:year') && (vetoes.includes('veto:ancillary') || Math.abs(Number(itemYear) - Number(year)) >= 30)) {
    return { action: 'reject', score, reasons: [...reasons, ...vetoes] };
  }
  if (vetoes.length > 0) {
    return { action: 'require_confirmation', score, reasons: [...reasons, ...vetoes] };
  }
  if (score < autoConfirmThreshold) {
    return { action: 'require_confirmation', score, reasons: [...reasons, 'below-threshold'] };
  }
  return { action: 'auto_apply', score, reasons };
};

export const getConfirmationMessage = (
  decision: TmdbConfirmationDecision | undefined,
  isEpisodeQuery: boolean,
): string => {
  const reasons = decision?.reasons || [];
  if (reasons.includes('veto:type')) return '结果类型与文件名判断不一致，请确认后应用。';
  if (reasons.includes('veto:year-after') || reasons.includes('veto:season-span')) {
    return '已按年份与季跨度排除不可能的同名剧，请确认剩余结果。';
  }
  if (reasons.includes('veto:year-soft')) {
    return '年份更像发行/观影印象而非首播年，已排除跨度不够的同名剧，请确认是否为目标片源。';
  }
  if (reasons.includes('veto:year')) return '结果年份与文件名年份不一致，请确认后应用。';
  if (reasons.includes('veto:ancillary')) return '结果可能是纪录片、花絮或特别篇，请确认是否为正片。';
  if (reasons.includes('veto:title-contains-only')) {
    return isEpisodeQuery
      ? '结果标题仅部分包含片名（非精确同名）。请确认，或补充首播年后再匹配。'
      : '结果标题仅部分包含片名，请确认后应用。';
  }
  if (reasons.includes('need-year')) return '存在多个同名片名，补充年份可排除错误结果。';
  if (reasons.includes('close-score')) return '前列候选分数接近，请确认正确片源；补充年份可减少歧义。';
  return '已找到相近结果，但片名或年份不够吻合，请确认后应用。';
};

export const sortScoredCandidates = (scored: ScoredTmdbCandidate[]): ScoredTmdbCandidate[] => {
  const next = [...scored];
  next.sort((a, b) => {
    const aExact = a.decision.reasons.some((r) => r === 'title:exact' || r === 'title:loose-exact');
    const bExact = b.decision.reasons.some((r) => r === 'title:exact' || r === 'title:loose-exact');
    const aSub = a.decision.reasons.includes('veto:title-contains-only')
      || (a.decision.reasons.includes('title:contains') && !aExact);
    const bSub = b.decision.reasons.includes('veto:title-contains-only')
      || (b.decision.reasons.includes('title:contains') && !bExact);
    if (aExact !== bExact) return aExact ? -1 : 1;
    if (aSub !== bSub) return aSub ? 1 : -1;
    return b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0) || (b.item.vote_count || 0) - (a.item.vote_count || 0);
  });
  return next;
};

/** 前列分数接近时，禁止仅靠 popularity 自动采纳（本轮结果内分差，而非全局热度）。 */
export const applyCloseScoreDemotion = (scored: ScoredTmdbCandidate[]): void => {
  if (scored.length < 2) return;
  const top = scored[0];
  const runnerUp = scored[1];
  if (
    top.decision.action === 'auto_apply'
    && runnerUp.decision.action !== 'reject'
    && top.score - runnerUp.score < 30
  ) {
    top.decision = {
      action: 'require_confirmation',
      score: top.score,
      reasons: [...top.decision.reasons, 'close-score'],
    };
  }
};

/**
 * Close-score demotion + need-year / lucky-path disambiguation.
 * Mutates `scored` decisions in place (same as the former store inline logic).
 */
export const resolveDisambiguation = (opts: {
  scored: ScoredTmdbCandidate[];
  isEpisodeQuery: boolean;
  year: string;
  seasonHint?: number;
}): TmdbDisambiguationResult => {
  const { scored, isEpisodeQuery, year, seasonHint } = opts;
  applyCloseScoreDemotion(scored);

  // 剧集无年 + 多个精确同名：若季跨度已能分出胜负 → 上屏高分项并缓存另一候选；否则再请补年份
  const exactTitleTv = scored.filter((entry) =>
    entry.item.media_type === 'tv'
    && entry.decision.action !== 'reject'
    && (entry.decision.reasons.includes('title:exact') || entry.decision.reasons.includes('title:loose-exact')),
  );
  const spanPlausibleExact = exactTitleTv.filter((entry) => !entry.decision.reasons.includes('season-span:demote'));
  const spanDemotedExact = exactTitleTv.filter((entry) => entry.decision.reasons.includes('season-span:demote'));
  const canLuckyDisambiguate = isEpisodeQuery
    && !year
    && Boolean(seasonHint && seasonHint > 1)
    && spanPlausibleExact.length === 1
    && spanDemotedExact.length >= 1;
  const needsYearDisambiguation = isEpisodeQuery
    && !year
    && exactTitleTv.length >= 2
    && !canLuckyDisambiguate;

  if (needsYearDisambiguation) {
    for (const entry of scored) {
      if (entry.decision.action === 'auto_apply') {
        entry.decision = {
          action: 'require_confirmation',
          score: entry.score,
          reasons: [...entry.decision.reasons, 'need-year'],
        };
      }
    }
  }

  // 有年时：硬否决的同名剧仍可展示在列表末尾，但不参与自动采纳
  // 运气路径：最多保留 2 条（上屏 + 备用），不扩缓存
  const rankedNonReject = scored.filter((entry) => entry.decision.action !== 'reject');
  const rankedReject = scored.filter((entry) => entry.decision.action === 'reject');
  const luckyPair = canLuckyDisambiguate
    ? [spanPlausibleExact[0], spanDemotedExact[0]].filter(Boolean)
    : null;
  const sortedResults = (
    luckyPair
      ? luckyPair.map((entry) => entry.item)
      : [...rankedNonReject, ...rankedReject].map((s) => s.item)
  ).slice(0, luckyPair ? 2 : 5);
  const bestScored = luckyPair?.[0]
    || scored.find((entry) => entry.item.id === sortedResults[0]?.id)
    || scored[0];
  const luckyAlternate = luckyPair?.[1]?.item || null;

  return {
    canLuckyDisambiguate,
    needsYearDisambiguation,
    scored,
    luckyPair,
    sortedResults,
    bestScored,
    luckyAlternate,
  };
};
