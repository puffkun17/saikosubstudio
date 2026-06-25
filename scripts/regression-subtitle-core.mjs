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
  'src/utils/importSafety.ts',
  'src/utils/timeline/alignmentDiff.ts',
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
  assessMediaIdentity,
  buildTmdbSearchQueries,
  checkIsBilingual,
  cleanFilename,
  classifySubtitleCue,
  detectLanguageByContent,
  detectSubtitleLanguagePair,
  appendCreatorCredit,
  extractSubtitleAttributions,
  generateAssContent,
  generateSrtContent,
  mergeSubtitles,
  normalizeSingleBilingualRows,
  parseMediaFilename,
  parseSubtitle,
  splitSingleBilingualText,
} = require(join(outDir, 'utils/subtitleCore.js'));
const { analyzeAlignmentDiff } = require(join(outDir, 'utils/timeline/alignmentDiff.js'));
const { useStudioStore } = require(join(outDir, 'store/useStudioStore.js'));
const { CLIENT_IMPORT_LIMITS, getClientFileIssue } = require(join(outDir, 'utils/importSafety.js'));

const noopLog = () => {};

const assertIncludes = (items, expected, message) => {
  assert.ok(items.includes(expected), `${message}\nExpected: ${expected}\nActual: ${items.join(' | ')}`);
};

{
  const oversizedRar = { name: 'subtitle-pack.rar', size: CLIENT_IMPORT_LIMITS.maxArchiveBytes + 1 };
  assert.match(getClientFileIssue(oversizedRar), /字幕包/, 'RAR packages should follow the same local size boundary as ZIP packages.');
  const acceptable7z = { name: 'subtitle-pack.7z', size: CLIENT_IMPORT_LIMITS.maxArchiveBytes };
  assert.equal(getClientFileIssue(acceptable7z), null, 'A 7z package at the stated boundary should remain eligible for local extraction.');
}

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
  const identity = assessMediaIdentity('S04E05.srt');
  assert.equal(identity.level, 'partial', 'Episode-only filenames should ask for a title instead of searching TMDB.');
  assert.equal(identity.shouldAutoSearchTmdb, false);
}

{
  const sample = '2024.1080p.HEVC.AC3.5.1.ass';
  assert.deepEqual(buildTmdbSearchQueries(sample), [], 'Year-and-release-parameter filenames should not create noisy TMDB searches.');
  const identity = assessMediaIdentity(sample);
  assert.equal(identity.level, 'weak', 'Files without a media title should be treated as weak identity.');
  assert.equal(identity.shouldAutoSearchTmdb, false);
}

{
  const sample = 'The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'The Battle Of Algiers', 'Publisher and edition tags after a movie year should not pollute the title.');
  assert.equal(parsed.year, '1966');
  assert.ok(parsed.releaseProfile.publisher.includes('Criterion'), 'Publisher tags should be retained as release profile markers.');
  assert.ok(parsed.releaseProfile.source.includes('BluRay'), 'Source tags should be retained as release profile markers.');
  assert.equal(buildTmdbSearchQueries(sample)[0], 'The Battle Of Algiers');
}

{
  const sample = 'The_Battle_of_Algiers_1966_REMASTERED_CUSTOM_MULTi_VFF_1080p_BluRay.srt';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'The Battle of Algiers', 'Scene edition, region, and quality tags should be stripped after the movie year.');
  assert.equal(parsed.year, '1966');
  assert.ok(parsed.releaseProfile.edition.includes('REMASTERED'), 'Edition markers should survive title cleanup.');
  assert.ok(parsed.releaseProfile.region.includes('MULTi'), 'Region markers should survive title cleanup.');
  assert.ok(parsed.releaseProfile.region.includes('VFF'), 'Language-region markers should survive title cleanup.');
}

{
  const sample = 'Blade.Runner.2049.2017.2160p.UHD.BluRay.REMUX.HDR10Plus.TrueHD.Atmos.7.1-FLUX.srt';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'Blade Runner 2049', 'A numeric title suffix should survive even when later release specs are present.');
  assert.equal(parsed.year, '2017');
  assert.ok(parsed.releaseProfile.source.includes('REMUX'), 'Release profile should retain carrier/source markers.');
  assert.ok(parsed.releaseProfile.hdr.includes('HDR10Plus'), 'Release profile should retain HDR markers.');
  assert.equal(parsed.releaseProfile.group, 'FLUX');
}

{
  const sample = 'Some.Movie.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.H.264-playWEB.ass';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'Some Movie', 'Platform, source, audio, video, and release-group tags should be stripped.');
  assert.equal(parsed.year, '2024');
}

