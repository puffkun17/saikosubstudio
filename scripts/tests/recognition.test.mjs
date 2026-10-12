import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_EN, LINES_ZH, LINES_JA, timeline, toAss } from './_fixtures.mjs';

const core = loadCore();
const rc = core('core/recognition');
const { parseSubtitle } = core('utils/subtitleCore');

test('zh+ja style-paired ASS (Dial_CH / Dial_JP) splits into two tracks; neutral styles stay with zh', () => {
  const t = timeline(30, 2);
  const events = t.flatMap((c, i) => [
    { ...c, style: 'Dial_JP', text: LINES_JA[i] },
    { ...c, style: 'Dial_CH', text: LINES_ZH[i] },
  ]);
  events.push({ start: 1000, end: 3000, style: 'Screen', text: '{\\pos(960,200)\\frz12}商店' });
  const split = rc.splitAssByLanguageStyles(toAss(events));
  assert.ok(split);
  assert.equal(split.secondary.lang, 'ja');
  assert.equal(split.primary.events, 31);
  assert.equal(split.secondary.events, 30);
  assert.deepEqual(split.neutralStyles, ['Screen']);
  assert.ok(parseSubtitle(split.secondary.text).every((r) => /[ぁ-ん]/.test(r.text)));
  // Plain single-style file → no split.
  assert.equal(rc.splitAssByLanguageStyles(toAss(t.map((c, i) => ({ ...c, style: 'Default', text: LINES_ZH[i] })))), null);
});

test('SDH by content vs plain dialogue; signs are not SDH', () => {
  const sdhRows = LINES_EN.map((l, i) => ({ text: i % 4 === 0 ? '[door opens]' : i % 7 === 0 ? `MOM: ${l}` : l }));
  assert.equal(rc.detectSdhByContent(sdhRows).isSdh, true);
  assert.equal(rc.detectSdhByContent(LINES_EN.map((text) => ({ text }))).isSdh, false);
  assert.equal(rc.isPositionedSign('{\\pos(960,200)\\frz12}OPEN'), true);
  assert.equal(rc.isPositionedSign('Where are you?'), false);
  assert.equal(rc.isRotated('{\\frz-8}SALE'), true);
});

test('two-speaker dash lines are restored (H-1); hyphenated words untouched', () => {
  assert.equal(rc.restoreDashDialogue('- Want some coffee? - Yes, please.'), '- Want some coffee?\n- Yes, please.');
  assert.equal(rc.restoreDashDialogue('A well-known shop.'), 'A well-known shop.');
  assert.equal(rc.restoreDashDialogue('- Already\n- split'), '- Already\n- split');
});

test('uploader watermark, lyrics markers, trailing song run', () => {
  assert.equal(rc.isUploaderWatermark('本字幕由微博@ 某某影视 合并分享'), true);
  assert.equal(rc.isUploaderWatermark('Downloaded from example-subs.com'), true);
  assert.equal(rc.isUploaderWatermark('Did you call your mother?'), false);
  assert.equal(rc.isMusicLyricLine('♪ walking down the road ♪'), true);
  assert.equal(rc.isMusicLyricLine('♪'), false);
  const sec = [{ start: 0, end: 1000 }, { start: 90_000, end: 92_000 }, { start: 93_000, end: 95_000 }, { start: 96_000, end: 98_000 }];
  assert.deepEqual(rc.findTrailingSongRun(89_000, sec), [1, 2, 3]);
  assert.deepEqual(rc.findTrailingSongRun(97_000, sec), []);
});

test('title key ignores language / SDH / release tokens', () => {
  assert.equal(rc.titleKeyOf('人性本兽.Animals.2026.SDH.srt'), rc.titleKeyOf('人性本兽.Animals.2026.简中.srt'));
  assert.equal(rc.titleKeyOf('The.Pitt.S02E15.1080p.WEB.eng.srt'), 'the pitt');
  assert.equal(rc.titleKeyOf('[Grp] 某番 #01 (BD 1920x1080 FLAC)[3E26061D].ass'), rc.titleKeyOf('[Grp] 某番 #02 (BD 1920x1080 FLAC)[AABBCCDD].ass'));
});
