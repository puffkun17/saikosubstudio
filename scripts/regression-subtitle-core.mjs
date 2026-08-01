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
  'src/utils/mediaIdentity.ts',
  'src/utils/tmdbCandidateFit.ts',
  'src/utils/releaseNamingRules.ts',
  'src/utils/importSafety.ts',
  'src/utils/timeline/alignmentDiff.ts',
  'src/utils/timeline/offsetDiagnosis.ts',
  'src/utils/timeline/timecode.ts',
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
  classifyAuxiliaryCue,
  CUE_MATCH_POLICY,
  smartDetectTitle,
  detectLanguageByContent,
  detectLanguageByFilename,
  detectSubtitleLanguage,
  detectSubtitleLanguagePair,
  isMainPathSecondaryLanguage,
  mainPathPrimaryRank,
  isSdhOrCcSubtitleFilename,
  mainPathSecondaryRank,
  appendCreatorCredit,
  extractStylesFromAss,
  extractSubtitleAttributions,
  generateAssContent,
  generateSrtContent,
  applyAuxiliarySubtitleMode,
  isSubtitleCreditText,
  mergeSubtitles,
  normalizeSingleBilingualRows,
  parseMediaFilename,
  parseSubtitle,
  splitSingleBilingualText,
} = require(join(outDir, 'utils/subtitleCore.js'));
const { analyzeAlignmentDiff } = require(join(outDir, 'utils/timeline/alignmentDiff.js'));
const { useStudioStore } = require(join(outDir, 'store/useStudioStore.js'));
const { CLIENT_IMPORT_LIMITS, getClientFileIssue } = require(join(outDir, 'utils/importSafety.js'));
const { assessTvYearFit, shouldDemoteBySeasonSpan } = require(join(outDir, 'utils/tmdbCandidateFit.js'));

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
  const zh = '新攻壳机动队.The.Ghost.in.the.Shell.S01E02.简中.srt';
  const tw = '新攻壳机动队.The.Ghost.in.the.Shell.S01E02.繁中.srt';
  const en = '新攻壳机动队.The.Ghost.in.the.Shell.S01E02.eng.srt';
  assert.equal(detectLanguageByFilename(zh), 'zh-CN');
  assert.equal(detectLanguageByFilename(tw), 'zh-TW');
  assert.equal(detectLanguageByFilename(en), 'en');
  assert.equal(cleanFilename(zh), '新攻壳机动队 The Ghost in the Shell');
  assert.equal(cleanFilename(tw), '新攻壳机动队 The Ghost in the Shell');
  assert.equal(cleanFilename(en), '新攻壳机动队 The Ghost in the Shell');
  assert.equal(parseMediaFilename(zh).title, '新攻壳机动队 The Ghost in the Shell');
  assert.equal(parseMediaFilename(tw).title, '新攻壳机动队 The Ghost in the Shell');
  assert.equal(assessMediaIdentity(zh).title, '新攻壳机动队 The Ghost in the Shell');
  const queries = buildTmdbSearchQueries(zh, 8);
  assertIncludes(queries, '新攻壳机动队 The Ghost in the Shell', 'Mixed CN/EN TV pack titles should keep a clean search seed.');
  assertIncludes(queries, 'The Ghost in the Shell', 'Latin title alone should be searchable for mixed filenames.');
  assertIncludes(queries, '新攻壳机动队', 'Chinese title alone should be searchable for mixed filenames.');
  assert.equal(
    cleanFilename(zh),
    cleanFilename(en),
    'Language-tagged sibling tracks in one episode pack must share the same task base title.',
  );
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
  assert.equal(parsed.year, undefined, 'Episode filenames without a release year should not invent one.');
  assert.deepEqual(buildTmdbSearchQueries(sample, 8), ['Alien Earth']);
}

{
  const sample = 'Lucky.2026.S01E01.1080p.WEB.h264-ETHEL.简体中文.ass';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'Lucky', 'Scene TV titles should keep the series name.');
  assert.equal(parsed.year, '2026', 'Title.Year.SxxExx must retain the release/premiere year for TV.');
  assert.equal(parsed.episodeKey, 'S01E01');
  assert.equal(parsed.mediaHint, 'tv');
  assert.equal(cleanFilename(sample), 'Lucky', 'TV cleanFilename stays title-only; year is carried via parsed.year.');
}

{
  const sample = 'Blade.Runner.2049.S01E01.1080p.WEB.ass';
  const parsed = parseMediaFilename(sample);
  assert.equal(parsed.title, 'Blade Runner 2049', 'Numeric title suffixes must not be mistaken for release years on TV.');
  assert.equal(parsed.year, undefined);
  assert.equal(parsed.episodeKey, 'S01E01');
}

