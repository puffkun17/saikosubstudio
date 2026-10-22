import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const {
  evaluateCandidate,
  applyCloseScoreDemotion,
  resolveDisambiguation,
  sortScoredCandidates,
  getConfirmationMessage,
} = core('core/tmdbMatch');

const tv = (id, name, firstAir, extras = {}) => ({
  id,
  media_type: 'tv',
  name,
  original_name: name,
  first_air_date: firstAir,
  popularity: extras.popularity ?? 20,
  vote_count: extras.vote_count ?? 100,
  vote_average: extras.vote_average ?? 7.5,
  ...extras,
});

const movie = (id, title, release, extras = {}) => ({
  id,
  media_type: 'movie',
  title,
  original_title: title,
  release_date: release,
  popularity: extras.popularity ?? 20,
  vote_count: extras.vote_count ?? 100,
  vote_average: extras.vote_average ?? 7.5,
  ...extras,
});

test('close-score: near-tied auto_apply top is demoted to require_confirmation', () => {
  const ctx = {
    isEpisodeQuery: false,
    year: '',
    scoringQueries: ['Inception'],
    expectedMediaType: 'movie',
  };
  const a = movie(1, 'Inception', '2010-07-16', { popularity: 90, vote_count: 20000 });
  const b = movie(2, 'Inception', '2010-01-01', { popularity: 80, vote_count: 15000 });
  const scored = sortScoredCandidates([
    { item: a, score: evaluateCandidate(a, ctx).score, decision: evaluateCandidate(a, ctx) },
    { item: b, score: evaluateCandidate(b, ctx).score, decision: evaluateCandidate(b, ctx) },
  ]);
  // Force both into auto_apply with a tight gap so demotion is deterministic.
  scored[0].decision = { action: 'auto_apply', score: 100, reasons: ['title:exact'] };
  scored[0].score = 100;
  scored[1].decision = { action: 'auto_apply', score: 85, reasons: ['title:exact'] };
  scored[1].score = 85;
  applyCloseScoreDemotion(scored);
  assert.equal(scored[0].decision.action, 'require_confirmation');
  assert.ok(scored[0].decision.reasons.includes('close-score'));
  assert.equal(
    getConfirmationMessage(scored[0].decision, false),
    '前列候选分数接近，请确认正确片源；补充年份可减少歧义。',
  );
});

test('need-year: two exact-title TV hits without year ask for year (no lucky path)', () => {
  // Same first-air span → neither demoted by season span at S01; needs year.
  const a = tv(10, 'The Office', '2005-03-24', { popularity: 50 });
  const b = tv(11, 'The Office', '2001-07-09', { popularity: 40 });
  const ctx = {
    isEpisodeQuery: true,
    year: '',
    seasonHint: 1,
    scoringQueries: ['The Office'],
    expectedMediaType: 'tv',
  };
  const scored = sortScoredCandidates([
    { item: a, score: evaluateCandidate(a, ctx).score, decision: evaluateCandidate(a, ctx) },
    { item: b, score: evaluateCandidate(b, ctx).score, decision: evaluateCandidate(b, ctx) },
  ]);
  const result = resolveDisambiguation({
    scored,
    isEpisodeQuery: true,
    year: '',
    seasonHint: 1,
  });
  assert.equal(result.canLuckyDisambiguate, false);
  assert.equal(result.needsYearDisambiguation, true);
  assert.ok(result.scored.some((e) => e.decision.reasons.includes('need-year')));
  assert.equal(
    getConfirmationMessage({ action: 'require_confirmation', score: 0, reasons: ['need-year'] }, true),
    '存在多个同名片名，补充年份可排除错误结果。',
  );
});

test('lucky path: season-span demotion picks plausible exact + caches alternate', () => {
  // Plausible (2015) supports S05; demoted (2024) cannot (ref year − air + 1 < season).
  const plausible = tv(20, 'Same Name', '2015-01-01', { popularity: 30 });
  const demoted = tv(21, 'Same Name', '2024-01-01', { popularity: 60 });
  const ctx = {
    isEpisodeQuery: true,
    year: '',
    seasonHint: 5,
    scoringQueries: ['Same Name'],
    expectedMediaType: 'tv',
  };
  const dPlausible = evaluateCandidate(plausible, ctx);
  const dDemoted = evaluateCandidate(demoted, ctx);
  assert.ok(dDemoted.reasons.includes('season-span:demote'), `expected demote, got ${dDemoted.reasons}`);
  assert.ok(!dPlausible.reasons.includes('season-span:demote'), `plausible demoted: ${dPlausible.reasons}`);

  const scored = sortScoredCandidates([
    { item: demoted, score: dDemoted.score, decision: dDemoted },
    { item: plausible, score: dPlausible.score, decision: dPlausible },
  ]);
  const result = resolveDisambiguation({
    scored,
    isEpisodeQuery: true,
    year: '',
    seasonHint: 5,
  });
  assert.equal(result.canLuckyDisambiguate, true);
  assert.equal(result.needsYearDisambiguation, false);
  assert.equal(result.sortedResults.length, 2);
  assert.equal(result.sortedResults[0].id, plausible.id);
  assert.equal(result.luckyAlternate?.id, demoted.id);
  assert.equal(result.bestScored?.item.id, plausible.id);
});
