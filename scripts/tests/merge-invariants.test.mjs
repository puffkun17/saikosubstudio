import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from './_compile.mjs';
import { checkMergeInvariants, snapshotMergeStructure, cuesToSrt } from './_mergeInvariants.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');

const goldenRoot = join(process.cwd(), 'scripts/fixtures/golden');
const auditRoot = join(process.cwd(), 'scripts/fixtures/audit');

function pickTrack(dir, lang) {
  return ['srt', 'ass'].map((ext) => join(dir, `${lang}.${ext}`)).find((file) => existsSync(file));
}

function runBothModes(zhSubs, enSubs) {
  return {
    standard: S.mergeSubtitles(zhSubs, enSubs),
    industrial: S.alignSubtitlesIndustrial(zhSubs, enSubs),
  };
}

test('invariants: all golden dual-track fixtures, both modes', () => {
  const samples = readdirSync(goldenRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.ok(samples.length >= 3);

  const summary = [];
  for (const sample of samples) {
    const dir = join(goldenRoot, sample);
    const zhFile = pickTrack(dir, 'zh');
    const enFile = ['en', 'ja', 'ko', 'fr', 'es', 'pt'].map((lang) => pickTrack(dir, lang)).find(Boolean);
    if (!zhFile || !enFile) continue; // bilingual-only samples skip here

    const zhSubs = S.parseSubtitle(S.decodeBuffer(readFileSync(zhFile)).text);
    const enSubs = S.parseSubtitle(S.decodeBuffer(readFileSync(enFile)).text);
    const modes = runBothModes(zhSubs, enSubs);

    for (const [mode, rows] of Object.entries(modes)) {
      const result = checkMergeInvariants({
        primary: zhSubs,
        secondary: enSubs,
        rows,
        label: `${sample}/${mode}`,
      });
      summary.push({ sample, mode, ok: result.ok, stats: result.stats, errors: result.errors });
      assert.equal(result.ok, true, result.errors.join('\n') || `${sample}/${mode} invariants`);
    }
  }
  assert.ok(summary.length >= 6, `expected both modes on dual-track goldens, got ${summary.length}`);
});

test('invariants: audit V5–V9 fixtures, both modes (post-P1 expectations)', async (t) => {
  // Imported by merge-audit-repro for detailed assertions; here we only run global invariants
  // on fixtures that should conserve cues after P1 fixes.
  const v5 = JSON.parse(readFileSync(join(auditRoot, 'v5-coverage-drop.json'), 'utf8'));
  const v6 = JSON.parse(readFileSync(join(auditRoot, 'v6-unsorted.json'), 'utf8'));
  const v8 = JSON.parse(readFileSync(join(auditRoot, 'v8-punctuation.json'), 'utf8'));

  const cases = [
    ['V5', v5.zh, v5.en],
    ['V6', v6.zh, v6.en],
  ];

  for (const [id, zh, en] of cases) {
    await t.test(id, () => {
      const zhSubs = S.parseSubtitle(cuesToSrt(zh, S.msToTime));
      const enSubs = S.parseSubtitle(cuesToSrt(en, S.msToTime));
      for (const [mode, rows] of Object.entries(runBothModes(zhSubs, enSubs))) {
        const result = checkMergeInvariants({ primary: zhSubs, secondary: enSubs, rows, label: `${id}/${mode}` });
        assert.equal(result.ok, true, result.errors.join('\n'));
      }
    });
  }

  await t.test('V8 punctuation samples', () => {
    for (const sample of v8.samples) {
      const zhSubs = S.parseSubtitle(cuesToSrt([[0, 1000, sample.zh]], S.msToTime));
      const enSubs = S.parseSubtitle(cuesToSrt([[0, 1000, sample.en]], S.msToTime));
      for (const [mode, rows] of Object.entries(runBothModes(zhSubs, enSubs))) {
        const result = checkMergeInvariants({ primary: zhSubs, secondary: enSubs, rows, label: `V8/${mode}` });
        assert.equal(result.ok, true, result.errors.join('\n'));
      }
    }
  });

  await t.test('V7 ASS duplicate layer', () => {
    const zhSubs = S.parseSubtitle(readFileSync(join(auditRoot, 'v7-ass-duplicate-layer.ass'), 'utf8'));
    const enSubs = S.parseSubtitle(readFileSync(join(auditRoot, 'v7-en.srt'), 'utf8'));
    for (const [mode, rows] of Object.entries(runBothModes(zhSubs, enSubs))) {
      const result = checkMergeInvariants({ primary: zhSubs, secondary: enSubs, rows, label: `V7/${mode}` });
      assert.equal(result.ok, true, result.errors.join('\n'));
    }
  });
});

test('snapshotMergeStructure: shape includes kind/method/cue refs', () => {
  const zh = S.parseSubtitle(cuesToSrt([[0, 2000, '你好。'], [3000, 5000, '走吧。']], S.msToTime));
  const en = S.parseSubtitle(cuesToSrt([[0, 2000, 'Hello.'], [3000, 5000, 'Go.']], S.msToTime));
  const snap = snapshotMergeStructure(S.mergeSubtitles(zh, en));
  assert.ok(snap.length >= 2);
  for (const row of snap) {
    assert.ok('method' in row && 'primaryCue' in row && 'secondaryCue' in row && 'text' in row && 'cueKind' in row);
  }
});
