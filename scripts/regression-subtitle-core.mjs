import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const outDir = join(tmpdir(), 'saiko-substudio-core-regression');
process.env.NODE_PATH = join(process.cwd(), 'node_modules');
Module._initPaths();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync('npx', [
  'tsc',
  'src/utils/subtitleCore.ts',
  'src/store/useStudioStore.ts',
  '--target',
  'ES2020',
  '--module',
  'commonjs',
  '--moduleResolution',
  'node',
  '--outDir',
  outDir,
  '--skipLibCheck',
], { stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  alignSubtitlesIndustrial,
  buildTmdbSearchQueries,
  cleanFilename,
  classifySubtitleCue,
  generateSrtContent,
  mergeSubtitles,
  parseMediaFilename,
  parseSubtitle,
  splitSingleBilingualText,
} = require(join(outDir, 'utils/subtitleCore.js'));
const { useStudioStore } = require(join(outDir, 'store/useStudioStore.js'));

const noopLog = () => {};

const assertIncludes = (items, expected, message) => {
  assert.ok(items.includes(expected), `${message}\nExpected: ${expected}\nActual: ${items.join(' | ')}`);
};

{
  const queries = buildTmdbSearchQueries('Down Cemetery Road XXX');
  assertIncludes(queries, 'Down Cemetery Road', 'Dirty manual query should fall back to the real title.');
}

{
  const queries = buildTmdbSearchQueries('[zmk.pw]Down.Cemetery.Road.S01E02.A.Kind.of.Grief.1080p.ATVP.WEB-DL.DD.5.1.Atmos.H.264-playWEB.简体&英文');
  assert.equal(queries[0], 'Down Cemetery Road', 'Release/site tags should not outrank the real title.');
}

{
  const queries = buildTmdbSearchQueries('[zmk.pw]【收藏级精修】Slow.Horses.S05.1080p_2160p.WEB.zip');
  assert.equal(queries[0], 'Slow Horses', 'Subtitle package labels should be stripped before TMDB search.');
}

{
  const sample = 'Mayor of Kingstown Teeth and Tissue AMZN playWEB 简体&英文';
  assert.equal(cleanFilename(sample), 'Mayor of Kingstown Teeth and Tissue');
  const queries = buildTmdbSearchQueries(sample, 12);
  assertIncludes(queries, 'Mayor of Kingstown', 'Episode titles without SxxExx should still fall back to the series title.');
}

{
  const sample = 'Alien_Earth_S01E02_1080p_DSNP_WEB-DL_DDP5_1_H_264_zh-CN_merged_20260617_223000.ass';
  assert.equal(cleanFilename(sample), 'Alien Earth');
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'Alien Earth');
  assert.equal(parsed.episodeKey, 'S01E02');
  assert.deepEqual(buildTmdbSearchQueries(sample, 8), ['Alien Earth']);
}

{
  const parsed = parseMediaFilename('金斯敦市长第四季第五集.srt');
  assert.equal(parsed.title, '金斯敦市长');
  assert.equal(parsed.episodeKey, 'S04E05');
}

{
  const queries = buildTmdbSearchQueries('S04E05.srt');
  assert.deepEqual(queries, [], 'Episode-only filenames should not create noisy TMDB searches.');
}

{
  const merged = mergeSubtitles(
    [
      { ts: '00:00:01,000 --> 00:00:03,000', text: '你好' },
      { ts: '00:00:04,000 --> 00:00:06,000', text: '再见' },
    ],
    [
      { ts: '00:00:01,100 --> 00:00:03,100', text: 'Hello' },
      { ts: '00:00:04,100 --> 00:00:06,100', text: 'Bye' },
    ],
    [],
    noopLog
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, '你好\nHello');
  assert.equal(merged[1].text, '再见\nBye');
}

{
  const aligned = alignSubtitlesIndustrial(
    [
      { ts: '00:00:01,000 --> 00:00:03,000', text: '你好' },
      { ts: '00:00:03,200 --> 00:00:03,900', text: '插入中文' },
      { ts: '00:00:04,000 --> 00:00:06,000', text: '再见' },
    ],
    [
      { ts: '00:00:01,050 --> 00:00:03,050', text: 'Hello' },
      { ts: '00:00:04,050 --> 00:00:06,050', text: 'Bye' },
    ],
    [],
    noopLog
  );
  assert.ok(aligned.some(row => row.text === '你好\nHello'), 'Industrial align should pair the first matching cue.');
  assert.ok(aligned.some(row => row.text === '再见\nBye'), 'Industrial align should recover after an inserted cue.');
  assert.ok(aligned.some(row => row.text === '插入中文'), 'Inserted unpaired cues should be preserved.');
}

{
  assert.equal(splitSingleBilingualText('你好 Hello world'), '你好\nHello world');
  assert.equal(splitSingleBilingualText('我们今天去吃 KFC。'), '我们今天去吃 KFC。');
  assert.equal(splitSingleBilingualText('This is fine 这很好'), '这很好\nThis is fine');
  assert.equal(splitSingleBilingualText('中文已换行\nEnglish already split'), '中文已换行\nEnglish already split');
}

{
  assert.equal(classifySubtitleCue('{\\an8}禁止入内').kind, 'screen_text');
  assert.equal(classifySubtitleCue('POLICE DEPARTMENT').kind, 'screen_text');
  assert.equal(classifySubtitleCue('我们今天去吃 KFC。').kind, 'dialogue');
  assert.equal(classifySubtitleCue('（脚步声）').kind, 'narration');
}

