#!/usr/bin/env node
/**
 * Corpus baseline harness — runs the real merge pipeline over a directory of
 * subtitle samples, records cue-level outputs, and diffs later runs.
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
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

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

function cueFingerprint(row, index) {
  return {
    i: index,
    type: row.type ?? null,
    cueKind: row.cueKind ?? null,
    ts: row.ts ?? null,
    start: row.start ?? null,
    end: row.end ?? null,
    text: row.text ?? '',
  };
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
    if (a.text !== e.text || a.ts !== e.ts || a.type !== e.type || a.cueKind !== e.cueKind) {
      changes.push({ index: i, kind: 'changed', expected: e, actual: a });
    }
  }
  return changes;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/corpus-baseline.mjs [--dir DIR] [--baseline DIR] [--record]

Env:
  CORPUS_DIR            sample root (default: scripts/fixtures/corpus-synthetic)
  CORPUS_BASELINE_DIR   recording root (default: <dir>/baseline for synthetic;
                        required + must be outside the repo for a real corpus)
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
  } = core;

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
      if (zhFile && enFile) {
        rows = alignSubtitlesIndustrial(parseSubtitle(readTrack(zhFile)), parseSubtitle(readTrack(enFile)));
        mode = 'dual';
      } else if (bilingualFile) {
        rows = normalizeSingleBilingualRows(parseSubtitle(readTrack(bilingualFile)));
        mode = 'bilingual';
      } else {
        console.warn(`skip ${sample}: no zh+secondary or bilingual track`);
        continue;
      }

      const payload = {
        sample,
        mode,
        rowCount: rows.length,
        cues: rows.map((row, i) => cueFingerprint(row, i)),
      };
      const outFile = join(baselineDir, `${sample}.json`);

      if (args.record) {
        writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
        recorded += 1;
        console.log(`recorded ${sample} (${payload.rowCount} cues)`);
        continue;
      }

      if (!existsSync(outFile)) {
        console.error(`missing baseline for ${sample}: ${outFile} (re-run with --record)`);
        failed += 1;
        continue;
      }

      const expected = JSON.parse(readFileSync(outFile, 'utf8'));
      checked += 1;
      if (expected.rowCount !== payload.rowCount) {
        console.error(`FAIL ${sample}: rowCount ${payload.rowCount} !== ${expected.rowCount}`);
        failed += 1;
        continue;
      }
      const changes = diffCues(payload.cues, expected.cues || []);
      if (changes.length > 0) {
        console.error(`FAIL ${sample}: ${changes.length} cue change(s)`);
        for (const c of changes.slice(0, 8)) {
          if (c.kind === 'changed') {
            console.error(`  cue ${c.index}: text/ts/type changed`);
            console.error(`    was: ${JSON.stringify(c.expected.text)} @ ${c.expected.ts}`);
            console.error(`    now: ${JSON.stringify(c.actual.text)} @ ${c.actual.ts}`);
          } else {
            console.error(`  cue ${c.index}: ${c.kind}`);
          }
        }
        if (changes.length > 8) console.error(`  … +${changes.length - 8} more`);
        console.error(`  json: ${firstDiff(payload, expected).split('\n').slice(0, 4).join('\n  ')}`);
        failed += 1;
      } else {
        console.log(`ok ${sample} (${payload.rowCount} cues)`);
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