{
  const credits = extractSubtitleAttributions(`[Script Info]
Translator: Aster Lin
Timing: Northbridge
Website: subtitles.example

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`);
  assert.deepEqual(credits.map(item => [item.role, item.value]), [
    ['translator', 'Aster Lin'],
    ['timing', 'Northbridge'],
    ['website', 'subtitles.example'],
  ], 'ASS header credits should be extracted into structured attributions.');
}

{
  const withCredit = appendCreatorCredit([
    { index: 1, ts: '00:01:00,000 --> 00:01:02,000', text: 'The end.' },
  ], 'Nexus Studio');
  assert.equal(withCredit.length, 2, 'Creator credit should append a new subtitle row without mutating the source count.');
  assert.equal(withCredit[1].text, '字幕制作：Nexus Studio');
  assert.equal(withCredit[1].ts, '00:01:03,500 --> 00:01:08,500');
  assert.match(generateSrtContent(withCredit), /字幕制作：Nexus Studio/, 'Creator credit should be included in exported SRT content.');
  const ass = generateAssContent(withCredit, { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#000000', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20 });
  assert.match(ass, /Style: Credit,/, 'ASS export should include a dedicated centered credit style.');
  assert.match(ass, /Dialogue: 0,0:01:03\.50,0:01:08\.50,Credit,/, 'Creator credit should use the dedicated ASS style.');
}

{
  const identity = assessMediaIdentity('Alien_Earth_S01E02_1080p_DSNP_WEB-DL_DDP5_1_H_264_zh-CN.ass');
  assert.equal(identity.level, 'strong', 'Series title plus episode should be a strong media identity.');
  assert.equal(identity.title, 'Alien Earth');
  assert.equal(identity.episodeKey, 'S01E02');
  assert.equal(identity.shouldAutoSearchTmdb, true);
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
  const aligned = alignSubtitlesIndustrial(
    [
      { ts: '01:03:43,988 --> 01:03:47,574', text: '-这是你所期望走的路吗?-正是' },
    ],
    [
      { ts: '01:03:44,533 --> 01:03:47,077', text: 'Alors Mathieu, ça se passe\ncomme vous voulez ?' },
      { ts: '01:03:47,411 --> 01:03:48,329', text: "Je l'espère." },
    ],
    [],
    noopLog,
  );
  assert.equal(aligned.length, 2, 'A packed two-speaker cue should expand only when two counterpart cues fit its timing envelope.');
  assert.deepEqual(aligned.map(row => [row.ts, row.text, row.alignment]), [
    ['01:03:44,533 --> 01:03:47,077', '这是你所期望走的路吗?\nAlors Mathieu, ça se passe comme vous voulez ?', 'expanded-dialogue'],
    ['01:03:47,411 --> 01:03:48,329', "正是\nJe l'espère.", 'expanded-dialogue'],
  ]);
  assert.equal(aligned[0].provenance?.timingSource, 'secondary', 'Expanded dialogue should preserve which track supplies the derived timestamps.');
  assert.equal(aligned[0].provenance?.primary?.text, '-这是你所期望走的路吗?-正是', 'Expanded dialogue should keep the original packed cue for review.');
  assert.equal(aligned[1].provenance?.secondary?.cueIndex, 2, 'Each expanded row should point to its own counterpart cue.');
}

{
  const merged = mergeSubtitles(
    [{ ts: '01:03:43,988 --> 01:03:47,574', text: '-这是你所期望走的路吗?-正是' }],
    [
      { ts: '01:03:44,533 --> 01:03:47,077', text: 'Alors Mathieu, ça se passe\ncomme vous voulez ?' },
      { ts: '01:03:47,411 --> 01:03:48,329', text: "Je l'espère." },
    ],
    [],
    noopLog,
  );
  assert.deepEqual(merged.map(row => row.text), [
    '这是你所期望走的路吗?\nAlors Mathieu, ça se passe comme vous voulez ?',
    "正是\nJe l'espère.",
  ], 'Fast merge must retain the same conservative dialogue expansion as industrial alignment.');
}

{
  const aligned = alignSubtitlesIndustrial(
    [{ ts: '00:00:01,000 --> 00:00:05,000', text: '这是普通的换行\n并不是两人对话' }],
    [
      { ts: '00:00:01,100 --> 00:00:03,000', text: 'This is just a wrapped sentence.' },
      { ts: '00:00:03,200 --> 00:00:04,900', text: 'It must remain separate.' },
    ],
    [],
    noopLog,
  );
  assert.equal(aligned.some(row => row.alignment === 'expanded-dialogue'), false, 'Ordinary visual line breaks must not be mistaken for two-speaker dialogue.');
}

{
  const summary = analyzeAlignmentDiff([
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '你好\nHello', type: 'merged' },
    {
      index: 2,
      ts: '00:00:03,000 --> 00:00:04,000',
      text: '你好吗？\nHow are you?',
      type: 'merged',
      alignment: 'expanded-dialogue',
      provenance: {
        method: 'expanded-dialogue',
        timingSource: 'secondary',
        primary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:05,000', text: '-你好吗？-很好。' },
        secondary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:04,000', text: 'How are you?' },
      },
    },
    {
      index: 3,
      ts: '00:02:00,000 --> 00:02:01,000',
      text: '只有这一轨',
      type: 'dialogue',
      provenance: { method: 'single-track', timingSource: 'primary', primary: { cueIndex: 3, ts: '00:02:00,000 --> 00:02:01,000', text: '只有这一轨' } },
    },
    {
      index: 4,
      ts: '00:02:01,500 --> 00:02:02,400',
      text: '仍然只有这一轨',
      type: 'dialogue',
      provenance: { method: 'single-track', timingSource: 'primary', primary: { cueIndex: 4, ts: '00:02:01,500 --> 00:02:02,400', text: '仍然只有这一轨' } },
    },
  ]);
  assert.equal(summary.directPairCount, 1, 'Direct bilingual rows should stay out of the review queue.');
  assert.equal(summary.expandedDialogueCount, 1, 'Expanded dialogue rows should remain reviewable.');
  assert.equal(summary.singleTrackCount, 2, 'Unpaired dialogue should be surfaced without being deleted.');
  assert.equal(summary.entries[1].kind, 'single-track');
  assert.deepEqual(summary.entries[1].rowIndexes, [3, 4], 'Continuous single-track cues should be grouped for review.');
  assert.equal(summary.entries[0].provenance[0].primary?.text, '-你好吗？-很好。', 'The diff view should retain source text for expanded dialogue review.');
}

{
  const summary = analyzeAlignmentDiff([
    { index: 1, ts: '00:10:00,000 --> 00:10:01,000', text: '单轨一', type: 'dialogue' },
    { index: 2, ts: '00:10:02,000 --> 00:10:03,000', text: '配对\nPaired', type: 'merged' },
    { index: 3, ts: '00:10:04,000 --> 00:10:05,000', text: '单轨二', type: 'dialogue' },
  ]);
  assert.deepEqual(summary.entries[0].rowIndexes, [1, 3], 'Nearby single-track cues should form one review range even when direct pairs appear between them.');
}

{
  assert.equal(splitSingleBilingualText('你好 Hello world'), '你好\nHello world');
  assert.equal(splitSingleBilingualText('我们今天去吃 KFC。'), '我们今天去吃 KFC。');
  assert.equal(splitSingleBilingualText('This is fine 这很好'), '这很好\nThis is fine');
  assert.equal(splitSingleBilingualText('中文已换行\nEnglish already split'), '中文已换行\nEnglish already split');
}

{
  const separatedBilingualSrt = `1
00:00:54,000 --> 00:00:57,000
(WIND HOWLING)

2
00:00:54,000 --> 00:00:57,000
（风声响）

3
00:01:12,620 --> 00:01:16,620
(DOOR OPENS, CREAKING)

4
00:01:12,620 --> 00:01:16,620
（门开了，吱吱作响）

5
00:01:28,540 --> 00:01:30,250
What's wrong?

6
00:01:28,540 --> 00:01:30,250
怎么了？
`;
  assert.equal(checkIsBilingual(separatedBilingualSrt), true, 'Separated same-time bilingual cues should be detected as a bilingual file.');
  const rows = normalizeSingleBilingualRows(parseSubtitle(separatedBilingualSrt));
  assert.equal(rows.length, 3, 'Single bilingual files should fold adjacent same-time bilingual cues.');
  assert.equal(rows[0].text, '（风声响）\n(WIND HOWLING)');
  assert.equal(rows[1].text, '（门开了，吱吱作响）\n(DOOR OPENS, CREAKING)');
  assert.equal(rows[2].text, "怎么了？\nWhat's wrong?");
  assert.equal(rows[2].index, 3);
}

{
  assert.equal(checkIsBilingual(`1
00:00:01,000 --> 00:00:03,000
我们今天去吃 KFC。

2
00:00:04,000 --> 00:00:06,000
然后回家。
`), false, 'Incidental English words inside Chinese dialogue should not mark a file bilingual.');
}

{
  const chineseJapaneseSrt = `1
00:00:01,000 --> 00:00:03,000
欢迎回来。

2
00:00:01,000 --> 00:00:03,000
おかえりなさい。

3
00:00:04,000 --> 00:00:06,000
我们开始吧。

4
00:00:04,000 --> 00:00:06,000
始めましょう。`;
  assert.equal(detectLanguageByContent('おかえりなさい。'), 'ja');
  assert.equal(checkIsBilingual(chineseJapaneseSrt), true, 'Chinese/Japanese same-time cues should be treated as bilingual.');
  const rows = normalizeSingleBilingualRows(parseSubtitle(chineseJapaneseSrt));
  assert.equal(rows.length, 2, 'Chinese/Japanese same-time cues should fold into one timeline row.');
  assert.deepEqual(detectSubtitleLanguagePair(chineseJapaneseSrt), { primary: 'zh-CN', secondary: 'ja' });
}

{
  const chineseKoreanSrt = `1
00:00:01,000 --> 00:00:03,000
你还好吗？

2
00:00:01,000 --> 00:00:03,000
괜찮아요?`;
  assert.equal(detectLanguageByContent('괜찮아요?'), 'ko');
  assert.equal(checkIsBilingual(chineseKoreanSrt), true, 'Chinese/Korean same-time cues should be treated as bilingual.');
  assert.deepEqual(detectSubtitleLanguagePair(chineseKoreanSrt), { primary: 'zh-CN', secondary: 'ko' });
}

{
  assert.equal(detectLanguageByContent('Bonjour, je suis avec vous.'), 'fr');
  assert.equal(detectLanguageByContent('Hola mundo'), 'latin');
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
    statusNotices: [],
    customFilename: '',
    filenameSource: 'unknown',
  });
};

