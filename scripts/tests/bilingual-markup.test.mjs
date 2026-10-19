/**
 * F7: bilingual SRT carrying ASS override tags / HTML markup.
 * Detection & splitting strip tags; export/original text paths stay untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');

const taggedEn = '{\\fn微软雅黑\\fs14}Hello there my friend, what are you doing?';
const bilingualSrt = [
  '1',
  '00:00:01,000 --> 00:00:03,000',
  '你好，世界。',
  taggedEn,
  '',
  '2',
  '00:00:04,000 --> 00:00:06,000',
  '我们走吧。',
  '{\\fn微软雅黑\\fs14}Let us go now, are you ready?',
  '',
].join('\n');

test('stripMarkupForDetection: drops ASS overrides and font/b/u, keeps <i>', () => {
  assert.equal(S.stripMarkupForDetection(taggedEn), 'Hello there my friend, what are you doing?');
  assert.equal(
    S.stripMarkupForDetection('<font color="#fff"><b>Hi</b></font> <i>aside</i> <u>x</u>'),
    'Hi <i>aside</i> x',
  );
  assert.equal(S.stripMarkupForDetection('上\\N下'), '上\n下');
});

test('detectLanguageByContent: tagged English is en, not zh from font name', () => {
  assert.equal(S.detectLanguageByContent(taggedEn), 'en');
  assert.notEqual(S.detectLanguageByContent(taggedEn), 'zh-CN');
  assert.notEqual(S.detectLanguageByContent(taggedEn), 'zh-TW');
  assert.equal(S.detectLanguageByContent('{\\fnArial\\fs20}What are you doing with that?'), 'en');
});

test('JA / KO stay distinct from Chinese (kana / hangul first)', () => {
  assert.equal(S.detectLanguageByContent('おかえりなさい。今日はいい天気だね。'), 'ja');
  assert.equal(S.detectLanguageByContent('괜찮아요? 오늘 날씨가 좋아요.'), 'ko');
  assert.equal(S.detectLanguageByContent('你好，今天天气不错。我们一起出去走走吧。'), 'zh-CN');
});

test('splitSingleBilingualText ignores CJK inside ASS font overrides', () => {
  const split = S.splitSingleBilingualText(`中文台词。${taggedEn}`);
  assert.ok(split.startsWith('中文台词。\n'));
  assert.ok(split.includes('Hello there my friend'));
  assert.ok(!split.includes('微软雅黑'));
});

test('detectSubtitleLanguage: tagged bilingual SRT → bilingual, not zh-CN/zh-TW', () => {
  const detected = S.detectSubtitleLanguage('Show.S01E01.EN.CHS.srt', bilingualSrt);
  assert.equal(detected.lang, 'bilingual');
  assert.equal(detected.isBilingual, true);
  assert.ok(detected.languagePair);
  assert.equal(detected.languagePair.primary, 'zh-CN');
  assert.equal(detected.languagePair.secondary, 'en');
});

test('Subfile-style original text still contains ASS tags after detection', () => {
  // Ingest keeps raw text; only detectors see the stripped view.
  assert.ok(bilingualSrt.includes('{\\fn微软雅黑\\fs14}'));
  const detected = S.detectSubtitleLanguage('a.srt', bilingualSrt);
  assert.equal(detected.isBilingual, true);
  assert.ok(bilingualSrt.includes('{\\fn微软雅黑\\fs14}'), 'raw input unchanged');
});
