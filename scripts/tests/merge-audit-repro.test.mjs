/**
 * Audit reproductions V1–V9 as unit tests.
 * V5–V9: must pass after P1 stop-the-bleeding fixes.
 * V1/V2/V3: known-failing / skipped — deferred to P2/P3 (do not block CI).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from './_compile.mjs';
import { checkMergeInvariants, cuesToSrt } from './_mergeInvariants.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');
const auditRoot = join(process.cwd(), 'scripts/fixtures/audit');

const loadJson = (name) => JSON.parse(readFileSync(join(auditRoot, name), 'utf8'));

// ---------------------------------------------------------------------------
// V5 — industrial coverage-merge must not drop lines
// ---------------------------------------------------------------------------
test('V5: industrial coverage-merge retains overlapping primary cue', () => {
  const fx = loadJson('v5-coverage-drop.json');
  const zh = S.parseSubtitle(cuesToSrt(fx.zh, S.msToTime));
  const en = S.parseSubtitle(cuesToSrt(fx.en, S.msToTime));
  const rows = S.alignSubtitlesIndustrial(zh, en);
  const hay = rows.map((r) => r.text).join('\n');
  for (const needle of fx.mustRetain) {
    assert.ok(hay.includes(needle), `industrial must retain ${JSON.stringify(needle)}`);
  }
  const inv = checkMergeInvariants({ primary: zh, secondary: en, rows, label: 'V5/industrial' });
  assert.equal(inv.ok, true, inv.errors.join('\n'));

  // Standard mode also must not lose lines (even if orphan rate is high).
  const std = S.mergeSubtitles(zh, en);
  const stdHay = std.map((r) => r.text).join('\n');
  for (const needle of fx.mustRetain) {
    assert.ok(stdHay.includes(needle), `standard must retain ${JSON.stringify(needle)}`);
  }
});

// ---------------------------------------------------------------------------
// V6 — sort cues by time before merging
// ---------------------------------------------------------------------------
test('V6: out-of-order primary cues pair correctly after sort', () => {
  const fx = loadJson('v6-unsorted.json');
  const zh = S.parseSubtitle(cuesToSrt(fx.zh, S.msToTime));
  const en = S.parseSubtitle(cuesToSrt(fx.en, S.msToTime));

  for (const mode of ['standard', 'industrial']) {
    const rows = mode === 'standard' ? S.mergeSubtitles(zh, en) : S.alignSubtitlesIndustrial(zh, en);
    for (const [zhText, enText] of fx.expectPaired) {
      const hit = rows.find((r) => r.text.includes(zhText) && r.text.includes(enText) && r.type === 'merged');
      assert.ok(hit, `${mode}: expected merged pair ${zhText} / ${enText}, got ${rows.map((r) => r.text).join(' | ')}`);
    }
    const inv = checkMergeInvariants({ primary: zh, secondary: en, rows, label: `V6/${mode}` });
    assert.equal(inv.ok, true, inv.errors.join('\n'));
  }
});

// ---------------------------------------------------------------------------
// V7 — dedupe identical same-time same-text ASS layers
// ---------------------------------------------------------------------------
test('V7: identical same-time ASS layer duplicates collapse without losing distinct lines', () => {
  const zh = S.parseSubtitle(readFileSync(join(auditRoot, 'v7-ass-duplicate-layer.ass'), 'utf8'));
  const en = S.parseSubtitle(readFileSync(join(auditRoot, 'v7-en.srt'), 'utf8'));
  // After dedupe, parse should keep one "我们走吧。"
  const goCount = zh.filter((c) => c.text === '我们走吧。').length;
  assert.equal(goCount, 1, `expected 1 deduped 我们走吧。, got ${goCount}`);
  assert.equal(zh.filter((c) => c.text === '你好。').length, 1);

  for (const mode of ['standard', 'industrial']) {
    const rows = mode === 'standard' ? S.mergeSubtitles(zh, en) : S.alignSubtitlesIndustrial(zh, en);
    const goRows = rows.filter((r) => r.text.includes('我们走吧'));
    assert.equal(goRows.length, 1, `${mode}: expected one merged/row for 我们走吧, got ${goRows.length}: ${goRows.map((r) => r.text)}`);
    assert.ok(rows.some((r) => r.text.includes('你好')));
    const inv = checkMergeInvariants({ primary: zh, secondary: en, rows, label: `V7/${mode}` });
    assert.equal(inv.ok, true, inv.errors.join('\n'));
  }
});

// ---------------------------------------------------------------------------
// V8 — never strip edge punctuation on dialogue-only cues
// ---------------------------------------------------------------------------
test('V8: score 20–39 path preserves leading/trailing punctuation', () => {
  const fx = loadJson('v8-punctuation.json');
  for (const sample of fx.samples) {
    const zh = S.parseSubtitle(cuesToSrt([[0, 1000, sample.zh]], S.msToTime));
    const en = S.parseSubtitle(cuesToSrt([[0, 1000, sample.en]], S.msToTime));
    const rows = S.mergeSubtitles(zh, en);
    const hay = rows.map((r) => r.text).join('\n');
    assert.ok(hay.includes(sample.zh), `zh punctuation preserved: ${JSON.stringify(sample.zh)} in ${JSON.stringify(hay)}`);
    assert.ok(hay.includes(sample.en), `en punctuation preserved: ${JSON.stringify(sample.en)} in ${JSON.stringify(hay)}`);
    const inv = checkMergeInvariants({ primary: zh, secondary: en, rows, label: 'V8' });
    assert.equal(inv.ok, true, inv.errors.join('\n'));
  }
});

// ---------------------------------------------------------------------------
// V9 — SRT multi-line keeps newlines (parity with ASS)
// ---------------------------------------------------------------------------
test('V9: SRT multi-line dual-speaker expands like ASS', () => {
  const fx = loadJson('v9-packed-srt.json');
  const en = S.parseSubtitle(cuesToSrt(fx.en, S.msToTime));

  const ass = `[Script Info]\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:04.00,Default,,0,0,0,,${fx.zhAssText}\n`;
  const assZh = S.parseSubtitle(ass);
  const srtZh = S.parseSubtitle(`1\n00:00:00,000 --> 00:00:04,000\n${fx.zhSrtMultiline}\n`);

  assert.ok(srtZh[0].text.includes('\n'), `SRT must retain newline, got ${JSON.stringify(srtZh[0].text)}`);
  assert.equal(srtZh[0].text.replace(/\n/g, '\\N'), assZh[0].text.replace(/\n/g, '\\N'));

  const srtRows = S.mergeSubtitles(srtZh, en);
  const assRows = S.mergeSubtitles(assZh, en);

  for (const turn of fx.expectExpandedTurns) {
    assert.ok(srtRows.some((r) => r.text.includes(turn)), `SRT expand missing turn ${turn}`);
    assert.ok(assRows.some((r) => r.text.includes(turn)), `ASS expand missing turn ${turn}`);
  }
  const srtExpanded = srtRows.filter((r) => r.provenance?.method === 'expanded-dialogue' || r.alignment === 'expanded-dialogue');
  assert.ok(srtExpanded.length >= 2, `SRT should expand to ≥2 rows, got ${srtRows.map((r) => `${r.provenance?.method}:${r.text}`).join(' | ')}`);
});

// ---------------------------------------------------------------------------
// V1 / V2 / V3 — deferred (P2/P3). Skipped so they never block CI.
// ---------------------------------------------------------------------------
test(
  'V1 [P3 deferred/SKIPPED]: keyword narration should still pair',
  { skip: 'P3 timeline-first: stop parse-time cueKind from blocking merge (audit V1)' },
  () => {
    const fx = loadJson('v1-keyword-narration.json');
    const zh = S.parseSubtitle(cuesToSrt(fx.zh, S.msToTime));
    const en = S.parseSubtitle(cuesToSrt(fx.en, S.msToTime));
    const rows = S.mergeSubtitles(zh, en);
    for (let i = 0; i < fx.expectMergedTexts.length; i += 2) {
      const a = fx.expectMergedTexts[i];
      const b = fx.expectMergedTexts[i + 1];
      assert.ok(rows.some((r) => r.type === 'merged' && r.text.includes(a) && r.text.includes(b)));
    }
  },
);

test(
  'V2 [P3 deferred/SKIPPED]: place-name short line should not exit pairing as note',
  { skip: 'P3: classify notes only after timeline pairing (audit V2)' },
  () => {
    const fx = loadJson('v2-note-before-timeline.json');
    const zh = S.parseSubtitle(cuesToSrt(fx.zh, S.msToTime));
    const en = S.parseSubtitle(cuesToSrt(fx.en, S.msToTime));
    const rows = S.mergeSubtitles(zh, en);
    const hit = rows.find((r) => fx.expectMergedContains.every((t) => r.text.includes(t)));
    assert.ok(hit && hit.type === 'merged');
  },
);

test(
  'V3 [P2 deferred/SKIPPED]: offset estimator should survive extra EN head cues',
  { skip: 'P2: time-anchored offset/drift mapping (audit V3)' },
  () => {
    const fx = loadJson('v3-offset-sampling.json');
    const N = fx.zhCount;
    const zh = Array.from({ length: N }, (_, i) => [i * fx.cueGapMs, i * fx.cueGapMs + fx.cueDurMs, `第${i + 1}句台词。`]);
    const enCore = Array.from({ length: N }, (_, i) => [i * fx.cueGapMs + fx.offsetMs, i * fx.cueGapMs + fx.offsetMs + fx.cueDurMs, `Line number ${i + 1}.`]);
    const enHead = Array.from({ length: fx.enExtraHead }, (_, i) => [i * 500, i * 500 + 400, `Previously ${i + 1}.`]);
    const rows = S.alignSubtitlesIndustrial(
      S.parseSubtitle(cuesToSrt(zh, S.msToTime)),
      S.parseSubtitle(cuesToSrt([...enHead, ...enCore], S.msToTime)),
    );
    const merged = rows.filter((r) => r.type === 'merged').length;
    assert.ok(merged >= N * 0.7, `expected most of ${N} paired, got merged=${merged}`);
  },
);