{
  resetStoreForTmdb();
  const weakName = '2024.1080p.HEVC.AC3.5.1.ass';
  useStudioStore.getState().processFiles([{
    id: 'weak-bilingual',
    name: weakName,
    text: `1
00:00:01,000 --> 00:00:03,000
你好
Hello`,
    lang: 'bilingual',
    isBilingual: true,
    isCommentary: false,
    size: 128,
  }]);

  const state = useStudioStore.getState();
  assert.notEqual(state.tasks[0]?.title, 'AC3', 'Weak release parameters must not become the task title.');
  assert.notEqual(state.customFilename, 'AC3', 'Weak release parameters must not become the output filename.');
  assert.equal(state.tmdbManualInput.title, '', 'Weak release parameters must not prefill the TMDB manual search box.');
}

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

{
  resetStoreForTmdb();
  const calls = [];
  const algeriaSuggestion = {
    id: 17295,
    media_type: 'movie',
    title: '阿尔及尔之战',
    original_title: 'La battaglia di Algeri',
    release_date: '1966-09-08',
    backdrop_path: '/algiers.jpg',
    poster_path: '/algiers-poster.jpg',
    popularity: 6,
  };
  const wrongBattleSuggestion = {
    id: 841755,
    media_type: 'movie',
    title: '真人快打传奇：天下之战',
    original_title: 'Mortal Kombat Legends: Battle of the Realms',
    release_date: '2021-08-30',
    backdrop_path: '/mk.jpg',
    poster_path: '/mk-poster.jpg',
    popularity: 80,
  };

  global.fetch = async (url) => {
    calls.push(String(url));
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie')) {
      const parsedUrl = new URL(`http://local${target}`);
      const query = decodeURIComponent(parsedUrl.searchParams.get('query') || '');
      const year = parsedUrl.searchParams.get('year');
      if (query === 'The Battle Of Algiers' && year === '1966') return createTmdbSearchResult(algeriaSuggestion);
      return createTmdbSearchResult(null);
    }
    if (target.includes('/api/tmdb/search/multi')) {
      const query = decodeURIComponent(new URL(`http://local${target}`).searchParams.get('query') || '');
      return createTmdbSearchResult(query === 'Battle Of' ? wrongBattleSuggestion : null);
    }
    if (target.includes('/api/tmdb/movie/17295/images')) return createTmdbImages();
    if (target.includes('/api/tmdb/movie/17295')) {
      return createTmdbDetails({
        id: 17295,
        title: '阿尔及尔之战',
        original_title: 'La battaglia di Algeri',
        release_date: '1966-09-08',
        genres: [{ name: '剧情' }],
        overview: 'A film about the Algerian War.',
        vote_average: 8.1,
        alternative_titles: { titles: [{ iso_3166_1: 'CN', title: '阿尔及尔之战' }] },
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  await useStudioStore.getState().searchTmdb('The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt', { silent: true });
  assert.ok(
    calls.some(url => url.includes('/api/tmdb/search/movie') && url.includes('query=The%20Battle%20Of%20Algiers') && url.includes('year=1966')),
    'Movie filename search should use the parsed title plus release year before loose fallback fragments.',
  );
  assert.equal(useStudioStore.getState().tmdbData?.title, '阿尔及尔之战', 'Exact movie-year match must outrank popular loose Battle candidates.');
}

console.log('Core subtitle regression checks passed.');
