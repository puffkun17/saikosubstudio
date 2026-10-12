import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_EN, LINES_ZH, timeline, toSrt } from './_fixtures.mjs';

const core = loadCore();
const { parseEpisodeRef, episodeKeyOf, compareEpisodes } = core('core/episode');
const { cueTimesFromRows, measureTimelineAgreement, TIMELINE_AGREEMENT_POLICY } = core('core/timelineAgreement');
const { decideSameEpisode } = core('core/sameEpisode');
const { titleKeyOf } = core('core/recognition');
const { parseSubtitle } = core('utils/subtitleCore');

test('episode parsing: SxxExx, SxEx, 1x01, 第N集, #NN, unknown stays unknown', () => {
  const cases = [
    ['The.Bear.2022.S01E02.1080p.WEB.srt', 1, 2],
    ['The Pitt S2E15.srt', 2, 15],
    ['only.murders.in.the.building.5x08.srt', 5, 8],
    ['熊家餐馆 第二季 第3集.ass', 2, 3],
    ['熊家餐馆 第12集.srt', null, 12],
    ['[Group] Show #02 (BD 1920x1080 FLAC)[3E26061D].ass', null, 2],
    ['Lanterns.S01E08.zh-Hans.srt', 1, 8],
    ['Show - 07 [1080p].ass', null, 7],
    ['Animals.2026.简中.srt', null, null],
    ['1917.2019.1080p.srt', null, null],
  ];
  for (const [name, s, e] of cases) assert.deepEqual(parseEpisodeRef(name), { season: s, episode: e }, name);
  assert.equal(episodeKeyOf({ season: null, episode: 2 }, 1), 'S01E02');
  assert.equal(episodeKeyOf({ season: null, episode: null }, 1), undefined);
  assert.equal(compareEpisodes({ season: 1, episode: 2 }, { season: null, episode: 2 }), 'equal');
  assert.equal(compareEpisodes({ season: 1, episode: 2 }, { season: 1, episode: 3 }), 'different');
  assert.equal(compareEpisodes({ season: 1, episode: 2 }, { season: null, episode: null }), 'unknown');
});

const rowsOf = (lines, times) => parseSubtitle(toSrt(lines, times));
const cand = (name, lines, times) => ({ ep: parseEpisodeRef(name), titleKey: titleKeyOf(name), times: cueTimesFromRows(rowsOf(lines, times)) });

test('timeline agreement: same template high, other episode low, constant offset tolerated', () => {
  const t1 = timeline(40, 1);
  const zh = cueTimesFromRows(rowsOf(LINES_ZH, t1));
  const en = cueTimesFromRows(rowsOf(LINES_EN, timeline(40, 1, 0, 80)));
  const shifted = cueTimesFromRows(rowsOf(LINES_EN, timeline(40, 1, 1500, 60)));
  const other = cueTimesFromRows(rowsOf(LINES_EN, timeline(40, 7)));
  const same = measureTimelineAgreement(zh, en).score;
  const off = measureTimelineAgreement(zh, shifted);
  const diff = measureTimelineAgreement(zh, other).score;
  assert.ok(same >= TIMELINE_AGREEMENT_POLICY.high, `same ${same}`);
  assert.ok(off.score >= TIMELINE_AGREEMENT_POLICY.high && Math.abs(off.offsetMs - 1500) < 200, `offset ${JSON.stringify(off)}`);
  assert.ok(diff < TIMELINE_AGREEMENT_POLICY.low, `different ${diff}`);
});

test('same-episode decision: zh 熊家餐馆 + en The Bear same ep → merge; never merge differing ep', () => {
  const t = timeline(40, 3);
  const zh = cand('熊家餐馆.S01E02.简中.srt', LINES_ZH, t);
  const en = cand('The.Bear.2022.S01E02.WEB.en.srt', LINES_EN, timeline(40, 3, 0, 70));
  assert.equal(decideSameEpisode(zh, en).kind, 'merge');
  const ep3 = cand('The.Bear.2022.S01E03.en.srt', LINES_EN, t);
  assert.deepEqual(decideSameEpisode(zh, ep3).kind, 'separate');
  // Same ep number, unrelated timing, different titles → ask the user.
  const odd = cand('Lanterns.S01E02.en.srt', LINES_EN, timeline(40, 11));
  assert.equal(decideSameEpisode(zh, odd).kind, 'suggest');
});

test('same-episode decision: movie 简中 + SDH (same title, unknown ep) → merge', () => {
  const t = timeline(40, 5);
  const zh = cand('人性本兽.Animals.2026.简中.srt', LINES_ZH, t);
  const sdh = cand('人性本兽.Animals.2026.SDH.srt', LINES_EN, timeline(40, 5, 0, 90));
  assert.equal(zh.titleKey, sdh.titleKey);
  assert.equal(decideSameEpisode(zh, sdh).kind, 'merge');
});

test('same-episode decision: anime #01/#02 never merged', () => {
  const a = cand('[Grp] 某番 #01 (BD 1920x1080)[11111111].ass', LINES_ZH, timeline(40, 1));
  const b = cand('[Grp] 某番 #02 (BD 1920x1080)[22222222].ass', LINES_ZH, timeline(40, 1));
  assert.equal(a.titleKey, b.titleKey);
  assert.equal(decideSameEpisode(a, b).kind, 'separate');
});