{
  // Prefer strong identity titles over noisy common-token joins from mismatched release names.
  assert.equal(
    smartDetectTitle(
      'The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt',
      'The.Battle.of.Algiers.1966.REMASTERED.CUSTOM.MULTi.VFF.1080p.BluRay.srt',
    ).toLowerCase(),
    'the battle of algiers 1966',
  );
  assert.equal(
    smartDetectTitle(
      'Movie.Sample.2024.en.srt',
      'Movie.Sample.2024.zh-CN.srt',
    ),
    'Movie Sample 2024',
  );
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
  const beforeEnd = appendCreatorCredit([
    { index: 1, ts: '00:01:00,000 --> 00:01:10,000', text: 'The end.' },
  ], 'Nexus Studio', 'before-end');
  assert.equal(beforeEnd[1].ts, '00:01:05,000 --> 00:01:10,000', 'before-end placement should sit in the final seconds.');
  const ass = generateAssContent(withCredit, { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#000000', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20 });
  assert.match(ass, /Style: Credit,/, 'ASS export should include a dedicated centered credit style.');
  assert.match(ass, /Dialogue: 0,0:01:03\.50,0:01:08\.50,Credit,/, 'Creator credit should use the dedicated ASS style.');
}

{
  const rows = [{ index: 1, ts: '00:01:00,000 --> 00:01:02,000', text: 'Hello' }];
  const assWithMeta = generateAssContent(rows, { zhFontSize: 20, enFontSize: 12, zhColor: '#FFFFFF', enColor: '#B0B0B0', zhOutline: '#000000', enOutline: '#000000', enScale: 90, maxLenZh: 20, maxLenEn: 80, marginV: 20 }, 'Demo', {
    originalScript: 'Nexus Studio',
    comments: ['声明：原创字幕', '来源：官方字幕'],
    updateDetails: '声明：原创字幕；来源：官方字幕',
  });
  assert.match(assWithMeta, /Original Script: Nexus Studio/, 'ASS Script Info should carry Original Script.');
  assert.match(assWithMeta, /Comment: 声明：原创字幕/, 'ASS Script Info should carry declaration comments.');
  assert.match(assWithMeta, /Update Details: 声明：原创字幕；来源：官方字幕/, 'ASS Script Info should carry Update Details.');
}

{
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:03,000', text: '{\\an8}画面文字', cueKind: 'screen_text' },
    { index: 2, ts: '00:00:04,000 --> 00:00:06,000', text: 'Sing along', type: 'lyrics' },
  ];
  const srt = generateSrtContent(rows, { lyricItalic: true });
  assert.doesNotMatch(srt, /\{\\an\d\}/, 'SRT export must not leak ASS-only positioning overrides.');
  assert.match(srt, /<i>Sing along<\/i>/, 'Portable SRT italics should remain available for lyrics.');

  const ass = generateAssContent(rows, {
    zhFontSize: 20,
    enFontSize: 12,
    zhColor: '#FFFFFF',
    enColor: '#DDEEFF',
    zhOutline: '#112233',
    enOutline: '#445566',
    enScale: 90,
    maxLenZh: 20,
    maxLenEn: 80,
    marginV: 20,
    zhFontFamily: '"Source Han Sans SC", sans-serif',
    enFontFamily: 'Inter, sans-serif',
  }, 'Safe\nTitle');
  assert.match(ass, /Title: Safe Title/, 'ASS title must remain on one header line.');
  assert.match(ass, /Style: Han,Source Han Sans SC,/, 'ASS export should honor the selected Chinese font face.');
  assert.match(ass, /Style: EN,Inter,/, 'ASS export should honor the selected secondary-language font face.');
  assert.match(ass, /Style: EN,[^\n]*&H00665544/, 'ASS export should honor the selected secondary outline color.');
}

{
  const imported = extractStylesFromAss('[Script Info]\r\nPlayResX: 1920\r\nPlayResY: 1080\r\n\r\n[V4+ Styles]\r\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\r\nStyle: Han,Source Han Sans SC,75,&H00FFFFFF,&H00000000,&H00332211,&H00000000,1,0,0,0,100,100,0,0,1,4,1,2,20,20,75,1\r\nStyle: EN,Inter,45,&H00FFEEDD,&H00000000,&H00665544,&H00000000,1,0,0,0,100,100,0,0,1,3,1,2,20,20,45,1\r\n\r\n[Events]\r\n');
  assert.equal(imported?.zhFontFamily, 'Source Han Sans SC', 'CRLF ASS files should expose the Chinese font.');
  assert.equal(imported?.enFontFamily, 'Inter', 'A dedicated secondary style should be imported independently.');
  assert.equal(imported?.zhFontSize, 20, 'ASS font sizes should scale from PlayResY instead of a fixed 1080p divisor.');
  assert.equal(imported?.enFontSize, 12);
  assert.equal(imported?.enColor, '#DDEEFF');
  assert.equal(imported?.enOutline, '#445566');
}

{
  const initialStyle = useStudioStore.getState().customStyle;
  useStudioStore.getState().setTheaterAspect('2.39:1');
  assert.equal(useStudioStore.getState().customStyle.aspectRatio, '2.39:1', 'Theater aspect changes should also update the exported ASS canvas.');
  useStudioStore.setState({ customStyle: initialStyle, theaterAspect: '16:9' });

  const bilingualFile = {
    id: 'bilingual-regression',
    name: 'sample.zh-en.srt',
    text: '1\n00:00:01,000 --> 00:00:03,000\n你好\nHello\n',
    lang: 'bilingual',
    isBilingual: true,
    isCommentary: false,
    size: 64,
  };
  useStudioStore.setState({
    files: { zh: bilingualFile, en: null, commentary: null },
    selectedTaskId: 'bilingual-task',
    tasks: [{
      id: 'bilingual-task',
      title: 'Sample',
      zh: bilingualFile,
      en: null,
      commentary: null,
      status: 'paired',
      isBilingualSingle: true,
      files: [bilingualFile],
    }],
  });
  useStudioStore.getState().runSubtitleMerge();
  assert.ok(useStudioStore.getState().processedSubs?.length, 'Native bilingual subtitles should enter the workbench.');
  assert.equal(
    useStudioStore.getState().processedSubs?.some(row => /SubStudioX|双语合并：/.test(row.text)),
    false,
    'Core processing must not insert an unsolicited signature cue.',
  );
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
  const logs = [];
  const primary = Array.from({ length: 2001 }, (_, index) => ({
    ts: `00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')},000 --> 00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')},700`,
    text: `字幕 ${index + 1}`,
  }));
  const secondary = [
    { ts: '00:00:00,050 --> 00:00:00,750', text: 'Line one' },
    { ts: '00:00:01,050 --> 00:00:01,750', text: 'Line two' },
  ];
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], message => logs.push(message));
  assert.ok(aligned.length >= primary.length, 'A long primary track should retain every cue during industrial alignment.');
  assert.equal(logs.some(message => /低内存快速合并/.test(message)), false, 'Line count alone should not force a low-quality fallback when the alignment matrix is small.');
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
  assert.equal(classifySubtitleCue('字幕翻译：凌武翎').kind, 'credit', 'Official translator credit must not be screen_text.');
  assert.equal(classifySubtitleCue('翻译：某人').kind, 'credit');
  assert.equal(classifySubtitleCue('字幕制作：Saiko').kind, 'credit');
  assert.equal(classifySubtitleCue('（机密）').kind, 'screen_text', 'Bracket confidential remains on-screen text.');
  assert.equal(isSubtitleCreditText('字幕翻译：凌武翎'), true);
  assert.equal(isSubtitleCreditText('下一集'), false);

  const smartGone = applyAuxiliarySubtitleMode(
    [{ index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '字幕翻译：凌武翎', type: 'credit', cueKind: 'credit' }],
    'smart',
  );
  assert.equal(smartGone.length, 0, 'Smart mode should strip subtitle credits by default.');
}

{
  const aligned = alignSubtitlesIndustrial(
    [
      { ts: '00:00:58,060 --> 00:01:01,900', text: '讓我準時上教堂' },
      { ts: '00:01:01,980 --> 00:01:04,610', text: '準時上教堂 - 讓我害怕' },
    ],
    [
      { ts: '00:00:58,060 --> 00:01:01,900', text: '♪ Gets me to the church on time ♪' },
      { ts: '00:01:01,980 --> 00:01:04,610', text: '♪ Church on time ♪ - ♪ Terrifies me ♪' },
    ],
    [],
    noopLog,
  );
  assert.equal(aligned.length, 2, 'Lyric source + translation with matching times must merge into bilingual rows.');
  assert.equal(aligned[0].type, 'lyrics');
  assert.equal(aligned[0].cueKind, 'lyrics');
  assert.equal(
    aligned[0].text,
    '讓我準時上教堂\n♪ Gets me to the church on time ♪',
    'Merged lyric rows keep translation above source.',
  );
  assert.equal(aligned[1].type, 'lyrics');
  assert.equal(
    aligned[1].text,
    '準時上教堂 - 讓我害怕\n♪ Church on time ♪ - ♪ Terrifies me ♪',
    'Hyphenated lyric phrases must not expand as two-speaker dialogue.',
  );
  assert.equal(aligned[1].alignment, undefined, 'Lyric hyphen lines must not be marked expanded-dialogue.');

  const fast = mergeSubtitles(
    [{ ts: '00:00:58,060 --> 00:01:01,900', text: '讓我準時上教堂' }],
    [{ ts: '00:00:58,060 --> 00:01:01,900', text: '♪ Gets me to the church on time ♪' }],
    [],
    noopLog,
  );
  assert.equal(fast.length, 1);
  assert.equal(fast[0].type, 'lyrics');
  assert.equal(fast[0].cueKind, 'lyrics');
  assert.equal(fast[0].text, '讓我準時上教堂\n♪ Gets me to the church on time ♪');

  const smartKept = applyAuxiliarySubtitleMode(fast, 'smart');
  assert.equal(smartKept.length, 1, 'Smart auxiliary mode must keep merged lyric rows even when EN side is music-tagged.');
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
  // Path after the packed match may insert an unpaired ZH cue before the second EN turn.
  // Expansion must still use array adjacency rather than requiring a contiguous path pair.
  const aligned = alignSubtitlesIndustrial(
    [
      { ts: '01:03:43,988 --> 01:03:47,574', text: '-这是你所期望走的路吗?-正是' },
      { ts: '01:03:45,200 --> 01:03:45,600', text: '插入旁白' },
    ],
    [
      { ts: '01:03:44,533 --> 01:03:47,077', text: 'Alors Mathieu, ça se passe\ncomme vous voulez ?' },
      { ts: '01:03:47,411 --> 01:03:48,329', text: "Je l'espère." },
    ],
    [],
    noopLog,
  );
  assert.equal(
    aligned.filter(row => row.alignment === 'expanded-dialogue').length,
    2,
    'Packed dialogue must expand even when an unpaired cue sits between path steps.',
  );
  assert.ok(aligned.some(row => row.text === '插入旁白'), 'The intervening unpaired cue must remain on the timeline.');
}

