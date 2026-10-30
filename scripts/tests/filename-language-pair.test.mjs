import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const { detectLanguagePairByFilename: pair } = loadCore()('core/filenameLanguagePair');
const P = 'Ted.Lasso.S04E01.Home.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-FLUX.';

test('latin pair tags at the tail, either order', () => {
  assert.deepEqual(pair(`${P}EN&CHS.srt`), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair(`${P}EN&CHT.ass`), { primary: 'zh-TW', secondary: 'en' });
  assert.deepEqual(pair(`${P}CHS&EN.srt`), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.chs_eng.ass'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.chs.eng.srt'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.CHT+ENG.srt'), { primary: 'zh-TW', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.zh-Hans.eng.srt'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.zh_TW&en.srt'), { primary: 'zh-TW', secondary: 'en' });
  assert.deepEqual(pair('Show.S01E01.chs&spa.srt'), { primary: 'zh-CN', secondary: 'es' });
});

test('CJK pair tags', () => {
  assert.deepEqual(pair('某剧.S01E01.简英.ass'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('某剧.S01E01.繁英.srt'), { primary: 'zh-TW', secondary: 'en' });
  assert.deepEqual(pair('某剧 第1集 繁體&英文.srt'), { primary: 'zh-TW', secondary: 'en' });
  assert.deepEqual(pair('某剧.S01E01.简体&英文.srt'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('某剧.S01E01.中英.srt'), { primary: 'zh-CN', secondary: 'en' });
  assert.deepEqual(pair('某剧.S01E01.英简.srt'), { primary: 'zh-CN', secondary: 'en' });
});

test('not a pair: single language, zh+zh, zh+ja, non-adjacent, bare short codes', () => {
  assert.equal(pair(`${P}CHS.srt`), null);
  assert.equal(pair(`${P}EN.srt`), null);
  assert.equal(pair('Show.S01E01.chs&cht.srt'), null);
  assert.equal(pair('Show.S01E01.简繁.srt'), null);
  assert.equal(pair('Show.S01E01.chs.jpn.srt'), null);
  assert.equal(pair('Show.CHS.S01E01.1080p.eng.srt'), null);
  assert.equal(pair('Show.S01E01.chs.it.srt'), null);
  assert.equal(pair('La.Casa.de.Papel.S01E01.chs.srt'), null);
  assert.equal(pair(''), null);
});
