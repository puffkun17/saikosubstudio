// Core subtitle regression suite — fully local (no network).
// Previously this file downloaded a pinned base script from GitHub at run time and stitched in
// regression-coverage-extra.inc.js / regression-review-queue.inc.js via a temp file
// (scripts/_reg_assembled_<pid>.mjs) that leaked whenever process.exit() skipped `finally`.
// The base (puffkun17/saikosubstudio@2dc1c63) and both includes are now vendored inline below.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  'src/utils/lineWrap.ts',
  'src/utils/exportPresets.ts',
  'src/utils/hdrPresets.ts',
  'src/utils/mediaIdentity.ts',
  'src/utils/tmdbCandidateFit.ts',
  'src/utils/tmdbSearchRank.ts',
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
  isEnglishSecondaryLanguage,
  mainPathPrimaryRank,
  isSdhOrCcSubtitleFilename,
  mainPathSecondaryRank,
  estimateSubtitleCueCount,
  isSparseSecondaryTrack,
  calculateOverlapRatio,
  isCueMostlyCoveredBy,
  isTemporalCueMatch,
  measureMergeOrphanRate,
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
const {
  createWrapReport,
} = require(join(outDir, 'utils/subtitleCore.js'));
const {
  estimateTextWidth,
  glyphWidthEm,
  splitLanguageBlocks,
  wrapSingleLine,
  wrapSubtitleBlock,
} = require(join(outDir, 'utils/lineWrap.js'));
const {
  ASS_PRESET_IDS,
  DEFAULT_EXPORT_PRESET_ID,
  SRT_ADDON_IDS,
  planExportBundle,
  EXPORT_PRESETS,
  EXPORT_PRESET_ORDER,
  buildExportFilename,
  canonicalFontFamily,
  getExportPreset,
  normalizeAssFontName,
  resolvePresetStyle,
} = require(join(outDir, 'utils/exportPresets.js'));
const { NAVY_OUTLINE_LAYOUT } = require(join(outDir, 'utils/exportPresets.js'));
const {
  HDR_LEVELS_PROVISIONAL,
  HDR_LEVEL_ORDER,
  DEFAULT_HDR_LEVEL,
  dimInlineFillTags,
  hdrFillHex,
  relativeLuminance,
} = require(join(outDir, 'utils/hdrPresets.js'));
const { decodeBuffer: decodeBufferP0 } = require(join(outDir, 'utils/textEncoding.js'));
const { BILINGUAL_SECONDARY_SHARE, isSentenceLevelLatinLine } = require(join(outDir, 'utils/subtitleCore.js'));
const { analyzeAlignmentDiff, buildMergeReviewQueue, filterMergeReviewQueue } = require(join(outDir, 'utils/timeline/alignmentDiff.js'));
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
  // '当前样式' SRT keeps a single {\an8} for top-placed text (Derek, PR #36 review); the generic preset strips it.
  assert.match(srt, /^\{\\an8\}画面文字$/m, 'Current-style SRT keeps exactly one {\\an8} on top-placed text.');
  assert.doesNotMatch(generateSrtContent(rows, { lyricItalic: true }, { profile: EXPORT_PRESETS['generic-srt'].profile }), /\{\\an\d\}/, 'Generic SRT never carries ASS-only positioning overrides.');
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
  // Time coverage may still emit coverage-merge rows, but must reuse the full CN text (never split on \\n).
  const coverageRows = aligned.filter(row => row.alignment === 'coverage-merge');
  if (coverageRows.length > 0) {
    assert.ok(
      coverageRows.every(row => row.text.includes('这是普通的换行') && row.text.includes('并不是两人对话')),
      'Coverage merge must reuse full primary text, not split visual line breaks into speakers.',
    );
  }
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
  const primary = Array.from({ length: 5000 }, (_, index) => ({
    ts: makeRegressionTs(index * 1000),
    text: `中文 ${index}`,
  }));
  const secondary = Array.from({ length: 5000 }, (_, index) => ({
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
  assert.equal(logs.some(message => /低内存快速合并/.test(message)), false, 'Banded mode must not fall through to low-memory merge for large in-sync tracks.');
  assert.ok(aligned.filter(row => row.type === 'merged').length >= 4800, 'Banded industrial align should still pair nearly all in-sync cues.');
}

{
  // Extreme cue counts: minimum band fill still exceeds budget → true low-memory fallback.
  // M * (2*minBandHalfWidth+1) > maxAlignmentCells  ⇒  M > ~165k at 16M cells
  const extremeCount = 180_000;
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
  assert.equal(isMainPathSecondaryLanguage('ja'), true, 'Japanese may occupy 原文 when English is missing/sparse.');
  assert.equal(isMainPathSecondaryLanguage('ko'), true);
  assert.equal(isMainPathSecondaryLanguage('fr'), false, 'Western false positives must stay out of auto 原文.');
  assert.equal(isEnglishSecondaryLanguage('en'), true);
  assert.equal(isEnglishSecondaryLanguage('ja'), false);
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
  // Derek (PR #36 review): the '当前样式' SRT keeps {\an8} so top-placed signs stay on top in players that honour it.
  assert.match(exported, /^\{\\an8\}EXIT$/m, 'Current-style SRT keeps {\\an8} for top-placed screen text.');
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
  assert.equal(task?.en?.id, 'f-en', 'When a real English dialogue track exists, auto-bind must prefer it over Japanese.');
  assert.notEqual(task?.en?.lang, 'ja', 'Japanese must not occupy the secondary slot when English dialogue is present.');
  assert.equal(task?.status, 'paired');

  useStudioStore.getState().bindTrack(task.id, 'en', 'f-ja');
  assert.equal(useStudioStore.getState().tasks[0]?.en?.id, 'f-ja', 'Manual 原文 bind must allow Japanese.');

  const fr = {
    id: 'f-fr',
    name: 'Sample.Movie.2024.FRA.ass',
    text: 'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Bonjour',
    lang: 'fr',
    isBilingual: false,
    isCommentary: false,
    size: 40,
  };
  useStudioStore.setState({ uploadedFiles: [...useStudioStore.getState().uploadedFiles, fr] });
  useStudioStore.getState().bindTrack(task.id, 'en', 'f-fr');
  assert.equal(useStudioStore.getState().tasks[0]?.en, null, 'French must not silent-bind into 原文; user gets a notice instead.');
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
  // Bare SDH.srt (no eng token): must be recognized as English AND demoted vs plain eng.
  assert.equal(detectLanguageByFilename('Movie.SDH.srt'), 'en', 'Bare SDH filename must not stay 待识别.');
  assert.equal(detectLanguageByFilename('SDH.srt'), 'en');
  assert.equal(isSdhOrCcSubtitleFilename('Movie.SDH.srt'), true);
  assert.ok(mainPathSecondaryRank('Movie.eng.srt', 'en') > mainPathSecondaryRank('Movie.SDH.srt', 'en'));

  assert.equal(detectLanguageByFilename('episode.zh.srt'), 'zh-CN', 'zh.srt token must resolve to Simplified Chinese.');
  assert.equal(detectLanguageByFilename('episode.en.srt'), 'en');
  assert.equal(detectLanguageByFilename('Show.S01E01.简中.srt'), 'zh-CN');
  assert.equal(detectLanguageByFilename('Show.S01E01.eng.srt'), 'en');

  resetStoreForTmdb();
  const zhHans = {
    id: 'toy-zh',
    name: 'Sample.Pack.简中.srt',
    text: Array.from({ length: 40 }, (_, i) => `${i + 1}\n00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},000 --> 00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},800\n对白${i}\n`).join('\n'),
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 40000,
  };
  const engPlain = {
    id: 'toy-eng',
    name: 'Sample.Pack.eng.srt',
    text: Array.from({ length: 42 }, (_, i) => `${i + 1}\n00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},050 --> 00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},850\nLine ${i}\n`).join('\n'),
    lang: 'en',
    isBilingual: false,
    isCommentary: false,
    size: 35000,
  };
  const sdhBare = {
    id: 'toy-sdh',
    name: 'Sample.Pack.SDH.srt',
    text: Array.from({ length: 55 }, (_, i) => `${i + 1}\n00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},000 --> 00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},900\n[door opens] Line ${i}\n`).join('\n'),
    lang: detectSubtitleLanguage('Sample.Pack.SDH.srt', 'Hello and thank you for the help.').lang,
    isBilingual: false,
    isCommentary: false,
    size: 52000,
  };
  assert.equal(sdhBare.lang, 'en', 'SDH content/filename path must classify as English.');
  useStudioStore.getState().processFiles([zhHans, sdhBare, engPlain]);
  const toyTask = useStudioStore.getState().tasks[0];
  assert.equal(toyTask?.zh?.id, 'toy-zh', 'Primary must auto-pick 简中.');
  assert.equal(toyTask?.en?.id, 'toy-eng', 'Plain eng must beat larger bare SDH for 原文.');
}

{
  // Sparse English + Korean source: auto-bind KR, not the 24-cue English screen text.
  resetStoreForTmdb();
  const makeTimed = (count, prefix, startPad = 0) => Array.from({ length: count }, (_, i) => {
    const sec = i * 2;
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${i + 1}\n00:${mm}:${ss},000 --> 00:${mm}:${ss},800\n${prefix}${i}\n`;
  }).join('\n');
  const zhMany = {
    id: 'shop-zh',
    name: 'Shop.S02E08.简中.srt',
    text: makeTimed(40, '中文'),
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 20000,
  };
  const enSparse = {
    id: 'shop-en',
    name: 'Shop.S02E08.eng.srt',
    text: makeTimed(4, 'ON SCREEN '),
    lang: 'en',
    isBilingual: false,
    isCommentary: false,
    size: 2000,
  };
  const koDialogue = {
    id: 'shop-ko',
    name: 'Shop.S02E08.kor.srt',
    text: makeTimed(36, '한국어'),
    lang: 'ko',
    isBilingual: false,
    isCommentary: false,
    size: 18000,
  };
  assert.equal(isSparseSecondaryTrack(40, 4), true);
  assert.equal(isSparseSecondaryTrack(40, 36), false);
  useStudioStore.getState().processFiles([zhMany, enSparse, koDialogue]);
  const shop = useStudioStore.getState().tasks[0];
  assert.equal(shop?.zh?.id, 'shop-zh');
  assert.equal(shop?.en?.id, 'shop-ko', 'When English is sparse vs CN, auto-bind Korean source dialogue.');
}

{
  // CN + JP only (no English): Japanese must become 原文, not bounce.
  resetStoreForTmdb();
  const zh = {
    id: 'gits-zh',
    name: 'Show.S01E07.简中.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\n你好\n',
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 10,
  };
  const ja = {
    id: 'gits-ja',
    name: 'Show.S01E07.jpn.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n',
    lang: 'ja',
    isBilingual: false,
    isCommentary: false,
    size: 12,
  };
  useStudioStore.getState().processFiles([zh, ja]);
  assert.equal(useStudioStore.getState().tasks[0]?.en?.id, 'gits-ja', 'CN+JP pack must auto-bind Japanese as 原文.');
}

{
  // Short cue fully inside long cue: containment must match (union ratio alone can be < 0.5).
  const overlap = calculateOverlapRatio(0, 10000, 3000, 4500);
  assert.ok(overlap >= 0.5, `Containment overlap should be strong, got ${overlap}`);
  assert.equal(isCueMostlyCoveredBy(0, 10000, 3000, 4500), true);
  assert.equal(isTemporalCueMatch(overlap, 3000), true, 'Containment must satisfy temporal match without loosening looseStartMs.');

  const zh = [{ ts: '00:00:01,000 --> 00:00:10,000', text: '这一整段中文' }];
  const en = [{ ts: '00:00:03,000 --> 00:00:04,500', text: 'Short English inside' }];
  const merged = mergeSubtitles(zh, en, [], noopLog);
  assert.ok(merged.some((row) => row.type === 'merged' && row.text.includes('Short English inside')), 'Short-in-long must merge.');
}

{
  // Coverage 1:N — one CN covers two EN cues (no dash packed-dialogue markers).
  const zh = [{ ts: '00:00:01,000 --> 00:00:08,000', text: '一句中文覆盖两句英文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: 'First English beat' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: 'Second English beat' },
  ];
  const merged = mergeSubtitles(zh, en, [], noopLog);
  const expanded = merged.filter((row) => row.alignment === 'coverage-merge');
  assert.equal(expanded.length, 2, 'Coverage 1:N should emit two merged rows.');
  assert.ok(expanded.every((row) => row.text.includes('一句中文覆盖两句英文')));
  assert.ok(merged.every((row) => row.type !== 'dialogue' || row.provenance?.method !== 'single-track'), 'Covered EN cues should not remain orphans.');
}

{
  // Coverage N:1 — one EN covers two CN cues (mirror of 1:N).
  const zh = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: '第一句中文' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: '第二句中文' },
  ];
  const en = [{ ts: '00:00:01,000 --> 00:00:08,000', text: 'One English span covering both' }];
  const fast = mergeSubtitles(zh, en, [], noopLog);
  const industrial = alignSubtitlesIndustrial(zh, en, [], noopLog);
  for (const [label, merged] of [['fast', fast], ['industrial', industrial]]) {
    const expanded = merged.filter((row) => row.alignment === 'coverage-merge');
    assert.equal(expanded.length, 2, `${label}: Coverage N:1 should emit two merged rows.`);
    assert.ok(expanded.every((row) => row.text.includes('One English span covering both')), `${label}: outer EN text must be reused.`);
    assert.ok(expanded.every((row) => /第一句中文|第二句中文/.test(row.text)), `${label}: each CN beat kept.`);
  }
}

{
  // Counterpart gap > 1600ms must NOT coverage-merge (avoid stitching distant beats).
  const zh = [{ ts: '00:00:01,000 --> 00:00:12,000', text: '很长的中文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,000', text: 'Early beat' },
    { ts: '00:00:08,000 --> 00:00:10,000', text: 'Late beat after big gap' },
  ];
  const merged = mergeSubtitles(zh, en, [], noopLog);
  assert.equal(
    merged.filter((row) => row.alignment === 'coverage-merge').length,
    0,
    'Large gap between covered cues must not produce coverage-merge.',
  );
}

{
  // Industrial path must also emit coverage 1:N (parity with fast merge).
  const zh = [{ ts: '00:00:01,000 --> 00:00:08,000', text: '一句中文覆盖两句英文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: 'First English beat' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: 'Second English beat' },
  ];
  const industrial = alignSubtitlesIndustrial(zh, en, [], noopLog);
  const expanded = industrial.filter((row) => row.alignment === 'coverage-merge');
  assert.equal(expanded.length, 2, 'Industrial coverage 1:N should emit two merged rows.');
  const diff = analyzeAlignmentDiff(industrial.map((row, index) => ({ ...row, index: index + 1 })));
  assert.equal(diff.coverageMergeCount, 2, 'Review summary must count coverage-merge separately.');
  assert.equal(diff.expandedDialogueCount, 0, 'Coverage rows must not inflate expanded-dialogue count.');
  assert.ok(
    expanded.every((row) => row.provenance?.method === 'coverage-merge'),
    'Industrial coverage-merge rows must expose provenance.method coverage-merge.',
  );
}

{
  // Fast merge path: coverage-merge provenance.method must match alignment (not expanded-dialogue).
  const zh = [{ ts: '00:00:01,000 --> 00:00:08,000', text: '一句中文覆盖两句英文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: 'First English beat' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: 'Second English beat' },
  ];
  const fast = mergeSubtitles(zh, en, [], noopLog);
  const coverage = fast.filter((row) => row.alignment === 'coverage-merge');
  assert.ok(coverage.length >= 2, 'Fast coverage 1:N should emit coverage-merge rows.');
  assert.ok(
    coverage.every((row) => row.provenance?.method === 'coverage-merge'),
    'Fast coverage-merge rows must expose provenance.method coverage-merge.',
  );
  assert.ok(
    coverage.every((row) => row.provenance?.method !== 'expanded-dialogue'),
    'coverage-merge must not reuse expanded-dialogue provenance.method.',
  );
}


{
  // buildMergeReviewQueue: coverage-merge + mid-film single-track must surface with reasons.
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '你好\nHello', type: 'merged' },
    {
      index: 2,
      ts: '00:00:03,000 --> 00:00:04,500',
      text: '覆盖中文\nOuter English span',
      type: 'merged',
      alignment: 'coverage-merge',
      provenance: {
        method: 'exact-match',
        timingSource: 'secondary',
        primary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:08,000', text: '覆盖中文' },
        secondary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:04,500', text: 'Outer English span' },
      },
    },
    {
      index: 3,
      ts: '00:05:00,000 --> 00:05:01,200',
      text: '片中单轨台词',
      type: 'dialogue',
      provenance: {
        method: 'single-track',
        timingSource: 'primary',
        primary: { cueIndex: 3, ts: '00:05:00,000 --> 00:05:01,200', text: '片中单轨台词' },
      },
    },
    {
      index: 4,
      ts: '00:10:00,000 --> 00:10:02,000',
      text: '平移\nShifted',
      type: 'merged',
      alignment: 'shifted-match',
      provenance: {
        method: 'shifted-match',
        timingSource: 'primary',
        confidence: 0.55,
        offsetMs: 3500,
        primary: { cueIndex: 4, ts: '00:10:00,000 --> 00:10:02,000', text: '平移' },
        secondary: { cueIndex: 4, ts: '00:10:03,500 --> 00:10:05,500', text: 'Shifted' },
      },
    },
    {
      index: 5,
      ts: '00:06:00,000 --> 00:06:01,000',
      text: '[something odd]',
      type: 'dialogue',
      auxiliary: {
        category: 'unknown',
        confidence: 38,
        action: 'keep_auxiliary',
        reasons: ['unknown-soft'],
        suspicion: {
          kind: 'needs_review',
          confidence: 40,
          reasons: ['soft-bracket'],
          detail: '括号内容分类不稳，建议人工确认',
        },
      },
    },
  ];

  const queue = buildMergeReviewQueue(rows);
  assert.ok(queue.total >= 3, 'Review queue should include coverage + single-track (+ more).');
  assert.equal(queue.counts['coverage-merge'], 1, 'coverage-merge must appear once in queue.');
  assert.equal(queue.counts['single-track'], 1, 'mid-film single-track must appear once in queue.');

  const coverage = queue.items.find((item) => item.category === 'coverage-merge');
  assert.ok(coverage, 'coverage-merge item missing');
  assert.match(coverage.reason, /覆盖|核对/, 'coverage-merge reason should ask for human check');
  assert.deepEqual(coverage.rowIndexes, [2]);

  const single = queue.items.find((item) => item.category === 'single-track');
  assert.ok(single, 'single-track item missing');
  assert.equal(single.isBoundaryCandidate, false, '00:05 mid-film orphan should not be boundary');
  assert.match(single.reason, /片中|未配对|核对/, 'single-track mid-film reason');
  assert.deepEqual(single.rowIndexes, [3]);

  const shifted = queue.items.find((item) => item.category === 'shifted-match');
  assert.ok(shifted, 'shifted-match should stay review-worthy');
  assert.equal(shifted.severity, 'review', 'low shifted confidence should be review severity');
  assert.match(shifted.reason, /偏低|抽查/, 'low-confidence shifted reason');

  const suspect = queue.items.find((item) => item.category === 'other-suspect');
  assert.ok(suspect, 'auxiliary suspicion should land in other-suspect');
  assert.match(suspect.reason, /人工|复核|存疑|确认/, 'other-suspect reason');

  const filtered = filterMergeReviewQueue(queue, 'coverage-merge');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].category, 'coverage-merge');
}

{
  // Live merge → queue: coverage N:1 rows must be queued with coverage-merge category.
  const zh = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: '第一句中文' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: '第二句中文' },
  ];
  const en = [{ ts: '00:00:01,000 --> 00:00:08,000', text: 'One English span covering both' }];
  const merged = mergeSubtitles(zh, en, [], noopLog).map((row, index) => ({ ...row, index: index + 1 }));
  const queue = buildMergeReviewQueue(merged);
  assert.ok(queue.counts['coverage-merge'] >= 2, 'Live coverage merge should enqueue coverage-merge rows');
  assert.ok(
    queue.items.some((item) => item.category === 'coverage-merge' && /覆盖|核对/.test(item.reason)),
    'Live coverage queue items need human-check reasons',
  );
}

{
  // Greedy look-ahead: one extra EN must not derail the rest.
  const zh = [
    { ts: '00:00:01,000 --> 00:00:03,000', text: '第一句' },
    { ts: '00:00:04,000 --> 00:00:06,000', text: '第二句' },
    { ts: '00:00:07,000 --> 00:00:09,000', text: '第三句' },
  ];
  const en = [
    { ts: '00:00:00,200 --> 00:00:00,800', text: 'Extra credit line' },
    { ts: '00:00:01,050 --> 00:00:03,050', text: 'First' },
    { ts: '00:00:04,050 --> 00:00:06,050', text: 'Second' },
    { ts: '00:00:07,050 --> 00:00:09,050', text: 'Third' },
  ];
  const merged = mergeSubtitles(zh, en, [], noopLog);
  assert.ok(merged.some((row) => row.text === '第一句\nFirst'));
  assert.ok(merged.some((row) => row.text === '第二句\nSecond'));
  assert.ok(merged.some((row) => row.text === '第三句\nThird'));
  assert.ok(measureMergeOrphanRate(merged) < 0.4);
}

{
  // Accent must not alone relabel English (commit 228806b4).
  assert.equal(detectLanguageByContent('Thank you for the café meeting and the hello.'), 'en');
  assert.equal(detectLanguageByContent('The señor said yes and that was that.'), 'en');
}

{
  assert.ok(estimateSubtitleCueCount('1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:04,000\nB\n') >= 2);
  const modeBefore = useStudioStore.getState().alignmentMode;
  useStudioStore.getState().processFiles([{
    id: 'keep-ingest',
    name: 'Keep.Ingest.chs.srt',
    text: '1\n00:00:01,000 --> 00:00:02,000\n你好\n',
    lang: 'zh-CN',
    isBilingual: false,
    isCommentary: false,
    size: 8,
  }]);
  const filesBefore = useStudioStore.getState().uploadedFiles.length;
  useStudioStore.getState().setAlignmentMode(modeBefore === 'standard' ? 'industrial' : 'standard');
  assert.equal(useStudioStore.getState().uploadedFiles.length, filesBefore, 'Switching 智能/精校 must not wipe imported files.');
  useStudioStore.getState().setAlignmentMode(modeBefore);
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

{
  resetStoreForTmdb();
  const bikini = {
    id: 99101,
    media_type: 'movie',
    title: 'Bikini Inception',
    original_title: 'Bikini Inception',
    release_date: '2010-01-01',
    popularity: 14,
    vote_average: 3.8,
    vote_count: 22,
  };
  const inception = {
    id: 27205,
    media_type: 'movie',
    title: '盗梦空间',
    original_title: 'Inception',
    release_date: '2010-07-16',
    popularity: 95,
    vote_average: 8.4,
    vote_count: 35000,
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/search/movie')) {
      return createTmdbSearchResult([bikini, inception]);
    }
    return createTmdbSearchResult(null);
  };
  await useStudioStore.getState().searchTmdbManual('Inception', 'movie', '');
  const top = useStudioStore.getState().tmdbSuggestions[0];
  assert.equal(top?.id, inception.id, 'Manual search for Inception must rank 盗梦空间 above Bikini Inception');
}

{
  resetStoreForTmdb();
  const suggestion = {
    id: 27205,
    media_type: 'movie',
    title: '盗梦空间',
    original_title: 'Inception',
    release_date: '2010-07-16',
    backdrop_path: '/inception.jpg',
    poster_path: '/inception-poster.jpg',
    popularity: 95,
  };
  useStudioStore.setState({
    selectedTaskId: 'task-inception',
    tasks: [{
      id: 'task-inception',
      title: '待补充片名',
      zh: { id: 'zh', name: 'zh.srt', text: '1\n00:00:01,000 --> 00:00:02,000\n你好\n', lang: 'zh-CN', isBilingual: false, isCommentary: false, size: 10 },
      en: { id: 'en', name: 'en.srt', text: '1\n00:00:01,000 --> 00:00:02,000\nHello\n', lang: 'en', isBilingual: false, isCommentary: false, size: 10 },
      commentary: null,
      status: 'paired',
      files: [],
    }],
    customFilename: '',
    filenameSource: 'unknown',
  });
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/tmdb/movie/27205/images')) return createTmdbImages();
    if (target.includes('/api/tmdb/movie/27205')) {
      return createTmdbDetails({
        id: 27205,
        title: '盗梦空间',
        original_title: 'Inception',
        release_date: '2010-07-16',
        genres: [{ name: '科幻' }],
        overview: 'A thief who steals corporate secrets.',
        vote_average: 8.4,
      });
    }
    return createTmdbSearchResult(null);
  };
  await useStudioStore.getState().selectTmdbSuggestion(suggestion);
  const state = useStudioStore.getState();
  assert.equal(state.tmdbData?.title, '盗梦空间');
  assert.equal(state.customFilename, '盗梦空间.2010', 'Applying TMDB must set export/job filename');
  assert.equal(state.tasks[0]?.title, '盗梦空间.2010', 'Applying TMDB must update task identity title');
  assert.equal(state.filenameSource, 'tmdb');
}

{
  resetStoreForTmdb();
  const storage = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)); },
      removeItem: (key) => { storage.delete(key); },
    },
  };
  useStudioStore.setState({
    selectedTaskId: 'task-merge',
    files: {
      zh: { id: 'zh', name: 'zh.srt', text: '1\n00:00:01,000 --> 00:00:02,000\n你好\n', lang: 'zh-CN', isBilingual: false, isCommentary: false, size: 10 },
      en: { id: 'en', name: 'en.srt', text: '1\n00:00:01,000 --> 00:00:02,000\nHello\n', lang: 'en', isBilingual: false, isCommentary: false, size: 10 },
      commentary: null,
    },
    tasks: [{
      id: 'task-merge',
      title: 'Demo',
      zh: { id: 'zh', name: 'zh.srt', text: '1\n00:00:01,000 --> 00:00:02,000\n你好\n', lang: 'zh-CN', isBilingual: false, isCommentary: false, size: 10 },
      en: { id: 'en', name: 'en.srt', text: '1\n00:00:01,000 --> 00:00:02,000\nHello\n', lang: 'en', isBilingual: false, isCommentary: false, size: 10 },
      commentary: null,
      status: 'paired',
      files: [],
    }],
    customFilename: 'Demo.Title',
    libraryList: [],
    alignmentMode: 'standard',
  });
  useStudioStore.getState().runSubtitleMerge();
  const lib = useStudioStore.getState().libraryList;
  assert.ok(lib.length >= 1, 'Completed merge must write a restorable archive entry');
  assert.equal(lib[0]?.name, 'Demo.Title');
  assert.ok(lib[0]?.subs?.length > 0, 'Archive entry must keep subtitle rows');
  const raw = storage.get('nexus_subtitle_library');
  assert.ok(raw && raw.includes('Demo.Title'), 'Archive must persist to localStorage');
}


// ---------------------------------------------------------------------------
// P0 correctness (2026-10-10)
// ---------------------------------------------------------------------------
const { smartLineWrap, stripAssDrawingCommands } = require(join(outDir, 'utils/subtitleCore.js'));

// P0-1b: a plain zh sentence overlapping its en line ~95% must pair (not become a note / screen text).
{
  const zh = '1\n00:00:01,000 --> 00:00:03,500\n你好，世界\n\n2\n00:00:04,000 --> 00:00:06,000\n这是测试字幕。\n\n3\n00:00:07,000 --> 00:00:09,500\n合轴需要人工复核的地方。\n';
  const en = '1\n00:00:01,000 --> 00:00:03,500\nHello, world.\n\n2\n00:00:04,100 --> 00:00:06,200\nThis is a test subtitle.\n\n3\n00:00:07,000 --> 00:00:09,500\nPlaces that need human review after merge.\n';
  const rows = alignSubtitlesIndustrial(parseSubtitle(zh), parseSubtitle(en));
  assert.equal(rows.length, 3, 'Overlap sample must produce 3 bilingual rows (no orphans)');
  assert.ok(rows.every((row) => row.type === 'merged'), 'Every overlap-sample row must be merged');
  assert.equal(rows[1].text, '这是测试字幕。\nThis is a test subtitle.');
  assert.equal(rows[1].cueKind, 'dialogue');
  // Plain sentences mentioning subtitle / text / 短信 are dialogue, not screen text.
  for (const line of ['This is a test subtitle.', 'Did you get my text?', 'Sign here, please.', '你收到我的短信了吗？', '我回忆起那天的事。']) {
    assert.equal(classifySubtitleCue(line).kind, 'dialogue', `"${line}" must stay dialogue`);
  }
  // Real markers keep working.
  assert.equal(classifySubtitleCue('[TEXT READS: CLOSED]').kind, 'screen_text');
  assert.equal(classifySubtitleCue('ON SCREEN: 1997').kind, 'screen_text');
  assert.equal(classifySubtitleCue('Sign reads: Closed').kind, 'screen_text');
  assert.equal(classifySubtitleCue('（短信）').kind, 'screen_text');
}

// P0-2: golden samples for generateAssContent / generateSrtContent.
{
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:03,000', text: '我们合作吧，这并不是你想的那样。\nLet us work together, it is not what you think.', type: 'merged', cueKind: 'dialogue' },
    { index: 2, ts: '00:00:04,000 --> 00:00:05,500', text: '（门铃响）', type: 'note', cueKind: 'sound_caption' },
    { index: 3, ts: '00:00:06,000 --> 00:00:08,000', text: '♪ 晚风轻轻吹过窗台 ♪\nThe evening breeze drifts past the window', type: 'lyrics', cueKind: 'lyrics' },
    // Real pipeline shape: mergeSubtitles / alignSubtitlesIndustrial set BOTH type and cueKind to 'credit'
    // for credit cues (the old fixture used type 'dialogue', which the pipeline never produces).
    { index: 4, ts: '00:00:09,000 --> 00:00:10,000', text: '翻译：字幕组', type: 'credit', cueKind: 'credit' },
    { index: 5, ts: '00:00:11,000 --> 00:00:12,000', text: 'EXIT', type: 'dialogue', cueKind: 'screen_text' },
    { index: 6, ts: '00:00:13,000 --> 00:00:14,000', text: '并不是这样合作的。', type: 'dialogue', cueKind: 'dialogue' },
  ];
  const style = { zhFontSize: 20, enFontSize: 12, maxLenZh: 20, maxLenEn: 40, resolution: '1080p', aspectRatio: '16:9', zhFontFamily: 'PingFang SC', enFontFamily: 'Helvetica Neue' };
  const expectedAss = [
    '[Script Info]',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'ScaledBorderAndShadow: yes',
    'ScriptType: v4.00+',
    'Title: Golden',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Han,PingFang SC,75,&H00FFFFFF,&H00FF9C41,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,6,6,2,38,38,94,1',
    'Style: EN,Helvetica Neue,45,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,4,2,38,38,56,1',
    'Style: Note,PingFang SC,68,&H00FFFFFF,&H000000FF,&H0000FBFF,&H00000000,0,0,0,0,100,100,0,0,1,6,6,8,38,38,94,1',
    'Style: Credit,PingFang SC,68,&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,6,6,5,38,38,94,1',
    'Style: Lyrics,PingFang SC,60,&H00FAE6E6,&H00000000,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,6,6,8,38,38,75,1',
    'Style: Lyrics_EN,Helvetica Neue,45,&H00FAE6E6,&H00000000,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,4,4,8,38,38,47,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:01.00,0:00:03.00,Han,,0,0,0,,我们合作吧，这并不是你想的那样。\\N{\\rEN}Let us work together, it is not what you think.',
    'Dialogue: 0,0:00:04.00,0:00:05.50,Note,,0,0,0,,{\\an8}（门铃响）',
    'Dialogue: 0,0:00:06.00,0:00:08.00,Lyrics,,0,0,0,,♪ 晚风轻轻吹过窗台 ♪\\N{\\rLyrics_EN}The evening breeze drifts past the window',
    'Dialogue: 0,0:00:09.00,0:00:10.00,Credit,,0,0,0,,翻译：字幕组',
    'Dialogue: 0,0:00:11.00,0:00:12.00,Note,,0,0,0,,{\\an8}EXIT',
    'Dialogue: 0,0:00:13.00,0:00:14.00,Han,,0,0,0,,并不是这样合作的。',
    '',
  ].join('\n');
  assert.equal(generateAssContent(rows, style, 'Golden'), expectedAss, 'ASS golden sample');
  const expectedSrt = [
    '1', '00:00:01,000 --> 00:00:03,000', '我们合作吧，这并不是你想的那样。', 'Let us work together, it is not what you think.', '',
    '2', '00:00:04,000 --> 00:00:05,500', '{\\an8}（门铃响）', '',
    '3', '00:00:06,000 --> 00:00:08,000', '<i>♪ 晚风轻轻吹过窗台 ♪', 'The evening breeze drifts past the window</i>', '',
    '4', '00:00:09,000 --> 00:00:10,000', '翻译：字幕组', '',
    '5', '00:00:11,000 --> 00:00:12,000', '{\\an8}EXIT', '',
    '6', '00:00:13,000 --> 00:00:14,000', '并不是这样合作的。', '',
  ].join('\n');
  assert.equal(generateSrtContent(rows, {}), expectedSrt, 'SRT golden sample');
}

// P0-3: ASS vector drawings are not text; Comment lines stay ignored.
{
  const ass = [
    '[Script Info]', 'PlayResX: 1920', 'PlayResY: 1080', '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Comment: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,karaoke template',
    'Dialogue: 0,0:00:01.00,0:00:02.00,Sign,,0,0,0,,{\\an7\\pos(10,10)\\p1}m 0 0 l 100 0 100 100 0 100{\\p0}',
    'Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\p1}m 0 0 l 10 0{\\p0}Hello there.',
    'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,你好，世界',
  ].join('\n');
  const parsed = parseSubtitle(ass);
  assert.deepEqual(parsed.map((row) => row.text), ['Hello there.', '你好，世界'], 'Drawing-only events dropped, drawing coords stripped');
  assert.ok(parsed.every((row) => !/\bm 0 0\b/.test(row.text)));
  assert.equal(stripAssDrawingCommands('{\\pos(1,2)}Text'), '{\\pos(1,2)}Text', '\\pos is not drawing mode');
  assert.equal(stripAssDrawingCommands('{\\p2}m 0 0 l 1 1{\\p0}A{\\p1}m 1 1{\\p0}B'), '{\\p2}{\\p0}A{\\p1}{\\p0}B');
}

// P0-4: encoding detection by score (GBK vs Big5 vs Shift-JIS vs EUC-KR, UTF-8/16).
{
  const fixtures = {
    "gbk": { encoding: "gbk", text: "1\n00:00:01,000 --> 00:00:03,000\n我们合作吧，这并不是你想的那样。\n\n2\n00:00:04,000 --> 00:00:06,000\n你好，世界！今天天气很好。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30332c3030300aced2c3c7bacfd7f7b0c9a3acd5e2b2a2b2bbcac7c4e3cfebb5c4c4c7d1f9a1a30a0a320a30303a30303a30342c303030202d2d3e2030303a30303a30362c3030300ac4e3bac3a3accac0bde7a3a1bdf1ccecccecc6f8badcbac3a1a30a' },
    "big5": { encoding: "big5", text: "1\n00:00:01,000 --> 00:00:03,000\n我愛你，這是繁體字幕。\n\n2\n00:00:04,000 --> 00:00:06,000\n你們在說什麼？我聽不懂。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30332c3030300aa7dab752a741a141b36fac4fc163c5e9a672b9f5a1430a0a320a30303a30303a30342c303030202d2d3e2030303a30303a30362c3030300aa741adcca662bba1a4b0bbf2a148a7dac5a5a4a3c0b4a1430a' },
    "shift_jis": { encoding: "shift_jis", text: "1\n00:00:01,000 --> 00:00:03,000\nこんにちは、元気ですか？\n\n2\n00:00:04,000 --> 00:00:06,000\n私は学生です。よろしくお願いします。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30332c3030300a82b182f182c982bf82cd81418cb38b4382c582b782a981480a0a320a30303a30303a30342c303030202d2d3e2030303a30303a30362c3030300a8e8482cd8a7790b682c582b7814282e682eb82b582ad82a88ae882a282b582dc82b781420a' },
    "euc-kr": { encoding: "euc-kr", text: "1\n00:00:01,000 --> 00:00:03,000\n안녕하세요, 만나서 반갑습니다.\n\n2\n00:00:04,000 --> 00:00:06,000\n우리는 친구입니다. 정말 고마워요.\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30332c3030300abec8b3e7c7cfbcbcbfe42c20b8b8b3aabcad20b9ddb0a9bdc0b4cfb4d92e0a0a320a30303a30303a30342c303030202d2d3e2030303a30303a30362c3030300abfecb8aeb4c220c4a3b1b8c0d4b4cfb4d92e20c1a4b8bb20b0edb8b6bff6bfe42e0a' },
    "big5-short": { encoding: "big5", text: "1\n00:00:01,000 --> 00:00:02,000\n謝謝你。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30322c3030300ac1c2c1c2a741a1430a' },
    "gbk-short": { encoding: "gbk", text: "1\n00:00:01,000 --> 00:00:02,000\n谢谢你。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30322c3030300ad0bbd0bbc4e3a1a30a' },
    "sjis-short": { encoding: "shift_jis", text: "1\n00:00:01,000 --> 00:00:02,000\nありがとう。\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30322c3030300a82a082e882aa82c682a481420a' },
    "euckr-short": { encoding: "euc-kr", text: "1\n00:00:01,000 --> 00:00:02,000\n감사합니다.\n", hex: '310a30303a30303a30312c303030202d2d3e2030303a30303a30322c3030300ab0a8bbe7c7d5b4cfb4d92e0a' }
  };
  for (const [name, fixture] of Object.entries(fixtures)) {
    const result = decodeBufferP0(Buffer.from(fixture.hex, 'hex'));
    assert.equal(result.encoding, fixture.encoding, `${name}: detected encoding`);
    assert.equal(result.text, fixture.text, `${name}: decoded text`);
  }
  const zhUtf8 = '1\n00:00:01,000 --> 00:00:02,000\n你好\n';
  assert.equal(decodeBufferP0(new TextEncoder().encode(zhUtf8)).encoding, 'utf-8');
  assert.equal(decodeBufferP0(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(zhUtf8)])).encoding, 'utf-8 (BOM)');
  assert.equal(decodeBufferP0(Buffer.from(zhUtf8, 'utf16le')).text, zhUtf8, 'BOM-less UTF-16LE');
  assert.equal(decodeBufferP0(Buffer.from('00:00:01,000 --> 00:00:02,000\nHi\n')).encoding, 'utf-8');
}

// P0-5: English wraps at maxLenEn (not 3x); Chinese fallback cut never splits Latin words / numbers.
{
  const en = 'This sentence is definitely longer than forty characters in total.';
  const wrapped = smartLineWrap(en, false, 40);
  assert.ok(wrapped.includes('\\N'), 'English beyond maxChars must wrap');
  assert.ok(wrapped.split('\\N').every((line) => line.length <= 40), 'Each English line within maxChars');
  assert.equal(wrapped.split('\\N').join(' '), en, 'Wrapping keeps every word');
  assert.equal(smartLineWrap('Short line.', false, 40), 'Short line.');
  for (const [line, word] of [['我昨天在商店里买了一台新的iPhone手机给妈妈', 'iPhone'], ['他们说这部电影是在2026年拍完的最后一部作品', '2026']]) {
    const out = smartLineWrap(line, true, 12);
    assert.ok(out.includes('\\N'), `${line} should wrap`);
    assert.ok(out.replace('\\N', '').includes(word) && out.split('\\N').some((part) => part.includes(word)), `${word} must not be split: ${out}`);
  }
}

// §G smart line-wrapping by rendered width (src/utils/lineWrap.ts).
{
  const px = 100; // 1 CJK glyph = 100 px
  const W = (glyphs) => glyphs * px;
  const wrap = (text, glyphs) => wrapSingleLine(text, { fontPx: px, maxWidth: W(glyphs) });
  const noSpace = (value) => value.replace(/\s+/g, '');
  const words = (value) => value.split(/\s+/).filter(Boolean);

  // Width table: CJK / full-width = 1em, Latin proportional, tags are zero width.
  assert.equal(glyphWidthEm('中'.codePointAt(0)), 1);
  assert.equal(glyphWidthEm('，'.codePointAt(0)), 1);
  assert.equal(glyphWidthEm('あ'.codePointAt(0)), 1);
  assert.equal(glyphWidthEm('한'.codePointAt(0)), 1);
  assert.ok(glyphWidthEm('i'.codePointAt(0)) < glyphWidthEm('W'.codePointAt(0)), 'Latin is proportional');
  assert.equal(estimateTextWidth('{\\an8}<i>你好</i>', px), 200, 'ASS override blocks and SRT tags have no width');
  assert.ok(estimateTextWidth('iPhone', px) < 4 * px, 'Latin word narrower than the same count of CJK glyphs');

  // Lines that fit are never touched.
  const short = wrap('我们合作吧，这并不是你想的那样。', 18);
  assert.deepEqual(short.lines, ['我们合作吧，这并不是你想的那样。']);
  assert.equal(short.changed, false);
  assert.equal(short.overflow, false);
  // Mixed: 17 characters by count, ~14.1em by width → fits in 15 glyphs.
  assert.equal(wrap('我昨天买了一台新的iPhone手机', 15).lines.length, 1, 'Latin measured by width, not char count');

  // Chinese: punctuation preferred over the exact middle; ≤2 lines; content preserved.
  const zh1 = wrap('我们合作吧，这并不是你想的那样，你明白吗我的朋友。', 18);
  assert.equal(zh1.lines.length, 2);
  assert.ok(zh1.lines[0].endsWith('，'), `break after a comma: ${zh1.lines}`);
  assert.equal(noSpace(zh1.lines.join('')), '我们合作吧，这并不是你想的那样，你明白吗我的朋友。');
  // Chinese pause space（官方字幕常用空格代替逗号 / 原字幕换行被拼成空格）is a preferred break; the space is dropped.
  assert.deepEqual(wrap('我今天早上出门的时候 发现钥匙忘在家里了', 18).lines, ['我今天早上出门的时候', '发现钥匙忘在家里了']);
  assert.deepEqual(wrap('我不知道 你在说什么 但是我会一直等你回来的', 16).lines, ['我不知道 你在说什么', '但是我会一直等你回来的']);
  // Never split Latin words / numbers inside Chinese.
  for (const [line, token] of [
    ['我昨天在商店里买了一台新的iPhone手机给妈妈当生日礼物', 'iPhone'],
    ['他们说这部电影是在2026年拍完的最后一部作品真的很可惜', '2026'],
    ['这个价格是1,234.56元，比上个月涨了不少你知道吗朋友', '1,234.56'],
  ]) {
    const out = wrap(line, 15);
    assert.equal(out.lines.length, 2, `${line} wraps`);
    assert.ok(out.lines.some((part) => part.includes(token)), `${token} must stay whole: ${out.lines}`);
  }
  // Kinsoku: no closing punctuation at line start, no opening bracket at line end.
  for (const line of [
    '「你到底在说什么？」他问道，然后转身离开了房间去找别人。',
    '他说（其实我早就知道了）这件事情根本就不是他做的吧。',
    '这真的是太好了！！我们终于成功了！！大家辛苦了！！',
    '我觉得……这样做不太好吧……你再想想看好不好……',
  ]) {
    const out = wrap(line, 15);
    for (const part of out.lines.slice(1)) assert.ok(!/^[，。！？、；：」』）】》…]/.test(part), `no forbidden line start: ${out.lines}`);
    for (const part of out.lines.slice(0, -1)) assert.ok(!/[「『（【《]$/.test(part), `no forbidden line end: ${out.lines}`);
    assert.equal(noSpace(out.lines.join('')), noSpace(line));
  }
  // No single-glyph orphan line.
  const orphanCase = wrap('我们这次一定要成功不然一切都完了啊', 16);
  assert.ok(orphanCase.lines.every((part) => [...part].length > 1), `no orphan: ${orphanCase.lines}`);
  // Balanced, pyramid-leaning.
  const balanced = wrap('这是一句没有任何标点符号但是非常非常长的中文字幕台词', 16);
  const [b1, b2] = balanced.lines.map((part) => [...part].length);
  assert.ok(Math.abs(b1 - b2) <= 2 && b1 <= b2, `balanced: ${balanced.lines}`);

  // English: clause > conjunction > plain gap; words never split; balanced; dangling article avoided.
  const enLine = 'I told you that we should have left before the storm came in, but nobody listened to me.';
  const en1 = wrapSingleLine(enLine, { fontPx: 50, maxWidth: 1460 });
  assert.equal(en1.lines.length, 2);
  assert.deepEqual(words(en1.lines.join(' ')), words(enLine), 'English words preserved');
  assert.ok(en1.lines.every((part) => estimateTextWidth(part, 50) <= 1460));
  const en2 = wrapSingleLine('We need to leave right now, before they find out where we are hiding.', { fontPx: 50, maxWidth: 1100 });
  assert.deepEqual(en2.lines, ['We need to leave right now,', 'before they find out where we are hiding.']);
  const en3 = wrapSingleLine('She said she would meet us at the old train station after the concert ends tonight.', { fontPx: 50, maxWidth: 1100 });
  assert.ok(!/\b(the|a|an|to|of|my|your)$/i.test(en3.lines[0]), `no dangling function word: ${en3.lines}`);
  const mr = wrapSingleLine('I already gave the documents to Mr. Smith yesterday afternoon at the office.', { fontPx: 50, maxWidth: 1000 });
  assert.ok(!mr.lines[0].endsWith('Mr.'), `never break after an honorific: ${mr.lines}`);

  // Long URLs / numbers are atomic: overflow is reported, never split, never a third line.
  const url = 'Go to https://www.example.com/a/very/long/url/that/never/ends/at/all/ok now';
  const urlOut = wrapSingleLine(url, { fontPx: 50, maxWidth: 900 });
  assert.ok(urlOut.lines.length <= 2);
  assert.ok(urlOut.lines.some((part) => part.includes('https://www.example.com/a/very/long/url/that/never/ends/at/all/ok')));
  assert.equal(urlOut.overflow, true);
  const zhUrl = wrap('请访问 https://example.com/very/long/path?query=1234567890 获取更多信息和下载地址', 14);
  assert.ok(zhUrl.lines.some((part) => part.includes('https://example.com/very/long/path?query=1234567890')));
  assert.equal(zhUrl.lines.length, 2);
  const digits = wrapSingleLine('Account 12345678901234567890123456789012345678901234567890', { fontPx: 50, maxWidth: 600 });
  assert.ok(digits.lines.some((part) => part === '12345678901234567890123456789012345678901234567890'));
  assert.ok(digits.overflow);
  const tooLong = wrap('这是一句真的非常非常非常非常非常非常非常非常非常非常非常非常长的台词，长到两行也放不下。', 12);
  assert.equal(tooLong.lines.length, 2, 'never more than two lines');
  assert.equal(tooLong.overflow, true, 'overflow flagged for review instead of a third line');

  // Japanese / Korean.
  const ja = wrap('これは日本語の字幕です。ちょっと長いですが、ちゃんと折り返されますか。', 22);
  assert.equal(ja.lines.length, 2);
  assert.ok(!/^[ゃゅょっー、。]/.test(ja.lines[1]), `ja kinsoku: ${ja.lines}`);
  const ko = wrap('안녕하세요 저는 학생입니다 만나서 정말 반갑습니다 오늘 날씨가 정말 좋네요', 20);
  assert.equal(ko.lines.length, 2);
  assert.deepEqual(words(ko.lines.join(' ')), words('안녕하세요 저는 학생입니다 만나서 정말 반갑습니다 오늘 날씨가 정말 좋네요'), 'Korean eojeol never split');

  // Latin languages: accents measured, NBSP before French punctuation never broken, ¿¡« stay attached.
  for (const line of [
    'No sé si vamos a llegar a tiempo, pero ¿por qué no lo intentamos de todas formas?',
    'Eu não sei se vamos chegar a tempo, mas podemos tentar mesmo assim, não é?',
    'Je ne sais pas si on arrivera à l\u2019heure, mais pourquoi ne pas essayer quand même\u00a0?',
  ]) {
    const out = wrapSingleLine(line, { fontPx: 50, maxWidth: 1100 });
    assert.equal(out.lines.length, 2, `${line} wraps`);
    assert.deepEqual(words(out.lines.join(' ')), words(line), 'Latin words never split');
    assert.ok(!/^[?!:;\u00a0]/.test(out.lines[1]), `no line starts with detached punctuation: ${out.lines}`);
    assert.ok(!/[¿¡«]$/.test(out.lines[0]), `no opening mark left dangling: ${out.lines}`);
  }

  // Inline tags stay attached and never count toward width.
  const tagged = wrapSingleLine('{\\fnArial\\fs14}I left my keys at home this morning, so I waited outside.', { fontPx: 50, maxWidth: 900 });
  assert.ok(tagged.lines[0].startsWith('{\\fnArial\\fs14}'));
  assert.equal(tagged.lines.length, 2);

  // Source line breaks: kept when they fit; re-flowed into ≤2 balanced lines when they overflow.
  assert.deepEqual(wrapSubtitleBlock(['你好', '世界'], { fontPx: px, maxWidth: W(16) }), { lines: ['你好', '世界'], changed: false, overflow: false });
  assert.deepEqual(wrapSubtitleBlock(['I know.', 'You told me.'], { fontPx: 50, maxWidth: 1400 }).lines, ['I know.', 'You told me.']);
  const reflow = wrapSubtitleBlock(['这是一个非常非常长的第一行字幕内容需要', '重新排版'], { fontPx: px, maxWidth: W(16) });
  assert.equal(reflow.lines.length, 2);
  assert.equal(reflow.lines.join(''), '这是一个非常非常长的第一行字幕内容需要重新排版', 'CJK source break joins without a space');
  const three = wrapSubtitleBlock(['So I said', 'to him, look,', 'it is fine.'], { fontPx: 50, maxWidth: 1400 });
  assert.ok(three.lines.length <= 2, '3 source lines → ≤2');
  assert.deepEqual(words(three.lines.join(' ')), words('So I said to him, look, it is fine.'));
  const dash = wrapSubtitleBlock(['- Where are you going this late at night? Tell me now.', '- Out.'], { fontPx: 50, maxWidth: 900 });
  assert.deepEqual(dash.lines, ['- Where are you going this late at night? Tell me now.', '- Out.'], 'two-speaker dash lines never merged');
  assert.equal(dash.overflow, true);

  // Language blocks of a bilingual cue keep their own source breaks.
  assert.deepEqual(splitLanguageBlocks('你好\n世界\nHello\nworld'), [['你好', '世界'], ['Hello', 'world']]);
  assert.deepEqual(splitLanguageBlocks('你好世界\n{\\fs14}Hello world'), [['你好世界'], ['{\\fs14}Hello world']]);
  assert.deepEqual(splitLanguageBlocks('Hello\nworld'), [['Hello', 'world']]);
  assert.deepEqual(splitLanguageBlocks('我们坐窗边吧\n窓際に座ろうよ。'), [['我们坐窗边吧'], ['窓際に座ろうよ。']], 'zh + ja never glued into one CJK block');
  assert.deepEqual(splitLanguageBlocks('那我们早点出发\n그럼 우리 일찍 출발하자.'), [['那我们早点出发'], ['그럼 우리 일찍 출발하자.']], 'zh + ko split by script');
  assert.deepEqual(splitLanguageBlocks('早上好\n今天天气还不错'), [['早上好', '今天天气还不错']]);
}

// P0-6: font names, ScaledBorderAndShadow, preset-driven default font.
{
  assert.equal(canonicalFontFamily('"Noto Sans SC"'), 'Noto Sans SC');
  assert.equal(canonicalFontFamily("'PingFang SC'"), 'PingFang SC');
  assert.equal(canonicalFontFamily('PingFangSC-Regular'), 'PingFang SC');
  assert.equal(canonicalFontFamily('HelveticaNeue-Bold'), 'Helvetica Neue');
  assert.equal(canonicalFontFamily('Noto Sans CJK SC Bold'), 'Noto Sans CJK SC');
  assert.equal(canonicalFontFamily('微软雅黑'), 'Microsoft YaHei');
  assert.equal(canonicalFontFamily('Times New Roman'), 'Times New Roman');
  assert.equal(canonicalFontFamily('Arial Black'), 'Arial Black');
  assert.equal(canonicalFontFamily('system-ui'), '');
  assert.equal(canonicalFontFamily('var(--font-geist)'), '');
  assert.equal(normalizeAssFontName('system-ui, sans-serif', 'PingFang SC'), 'PingFang SC');
  assert.equal(normalizeAssFontName('-apple-system, BlinkMacSystemFont, "Noto Sans SC", sans-serif', 'X'), 'Noto Sans SC', 'skip generic entries, take the first concrete family');
  assert.equal(normalizeAssFontName('"Helvetica Neue", Arial, sans-serif', 'Arial'), 'Helvetica Neue');
  assert.equal(normalizeAssFontName(undefined, 'Noto Sans CJK SC'), 'Noto Sans CJK SC');
  assert.equal(normalizeAssFontName('Evil,Name\r\nStyle: x', 'Arial'), 'Evil', 'no comma / newline injection into the Style line');

  const rows = [{ index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '你好\nHello', type: 'merged', cueKind: 'dialogue' }];
  const legacy = generateAssContent(rows, { zhFontSize: 20, enFontSize: 12, zhFontFamily: 'system-ui, sans-serif', enFontFamily: 'system-ui' });
  assert.match(legacy, /^ScaledBorderAndShadow: yes$/m);
  assert.match(legacy, /^Style: Han,PingFang SC,/m, 'legacy default zh font');
  assert.match(legacy, /^Style: EN,Arial,/m, 'legacy default en font');
  const libass = getExportPreset('libass-ass');
  const libassAss = generateAssContent(rows, resolvePresetStyle({ zhFontSize: 30, enFontSize: 20, zhFontFamily: '"Noto Sans SC"' }, libass), 'T', undefined, { profile: libass.profile });
  assert.match(libassAss, /^Style: Han,Noto Sans CJK SC,75,/m, 'libass preset fixes font + size');
  assert.match(libassAss, /^Style: EN,Arial,45,/m);
  const noFamily = generateAssContent(rows, { zhFontSize: 20, enFontSize: 12 }, 'T', undefined, { profile: libass.profile });
  assert.match(noFamily, /^Style: Han,Noto Sans CJK SC,/m, 'default font driven by preset profile');
}

// P0-7: export presets v1 + naming.
{
  assert.equal(DEFAULT_EXPORT_PRESET_ID, 'current', 'Default preset stays legacy until Derek decides (§E-4)');
  assert.deepEqual(EXPORT_PRESET_ORDER, ['current', 'plex-srt', 'libass-ass', 'navy-outline', 'generic-srt']);
  assert.equal(getExportPreset('nope').id, 'current');
  assert.deepEqual(EXPORT_PRESETS['plex-srt'].formats, ['srt']);
  assert.deepEqual(EXPORT_PRESETS['libass-ass'].formats, ['ass']);
  assert.deepEqual(EXPORT_PRESETS['generic-srt'].formats, ['srt']);
  assert.deepEqual(EXPORT_PRESETS.current.formats, ['ass', 'srt']);

  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:03,000', text: '我今天早上出门的时候 发现钥匙忘在家里了\nI left my keys at home this morning, so I waited outside for an hour.', type: 'merged', cueKind: 'dialogue' },
    { index: 2, ts: '00:00:04,000 --> 00:00:05,000', text: 'EXIT', type: 'dialogue', cueKind: 'screen_text' },
    { index: 3, ts: '00:00:06,000 --> 00:00:08,000', text: '♪ 晚风轻轻吹过窗台 ♪\n<i>The evening breeze drifts past the window</i>', type: 'lyrics', cueKind: 'lyrics' },
  ];
  // Legacy ('当前样式') SRT: no rewrap; keeps {\an8} for top-placed cues (Derek, PR #36 review).
  assert.equal(generateSrtContent(rows, {}), [
    '1', '00:00:01,000 --> 00:00:03,000', '我今天早上出门的时候 发现钥匙忘在家里了', 'I left my keys at home this morning, so I waited outside for an hour.', '',
    '2', '00:00:04,000 --> 00:00:05,000', '{\\an8}EXIT', '',
    '3', '00:00:06,000 --> 00:00:08,000', '<i>♪ 晚风轻轻吹过窗台 ♪', 'The evening breeze drifts past the window</i>', '',
  ].join('\n'));
  const report = createWrapReport();
  const plex = generateSrtContent(rows, {}, { profile: EXPORT_PRESETS['plex-srt'].profile, report });
  assert.equal(plex, [
    '1', '00:00:01,000 --> 00:00:03,000', '我今天早上出门的时候', '发现钥匙忘在家里了', 'I left my keys at home this morning,', 'so I waited outside for an hour.', '',
    '2', '00:00:04,000 --> 00:00:05,000', '{\\an8}EXIT', '',
    '3', '00:00:06,000 --> 00:00:08,000', '<i>♪ 晚风轻轻吹过窗台 ♪', 'The evening breeze drifts past the window</i>', '',
  ].join('\n'), 'Plex SRT: wrap by width, keep {\\an8}');
  assert.equal(report.rewrapped, 1);
  assert.equal(report.overflow, 0);
  const generic = generateSrtContent(rows, {}, { profile: EXPORT_PRESETS['generic-srt'].profile });
  assert.ok(!/[{<]/.test(generic), 'Generic SRT carries no tags at all');
  assert.match(generic, /^♪ 晚风轻轻吹过窗台 ♪$/m);

  // Filenames.
  assert.equal(buildExportFilename('Sample Show S01E02', 'srt', 'plain'), 'Sample Show S01E02.srt');
  assert.equal(buildExportFilename('Sample Show S01E02', 'srt', 'plex'), 'Sample Show S01E02.zh.srt');
  assert.equal(buildExportFilename('Sample Show S01E02', 'srt', 'plex-sdh'), 'Sample Show S01E02.zh.sdh.srt');
  assert.equal(buildExportFilename('Sample Show S01E02', 'ass', 'plex-forced'), 'Sample Show S01E02.zh.forced.ass');
  assert.equal(buildExportFilename('Movie (2010)', 'ass', 'jellyfin'), 'Movie (2010).zh-Hans.ass');
  assert.equal(buildExportFilename('Movie (2010)', 'ass', 'jellyfin', { traditional: true }), 'Movie (2010).zh-Hant.ass');
  assert.equal(buildExportFilename('Movie (2010)', 'srt', 'infuse-sdh'), 'Movie (2010).zh-Hans.sdh.srt');
  assert.equal(buildExportFilename('Movie', 'ass', 'generic'), 'Movie.zh-Hans.en.ass');
  assert.equal(buildExportFilename('a/b:c?', 'srt', 'unknown-id'), 'a b c.srt', 'unsafe characters stripped; unknown naming → plain');
  assert.equal(buildExportFilename('', 'srt', 'plex'), 'subtitles.zh.srt');
}

// Synthetic edge packs (scripts/fixtures/encoding, golden/everyday-ass-styled) — generated by
// scripts/fixtures/build-fixtures.py; everyday dialogue only, no real subtitle excerpts.
{
  const fx = (name) => join(process.cwd(), 'scripts/fixtures', name);
  for (const [file, encoding, note] of [
    ['zh-hans.gbk.srt', 'gbk', 'ANSI (GBK) Simplified Chinese'],
    ['zh-hant.big5.srt', 'big5', 'Big5 Traditional Chinese'],
    ['zh-hant-in-gbk.gbk.srt', 'gbk', 'Traditional characters stored as GBK must not be read as Big5'],
    ['ja.shift-jis.srt', 'shift_jis', 'Shift-JIS Japanese'],
    ['ko.euc-kr.srt', 'euc-kr', 'EUC-KR Korean'],
  ]) {
    const decoded = decodeBufferP0(readFileSync(fx(`encoding/${file}`)));
    assert.equal(decoded.encoding, encoding, `${file}: ${note}`);
    const sibling = fx(`encoding/${file.replace(/\.[^.]+\.srt$/, '.utf8.srt')}`);
    assert.equal(decoded.text.replace(/\r\n/g, '\n'), readFileSync(sibling, 'utf8').replace(/\r\n/g, '\n'), `${file}: decode equals the UTF-8 sibling`);
    assert.ok(parseSubtitle(decoded.text).length >= 4, `${file}: parses into cues`);
  }

  const ass = parseSubtitle(readFileSync(fx('golden/everyday-ass-styled/zh.ass'), 'utf8'));
  assert.ok(!ass.some((row) => row.text.includes('注释')), 'Comment events are not imported');
  assert.ok(ass.every((row) => !/\{\\|\\pos|\\fad|\\p1|^m \d/.test(row.text)), 'override tags / drawings never leak into text');
  const sign = ass.find((row) => row.text.startsWith('便利店'));
  assert.ok(sign, 'styled sign parsed');
  assert.equal(sign.text.split('\n').length, 3, 'ASS \\N source breaks preserved through parse');
  assert.equal(sign.cueKind, 'screen_text', '\\an8 sign classified as screen text');
  const preset = EXPORT_PRESETS['libass-ass'];
  const exported = generateAssContent(ass.map((row, idx) => ({ ...row, index: idx + 1, type: row.cueKind === 'screen_text' ? 'note' : 'dialogue' })), resolvePresetStyle(useStudioStore.getState().customStyle, preset), 'Styled', undefined, { profile: preset.profile });
  const signLine = exported.split('\n').find((line) => line.includes('便利店'));
  assert.ok(signLine.includes('{\\an8}'), 'sign stays top-placed');
  assert.equal(signLine.split('\\N').length, 3, `3-line sign keeps its layout (signs are never squeezed to 2 lines): ${signLine}`);
  const longLine = exported.split('\n').find((line) => line.includes('河边骑车'));
  assert.ok(longLine && longLine.split('\\N').length === 2, `long unpunctuated line wraps to 2 lines: ${longLine}`);
  const threeLine = exported.split('\n').find((line) => line.includes('七点半'));
  assert.ok(threeLine && threeLine.split('\\N').length <= 2, `3-line dialogue re-flows to ≤2 lines: ${threeLine}`);
}

// P0-7 bundle download: ASS always, SRT add-ons optional, >1 file → one zip named from the same rule.
{
  const single = planExportBundle('Sample Show S01E02', 'plex', 'current', []);
  assert.deepEqual(single, { files: [{ presetId: 'current', format: 'ass', filename: 'Sample Show S01E02.zh.ass' }], zipName: null });
  const bundle = planExportBundle('Sample Show S01E02', 'infuse', 'libass-ass', ['generic-srt', 'current', 'nope']);
  assert.deepEqual(bundle.files, [
    { presetId: 'libass-ass', format: 'ass', filename: 'Sample Show S01E02.zh-Hans.ass' },
    { presetId: 'current', format: 'srt', filename: 'Sample Show S01E02.zh-Hans.srt' },
    { presetId: 'generic-srt', format: 'srt', filename: '通用 SRT/Sample Show S01E02.zh-Hans.srt' },
  ], 'addon order fixed; first SRT sits next to the ASS, extra variants go into labelled folders');
  assert.equal(bundle.zipName, 'Sample Show S01E02.zh-Hans.zip');
  assert.equal(planExportBundle('Movie', 'jellyfin', 'plex-srt', ['plex-srt'], { traditional: true }).files[0].presetId, 'current', 'SRT-only preset is never used for the ASS');
  assert.equal(planExportBundle('Movie', 'jellyfin', 'current', ['plex-srt'], { traditional: true }).zipName, 'Movie.zh-Hant.zip');
  assert.deepEqual(ASS_PRESET_IDS, ['current', 'libass-ass', 'navy-outline']);
  assert.deepEqual(SRT_ADDON_IDS, ['current', 'plex-srt', 'generic-srt']);
}


// ---------------------------------------------------------------------------------------------
// Bilingual misdetection: a Chinese track with inline English tokens is NOT a bilingual track.
{
  const fixtureDir = join(process.cwd(), 'scripts/fixtures/detection');
  const zhText = readFileSync(join(fixtureDir, 'zh-inline-latin.zh.srt'), 'utf8');
  const enText = readFileSync(join(fixtureDir, 'zh-inline-latin.en.srt'), 'utf8');
  for (const name of ['Weekend.S01E01.zh.srt', 'Weekend.S01E01.srt', 'Weekend.S01E01.chs.srt']) {
    assert.deepEqual(detectSubtitleLanguage(name, zhText), { lang: 'zh-CN', isBilingual: false }, `${name}: inline iPhone/OK/Wi-Fi must not make a bilingual track`);
  }
  assert.equal(detectSubtitleLanguagePair(zhText), undefined);
  assert.equal(checkIsBilingual(zhText), false, 'checkIsBilingual: inline tokens are not secondary lines');
  assert.equal(detectSubtitleLanguage('Weekend.S01E01.en.srt', enText).lang, 'en');
  // Inline token never splits a Chinese sentence.
  assert.equal(splitSingleBilingualText('家里的Wi-Fi密码是多少？'), '家里的Wi-Fi密码是多少？');
  assert.equal(splitSingleBilingualText('今晚Netflix有新剧，要一起看吗？'), '今晚Netflix有新剧，要一起看吗？');
  assert.equal(splitSingleBilingualText('你好 Hello world'), '你好\nHello world', 'real trailing English still splits');
  assert.equal(isSentenceLevelLatinLine('OK'), false);
  assert.equal(isSentenceLevelLatinLine('iPhone'), false);
  assert.equal(isSentenceLevelLatinLine('Wi-Fi'), false);
  assert.equal(isSentenceLevelLatinLine("What's wrong?"), true);
  assert.equal(isSentenceLevelLatinLine('Welcome back.'), true);

  // End to end through the store: the English track takes the 原文 slot.
  resetStoreForTmdb();
  const mk = (id, name, text) => ({ id, name, text, ...detectSubtitleLanguage(name, text), isCommentary: false, size: text.length });
  useStudioStore.getState().processFiles([mk('tok-zh', 'Weekend.S01E01.zh.srt', zhText), mk('tok-en', 'Weekend.S01E01.en.srt', enText)]);
  const task = useStudioStore.getState().tasks[0];
  assert.equal(task?.zh?.id, 'tok-zh');
  assert.equal(task?.en?.id, 'tok-en', 'English track must merge as 原文 (was left unbound when zh was misdetected as bilingual)');
  assert.equal(task?.isBilingualSingle, false);
  assert.equal(task?.status, 'paired');

  // Real bilingual files still detect: in-cue zh\nEN, and a minority of untranslated English is fine.
  const cue = (i, text) => `${i + 1}\n00:00:${String(i * 3 + 1).padStart(2, '0')},000 --> 00:00:${String(i * 3 + 3).padStart(2, '0')},000\n${text}\n`;
  const zhLines = zhText.split(/\n\n/).map((block) => block.split('\n').slice(2).join(' ')).filter(Boolean);
  const enLines = enText.split(/\n\n/).map((block) => block.split('\n').slice(2).join(' ')).filter(Boolean);
  const inCue = zhLines.slice(0, 15).map((zh, i) => cue(i, `${zh}\n${enLines[i]}`)).join('\n');
  assert.deepEqual(detectSubtitleLanguagePair(inCue), { primary: 'zh-CN', secondary: 'en' }, 'in-cue bilingual stays bilingual');
  // Mostly Chinese with only a couple of full English sentences (a song title, a sign) → Chinese.
  const fewSentences = zhLines.slice(0, 15).map((zh, i) => cue(i, i === 3 || i === 9 ? enLines[i] : zh)).join('\n');
  assert.equal(detectSubtitleLanguagePair(fewSentences), undefined, `below ${BILINGUAL_SECONDARY_SHARE} share → not bilingual`);
  // …unless the filename says bilingual (lower bar), e.g. a 中英 file whose English is partly missing.
  const halfDone = zhLines.slice(0, 15).map((zh, i) => cue(i, i % 4 === 0 ? `${zh}\n${enLines[i]}` : zh)).join('\n');
  assert.equal(detectSubtitleLanguagePair(halfDone), undefined);
  assert.deepEqual(detectSubtitleLanguagePair(halfDone, 'Weekend.S01E01.中英双语.srt'), { primary: 'zh-CN', secondary: 'en' });
}

// ---------------------------------------------------------------------------------------------
// 「深蓝描边」 navy-outline preset: two stacked events, PlayResY scaling, wrap per language size.
{
  const navyPreset = EXPORT_PRESETS['navy-outline'];
  assert.ok(ASS_PRESET_IDS.includes('navy-outline'), 'navy preset is offered in the ASS dropdown');
  assert.ok(!SRT_ADDON_IDS.includes('navy-outline'));
  const baseStyle = useStudioStore.getState().customStyle;
  const style = resolvePresetStyle(baseStyle, navyPreset);
  const rows = [
    { ts: '00:00:01,000 --> 00:00:03,000', text: '我们明天早上一起去吃早饭吧\nLet\'s get breakfast together tomorrow morning.', type: 'merged', index: 1 },
    { ts: '00:00:04,000 --> 00:00:06,000', text: '好啊\nSure.', type: 'merged', index: 2 },
    { ts: '00:00:07,000 --> 00:00:09,000', text: '只有中文的一行', type: 'dialogue', index: 3 },
    { ts: '00:00:10,000 --> 00:00:12,000', text: 'Only an English line here.', type: 'dialogue', index: 4 },
    { ts: '00:00:13,000 --> 00:00:16,000', text: '你记得带伞\nRemember to bring an umbrella, the forecast says it will rain all afternoon.', type: 'merged', index: 5 },
    { ts: '00:00:17,000 --> 00:00:19,000', text: '便利店', type: 'dialogue', cueKind: 'screen_text', index: 6 },
  ];
  const ass = generateAssContent(rows, style, 'Navy', undefined, { profile: navyPreset.profile });
  const styleLine = (content, name) => content.split('\n').find((line) => line.startsWith(`Style: ${name},`)).split(',');
  const zh = styleLine(ass, 'ZH');
  const sec = styleLine(ass, 'SEC');
  // Format: Name0, Fontname1, Fontsize2, Primary3, Secondary4, Outline5, Back6, Bold7, ..., Outline16, Shadow17, Alignment18, L19, R20, V21
  assert.equal(zh[1], 'Source Han Sans SC Medium', 'zh Medium (legacy family name kept by normalization)');
  assert.equal(sec[1], 'Source Han Sans SC', 'Latin secondary: Regular family');
  assert.deepEqual([zh[2], sec[2]], ['75', '51'], 'zh 75 @1080, secondary 0.68×');
  assert.deepEqual([zh[3], sec[3]], ['&H00FFFFFF', '&H00FFFFFF'], 'white fills');
  assert.deepEqual([zh[5], sec[5]], ['&H00551B14', '&H00000000'], 'navy #141B55 / black outlines');
  assert.deepEqual([zh[7], sec[7]], ['0', '0'], 'no faux bold');
  assert.deepEqual([zh[16], sec[16]], ['5.5', '4.5'], 'outline widths');
  assert.deepEqual([zh[17], sec[17]], ['0', '0'], 'no shadow');
  assert.deepEqual([zh[18], sec[18]], ['2', '2']);
  assert.deepEqual([zh[21], sec[21]], ['97', '51'], 'secondary ink ≈5.6 % above bottom; ink gap ≈1.7 %');
  assert.match(ass, /^PlayResY: 1080$/m);
  assert.doesNotMatch(ass, /YCbCr Matrix/, 'SDR export leaves YCbCr Matrix unset');
  const events = ass.split('\n').filter((line) => line.startsWith('Dialogue:'));
  assert.equal(events[0], 'Dialogue: 1,0:00:01.00,0:00:03.00,ZH,,0,0,0,,我们明天早上一起去吃早饭吧');
  assert.equal(events[1], "Dialogue: 0,0:00:01.00,0:00:03.00,SEC,,0,0,0,,Let's get breakfast together tomorrow morning.");
  assert.equal(events[4], 'Dialogue: 1,0:00:07.00,0:00:09.00,ZH,,0,0,0,,只有中文的一行', 'zh-only keeps the zh line height');
  assert.equal(events[5], 'Dialogue: 0,0:00:10.00,0:00:12.00,SEC,,0,0,0,,Only an English line here.');
  // A two-line secondary pushes the Chinese event up by one secondary line (51 px).
  const longZh = events[6].split(',');
  const longSec = events[7];
  assert.equal(longZh[3], 'ZH');
  assert.equal(longZh[7], '148', '97 + 51');
  assert.equal((longSec.match(/\\N/g) || []).length, 1, 'secondary wrapped to two lines at its own (smaller) size');
  for (const line of longSec.split(',').slice(9).join(',').split('\\N')) {
    assert.ok(estimateTextWidth(line, 51) <= (1920 - 120) * 0.62 + 1, `secondary line fits its width: ${line}`);
  }
  assert.match(events[8], /^Dialogue: 0,.*,Note,,0,0,0,,\{\\an8\}便利店$/, 'signs keep the Note style at the top');

  // Scales by PlayResY (4K) and picks the regional family for ja / ko secondaries.
  const ass4k = generateAssContent(rows, { ...style, resolution: '4K' }, 'Navy', undefined, { profile: navyPreset.profile });
  const zh4k = styleLine(ass4k, 'ZH');
  const sec4k = styleLine(ass4k, 'SEC');
  assert.deepEqual([zh4k[2], sec4k[2], zh4k[16], sec4k[16], zh4k[21], sec4k[21], zh4k[19]], ['150', '102', '11', '9', '194', '102', '120']);
  const jaRows = [{ ts: '00:00:01,000 --> 00:00:03,000', text: '我们走吧\n行きましょう', type: 'merged', index: 1 }];
  assert.equal(styleLine(generateAssContent(jaRows, style, 'Navy', undefined, { profile: navyPreset.profile }), 'SEC')[1], 'Source Han Sans JP');
  const koRows = [{ ts: '00:00:01,000 --> 00:00:03,000', text: '我们走吧\n가자', type: 'merged', index: 1 }];
  assert.equal(styleLine(generateAssContent(koRows, style, 'Navy', undefined, { profile: navyPreset.profile }), 'SEC')[1], 'Source Han Sans K');
  assert.equal(NAVY_OUTLINE_LAYOUT.primaryOutlineColour, '#141B55');

  // Font-name normalization keeps legacy weighted CJK families, strips ordinary weight suffixes.
  assert.equal(canonicalFontFamily('Source Han Sans SC Medium'), 'Source Han Sans SC Medium');
  assert.equal(canonicalFontFamily('SourceHanSansSC-Medium'), 'Source Han Sans SC Medium');
  assert.equal(canonicalFontFamily('"Noto Sans CJK SC Medium"'), 'Noto Sans CJK SC Medium');
  assert.equal(canonicalFontFamily('思源黑体 Medium'), 'Source Han Sans SC Medium');
  assert.equal(canonicalFontFamily('Source Han Sans SC Bold'), 'Source Han Sans SC', 'Bold is a style → flag, not a family');
  assert.equal(canonicalFontFamily('Noto Sans CJK SC Regular'), 'Noto Sans CJK SC');
  assert.equal(canonicalFontFamily('PingFang SC Medium'), 'PingFang SC');
}

// ---------------------------------------------------------------------------------------------
// HDR variants (PROVISIONAL levels): warm-grey fills only, outlines unchanged, YCbCr Matrix: None.
{
  assert.deepEqual(HDR_LEVEL_ORDER, ['soft', 'dim', 'cinema']);
  assert.equal(DEFAULT_HDR_LEVEL, 'soft');
  const toAss = (hex) => `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toUpperCase();
  assert.deepEqual(
    HDR_LEVEL_ORDER.map((id) => [toAss(HDR_LEVELS_PROVISIONAL[id].primaryFill), toAss(HDR_LEVELS_PROVISIONAL[id].secondaryFill)]),
    [['&H00DCE6EB', '&H00C6CED2'], ['&H00C0C8CC', '&H00AAB1B4'], ['&H009CA3A6', '&H00898F91']],
    'levels match hdr-subtitle-guide §五',
  );
  for (const id of HDR_LEVEL_ORDER) {
    const { primaryFill, secondaryFill } = HDR_LEVELS_PROVISIONAL[id];
    for (const fill of [primaryFill, secondaryFill]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
      assert.ok(r >= g && g > b, `${id} ${fill}: warm grey R ≥ G > B`);
      assert.ok((r - b) / 255 <= 0.06, `${id} ${fill}: warm shift ≤ 6 %`);
    }
    assert.ok(relativeLuminance(secondaryFill) < relativeLuminance(primaryFill), `${id}: secondary one step darker`);
  }
  const soft = HDR_LEVELS_PROVISIONAL.soft;
  assert.equal(hdrFillHex('#FFFFFF', soft, 'primary'), soft.primaryFill);
  assert.equal(hdrFillHex('#ffffff', soft, 'secondary'), soft.secondaryFill);
  const dimmedLavender = hdrFillHex('#E6E6FA', soft, 'primary');
  assert.ok(relativeLuminance(dimmedLavender) < relativeLuminance('#E6E6FA'), 'non-white fills dim in linear light');
  assert.ok(parseInt(dimmedLavender.slice(5, 7), 16) > parseInt(dimmedLavender.slice(1, 3), 16), 'hue kept (still bluish)');
  const dimmedTags = dimInlineFillTags('{\\c&HFFFFFF&\\3c&H000000&\\1c&H00FFFF&}歌', soft);
  const [, cWhite, c1Yellow] = dimmedTags.match(/^\{\\c&H([0-9A-F]{6})&\\3c&H000000&\\1c&H([0-9A-F]{6})&\}歌$/) || [];
  assert.ok(cWhite && c1Yellow, `inline fills rewritten, \\3c untouched: ${dimmedTags}`);
  assert.ok(cWhite !== 'FFFFFF' && cWhite.slice(0, 2) === cWhite.slice(2, 4), 'inline white dimmed (scaled, stays neutral)');
  assert.ok(c1Yellow.slice(0, 2) === '00' && c1Yellow.slice(2, 4) === c1Yellow.slice(4, 6), 'inline yellow dimmed, hue kept');

  const navyPreset = EXPORT_PRESETS['navy-outline'];
  const style = resolvePresetStyle(useStudioStore.getState().customStyle, navyPreset);
  const rows = [
    { ts: '00:00:01,000 --> 00:00:03,000', text: '今天早点回家\nGo home early today.', type: 'merged', index: 1 },
    { ts: '00:00:04,000 --> 00:00:06,000', text: '{\\1c&H00FFFF&}黄色的提示', type: 'dialogue', index: 2 },
  ];
  const sdr = generateAssContent(rows, style, 'Navy', undefined, { profile: navyPreset.profile });
  for (const id of HDR_LEVEL_ORDER) {
    const level = HDR_LEVELS_PROVISIONAL[id];
    const hdr = generateAssContent(rows, style, 'Navy', undefined, { profile: navyPreset.profile, hdr: id });
    assert.match(hdr, /^YCbCr Matrix: None$/m, `${id}: YCbCr Matrix: None`);
    assert.match(hdr, new RegExp(`^Title: Navy \\(HDR ${level.label}\\)$`, 'm'));
    const fields = (content, name) => content.split('\n').find((line) => line.startsWith(`Style: ${name},`)).split(',');
    assert.equal(fields(hdr, 'ZH')[3], toAss(level.primaryFill), `${id}: zh fill`);
    assert.equal(fields(hdr, 'SEC')[3], toAss(level.secondaryFill), `${id}: secondary fill`);
    for (const name of ['ZH', 'SEC', 'Note', 'Credit', 'Lyrics', 'Lyrics_EN']) {
      const a = fields(sdr, name);
      const b = fields(hdr, name);
      assert.deepEqual([...b.slice(0, 3), ...b.slice(4)], [...a.slice(0, 3), ...a.slice(4)], `${id}/${name}: only PrimaryColour changes (outline, sizes, margins identical)`);
      assert.ok(b[3].startsWith('&H00'), `${id}/${name}: opaque fill, no transparency`);
    }
    const inline = hdr.split('\n').find((line) => line.includes('黄色的提示'));
    assert.doesNotMatch(inline, /\\1c&H00FFFF&/, `${id}: inline \\1c dimmed`);
    // Same events otherwise.
    const strip = (content) => content.split('\n').filter((line) => line.startsWith('Dialogue:') && !line.includes('\\1c'));
    assert.deepEqual(strip(hdr), strip(sdr));
  }
  // HDR also applies to the classic presets.
  const legacyHdr = generateAssContent(rows, useStudioStore.getState().customStyle, 'Cur', undefined, { hdr: 'dim' });
  assert.match(legacyHdr, /^YCbCr Matrix: None$/m);

  // Bundle: 同时生成 HDR 版 → HDR/<identical filename> in the zip; SRT gets no HDR copy.
  const withHdr = planExportBundle('Sample Show S01E02', 'infuse', 'navy-outline', ['plex-srt'], { hdr: 'soft' });
  assert.deepEqual(withHdr.files.map((file) => [file.format, file.filename, file.hdr ?? null]), [
    ['ass', 'Sample Show S01E02.zh-Hans.ass', null],
    ['ass', 'HDR/Sample Show S01E02.zh-Hans.ass', 'soft'],
    ['srt', 'Sample Show S01E02.zh-Hans.srt', null],
  ]);
  assert.equal(withHdr.zipName, 'Sample Show S01E02.zh-Hans.zip');
  const hdrOnly = planExportBundle('Movie', 'plain', 'current', [], { hdr: 'cinema' });
  assert.equal(hdrOnly.files.length, 2);
  assert.equal(hdrOnly.zipName, 'Movie.zip', 'ASS + HDR copy is always a zip');
  assert.equal(planExportBundle('Movie', 'plain', 'current', [], { hdr: 'nope' }).zipName, null, 'unknown level → SDR only');
}

// End-to-end golden samples: synthetic everyday tracks → parse → align → export (ASS + SRT, every preset).
// Fixtures: scripts/fixtures/golden/<sample>/{zh + en|ja|ko|fr|es|pt}.(srt|ass) or bilingual.(srt|ass),
// generated by scripts/fixtures/build-fixtures.py (no real subtitle excerpts). Add a <sample> directory
// and run with UPDATE_GOLDEN=1 to record its snapshots; review the diff before committing.
{
  const goldenRoot = join(process.cwd(), 'scripts/fixtures/golden');
  const update = process.env.UPDATE_GOLDEN === '1';
  const baseStyle = useStudioStore.getState().customStyle;
  const pickTrack = (dir, lang) => ['srt', 'ass'].map((ext) => join(dir, `${lang}.${ext}`)).find((file) => existsSync(file));
  const samples = readdirSync(goldenRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.ok(samples.length >= 3, 'at least three golden samples');
  const firstDiff = (actual, expected) => {
    const a = actual.split('\n');
    const e = expected.split('\n');
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
      if (a[i] !== e[i]) return `line ${i + 1}\n  expected: ${e[i]}\n  actual:   ${a[i]}`;
    }
    return 'identical';
  };
  for (const sample of samples) {
    const dir = join(goldenRoot, sample);
    // Tracks are decoded exactly like the app does (decodeBuffer: UTF-8/16, GBK, Big5, SJIS, EUC-KR).
    const readTrack = (file) => decodeBufferP0(readFileSync(file)).text;
    const zhFile = pickTrack(dir, 'zh');
    const enFile = ['en', 'ja', 'ko', 'fr', 'es', 'pt'].map((lang) => pickTrack(dir, lang)).find(Boolean);
    const bilingualFile = pickTrack(dir, 'bilingual');
    let rows;
    if (zhFile && enFile) {
      rows = alignSubtitlesIndustrial(parseSubtitle(readTrack(zhFile)), parseSubtitle(readTrack(enFile)));
    } else if (bilingualFile) {
      rows = normalizeSingleBilingualRows(parseSubtitle(readTrack(bilingualFile))); // single bilingual file path
    } else {
      continue;
    }
    assert.ok(rows.length >= 4, `${sample}: produced rows (${rows.length})`);
    const summary = { rows: rows.length, merged: rows.filter((row) => row.type === 'merged').length, presets: {} };
    const outputs = {};
    for (const presetId of EXPORT_PRESET_ORDER) {
      const preset = EXPORT_PRESETS[presetId];
      const style = resolvePresetStyle(baseStyle, preset);
      for (const format of preset.formats) {
        const report = createWrapReport();
        const content = format === 'ass'
          ? generateAssContent(rows, style, sample, undefined, { profile: preset.profile, report })
          : generateSrtContent(rows, style, { profile: preset.profile, report });
        outputs[`${presetId}.${format}`] = content;
        summary.presets[`${presetId}.${format}`] = { rewrapped: report.rewrapped, overflow: report.overflow };
      }
    }
    if (sample === 'everyday-srt') {
      // HDR snapshots (PROVISIONAL levels) for one sample: navy at every level + the classic preset.
      const navy = EXPORT_PRESETS['navy-outline'];
      for (const level of HDR_LEVEL_ORDER) {
        outputs[`navy-outline.hdr-${level}.ass`] = generateAssContent(rows, resolvePresetStyle(baseStyle, navy), sample, undefined, { profile: navy.profile, hdr: level });
      }
      outputs['current.hdr-soft.ass'] = generateAssContent(rows, baseStyle, sample, undefined, { profile: EXPORT_PRESETS.current.profile, hdr: 'soft' });
    }
    outputs['summary.json'] = `${JSON.stringify(summary, null, 2)}\n`;
    const expectedDir = join(dir, 'expected');
    if (update) mkdirSync(expectedDir, { recursive: true });
    for (const [name, content] of Object.entries(outputs)) {
      const file = join(expectedDir, name);
      if (update) {
        writeFileSync(file, content);
        continue;
      }
      assert.ok(existsSync(file), `${sample}/expected/${name} missing — run UPDATE_GOLDEN=1 npm run test:core`);
      const expected = readFileSync(file, 'utf8');
      assert.ok(content === expected, `${sample}/${name} golden mismatch at ${firstDiff(content, expected)}`);
    }

    // Invariants, independent of the snapshots.
    const plexSrt = outputs['plex-srt.srt'];
    for (const block of plexSrt.trim().split(/\n\n/)) {
      const lines = block.split('\n').slice(2);
      if (lines[0]?.startsWith('{\\an8}')) continue; // signs keep their deliberate multi-line layout
      for (const part of splitLanguageBlocks(lines.join('\n'))) assert.ok(part.length <= 2, `${sample}: ≤2 lines per language\n${block}`);
      for (const line of lines) assert.ok(!/^[，。！？、；：」』）]/.test(line), `${sample}: kinsoku\n${block}`);
    }
    const strip = (value) => value.replace(/\{[^}]*\}|<\/?i>/g, '').replace(/\s+/g, '');
    const wordsOf = (content) => content.split('\n').filter((line) => !/-->|^\d+$/.test(line)).join(' ').replace(/\{[^}]*\}|<\/?i>/g, ' ').split(/\s+/).filter(Boolean);
    assert.equal(strip(outputs['plex-srt.srt'].replace(/^\d+\n.*-->.*$/gm, '')), strip(outputs['current.srt'].replace(/^\d+\n.*-->.*$/gm, '')), `${sample}: wrapping never drops or alters characters`);
    assert.deepEqual(wordsOf(outputs['plex-srt.srt']).filter((w) => /^[A-Za-z]/.test(w)), wordsOf(outputs['current.srt']).filter((w) => /^[A-Za-z]/.test(w)), `${sample}: Latin words never split`);
    assert.equal(summary.presets['current.srt'].rewrapped, 0, `${sample}: legacy SRT never rewraps`);
  }
}

console.log('Core subtitle regression checks passed.');