const makeRegressionTs = (startMs) => {
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  const format = (value) => {
    const h = Math.floor(value / 3600000);
    const m = Math.floor((value % 3600000) / 60000);
    const s = Math.floor((value % 60000) / 1000);
    const ms = value % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };
  return `${format(startMs)} --> ${format(startMs + 900)}`;
};

{
  const primary = Array.from({ length: 3000 }, (_, index) => ({
    ts: makeRegressionTs(index * 1000),
    text: `中文 ${index}`,
  }));
  const secondary = Array.from({ length: 3000 }, (_, index) => ({
    ts: makeRegressionTs(index * 1000 + 40),
    text: `English ${index}`,
  }));
  assert.ok(primary.length * secondary.length > CUE_MATCH_POLICY.maxAlignmentCells, 'Banded fixture must exceed the shared matrix limit.');
  let fallback = null;
  const logs = [];
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], message => logs.push(message), {
    onFallback: (info) => { fallback = info; },
  });
  assert.ok(fallback, 'Oversized alignment matrices must surface an onFallback signal.');
  assert.equal(fallback.reason, 'banded', 'Typical film-length tracks should stay in industrial mode via banded DP.');
  assert.ok(typeof fallback.bandHalfWidth === 'number' && fallback.bandHalfWidth >= CUE_MATCH_POLICY.minBandHalfWidth);
  assert.ok(logs.some(message => /带状 DP/.test(message)), 'Banded mode should be logged explicitly.');
  assert.equal(logs.some(message => /低内存快速合并/.test(message)), false, 'Banded mode must not fall through to low-memory merge for 3k×3k tracks.');
  assert.ok(aligned.filter(row => row.type === 'merged').length >= 2900, 'Banded industrial align should still pair nearly all in-sync cues.');
}

{
  // Extreme cue counts: minimum band fill still exceeds budget → true low-memory fallback.
  // M * (2*minBandHalfWidth+1) > maxAlignmentCells  ⇒  M > ~82k
  const extremeCount = 90_000;
  const primary = Array.from({ length: extremeCount }, (_, index) => ({
    ts: makeRegressionTs(index * 40),
    text: `中文 ${index}`,
  }));
  const secondary = Array.from({ length: extremeCount }, (_, index) => ({
    ts: makeRegressionTs(index * 40 + 10),
    text: `English ${index}`,
  }));
  let fallback = null;
  const logs = [];
  alignSubtitlesIndustrial(primary, secondary, [], message => logs.push(message), {
    onFallback: (info) => { fallback = info; },
  });
  assert.equal(fallback?.reason, 'matrix_too_large', 'Pathological track sizes should still escape to fast merge.');
  assert.ok(logs.some(message => /低内存快速合并/.test(message)));
}

{
  const primary = Array.from({ length: 30 }, (_, index) => ({
    ts: makeRegressionTs(10_000 + index * 2200),
    text: `中文 ${index + 1}`,
  }));
  const secondary = Array.from({ length: 30 }, (_, index) => ({
    ts: makeRegressionTs(14_000 + index * 2200),
    text: `Line ${index + 1}`,
  }));
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], noopLog);
  assert.equal(aligned.length, 30, 'Stable whole-track offset should not explode into single-track rows.');
  assert.equal(aligned[0].alignment, 'shifted-match');
  assert.equal(aligned[0].provenance?.method, 'shifted-match');
  assert.equal(aligned[0].provenance?.offsetMs, 4000);
  assert.equal(aligned[0].ts, primary[0].ts, 'Shifted merge should keep the corrected primary timeline.');
}

{
  const primary = Array.from({ length: 30 }, (_, index) => ({
    ts: makeRegressionTs(10_000 + index * 2200),
    text: `中文 ${index + 1}`,
  }));
  const secondary = Array.from({ length: 30 }, (_, index) => ({
    ts: makeRegressionTs(10_000 + index * 2200 + (index < 15 ? 3500 : 9000)),
    text: `Line ${index + 1}`,
  }));
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], noopLog);
  assert.equal(aligned.some(row => row.alignment === 'shifted-match'), false, 'Unstable segmented drift should not be auto-applied as a global shift.');
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
  assert.equal(summary.shiftedMatchCount, 0);
  assert.equal(summary.entries[1].kind, 'single-track');
  assert.deepEqual(summary.entries[1].rowIndexes, [3, 4], 'Continuous single-track cues should be grouped for review.');
  assert.equal(summary.entries[0].provenance[0].primary?.text, '-你好吗？-很好。', 'The diff view should retain source text for expanded dialogue review.');
}

{
  const summary = analyzeAlignmentDiff([
    {
      index: 1,
      ts: '00:10:00,000 --> 00:10:02,000',
      text: '你好\nHello',
      type: 'merged',
      alignment: 'shifted-match',
      provenance: {
        method: 'shifted-match',
        timingSource: 'primary',
        confidence: 0.9,
        offsetMs: 4000,
        primary: { cueIndex: 1, ts: '00:10:00,000 --> 00:10:02,000', text: '你好' },
        secondary: { cueIndex: 1, ts: '00:10:04,000 --> 00:10:06,000', text: 'Hello' },
      },
    },
    {
      index: 2,
      ts: '00:10:03,000 --> 00:10:05,000',
      text: '再见\nBye',
      type: 'merged',
      alignment: 'shifted-match',
      provenance: {
        method: 'shifted-match',
        timingSource: 'primary',
        confidence: 0.9,
        offsetMs: 4000,
        primary: { cueIndex: 2, ts: '00:10:03,000 --> 00:10:05,000', text: '再见' },
        secondary: { cueIndex: 2, ts: '00:10:07,000 --> 00:10:09,000', text: 'Bye' },
      },
    },
  ]);
  assert.equal(summary.shiftedMatchCount, 2);
  assert.equal(summary.directPairCount, 0, 'Shifted pairs must not be counted as ordinary direct pairs.');
  assert.equal(summary.entries.length, 1, 'Consecutive shifted pairs with the same offset should group for review.');
  assert.equal(summary.entries[0].kind, 'shifted-match');
  assert.match(summary.entries[0].detail, /\+4000ms/);
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
  assert.equal(checkIsBilingual(chineseJapaneseSrt), true, 'Structural zh/ja timing pairs may still fold; main-path detect demotes them.');
  const rows = normalizeSingleBilingualRows(parseSubtitle(chineseJapaneseSrt));
  assert.equal(rows.length, 2, 'Chinese/Japanese same-time cues should fold into one timeline row.');
  assert.equal(detectSubtitleLanguagePair(chineseJapaneseSrt), undefined, 'Japanese must not enter main-path secondary.');
  assert.deepEqual(
    detectSubtitleLanguage('Movie.CHS.JPN.srt', chineseJapaneseSrt),
    { lang: 'zh-CN', isBilingual: false },
    'zh+ja content must demote out of bilingual main path.',
  );
}

