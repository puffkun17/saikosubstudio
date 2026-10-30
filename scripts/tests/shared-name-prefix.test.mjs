import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const { splitSharedPrefix, distinguishingTailLength } = loadCore()('core/sharedNamePrefix');

const P = 'Ted.Lasso.S04E01.Home.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-FLUX.';

test('Ted.Lasso zip: prefix shown once, rows keep the distinguishing tail + extension', () => {
  const tails = ['CHS.ass', 'CHS.srt', 'CHT.ass', 'CHT.srt', 'EN&CHS.ass', 'EN&CHS.srt', 'EN&CHT.ass', 'EN&CHT.srt', 'EN.srt'];
  const split = splitSharedPrefix(tails.map((t) => P + t));
  assert.equal(split.prefix, P);
  assert.deepEqual(split.tails, tails);
});

test('never cuts inside a word', () => {
  const split = splitSharedPrefix(['Show.Name.S01E01.CHS.srt', 'Show.Name.S01E02.CHS.srt'], 6);
  assert.equal(split.prefix, 'Show.Name.');
  assert.deepEqual(split.tails, ['S01E01.CHS.srt', 'S01E02.CHS.srt'].map((t) => t));
});

test('backs off when a tail would be only the extension', () => {
  const split = splitSharedPrefix(['Some.Long.Movie.Name.2021.srt', 'Some.Long.Movie.Name.2021.en.srt']);
  assert.equal(split.prefix, 'Some.Long.Movie.Name.');
  assert.deepEqual(split.tails, ['2021.srt', '2021.en.srt']);
});

test('no collapse for single file, short prefix, or nothing shared', () => {
  assert.equal(splitSharedPrefix([P + 'EN.srt']), null);
  assert.equal(splitSharedPrefix(['a.CHS.srt', 'a.CHT.srt']), null);
  assert.equal(splitSharedPrefix(['alpha.srt', 'beta.srt']), null);
});

test('distinguishingTailLength keeps the segment before the extension', () => {
  const name = P + 'EN&CHS.srt';
  assert.equal(name.slice(-distinguishingTailLength(name)), 'EN&CHS.srt');
  assert.equal(distinguishingTailLength('a.srt'), 5);
});
