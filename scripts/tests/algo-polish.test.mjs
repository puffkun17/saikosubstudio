import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { cuesToSrt } from './_mergeInvariants.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');
const O = core('utils/timeline/offsetDiagnosis');

test('histogram offset diagnosis detects global shift despite extra head cues and ignores unshifted periodic cues', () => {
  const N = 28;
  const primary = Array.from({ length: N }, (_, i) => (i + 2) * 4000);
  const extraHead = [400, 1100, 1800, 2600, 3400, 4200, 5100];
  const shiftedSecondary = [...extraHead, ...primary.map((t) => t + 3200)];

  const shifted = O.estimateGlobalOffsetFromStarts(primary, shiftedSecondary);
  assert.equal(shifted.shouldApply, true, `expected shouldApply=true, got ${JSON.stringify(shifted)}`);
  assert.ok(Math.abs(shifted.offsetMs - 3200) <= 200, `expected ~3200ms, got ${shifted.offsetMs}`);

  // Unshifted periodic track must NOT trigger a bogus harmonic shift
  const unshifted = O.estimateGlobalOffsetFromStarts(primary, [...extraHead, ...primary]);
  assert.equal(unshifted.shouldApply, false, `unshifted cues must stay unshifted, got ${JSON.stringify(unshifted)}`);
});

test('industrial aligner propagates secondaryOffsetMs to packed-dialogue expansion and 1:N coverage merge', () => {
  const offset = 2500;
  const zh = [];
  const en = [];

  // Cue 1: packed two-speaker Chinese dialogue at 2000..6500ms, EN split at +2500ms
  zh.push([2000, 6500, '- 你好。\\N- 我要走了。']);
  en.push([2000 + offset, 4000 + offset, 'Hello.']);
  en.push([4200 + offset, 6400 + offset, 'I have to go.']);

  // Cue 2: 1:N coverage Chinese cue at 10000..15000ms, EN split into two at +2500ms
  zh.push([10000, 15000, '我们今天晚上去那家新开的餐厅吃饭吧。']);
  en.push([10100 + offset, 12300 + offset, "Let's go to that new restaurant"]);
  en.push([12400 + offset, 14900 + offset, 'for dinner tonight.']);

  // Add enough normal cues so global offset diagnosis has >=20 samples
  for (let i = 0; i < 24; i += 1) {
    const start = 20_000 + i * 4000;
    zh.push([start, start + 1800, `第${i + 1}句对白。`]);
    en.push([start + offset, start + 1800 + offset, `Dialogue line ${i + 1}.`]);
  }

  const rows = S.alignSubtitlesIndustrial(
    S.parseSubtitle(cuesToSrt(zh, S.msToTime)),
    S.parseSubtitle(cuesToSrt(en, S.msToTime)),
  );

  const expanded = rows.filter((r) => r.alignment === 'expanded-dialogue');
  assert.equal(expanded.length, 2, `expected 2 expanded rows, got ${expanded.length}`);
  assert.equal(expanded[0].ts, '00:00:02,000 --> 00:00:04,000');
  assert.equal(expanded[1].ts, '00:00:04,200 --> 00:00:06,400');

  const covered = rows.filter((r) => r.alignment === 'coverage-merge');
  assert.equal(covered.length, 2, `expected 2 coverage-merge rows, got ${covered.length}`);
  assert.equal(covered[0].ts, '00:00:10,100 --> 00:00:12,300');
  assert.equal(covered[1].ts, '00:00:12,400 --> 00:00:14,900');
});

test('detectLanguageByContent distinguishes short Traditional vs Simplified Chinese with expanded lexicon', () => {
  assert.equal(S.detectLanguageByContent('我們應該現在去醫院看醫生，別讓問題變嚴重。'), 'zh-TW');
  assert.equal(S.detectLanguageByContent('我们应该现在去医院看医生，别让问题变严重。'), 'zh-CN');
});

test('splitSingleBilingualText splits Chinese + accented Romance cues cleanly', () => {
  assert.equal(S.splitSingleBilingualText('你好，朋友们！¡Hola, amigos!'), '你好，朋友们！\n¡Hola, amigos!');
  assert.equal(S.splitSingleBilingualText('Écoute-moi bien 快点听我说'), '快点听我说\nÉcoute-moi bien');
});