{
  const chineseKoreanSrt = `1
00:00:01,000 --> 00:00:03,000
你还好吗？

2
00:00:01,000 --> 00:00:03,000
괜찮아요?`;
  assert.equal(detectLanguageByContent('괜찮아요?'), 'ko');
  assert.equal(checkIsBilingual(chineseKoreanSrt), true, 'Structural zh/ko timing pairs may still fold; main-path detect demotes them.');
  assert.equal(detectSubtitleLanguagePair(chineseKoreanSrt), undefined, 'Korean must not enter main-path secondary.');
  assert.equal(detectSubtitleLanguage('Movie.CHS.KOR.srt', chineseKoreanSrt).isBilingual, false);
}

{
  assert.equal(detectLanguageByContent('Bonjour, je suis avec vous.'), 'fr');
  assert.equal(detectLanguageByContent('Movimiento ocular detectado.'), 'es');
  assert.equal(detectLanguageByContent('Hola mundo'), 'latin');
  assert.equal(detectLanguageByFilename('Project.Hail.Mary.2026.1080p.WEBRip.x265-KONTRAST.Chinese.Traditional.srt'), 'zh-TW');
  assert.equal(detectLanguageByFilename('Project.Hail.Mary.2026.1080p.WEBRip.x265-KONTRAST.Spanish.srt'), 'es');
}

{
  const chineseSpanishSrt = `1
00:00:01,000 --> 00:00:03,000
偵測到眼球運動

2
00:00:01,000 --> 00:00:03,000
這裡偵測到眼球運動

3
00:00:01,000 --> 00:00:03,000
Movimiento ocular detectado.`;
  assert.equal(checkIsBilingual(chineseSpanishSrt), true, 'Structural zh/es timing pairs may still fold; main-path detect demotes them.');
  assert.equal(
    detectSubtitleLanguagePair(chineseSpanishSrt, 'Project.Hail.Mary.2026.Chinese.Traditional.Spanish.srt'),
    undefined,
    'Spanish must not enter main-path secondary.',
  );
  assert.deepEqual(
    detectSubtitleLanguage('Project.Hail.Mary.2026.Chinese.Traditional.Spanish.srt', chineseSpanishSrt),
    { lang: 'zh-TW', isBilingual: false },
    'zh+es must demote to primary Chinese, not bilingual.',
  );
}

{
  const chineseEnglishSrt = `1
00:00:01,000 --> 00:00:03,000
欢迎回来。

2
00:00:01,000 --> 00:00:03,000
Welcome back.

3
00:00:04,000 --> 00:00:06,000
我们开始吧。

4
00:00:04,000 --> 00:00:06,000
Lets begin.`;
  assert.deepEqual(
    detectSubtitleLanguagePair(chineseEnglishSrt, 'Movie.EN&CHS.srt'),
    { primary: 'zh-CN', secondary: 'en' },
    'Short English lines must still form a main-path EN secondary pair.',
  );
  assert.deepEqual(
    detectSubtitleLanguage('Movie.EN&CHS.srt', chineseEnglishSrt),
    { lang: 'bilingual', isBilingual: true, languagePair: { primary: 'zh-CN', secondary: 'en' } },
  );
  assert.equal(isMainPathSecondaryLanguage('en'), true);
  assert.equal(isMainPathSecondaryLanguage('ja'), false);
  assert.ok(mainPathPrimaryRank('zh-CN') > mainPathPrimaryRank('zh-TW'), 'Simplified Chinese ranks above Traditional.');
}

{
  assert.equal(classifySubtitleCue('{\\an8}禁止入内').kind, 'screen_text');
  assert.equal(classifySubtitleCue('POLICE DEPARTMENT').kind, 'screen_text');
  assert.equal(classifySubtitleCue('EXIT SIGN').kind, 'screen_text');
  assert.equal(classifySubtitleCue('我们今天去吃 KFC。').kind, 'dialogue');
  assert.equal(classifySubtitleCue('（脚步声）').kind, 'sound_caption');
  assert.equal(classifySubtitleCue('[faint beeping]').kind, 'sound_caption');
  assert.equal(classifyAuxiliaryCue('[speaking alien language]').category, 'speech_context');
  // Substring traps: SIGN⊂signed/designed, TEXT⊂treatment — must stay dialogue.
  assert.equal(classifySubtitleCue('and the Minister of Defense already signed off on it.').kind, 'dialogue');
  assert.equal(classifySubtitleCue('Go over those contracts and bring them signed,').kind, 'dialogue');
  assert.equal(classifySubtitleCue("I put it together. It's designed to work with micromachines.").kind, 'dialogue');
  assert.equal(classifySubtitleCue('is currently residing in our country under the pretext of seeking medical treatment.').kind, 'dialogue');

  // Ungated ambient/speech keywords must stay ordinary dialogue — no soft spam marks.
  const phoneCue = classifySubtitleCue('and I collect the trash and you make the phone call?');
  assert.equal(phoneCue.kind, 'dialogue');
  assert.equal(phoneCue.auxiliary?.suspicion, undefined);
  assert.equal(classifyAuxiliaryCue('and I collect the trash and you make the phone call?').category, 'unknown');

  const robotCue = classifySubtitleCue("Sorry, but I'm not a robot.");
  assert.equal(robotCue.kind, 'dialogue');
  assert.equal(robotCue.auxiliary?.suspicion, undefined);

  const brainwashCue = classifySubtitleCue("At 8 a.m., you'll be at the collection of all of those brainwashing devices.");
  assert.equal(brainwashCue.kind, 'dialogue');
  assert.equal(brainwashCue.auxiliary?.suspicion, undefined, 'rain⊂brainwashing must not flag');

  // Bracket-gated high confidence still promotes structure.
  assert.equal(classifyAuxiliaryCue('[phone ringing]').category, 'ambient_sdh');
  assert.equal(classifySubtitleCue('[phone ringing]').kind, 'sound_caption');
  assert.equal(classifySubtitleCue('（电话铃声响）').kind, 'sound_caption');
  assert.equal(classifyAuxiliaryCue('（三个月后）').category, 'screen_text');
  assert.equal(classifySubtitleCue('（三个月后）').kind, 'screen_text');

  // Bracketed content without a more specific class → screen text (not review).
  assert.equal(classifyAuxiliaryCue('（机密）').category, 'screen_text');
  assert.equal(classifySubtitleCue('（机密）').kind, 'screen_text');
  assert.equal(classifySubtitleCue('（机密）').auxiliary?.suspicion, undefined);
  assert.equal(classifyAuxiliaryCue('（青心精工）').category, 'screen_text');
  // 「电话」是画面标注；「电话铃声响」才是可剥离音效。
  assert.equal(classifyAuxiliaryCue('（电话）').category, 'screen_text');
  assert.equal(classifySubtitleCue('（电话）').kind, 'screen_text');
  assert.equal(classifySubtitleCue('[phone]').kind, 'screen_text');
  assert.ok(classifySubtitleCue('（电话）').auxiliary?.reasons.includes('bracket-screen-text'));

  // EN [] pure SDH reactions (Lucky / Prada): must not fall through to screen_text.
  for (const sample of [
    '[grunts]',
    '[gasps]',
    '[panting]',
    '[thuds]',
    '[cheering]',
    '[horn honks]',
    '[clears throat]',
    '[person 1 panting]',
    '[Amari clears throat]',
    '[Miranda groans]',
    '[guests gasping]',
    '[horns honking]',
    '[laughs]',
    '[both laughing]',
    '[Lily laughing]',
    '[Andy muttering indistinctly]',
    '[crowd applauding]',
    '[stammers]',
    '[exclaims]',
    '[pages shuffling]',
    '[Lady Gaga vocalizes]',
    '[no audible dialogue]',
    '[doorbell chimes]',
  ]) {
    const aux = classifyAuxiliaryCue(sample);
    assert.equal(aux.category, 'ambient_sdh', `${sample} should be strippable ambient SDH`);
    assert.equal(aux.action, 'hide_by_default', `${sample} should hide_by_default`);
    assert.equal(classifySubtitleCue(sample).kind, 'sound_caption', `${sample} cueKind`);
  }
  // Music "… playing" stays auxiliary music, not screen_text.
  assert.equal(classifyAuxiliaryCue('[Jamiroquai "Diskokid" playing]').category, 'music');
  // Counterexamples: bare nouns / 中文画面字 keep visible.
  assert.equal(classifyAuxiliaryCue('[phone]').category, 'screen_text');
  assert.equal(classifyAuxiliaryCue('[TEXT]').category, 'screen_text');
  assert.equal(classifyAuxiliaryCue('[Someone speaks softly]').category, 'speech_context');
}

