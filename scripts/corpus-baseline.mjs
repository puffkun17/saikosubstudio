#!/usr/bin/env node
/**
 * Corpus baseline harness — runs the real merge pipeline over a directory of
 * subtitle samples, records cue-level outputs, and diffs later runs.
 *
 * Recording format version 3 runs each dual-track sample through three paths
 * (standard mergeSubtitles, industrial alignSubtitlesIndustrial, and
 * executeMergeJob with mode:'standard' so auto industrial upgrade can fire),
 * plus single-file bilingual via executeMergeJob. Non-deterministic fields
 * (e.g. elapsedMs from Date.now) are never recorded. Older recordings
 * (format ≠ 3) fail compare with a re-record instruction — they never
 * silently pass.
 *
 * Usage (Mac / Linux):
 *   # CI / synthetic (committed samples + baselines under the repo):
 *   node scripts/corpus-baseline.mjs
 *   node scripts/corpus-baseline.mjs --dir scripts/fixtures/corpus-synthetic
 *
 *   # Real corpus (NEVER commit samples or recordings):
 *   CORPUS_DIR=~/Movies/saiko-corpus \
 *   CORPUS_BASELINE_DIR=~/Movies/saiko-corpus-baseline \
 *   node scripts/corpus-baseline.mjs
 *
 *   # Re-record baselines (explicit flag required):
 *   node scripts/corpus-baseline.mjs --dir … --baseline … --record
 *
 * Pairing: each sample folder needs zh.(srt|ass) + one of en|ja|ko|fr|es|pt.(srt|ass),
 * or a single bilingual.(srt|ass). Sample dir layout is unchanged across formats.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/** Bump when the recording JSON shape or compare semantics change. */
const FORMAT = 3;

/** Time window (ms) for text-presence loss checks — mirrors runCorpus ±2s. */
const LOSS_TIME_SLACK_MS = 2000;

/** Dual-track algorithm modes recorded per sample (format 3). */
const DUAL_MODES = ['standard', 'industrial', 'auto'];

function parseArgs(argv) {
  const out = { dir: null, baseline: null, record: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--record') out.record = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dir') out.dir = argv[++i];
    else if (a === '--baseline') out.baseline = argv[++i];
    else if (a.startsWith('--dir=')) out.dir = a.slice(6);
    else if (a.startsWith('--baseline=')) out.baseline = a.slice(11);
  }
  return out;
}

function isInsideRepo(absPath) {
  const root = realpathSync(REPO_ROOT);
  let cur;
  try {
    cur = realpathSync(absPath);
  } catch {
    cur = resolve(absPath);
  }
  const rel = relative(root, cur);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..');
}

