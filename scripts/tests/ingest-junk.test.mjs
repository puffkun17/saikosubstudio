import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
// ingestJunk is under utils/ — load via the same compiled outDir as subtitleCore.
const junk = core('utils/ingestJunk');

const isSub = (path) => /\.(srt|ass)$/i.test(path);

test('isJunkIngestPath catches __MACOSX, AppleDouble, system and meta files', () => {
  assert.equal(junk.isJunkIngestPath('__MACOSX/._Show.S01E01.srt'), true);
  assert.equal(junk.isJunkIngestPath('Show/._hidden.srt'), true);
  assert.equal(junk.isJunkIngestPath('.DS_Store'), true);
  assert.equal(junk.isJunkIngestPath('folder/Thumbs.db'), true);
  assert.equal(junk.isJunkIngestPath('desktop.ini'), true);
  assert.equal(junk.isJunkIngestPath('show.nfo'), true);
  assert.equal(junk.isJunkIngestPath('release.sfv'), true);
  assert.equal(junk.isJunkIngestPath('homepage.url'), true);
  assert.equal(junk.isJunkIngestPath('cover.jpg'), true);
  assert.equal(junk.isJunkIngestPath('README.txt'), true);
  assert.equal(junk.isJunkIngestPath('info.txt'), true);
  assert.equal(junk.isJunkIngestPath('Show.S01E01.chs.srt'), false);
  assert.equal(junk.isJunkIngestPath('subs/episode.ass'), false);
});

test('partitionIngestPaths keeps real subs and records ignored names', () => {
  const { subtitles, ignored } = junk.partitionIngestPaths([
    'Show.S01E01.chs.srt',
    '__MACOSX/._Show.S01E01.chs.srt',
    'Show.S01E01.eng.srt',
    'cover.png',
    'readme.txt',
    'notes.md',
  ], isSub);
  assert.deepEqual(subtitles, ['Show.S01E01.chs.srt', 'Show.S01E01.eng.srt']);
  assert.equal(ignored.length, 4);
  assert.ok(ignored.some((e) => e.name.includes('__MACOSX') && e.reason === 'macosx'));
  assert.ok(ignored.some((e) => e.reason === 'image'));
  assert.ok(ignored.some((e) => e.reason === 'readme'));
  assert.ok(ignored.some((e) => e.reason === 'non_subtitle' && e.name.endsWith('.md')));
});