{
  const primary = [
    { ts: '00:00:01,000 --> 00:00:02,000', text: '开始', cueKind: 'dialogue' },
  ];
  const secondary = [
    { ts: '00:00:01,000 --> 00:00:02,000', text: '[faint beeping]', cueKind: 'sound_caption' },
  ];
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], noopLog);
  assert.equal(aligned.some(row => row.type === 'merged'), false, 'Ambient SDH must not be merged into a dialogue row.');
  assert.equal(aligned.some(row => row.cueKind === 'sound_caption'), true, 'Ambient SDH should be preserved as auxiliary content.');
}

{
  const primary = [
    { ts: '00:00:10,000 --> 00:00:12,000', text: '我们得走了。', cueKind: 'dialogue' },
  ];
  const secondary = [
    { ts: '00:00:10,000 --> 00:00:12,000', text: '[Rocky chirps]', cueKind: 'narration', auxiliary: classifyAuxiliaryCue('[Rocky chirps]') },
  ];
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], noopLog);
  assert.equal(aligned.some(row => row.type === 'merged'), false, 'Semantic SDH must not be merged into ordinary dialogue.');
}

{
  const primary = [
    { ts: '00:00:10,000 --> 00:00:12,000', text: '[外星语]', cueKind: 'narration', auxiliary: classifyAuxiliaryCue('[外星语]') },
  ];
  const secondary = [
    { ts: '00:00:10,000 --> 00:00:12,000', text: '[speaking alien language]', cueKind: 'narration', auxiliary: classifyAuxiliaryCue('[speaking alien language]') },
  ];
  const aligned = alignSubtitlesIndustrial(primary, secondary, [], noopLog);
  assert.equal(aligned.filter(row => row.auxiliary?.category === 'speech_context').length, 2, 'Speech-context auxiliary cues should be preserved for export-mode decisions.');
}

{
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '[faint beeping]', type: 'note', cueKind: 'sound_caption', auxiliary: classifyAuxiliaryCue('[faint beeping]') },
    { index: 2, ts: '00:00:03,000 --> 00:00:04,000', text: '[speaking alien language]', type: 'note', cueKind: 'narration', auxiliary: classifyAuxiliaryCue('[speaking alien language]') },
    { index: 3, ts: '00:00:05,000 --> 00:00:06,000', text: '你好', type: 'dialogue', cueKind: 'dialogue' },
  ];
  const smartRows = applyAuxiliarySubtitleMode(rows, 'smart');
  assert.equal(smartRows.length, 2, 'Smart auxiliary mode should hide low-value ambient SDH.');
  assert.equal(smartRows.some(row => row.text.includes('alien')), true, 'Smart auxiliary mode should keep semantic auxiliary cues.');
  assert.equal(applyAuxiliarySubtitleMode(rows, 'keep').length, 3);
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
  assert.ok(exported.includes('EXIT'), 'Screen text content should survive SRT export.');
  assert.doesNotMatch(exported, /\{\\an8\}/, 'SRT cannot portably preserve ASS positioning overrides.');
}

const resetStoreForTmdb = () => {
  useStudioStore.setState({
    tasks: [],
    selectedTaskId: null,
    tmdbData: null,
    tmdbBackdrop: null,
    tmdbBackdropList: [],
    tmdbSuggestions: [],
    tmdbAlternateSuggestion: null,
    selectedSuggestion: null,
    tmdbManualOpen: false,
    tmdbManualInput: { title: '', year: '', type: 'movie', season: '1', episode: '1' },
    isSearchingTmdb: false,
    logs: [],
    statusNotices: [],
    customFilename: '',
    filenameSource: 'unknown',
  });
};

{
  resetStoreForTmdb();
  const zhCn = {
    id: 'f-zhcn',
    name: 'Sample.Movie.2024.CHS.ass',
    text: 'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,你好世界',
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 100,
  };
  const zhTw = {
    id: 'f-zhtw',
    name: 'Sample.Movie.2024.CHT.ass',
    text: 'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,你好世界',
    lang: 'zh-TW',
    isBilingual: false,
    isCommentary: false,
    size: 200,
  };
  const en = {
    id: 'f-en',
    name: 'Sample.Movie.2024.ENG.ass',
    text: 'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello world',
    lang: 'en',
    isBilingual: false,
    isCommentary: false,
    size: 50,
  };
  const ja = {
    id: 'f-ja',
    name: 'Sample.Movie.2024.JPN.ass',
    text: 'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,こんにちは',
    lang: 'ja',
    isBilingual: false,
    isCommentary: false,
    size: 900,
  };
  useStudioStore.getState().processFiles([zhTw, zhCn, ja, en]);
  const task = useStudioStore.getState().tasks[0];
  assert.equal(task?.zh?.id, 'f-zhcn', 'Binding must prefer Simplified Chinese over Traditional.');
  assert.equal(task?.en?.id, 'f-en', 'Binding secondary must be English only.');
  assert.notEqual(task?.en?.lang, 'ja', 'Japanese must not occupy the secondary slot even if larger.');
  assert.equal(task?.status, 'paired');

  useStudioStore.getState().bindTrack(task.id, 'en', 'f-ja');
  assert.equal(useStudioStore.getState().tasks[0]?.en, null, 'Post-bind filter must demote non-English secondary selections.');
}