{
  const parsed = parseSubtitle(`1
00:00:01,000 --> 00:00:03,000  X1:100 X2:800 Y1:40 Y2:120
EXIT

2
00:00:04,000 --> 00:00:06,000
我们走吧
`);
  assert.equal(parsed[0].ts, '00:00:01,000 --> 00:00:03,000', 'SRT positioning metadata should not pollute timestamps.');
  assert.equal(parsed[0].cueKind, 'screen_text');
  assert.equal(parsed[1].cueKind, 'dialogue');
}

{
  const parsed = parseSubtitle(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Signs,,0,0,0,,{\\an8}ROOM 204
Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,Hello
`);
  assert.equal(parsed[0].cueKind, 'screen_text');
  assert.equal(parsed[1].cueKind, 'dialogue');
}

{
  const merged = mergeSubtitles(
    [{ ts: '00:00:01,000 --> 00:00:03,000', text: '{\\an8}EXIT', cueKind: 'screen_text' }],
    [],
    [],
    noopLog
  );
  assert.equal(merged[0].cueKind, 'screen_text');
  const exported = generateSrtContent(merged);
  assert.ok(exported.includes('{\\an8}EXIT'), 'Screen text should keep top placement when exported to SRT.');
}

const resetStoreForTmdb = () => {
  useStudioStore.setState({
    tasks: [],
    selectedTaskId: null,
    tmdbData: null,
    tmdbBackdrop: null,
    tmdbBackdropList: [],
    tmdbSuggestions: [],
    selectedSuggestion: null,
    tmdbManualOpen: false,
    isSearchingTmdb: false,
    logs: [],
    customFilename: '',
    filenameSource: 'unknown',
  });
};

const createTmdbSearchResult = (item) => ({
  ok: true,
  status: 200,
  json: async () => ({ page: 1, results: item ? [item] : [], total_pages: item ? 1 : 0, total_results: item ? 1 : 0 }),
});

const createTmdbDetails = (details) => ({
  ok: true,
  status: 200,
  json: async () => details,
});

const createTmdbImages = () => ({
  ok: true,
  status: 200,
  json: async () => ({ backdrops: [{ file_path: '/fallback.jpg' }], stills: [{ file_path: '/still.jpg' }] }),
});

{
  resetStoreForTmdb();
  const calls = [];
  const downCemeterySuggestion = {
    id: 252000,
    media_type: 'tv',
    name: '坟场回路',
    original_name: 'Down Cemetery Road',
    first_air_date: '2025-10-29',
    backdrop_path: '/down.jpg',
    poster_path: '/down-poster.jpg',
    popularity: 5,
  };

  global.fetch = async (url) => {
    calls.push(String(url));
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv')) {
      const query = decodeURIComponent(new URL(`http://local${target}`).searchParams.get('query') || '');
      return createTmdbSearchResult(query === 'Down Cemetery Road' ? downCemeterySuggestion : null);
    }
    if (target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(null);
    }
    if (target.includes('/api/tmdb/tv/252000/images')) return createTmdbImages();
    if (target.includes('/api/tmdb/tv/252000')) {
      return createTmdbDetails({
        id: 252000,
        name: '坟场回路',
        original_name: 'Down Cemetery Road',
        first_air_date: '2025-10-29',
        genres: [{ name: '剧情' }],
        overview: 'A missing child case.',
        vote_average: 6.9,
        alternative_titles: { results: [{ iso_3166_1: 'CN', title: '坟场回路' }] },
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  await useStudioStore.getState().searchTmdbManual('Down Cemetery Road XXX', 'tv', '');
  assert.ok(calls.some(url => url.includes('query=Down%20Cemetery%20Road%20XXX')), 'Manual search should try the user query first.');
  assert.ok(calls.some(url => url.includes('query=Down%20Cemetery%20Road')), 'Manual search should fall back to the clean title.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, 252000, 'Manual fallback should keep the TMDB candidate.');

  await useStudioStore.getState().searchTmdb('Down Cemetery Road XXX S01E03', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '坟场回路', 'Automatic TMDB fallback should select the recovered TV candidate.');
  assert.ok(useStudioStore.getState().tmdbBackdrop?.startsWith('https://image.tmdb.org/t/p/w1280/'), 'Automatic TMDB fallback should keep a usable backdrop.');
}

{
  resetStoreForTmdb();
  useStudioStore.setState({
    tmdbData: {
      title: '已有片源',
      originalTitle: 'Existing Title',
      year: '2025',
      genres: ['剧情'],
      posterUrl: null,
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/existing.jpg',
      overview: 'Existing metadata',
      voteAverage: 8,
      isAnime: false,
    },
    tmdbBackdrop: 'https://image.tmdb.org/t/p/w1280/existing.jpg',
  });

  global.fetch = async () => createTmdbSearchResult(null);
  await useStudioStore.getState().searchTmdb('No Match Title S01E01', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '已有片源', 'Failed automatic search must not clear existing TMDB metadata.');
  assert.equal(useStudioStore.getState().tmdbBackdrop, 'https://image.tmdb.org/t/p/w1280/existing.jpg', 'Failed automatic search must not clear existing backdrop.');
}

console.log('Core subtitle regression checks passed.');