function loadMergeCore() {
  const out = mkdtempSync(join(tmpdir(), 'saiko-corpus-'));
  const sources = [
    'src/utils/subtitleCore.ts',
    'src/utils/lineWrap.ts',
    'src/utils/exportPresets.ts',
    'src/utils/hdrPresets.ts',
    'src/utils/textEncoding.ts',
    'src/core/mergeJob.ts',
  ];
  execFileSync(
    'npx',
    [
      'tsc',
      ...sources,
      '--target', 'ES2020',
      '--module', 'commonjs',
      '--moduleResolution', 'node',
      '--outDir', out,
      '--rootDir', 'src',
      '--skipLibCheck',
      '--lib', 'ES2020,DOM',
    ],
    { stdio: 'inherit', cwd: REPO_ROOT },
  );
  const requireFromOut = createRequire(join(out, 'x.js'));
  const core = requireFromOut('./utils/subtitleCore.js');
  const mergeJob = requireFromOut('./core/mergeJob.js');
  const cleanup = () => {
    try { rmSync(out, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  return { core, mergeJob, cleanup };
}

function pickTrack(dir, lang) {
  return ['srt', 'ass'].map((ext) => join(dir, `${lang}.${ext}`)).find((f) => existsSync(f));
}

function listSamples(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'baseline')
    .map((e) => e.name)
    .sort();
}

function tsToMsPair(ts, timeToMs) {
  const parts = String(ts || '').split(/\s*-->\s*/);
  const startRaw = (parts[0] || '').trim();
  const endRaw = (parts[1] || '').trim();
  return [timeToMs(startRaw), timeToMs(endRaw)];
}

function cueFingerprint(row, index, timeToMs) {
  const [start, end] = tsToMsPair(row.ts, timeToMs);
  return {
    i: index,
    type: row.type ?? null,
    cueKind: row.cueKind ?? null,
    ts: row.ts ?? null,
    start,
    end,
    text: row.text ?? '',
  };
}

/**
 * Loss: input cues whose cleaned text does not appear in any output row
 * within ±LOSS_TIME_SLACK_MS. Empty cleaned text is skipped (nothing to keep).
 * Provenance is not required — text+time is the portable check (see runCorpus).
 */
function measureLoss(inputTracks, outputRows, { timeToMs, cleanSubtitleContent }) {
  const outParsed = outputRows.map((r) => {
    const [s, e] = tsToMsPair(r.ts, timeToMs);
    return { s, e, text: r.text || '' };
  });

  let lost = 0;
  const perFile = [];
  for (const track of inputTracks) {
    let fileLost = 0;
    for (const cue of track.rows) {
      const clean = String(cleanSubtitleContent(cue.text || '') || '').trim();
      if (!clean) continue;
      const [cs, ce] = tsToMsPair(cue.ts, timeToMs);
      const present = outParsed.some(
        (r) => r.s <= ce + LOSS_TIME_SLACK_MS
          && r.e >= cs - LOSS_TIME_SLACK_MS
          && r.text.includes(clean),
      );
      if (!present) {
        fileLost += 1;
        lost += 1;
      }
    }
    perFile.push({ file: track.file, cues: track.rows.length, lost: fileLost });
  }
  return { lost, perFile };
}

function firstDiff(actual, expected) {
  const a = JSON.stringify(actual, null, 2).split('\n');
  const e = JSON.stringify(expected, null, 2).split('\n');
  for (let i = 0; i < Math.max(a.length, e.length); i += 1) {
    if (a[i] !== e[i]) {
      return `line ${i + 1}\n  expected: ${e[i] ?? '<missing>'}\n  actual:   ${a[i] ?? '<missing>'}`;
    }
  }
  return 'identical';
}

function diffCues(actualCues, expectedCues) {
  const changes = [];
  const n = Math.max(actualCues.length, expectedCues.length);
  for (let i = 0; i < n; i += 1) {
    const a = actualCues[i];
    const e = expectedCues[i];
    if (!e) {
      changes.push({ index: i, kind: 'added', actual: a });
      continue;
    }
    if (!a) {
      changes.push({ index: i, kind: 'removed', expected: e });
      continue;
    }
    const same =
      a.text === e.text
      && a.ts === e.ts
      && a.type === e.type
      && a.cueKind === e.cueKind
      && a.start === e.start
      && a.end === e.end;
    if (!same) {
      changes.push({ index: i, kind: 'changed', expected: e, actual: a });
    }
  }
  return changes;
}

/** Build a deterministic per-mode recording (no elapsedMs / wall-clock fields). */
function modePayload(rows, usedMode, inputTracks, helpers) {
  const { timeToMs, cleanSubtitleContent } = helpers;
  const loss = measureLoss(inputTracks, rows, { timeToMs, cleanSubtitleContent });
  return {
    usedMode,
    rowCount: rows.length,
    loss: {
      lost: loss.lost,
      perFile: loss.perFile,
    },
    cues: rows.map((row, i) => cueFingerprint(row, i, timeToMs)),
  };
}

function sampleSummary(payload) {
  const inCues = (payload.inputs || []).reduce((n, t) => n + (t.cues || 0), 0);
  const modeParts = Object.entries(payload.modes || {}).map(([name, m]) => {
    const used = m.usedMode && m.usedMode !== name ? `→${m.usedMode}` : '';
    return `${name}${used}:out=${m.rowCount}/lost=${m.loss?.lost ?? 0}`;
  });
  return `in=${inCues} ${modeParts.join(' ')}`;
}

function compareMode(sample, modeName, actual, expected) {
  let failed = false;
  if (!expected) {
    console.error(`FAIL ${sample}/${modeName}: missing in baseline`);
    return true;
  }
  if (!actual) {
    console.error(`FAIL ${sample}/${modeName}: missing in actual run`);
    return true;
  }
  if (expected.usedMode !== actual.usedMode) {
    console.error(
      `FAIL ${sample}/${modeName}: usedMode ${actual.usedMode} !== ${expected.usedMode}`,
    );
    failed = true;
  }
  if (expected.rowCount !== actual.rowCount) {
    console.error(
      `FAIL ${sample}/${modeName}: rowCount ${actual.rowCount} !== ${expected.rowCount}`,
    );
    failed = true;
  }
  const expectedLost = expected.loss?.lost ?? 0;
  if ((actual.loss?.lost ?? 0) > expectedLost) {
    console.error(
      `FAIL ${sample}/${modeName}: loss increased ${actual.loss.lost} > ${expectedLost} (recorded)`,
    );
    failed = true;
  }
  const changes = diffCues(actual.cues || [], expected.cues || []);
  if (changes.length > 0) {
    console.error(`FAIL ${sample}/${modeName}: ${changes.length} cue change(s)`);
    for (const c of changes.slice(0, 8)) {
      if (c.kind === 'changed') {
        const timing =
          c.expected.start !== c.actual.start || c.expected.end !== c.actual.end
            ? ` start/end ${c.expected.start}–${c.expected.end} → ${c.actual.start}–${c.actual.end}`
            : '';
        console.error(`  cue ${c.index}: text/ts/type/timing changed${timing}`);
        console.error(`    was: ${JSON.stringify(c.expected.text)} @ ${c.expected.ts}`);
        console.error(`    now: ${JSON.stringify(c.actual.text)} @ ${c.actual.ts}`);
      } else {
        console.error(`  cue ${c.index}: ${c.kind}`);
      }
    }
    if (changes.length > 8) console.error(`  … +${changes.length - 8} more`);
    console.error(`  json: ${firstDiff(actual, expected).split('\n').slice(0, 4).join('\n  ')}`);
    failed = true;
  }
  return failed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/corpus-baseline.mjs [--dir DIR] [--baseline DIR] [--record]

Env:
  CORPUS_DIR            sample root (default: scripts/fixtures/corpus-synthetic)
  CORPUS_BASELINE_DIR   recording root (default: <dir>/baseline for synthetic;
                        required + must be outside the repo for a real corpus)

Recording format: ${FORMAT}
  Dual samples → modes.standard / modes.industrial / modes.auto
    (auto = executeMergeJob mode:'standard', may upgrade to industrial)
  Bilingual samples → modes.bilingual (executeMergeJob bilingualSingle)
  Non-deterministic fields (elapsedMs, etc.) are omitted from recordings.
`);
    process.exit(0);
  }

  const dir = resolve(args.dir || process.env.CORPUS_DIR || join(REPO_ROOT, 'scripts/fixtures/corpus-synthetic'));
  assert.ok(existsSync(dir) && statSync(dir).isDirectory(), `corpus dir missing: ${dir}`);

  const syntheticDefault = resolve(REPO_ROOT, 'scripts/fixtures/corpus-synthetic');
  const isSynthetic = resolve(dir) === syntheticDefault || relative(syntheticDefault, dir) === '';

  let baselineDir = args.baseline || process.env.CORPUS_BASELINE_DIR || null;
  if (!baselineDir) {
    if (isSynthetic) baselineDir = join(dir, 'baseline');
    else {
      console.error('Real corpus requires --baseline or CORPUS_BASELINE_DIR outside the git repo.');
      process.exit(2);
    }
  }
  baselineDir = resolve(baselineDir);

  if (!isSynthetic && isInsideRepo(baselineDir)) {
    console.error(`Refusing to write/read real-corpus baselines inside the repo: ${baselineDir}`);
    process.exit(2);
  }
  if (!isSynthetic && isInsideRepo(dir)) {
    console.error(`CORPUS_DIR looks inside the repo (${dir}). Real samples must stay outside.`);
    process.exit(2);
  }

  const { core, mergeJob, cleanup } = loadMergeCore();
  const {
    parseSubtitle,
    alignSubtitlesIndustrial,
    mergeSubtitles,
    decodeBuffer,
    timeToMs,
    cleanSubtitleContent,
  } = core;
  const { executeMergeJob } = mergeJob;

  assert.equal(typeof timeToMs, 'function', 'subtitleCore.timeToMs missing');
  assert.equal(typeof cleanSubtitleContent, 'function', 'subtitleCore.cleanSubtitleContent missing');
  assert.equal(typeof mergeSubtitles, 'function', 'subtitleCore.mergeSubtitles missing');
  assert.equal(typeof executeMergeJob, 'function', 'mergeJob.executeMergeJob missing');

  const helpers = { timeToMs, cleanSubtitleContent };

  const readTrack = (file) => {
    const buf = readFileSync(file);
    if (typeof decodeBuffer === 'function') return decodeBuffer(buf).text;
    return buf.toString('utf8');
  };

  const noopEmit = () => {};

  try {
    mkdirSync(baselineDir, { recursive: true });
    const samples = listSamples(dir);
    assert.ok(samples.length >= 1, `no sample folders under ${dir}`);

    let failed = 0;
    let recorded = 0;
    let checked = 0;

    for (const sample of samples) {
      const sampleDir = join(dir, sample);
      const zhFile = pickTrack(sampleDir, 'zh');
      const enFile = ['en', 'ja', 'ko', 'fr', 'es', 'pt'].map((lang) => pickTrack(sampleDir, lang)).find(Boolean);
      const bilingualFile = pickTrack(sampleDir, 'bilingual');

      /** @type {Record<string, ReturnType<typeof modePayload>>} */
      let modes = {};
      let pairing;
      /** @type {{ file: string, rows: unknown[] }[]} */
      let inputTracks = [];

      if (zhFile && enFile) {
        const zhText = readTrack(zhFile);
        const enText = readTrack(enFile);
        const zhRows = parseSubtitle(zhText);
        const enRows = parseSubtitle(enText);
        pairing = 'dual';
        inputTracks = [
          { file: basename(zhFile), rows: zhRows },
          { file: basename(enFile), rows: enRows },
        ];

        const standardRows = mergeSubtitles(zhRows, enRows);
        modes.standard = modePayload(standardRows, 'standard', inputTracks, helpers);

        const industrialRows = alignSubtitlesIndustrial(zhRows, enRows);
        modes.industrial = modePayload(industrialRows, 'industrial', inputTracks, helpers);

        // Real product path: start standard; may auto-upgrade to industrial.
        // elapsedMs (Date.now) is intentionally dropped — never recorded.
        const autoResult = executeMergeJob(
          {
            zhText,
            enText,
            commentaryText: '',
            mode: 'standard',
            bilingualSingle: false,
          },
          noopEmit,
        );
        modes.auto = modePayload(autoResult.rows, autoResult.usedMode, inputTracks, helpers);
      } else if (bilingualFile) {
        const biText = readTrack(bilingualFile);
        const biRows = parseSubtitle(biText);
        pairing = 'bilingual';
        inputTracks = [{ file: basename(bilingualFile), rows: biRows }];

        const biResult = executeMergeJob(
          {
            zhText: biText,
            enText: '',
            commentaryText: '',
            mode: 'standard',
            bilingualSingle: true,
          },
          noopEmit,
        );
        modes.bilingual = modePayload(biResult.rows, biResult.usedMode, inputTracks, helpers);
      } else {
        console.warn(`skip ${sample}: no zh+secondary or bilingual track`);
        continue;
      }

      const payload = {
        format: FORMAT,
        sample,
        pairing,
        inputs: inputTracks.map((t) => ({ file: t.file, cues: t.rows.length })),
        modes,
      };
      const outFile = join(baselineDir, `${sample}.json`);
      const summary = sampleSummary(payload);

      if (args.record) {
        writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
        recorded += 1;
        console.log(`recorded ${sample} (${summary})`);
        continue;
      }

      if (!existsSync(outFile)) {
        console.error(`missing baseline for ${sample}: ${outFile} (re-run with --record)`);
        failed += 1;
        continue;
      }

      const expected = JSON.parse(readFileSync(outFile, 'utf8'));
      checked += 1;

      if (expected.format !== FORMAT) {
        console.error(
          `FAIL ${sample}: baseline format ${expected.format ?? '(none/v1)'} ≠ ${FORMAT}; `
          + `re-record with --record (old recordings are not compared)`,
        );
        failed += 1;
        continue;
      }

      let sampleFailed = false;

      if (expected.pairing !== payload.pairing) {
        console.error(`FAIL ${sample}: pairing ${payload.pairing} !== ${expected.pairing}`);
        sampleFailed = true;
      }

      const expectedModeNames = Object.keys(expected.modes || {}).sort();
      const actualModeNames = Object.keys(payload.modes).sort();
      if (JSON.stringify(expectedModeNames) !== JSON.stringify(actualModeNames)) {
        console.error(
          `FAIL ${sample}: modes [${actualModeNames.join(',')}] !== [${expectedModeNames.join(',')}]`,
        );
        sampleFailed = true;
      }

      const modeNames = pairing === 'dual' ? DUAL_MODES : ['bilingual'];
      for (const modeName of modeNames) {
        if (compareMode(sample, modeName, payload.modes[modeName], expected.modes?.[modeName])) {
          sampleFailed = true;
        }
      }

      if (sampleFailed) {
        failed += 1;
        console.error(`  summary ${sample}: ${summary}`);
      } else {
        console.log(`ok ${sample} (${summary})`);
      }
    }

    if (args.record) {
      console.log(`corpus-baseline: recorded ${recorded} sample(s) → ${baselineDir}`);
      process.exit(0);
    }
    if (failed > 0) {
      console.error(`corpus-baseline: ${failed} failure(s) of ${checked} checked`);
      process.exit(1);
    }
    console.log(`corpus-baseline: passed (${checked} sample(s))`);
  } finally {
    cleanup();
  }
}

main();