{
  // Stuart Fails sample: en.SDH.srt 体积大于 en.srt，不得默认绑成原文轨
  resetStoreForTmdb();
  assert.equal(isSdhOrCcSubtitleFilename('Show.S01E01.en.SDH.srt'), true);
  assert.equal(isSdhOrCcSubtitleFilename('Show.S01E01.en.CC.srt'), true);
  assert.equal(isSdhOrCcSubtitleFilename('Show.S01E01.en.srt'), false);
  assert.ok(mainPathSecondaryRank('Show.S01E01.en.srt') > mainPathSecondaryRank('Show.S01E01.en.SDH.srt'));

  const chs = {
    id: 'stuart-chs',
    name: 'Stuart.Fails.to.Save.the.Universe.S01E01.chs.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\n你好',
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 32168,
  };
  const enPlain = {
    id: 'stuart-en',
    name: 'Stuart.Fails.to.Save.the.Universe.S01E01.en.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\nHello',
    lang: 'en',
    isBilingual: false,
    isCommentary: false,
    size: 27307,
  };
  const enSdh = {
    id: 'stuart-en-sdh',
    name: 'Stuart.Fails.to.Save.the.Universe.S01E01.en.SDH.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\n[door opens]\nHello',
    lang: 'en',
    isBilingual: false,
    isCommentary: false,
    size: 41392,
  };
  const cht = {
    id: 'stuart-cht',
    name: 'Stuart.Fails.to.Save.the.Universe.S01E01.cht.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\n你好',
    lang: 'zh-TW',
    isBilingual: false,
    isCommentary: false,
    size: 31212,
  };
  useStudioStore.getState().processFiles([chs, cht, enSdh, enPlain]);
  const stuart = useStudioStore.getState().tasks[0];
  assert.equal(stuart?.zh?.id, 'stuart-chs', 'Stuart pack must prefer chs over cht.');
  assert.equal(
    stuart?.en?.id,
    'stuart-en',
    'Stuart pack must prefer plain en.srt over larger en.SDH.srt for secondary.',
  );

  resetStoreForTmdb();
  useStudioStore.getState().processFiles([chs, enSdh]);
  assert.equal(
    useStudioStore.getState().tasks[0]?.en?.id,
    'stuart-en-sdh',
    'SDH remains usable when it is the only English track.',
  );
}

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

const createTmdbSearchResult = (item) => {
  const results = item == null ? [] : Array.isArray(item) ? item : [item];
  return {
    ok: true,
    status: 200,
    json: async () => ({ page: 1, results, total_pages: results.length ? 1 : 0, total_results: results.length }),
  };
};

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
  const episodeOne = { id: 'ep1', name: 'Example.Show.2025.S01E01.zh.srt', text: '', lang: 'zh-CN', isBilingual: false, isCommentary: false, size: 10 };
  const episodeTwo = { id: 'ep2', name: 'Example.Show.2025.S01E02.zh.srt', text: '', lang: 'zh-CN', isBilingual: false, isCommentary: false, size: 10 };
  const sharedMetadata = { id: 909, title: '示例剧', originalTitle: 'Example Show', year: '2025', type: 'tv', overview: '', posterUrl: null, backdropUrl: '/example.jpg', genres: [], rating: 0, isAnime: false };
  useStudioStore.setState({
    tasks: [
      { id: 'task-1', title: 'Example Show', epKey: 'S01E01', zh: episodeOne, en: null, commentary: null, status: 'paired', files: [episodeOne], tmdbData: sharedMetadata, tmdbBackdrop: '/example.jpg', tmdbBackdropList: ['/example.jpg'] },
      { id: 'task-2', title: 'Example Show', epKey: 'S01E02', zh: episodeTwo, en: null, commentary: null, status: 'paired', files: [episodeTwo] },
    ],
  });
  useStudioStore.getState().selectTask('task-2');
  assert.equal(useStudioStore.getState().tmdbData?.id, sharedMetadata.id, 'Sibling episodes from the same title and year should reuse confirmed metadata.');
  assert.equal(useStudioStore.getState().customFilename, '示例剧.2025.S01E02', 'Reused series metadata should preserve the selected episode number.');
}

