/**
 * Merge-structure snapshot harness: runs BOTH standard (mergeSubtitles) and
 * industrial (alignSubtitlesIndustrial) on fixtures and snapshots row structure
 * (kind, match type, source cue indexes, times, text) — not just export text.
 *
 * UPDATE_MERGE_SNAPSHOTS=1 refreshes scripts/fixtures/merge-structure/*.json
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from './_compile.mjs';
import { snapshotMergeStructure, cuesToSrt } from './_mergeInvariants.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');

const goldenRoot = join(process.cwd(), 'scripts/fixtures/golden');
const auditRoot = join(process.cwd(), 'scripts/fixtures/audit');
const snapRoot = join(process.cwd(), 'scripts/fixtures/merge-structure');
const update = process.env.UPDATE_MERGE_SNAPSHOTS === '1';

function pickTrack(dir, lang) {
  return ['srt', 'ass'].map((ext) => join(dir, `${lang}.${ext}`)).find((file) => existsSync(file));
}

function readTrack(file) {
  const buf = readFileSync(file);
  return S.decodeBuffer(buf).text;
}

function assertSnapshot(name, payload) {
  mkdirSync(snapRoot, { recursive: true });
  const file = join(snapRoot, `${name}.json`);
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  if (update) {
    writeFileSync(file, text);
    return;
  }
  assert.ok(
    existsSync(file),
    `missing merge-structure snapshot ${name}.json — run UPDATE_MERGE_SNAPSHOTS=1 npm run test:unit`,
  );
  const expected = readFileSync(file, 'utf8');
  assert.equal(text, expected, `merge-structure snapshot mismatch: ${name} (run UPDATE_MERGE_SNAPSHOTS=1 to refresh)`);
}

function structureForPair(zhSubs, enSubs) {
  return {
    standard: snapshotMergeStructure(S.mergeSubtitles(zhSubs, enSubs)),
    industrial: snapshotMergeStructure(S.alignSubtitlesIndustrial(zhSubs, enSubs)),
  };
}

test('merge-structure snapshots: golden dual-track samples (both modes)', () => {
  const samples = readdirSync(goldenRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let counted = 0;
  for (const sample of samples) {
    const dir = join(goldenRoot, sample);
    const zhFile = pickTrack(dir, 'zh');
    const enFile = ['en', 'ja', 'ko', 'fr', 'es', 'pt'].map((lang) => pickTrack(dir, lang)).find(Boolean);
    if (!zhFile || !enFile) continue;
    const zhSubs = S.parseSubtitle(readTrack(zhFile));
    const enSubs = S.parseSubtitle(readTrack(enFile));
    assertSnapshot(`golden-${sample}`, {
      sample,
      primaryCount: zhSubs.length,
      secondaryCount: enSubs.length,
      ...structureForPair(zhSubs, enSubs),
    });
    counted += 1;
  }
  assert.ok(counted >= 3, `expected golden dual-track snapshots, got ${counted}`);
});

test('merge-structure snapshots: audit V5/V6/V9 synthetic pairs', () => {
  const v5 = JSON.parse(readFileSync(join(auditRoot, 'v5-coverage-drop.json'), 'utf8'));
  const v6 = JSON.parse(readFileSync(join(auditRoot, 'v6-unsorted.json'), 'utf8'));
  const v9 = JSON.parse(readFileSync(join(auditRoot, 'v9-packed-srt.json'), 'utf8'));

  const v5zh = S.parseSubtitle(cuesToSrt(v5.zh, S.msToTime));
  const v5en = S.parseSubtitle(cuesToSrt(v5.en, S.msToTime));
  assertSnapshot('audit-v5-coverage-drop', { id: 'V5', ...structureForPair(v5zh, v5en) });

  const v6zh = S.parseSubtitle(cuesToSrt(v6.zh, S.msToTime));
  const v6en = S.parseSubtitle(cuesToSrt(v6.en, S.msToTime));
  assertSnapshot('audit-v6-unsorted', { id: 'V6', ...structureForPair(v6zh, v6en) });

  const v9Srt = `1\n00:00:00,000 --> 00:00:04,000\n${v9.zhSrtMultiline}\n`;
  const v9zh = S.parseSubtitle(v9Srt);
  const v9en = S.parseSubtitle(cuesToSrt(v9.en, S.msToTime));
  assertSnapshot('audit-v9-packed-srt', { id: 'V9', parsedPrimaryText: v9zh.map((c) => c.text), ...structureForPair(v9zh, v9en) });
});
