import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const score = loadCore()('core/workbenchScore');
const review = loadCore()('core/workbenchReview');

const ts = (start, end = start + 1) => {
  const fmt = (n) => {
    const s = Math.floor(n);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec},000`;
  };
  return `${fmt(start)} --> ${fmt(end)}`;
};

test('score: perfect bilingual pairs score high with no gaps', () => {
  const rows = [
    { index: 1, ts: ts(1), text: '你好\nHello', type: 'merged', cueKind: 'dialogue' },
    { index: 2, ts: ts(3), text: '再见\nBye', type: 'merged', cueKind: 'dialogue' },
  ];
  const s = score.computeWorkbenchScore({ rows, checkedIds: [] });
  assert.equal(s.longGapPenalty, 0);
  assert.equal(s.unresolvedReview, 0);
  assert.ok(s.quality >= 90);
  assert.ok(s.total >= 90);
  assert.equal(s.potential, s.total);
  assert.match(s.formulaZh.quality, /质量分/);
  assert.match(s.formulaZh.fit, /契合度/);
});

test('score: unresolved review items and long gaps lower quality; potential rises when cleared', () => {
  const rows = [
    { index: 1, ts: ts(1), text: 'A\nA', type: 'merged', cueKind: 'dialogue', alignment: 'coverage-merge' },
    { index: 2, ts: ts(3), text: 'B\nB', type: 'merged', cueKind: 'dialogue' },
    // Large gap (>90s and >8% of span) between 2 and 3
    { index: 3, ts: ts(200), text: 'C\nC', type: 'merged', cueKind: 'dialogue' },
  ];
  const open = score.computeWorkbenchScore({ rows, checkedIds: [] });
  assert.ok(open.unresolvedReview + open.unresolvedWatch >= 1);
  assert.ok(open.longGapPenalty === 12 || open.longGapPenalty === 22);
  assert.ok(open.quality < 100);
  assert.ok(open.potential >= open.total);

  // Mark all structure items checked — quality should ignore their penalties
  const { buildMergeReviewQueue } = loadCore()('utils/timeline/alignmentDiff');
  const queue = buildMergeReviewQueue(rows);
  const allIds = queue.items.map((i) => i.id);
  const closed = score.computeWorkbenchScore({ rows, checkedIds: allIds });
  assert.equal(closed.unresolvedReview, 0);
  assert.equal(closed.unresolvedWatch, 0);
  assert.ok(closed.quality >= open.quality);
  assert.ok(closed.total >= open.total);
});

test('applyLineKindOverride: confirming narration updates classifyLineKind', () => {
  const row = {
    index: 9,
    ts: ts(9),
    text: 'Once upon',
    type: 'note',
    cueKind: 'sound_caption',
    auxiliary: { category: 'ambient_sdh', confidence: 40, action: 'keep_auxiliary', reasons: [], suspicion: { kind: 'needs_review', confidence: 40, reasons: [], detail: '不确定' } },
  };
  const next = review.applyLineKindOverride(row, 'narration');
  const { classifyLineKind } = loadCore()('core/lineKinds');
  assert.equal(classifyLineKind(next), 'narration');
  assert.equal(next.cueKind, 'narration');
  assert.equal(next.auxiliary.confidence, 100);
  assert.equal(next.auxiliary.suspicion, undefined);
});