{
  resetStoreForTmdb();
  let releaseFirstSearch;
  const firstSearchGate = new Promise(resolve => { releaseFirstSearch = resolve; });
  const alpha = { id: 101, media_type: 'movie', title: 'Alpha Film', original_title: 'Alpha Film', release_date: '2020-01-01', popularity: 1 };
  const beta = { id: 202, media_type: 'movie', title: 'Beta Film', original_title: 'Beta Film', release_date: '2021-01-01', popularity: 1 };
  let delayedAlpha = true;
  global.fetch = async (url) => {
    const target = String(url);
    const query = decodeURIComponent(new URL(`http://local${target}`).searchParams.get('query') || '');
    if (query.includes('Alpha') && delayedAlpha) {
      delayedAlpha = false;
      await firstSearchGate;
    }
    return createTmdbSearchResult(query.includes('Beta') ? beta : query.includes('Alpha') ? alpha : null);
  };

  const firstSearch = useStudioStore.getState().searchTmdbManual('Alpha Film', 'movie', '2020');
  await Promise.resolve();
  const secondSearch = useStudioStore.getState().searchTmdbManual('Beta Film', 'movie', '2021');
  await secondSearch;
  releaseFirstSearch();
  await firstSearch;
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, beta.id, 'A stale TMDB response must not overwrite the latest manual search.');
}

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
  const wrongAlgiersDocumentarySuggestion = {
    id: 998877,
    media_type: 'movie',
    title: 'Marxist Poetry: The Making of The Battle of Algiers',
    original_title: 'Marxist Poetry: The Making of The Battle of Algiers',
    release_date: '2004-01-01',
    backdrop_path: '/marxist.jpg',
    poster_path: '/marxist-poster.jpg',
    popularity: 40,
  };
  const sameYearAncillarySuggestion = {
    id: 998878,
    media_type: 'movie',
    title: 'The Battle of Algiers: Behind the Scenes',
    original_title: 'The Battle of Algiers: Behind the Scenes',
    release_date: '1966-01-01',
    genre_ids: [99],
    backdrop_path: '/behind.jpg',
    poster_path: '/behind-poster.jpg',
    popularity: 60,
  };
  const sameYearContainsOnlySuggestion = {
    id: 998880,
    media_type: 'movie',
    title: 'The Battle of Algiers Revisited',
    original_title: 'The Battle of Algiers Revisited',
    release_date: '1966-01-01',
    backdrop_path: '/revisited.jpg',
    poster_path: '/revisited-poster.jpg',
    popularity: 65,
  };
  const chineseAncillarySuggestion = {
    id: 998881,
    media_type: 'movie',
    title: '阿尔及尔之战幕后纪录片',
    original_title: 'The Battle of Algiers Documentary',
    release_date: '1966-01-01',
    genre_ids: [99],
    backdrop_path: '/cn-doc.jpg',
    poster_path: '/cn-doc-poster.jpg',
    popularity: 66,
  };
  const wrongTypeSuggestion = {
    id: 998879,
    media_type: 'tv',
    name: 'The Battle of Algiers',
    original_name: 'The Battle of Algiers',
    first_air_date: '1966-01-01',
    backdrop_path: '/tv.jpg',
    poster_path: '/tv-poster.jpg',
    popularity: 70,
  };

  global.fetch = async (url) => {
    calls.push(String(url));
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie')) {
      const parsedUrl = new URL(`http://local${target}`);
      const query = decodeURIComponent(parsedUrl.searchParams.get('query') || '');
      const year = parsedUrl.searchParams.get('year');
      if (query.toLowerCase() === 'the battle of algiers' && year === '1966') return createTmdbSearchResult(algeriaSuggestion);
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

  resetStoreForTmdb();
  await useStudioStore.getState().searchTmdb('The_Battle_of_Algiers_1966_REMASTERED_CUSTOM_MULTi_VFF_1080p_BluRay.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '阿尔及尔之战', 'Remastered release filename must resolve to the 1966 feature, not a making-of documentary.');

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(wrongAlgiersDocumentarySuggestion);
    }
    throw new Error(`Weak candidate should not be auto-selected: ${target}`);
  };
  await useStudioStore.getState().searchTmdb('The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Weak title-containing but year-mismatched candidates must not be auto-applied.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, wrongAlgiersDocumentarySuggestion.id, 'Weak candidates may remain visible for manual confirmation.');

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(sameYearAncillarySuggestion);
    }
    throw new Error(`Ancillary candidate should not be auto-selected: ${target}`);
  };
  await useStudioStore.getState().searchTmdb('The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Same-year documentary or making-of candidates must still require confirmation.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, sameYearAncillarySuggestion.id, 'Ancillary candidates may remain visible for manual confirmation.');

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(sameYearContainsOnlySuggestion);
    }
    throw new Error(`Contains-only candidate should not be auto-selected: ${target}`);
  };
  await useStudioStore.getState().searchTmdb('The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Same-year title-containing candidates without exact title match must require confirmation.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, sameYearContainsOnlySuggestion.id, 'Contains-only candidates may remain visible for manual confirmation.');

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(chineseAncillarySuggestion);
    }
    throw new Error(`Chinese ancillary candidate should not be auto-selected: ${target}`);
  };
  await useStudioStore.getState().searchTmdb('阿尔及尔之战.1966.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Chinese documentary or making-of candidates must not be auto-applied in cross-language lookup.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, chineseAncillarySuggestion.id, 'Cross-language ancillary candidates may remain visible for manual confirmation.');

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult(wrongTypeSuggestion);
    }
    throw new Error(`Wrong media type should not be auto-selected: ${target}`);
  };
  await useStudioStore.getState().searchTmdb('The_Battle_Of_Algiers_1966_BluRay_Criterion_Collection_1080p_AVC.srt', { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Movie filenames must not auto-apply TV candidates.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, wrongTypeSuggestion.id, 'Wrong-type candidates may remain visible for manual confirmation.');
}

{
  assert.equal(assessTvYearFit({ userYear: '2020', itemYear: '2020', season: 5 }).match, true, 'Exact premiere year should match.');
  assert.equal(assessTvYearFit({ userYear: '2020', itemYear: '2023', season: 5 }).veto, 'veto:year-after', 'Later premiere than user year should veto.');
  assert.equal(assessTvYearFit({ userYear: '2025', itemYear: '2023', season: 5 }).veto, 'veto:season-span', 'Too-new show cannot cover S05 by user year.');
  assert.equal(assessTvYearFit({ userYear: '2025', itemYear: '2020', season: 5 }).soft, true, 'Later impression year with enough span should soft-confirm.');
  assert.equal(
    shouldDemoteBySeasonSpan({ itemYear: '2023', season: 5, referenceYear: 2026 }),
    true,
    'S05 against a 2023 premiere should demote by 2026.',
  );
  assert.equal(
    shouldDemoteBySeasonSpan({ itemYear: '2020', season: 5, referenceYear: 2026 }),
    false,
    'S05 against a 2020 premiere should remain plausible in 2026.',
  );

  const tryingWrong = {
    id: 301,
    media_type: 'tv',
    name: 'Trying',
    original_name: 'Trying',
    first_air_date: '2023-01-01',
    popularity: 90,
    vote_average: 6,
  };
  const tryingRight = {
    id: 302,
    media_type: 'tv',
    name: '尝试',
    original_name: 'Trying',
    first_air_date: '2020-05-01',
    popularity: 40,
    vote_average: 7.6,
  };
  const tryingFile = 'Trying.S05E02.1080p.WEB.h264-ETHEL.ass';

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult([tryingWrong, tryingRight]);
    }
    if (target.includes('/api/tmdb/tv/302')) {
      if (target.includes('/images') || target.includes('/season/')) return createTmdbImages();
      return createTmdbDetails({
        id: 302,
        name: '尝试',
        original_name: 'Trying',
        first_air_date: '2020-05-01',
        genres: [{ name: '喜剧' }],
        overview: 'Apple TV+ Trying',
        vote_average: 7.6,
        alternative_titles: { results: [{ iso_3166_1: 'CN', title: '尝试' }] },
      });
    }
    if (target.includes('/api/tmdb/tv/301')) {
      if (target.includes('/images') || target.includes('/season/')) return createTmdbImages();
      return createTmdbDetails({
        id: 301,
        name: 'Trying',
        original_name: 'Trying',
        first_air_date: '2023-01-01',
        genres: [{ name: '剧情' }],
        overview: 'Wrong same-title show',
        vote_average: 6,
        alternative_titles: { results: [] },
      });
    }
    throw new Error(`Unexpected fetch during Trying lucky path: ${target}`);
  };
  await useStudioStore.getState().searchTmdb(tryingFile, { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '尝试', 'Season-span demotion should auto-apply the span-plausible Trying series.');
  assert.equal(useStudioStore.getState().tmdbAlternateSuggestion?.id, 301, 'Demoted same-title candidate should remain cached for swap.');
  assert.deepEqual(
    useStudioStore.getState().tmdbSuggestions.map((item) => item.id),
    [302, 301],
    'Lucky path should keep at most two cached suggestions.',
  );

  await useStudioStore.getState().swapTmdbAlternate();
  assert.equal(useStudioStore.getState().tmdbData?.title, 'Trying', 'Not-this swap should surface the cached alternate without a new search.');
  assert.equal(useStudioStore.getState().tmdbAlternateSuggestion?.id, 302, 'Swap should park the previous selection as the new alternate.');

  resetStoreForTmdb();
  useStudioStore.setState({
    tmdbManualInput: { title: 'Trying', year: '2020', type: 'tv', season: '5', episode: '2' },
  });
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult([tryingWrong, tryingRight]);
    }
    if (target.includes('/api/tmdb/tv/302/images') || target.includes('/api/tmdb/tv/302/season/')) return createTmdbImages();
    if (target.includes('/api/tmdb/tv/302')) {
      return createTmdbDetails({
        id: 302,
        name: '尝试',
        original_name: 'Trying',
        first_air_date: '2020-05-01',
        genres: [{ name: '喜剧' }],
        overview: 'Apple TV+ Trying',
        vote_average: 7.6,
        alternative_titles: { results: [{ iso_3166_1: 'CN', title: '尝试' }] },
      });
    }
    throw new Error(`Unexpected fetch during Trying exact year: ${target}`);
  };
  await useStudioStore.getState().searchTmdb(tryingFile, { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '尝试', 'Exact premiere year 2020 should auto-apply the real Trying series.');
  assert.equal(useStudioStore.getState().tmdbData?.year, '2020', 'Exact premiere year should keep 2020 metadata.');

  resetStoreForTmdb();
  useStudioStore.setState({
    tmdbManualInput: { title: 'Trying', year: '2025', type: 'tv', season: '5', episode: '2' },
  });
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult([tryingWrong, tryingRight]);
    }
    throw new Error(`Unexpected fetch during Trying soft year: ${target}`);
  };
  await useStudioStore.getState().searchTmdb(tryingFile, { silent: true });
  assert.equal(useStudioStore.getState().tmdbData, null, 'Subjective year must not auto-apply; user confirmation required.');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, 302, 'Season-span veto should rank the 2020 Trying series first.');
  assert.ok(
    useStudioStore.getState().statusNotices.some((n) => n.title.includes('年份') || n.message.includes('确认')),
    'Soft year should ask the user to confirm the remaining series.',
  );

  resetStoreForTmdb();
  useStudioStore.setState({
    tmdbManualInput: { title: 'Trying', year: '2025', type: 'tv', season: '5', episode: '2' },
  });
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv')) {
      assert.ok(!target.includes('year='), 'TV manual search must not pass year= to TMDB API (soft year would be lost).');
      return createTmdbSearchResult([tryingWrong, tryingRight]);
    }
    throw new Error(`Unexpected fetch during Trying manual soft year: ${target}`);
  };
  await useStudioStore.getState().searchTmdbManual('Trying', 'tv', '2025');
  assert.equal(useStudioStore.getState().tmdbSuggestions[0]?.id, 302, 'Manual soft year should surface the span-plausible Trying series first.');
}

