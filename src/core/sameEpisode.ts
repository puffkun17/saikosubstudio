import { compareEpisodes, type EpisodeRef } from './episode';
import { measureTimelineAgreement, TIMELINE_AGREEMENT_POLICY, type CueTime } from './timelineAgreement';

export type SameEpisodeDecision =
  | { kind: 'merge'; reason: 'episode-and-timeline' | 'title-and-episode' | 'timeline-unknown-episode'; score: number }
  | { kind: 'suggest'; reason: 'timeline-plausible' | 'episode-equal-timeline-low' | 'title-only'; score: number }
  | { kind: 'separate'; reason: 'episode-different' | 'timeline-mismatch'; score: number };

export interface EpisodeCandidate {
  ep: EpisodeRef;
  /** Normalised title from filename (may differ across languages: 熊家餐馆 vs The Bear). */
  titleKey: string;
  times: CueTime[];
  /** TMDB id when already known (strongest identity). */
  tmdbId?: number;
}

/**
 * Rules (Derek 2026-10-12):
 * - Never merge when episode numbers differ.
 * - Timeline is only consulted when episodes are equal or unknown.
 * - Auto-merge when episode equal AND timeline high; otherwise flag a suggestion for the user.
 */
export function decideSameEpisode(a: EpisodeCandidate, b: EpisodeCandidate, policy = TIMELINE_AGREEMENT_POLICY): SameEpisodeDecision {
  const rel = compareEpisodes(a.ep, b.ep);
  if (rel === 'different') return { kind: 'separate', reason: 'episode-different', score: 0 };
  if (a.tmdbId && b.tmdbId && a.tmdbId !== b.tmdbId) return { kind: 'separate', reason: 'timeline-mismatch', score: 0 };
  const sameTitle = Boolean(a.titleKey) && a.titleKey === b.titleKey;
  const hasTimes = a.times.length >= policy.minCues && b.times.length >= policy.minCues;
  const score = hasTimes ? Math.max(measureTimelineAgreement(a.times, b.times, policy).score, measureTimelineAgreement(b.times, a.times, policy).score) : 0;
  if (rel === 'equal') {
    if (score >= policy.high) return { kind: 'merge', reason: 'episode-and-timeline', score };
    // Same title + same episode keeps today's behaviour (e.g. 简中/繁中 with re-timed cues).
    if (sameTitle) return { kind: 'merge', reason: 'title-and-episode', score };
    return { kind: 'suggest', reason: 'episode-equal-timeline-low', score };
  }
  // Unknown episode on at least one side (movies, or unparseable names).
  if (sameTitle) {
    // Same title (e.g. 人性本兽.Animals.2026.简中 / .SDH): keep together unless timing clearly disagrees.
    if (!hasTimes || score >= policy.low) return { kind: 'merge', reason: 'title-and-episode', score };
    return { kind: 'suggest', reason: 'title-only', score };
  }
  if (score >= policy.high) return { kind: 'merge', reason: 'timeline-unknown-episode', score };
  if (score >= policy.low) return { kind: 'suggest', reason: 'timeline-plausible', score };
  return { kind: 'separate', reason: 'timeline-mismatch', score };
}
