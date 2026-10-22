#!/usr/bin/env node
/**
 * Corpus baseline harness — runs the real merge pipeline over a directory of
 * subtitle samples, records cue-level outputs, and diffs later runs.
 *
 * Recording format version 2 adds numeric start/end (ms), per-file input cue
 * counts, and a loss measure (input cues whose cleaned text is absent from
 * output within a ±2s window). Older recordings (no format / format ≠ 2) fail
 * compare with a re-record instruction — they never silently pass.
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
 * or a single bilingual.(srt|ass).
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
const FORMAT = 2;

/** Time window (ms) for text-presence loss checks — mirrors runCorpus ±2s. */
const LOSS_TIME_SLACK_MS = 2000;

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
  const core = createRequire(join(out, 'x.js'))('./utils/subtitleCore.js');
  const cleanup = () => {
    try { rmSync(out, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  return { core, cleanup };
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

function sampleSummary(payload) {
  const inCues = (payload.inputs || []).reduce((n, t) => n + (t.cues || 0), 0);
  return `in=${inCues} out=${payload.rowCount} lost=${payload.loss?.lost ?? 0}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/corpus-baseline.mjs [--dir DIR] [--baseline DIR] [--record]

Env:
  CORPUS_DIR            sample root (default: scripts/fixtures/corpus-synthetic)
  CORPUS_BASELINE_DIR   recording root (default: <dir>/baseline for synthetic;
                        required + must be outside the repo for a real corpus)

Recording format: ${FORMAT} (numeric start/end ms, inputs[], loss).
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

  const { core, cleanup } = loadMergeCore();
  const {
    parseSubtitle,
    alignSubtitlesIndustrial,
    normalizeSingleBilingualRows,
    decodeBuffer,
    timeToMs,
    cleanSubtitleContent,
  } = core;

  assert.equal(typeof timeToMs, 'function', 'subtitleCore.timeToMs missing');
  assert.equal(typeof cleanSubtitleContent, 'function', 'subtitleCore.cleanSubtitleContent missing');

  const readTrack = (file) => {
    const buf = readFileSync(file);
    if (typeof decodeBuffer === 'function') return decodeBuffer(buf).text;
    return buf.toString('utf8');
  };

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

      let rows;
      let mode;
      /** @type {{ file: string, rows: unknown[] }[]} */
      let inputTracks = [];

      if (zhFile && enFile) {
        const zhText = readTrack(zhFile);
        const enText = readTrack(enFile);
        const zhRows = parseSubtitle(zhText);
        const enRows = parseSubtitle(enText);
        rows = alignSubtitlesIndustrial(zhRows, enRows);
        mode = 'dual';
        inputTracks = [
          { file: basename(zhFile), rows: zhRows },
          { file: basename(enFile), rows: enRows },
        ];
      } else if (bilingualFile) {
        const biText = readTrack(bilingualFile);
        const biRows = parseSubtitle(biText);
        rows = normalizeSingleBilingualRows(biRows);
        mode = 'bilingual';
        inputTracks = [{ file: basename(bilingualFile), rows: biRows }];
      } else {
        console.warn(`skip ${sample}: no zh+secondary or bilingual track`);
        continue;
      }

      const loss = measureLoss(inputTracks, rows, { timeToMs, cleanSubtitleContent });
      const payload = {
        format: FORMAT,
        sample,
        mode,
        rowCount: rows.length,
        inputs: inputTracks.map((t) => ({ file: t.file, cues: t.rows.length })),
        loss: {
          lost: loss.lost,
          perFile: loss.perFile,
        },
        cues: rows.map((row, i) => cueFingerprint(row, i, timeToMs)),
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

      if (expected.rowCount !== payload.rowCount) {
        console.error(`FAIL ${sample}: rowCount ${payload.rowCount} !== ${expected.rowCount}`);
        sampleFailed = true;
      }

      const expectedLost = expected.loss?.lost ?? 0;
      if (payload.loss.lost > expectedLost) {
        console.error(
          `FAIL ${sample}: loss increased ${payload.loss.lost} > ${expectedLost} (recorded)`,
        );
        sampleFailed = true;
      }

      const changes = diffCues(payload.cues, expected.cues || []);
      if (changes.length > 0) {
        console.error(`FAIL ${sample}: ${changes.length} cue change(s)`);
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
        console.error(`  json: ${firstDiff(payload, expected).split('\n').slice(0, 4).join('\n  ')}`);
        sampleFailed = true;
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