{
  // Scene TV filenames carry Title.Year.SxxExx — year must disambiguate without manual input.
  const luckyOld = {
    id: 401,
    media_type: 'tv',
    name: 'Lucky',
    original_name: 'Lucky',
    first_air_date: '2003-01-01',
    popularity: 90,
    vote_average: 9,
  };
  const luckyMid = {
    id: 402,
    media_type: 'tv',
    name: 'Lucky',
    original_name: 'Lucky',
    first_air_date: '2007-06-01',
    popularity: 70,
    vote_average: 8.3,
  };
  const luckyTarget = {
    id: 403,
    media_type: 'tv',
    name: '幸运女神',
    original_name: 'Lucky',
    first_air_date: '2026-03-01',
    popularity: 35,
    vote_average: 8,
  };
  const luckyFile = 'Lucky.2026.S01E01.1080p.WEB.h264-ETHEL.简体中文.ass';

  resetStoreForTmdb();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult([luckyOld, luckyMid, luckyTarget]);
    }
    if (target.includes('/api/tmdb/tv/403')) {
      if (target.includes('/images') || target.includes('/season/')) return createTmdbImages();
      return createTmdbDetails({
        id: 403,
        name: '幸运女神',
        original_name: 'Lucky',
        first_air_date: '2026-03-01',
        genres: [{ name: '剧情' }],
        overview: 'Lucky 2026',
        vote_average: 8,
        alternative_titles: { results: [{ iso_3166_1: 'CN', title: '幸运女神' }] },
      });
    }
    throw new Error(`Unexpected fetch during Lucky filename year: ${target}`);
  };
  await useStudioStore.getState().searchTmdb(luckyFile, { silent: true });
  assert.equal(useStudioStore.getState().tmdbData?.title, '幸运女神', 'Filename year 2026 must auto-apply the matching Lucky series without manual year.');
  assert.equal(useStudioStore.getState().tmdbData?.year, '2026');
  assert.equal(useStudioStore.getState().tmdbData?.originalTitle, 'Lucky');
  assert.equal(
    useStudioStore.getState().tmdbManualOpen,
    false,
    'Filename year should prevent the need-year manual disambiguation dialog.',
  );
  assert.equal(
    useStudioStore.getState().tmdbSuggestions[0]?.id,
    403,
    'Exact filename year should rank the 2026 Lucky series first.',
  );
}

{
  // Elite Force / Lab Rats: 查询⊂片名 的危险 contains 不得自动应用（有年+热度也不行）
  resetStoreForTmdb();
  const labRatsContains = {
    id: 70101,
    media_type: 'tv',
    name: 'Lab Rats: Elite Force',
    original_name: 'Lab Rats: Elite Force',
    first_air_date: '2016-03-02',
    popularity: 95,
    vote_average: 7.8,
  };
  const otherContains = {
    id: 70102,
    media_type: 'tv',
    name: 'S.W.A.T.: Elite Force',
    original_name: 'S.W.A.T.: Elite Force',
    first_air_date: '2018-01-01',
    popularity: 40,
    vote_average: 6.5,
  };
  const eliteFile = 'Elite.Force.S01E01.720p.HEVC.x265-MeGusta-Chs.srt';

  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/tv') || target.includes('/api/tmdb/search/multi')) {
      return createTmdbSearchResult([labRatsContains, otherContains]);
    }
    throw new Error(`Unexpected fetch in Elite Force case: ${target}`);
  };

  await useStudioStore.getState().searchTmdb(eliteFile, { silent: true });
  assert.equal(
    useStudioStore.getState().tmdbData,
    null,
    'Contains-only TV title must not auto-apply even when popular (Lab Rats: Elite Force).',
  );
  assert.equal(
    useStudioStore.getState().tmdbSuggestions[0]?.id,
    70101,
    'Popular contains candidate may still rank first for manual confirmation.',
  );
  assert.ok(
    useStudioStore.getState().statusNotices.some((n) => n.id === 'media-match'),
    'Contains-only match should surface a confirmation notice.',
  );
}

{
  // 英文对白偶发法语停用词 / 单个外来词重音，不得压过英语信号
  assert.equal(
    detectLanguageByContent('What are you doing with that? I have not seen this before.'),
    'en',
  );
  assert.equal(
    detectLanguageByContent('I am not sure what you said about the pas de deux and the queue.'),
    'en',
    'Sparse French lexicon hits must not beat stronger English signals.',
  );
  assert.equal(
    detectLanguageByContent('What are you doing with that? I have not seen this before. Café later.'),
    'en',
    'A single French loanword accent must not override English dialogue.',
  );
  assert.equal(
    detectLanguageByContent('What are you doing with that? I have not seen this before. Señor, please.'),
    'en',
    'A single Spanish mark must not override English dialogue.',
  );
}

console.log('Core subtitle regression checks passed.');
