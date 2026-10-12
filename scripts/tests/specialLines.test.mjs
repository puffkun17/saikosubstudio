import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const sl = loadCore()('core/specialLines');

const rows = [
  { text: '早上好' },
  { text: '♪ 歌词一句 ♪', type: 'lyrics' },
  { text: '[关门声]', cueKind: 'sound_caption' },
  { text: '熊家餐馆', cueKind: 'screen_text' },
  { text: '这是一句特别长特别长特别长特别长特别长的对白内容' },
];

test('special lines: kinds, next index with wrap, counts', () => {
  assert.equal(sl.specialKindOf(rows[0]), null);
  assert.equal(sl.specialKindOf(rows[1]), 'lyrics');
  assert.equal(sl.specialKindOf(rows[2]), 'sdh');
  assert.equal(sl.specialKindOf(rows[3]), 'sign');
  assert.equal(sl.specialKindOf(rows[4]), 'long');
  assert.equal(sl.nextSpecialIndex(rows, 0, 'sign'), 3);
  assert.equal(sl.nextSpecialIndex(rows, 3, 'lyrics'), 1);
  assert.deepEqual(sl.countSpecial(rows), { long: 1, lyrics: 1, sign: 1, sdh: 1 });
});

test('slideshow: stills advance evenly', () => {
  assert.equal(sl.slideIndexFor(0, 100, 5), 0);
  assert.equal(sl.slideIndexFor(99, 100, 5), 4);
  assert.equal(sl.slideIndexFor(50, 100, 1), 0);
});

test('pager ordinal and stepping within a category', () => {
  const idx = [3, 7, 12];
  assert.equal(sl.pagerOrdinal(idx, 0), 0);
  assert.equal(sl.pagerOrdinal(idx, 7), 2);
  assert.equal(sl.pagerOrdinal(idx, 20), 3);
  assert.equal(sl.stepSpecial(idx, 7, 1), 12);
  assert.equal(sl.stepSpecial(idx, 12, 1), 3);
  assert.equal(sl.stepSpecial(idx, 3, -1), 12);
  assert.equal(sl.stepSpecial(idx, 8, -1), 7);
  assert.equal(sl.stepSpecial([], 0, 1), -1);
  const rows = [{ text: 'a', cueKind: 'lyrics' }, { text: 'b' }, { text: 'c', cueKind: 'sound_caption' }];
  assert.deepEqual(sl.specialIndices(rows).lyrics, [0]);
  assert.deepEqual(sl.specialIndices(rows).sdh, [2]);
});
