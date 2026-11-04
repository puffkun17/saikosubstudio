import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const measure = loadCore()('core/timelineMeasure');
const review = loadCore()('core/workbenchReview');
const diff = loadCore()('utils/timeline/alignmentDiff');

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

test('measure cycle: hit mode only while a filter is on', () => {
  assert.equal(measure.cycleMeasureMode('position', false), 'remain');
  assert.equal(measure.cycleMeasureMode('remain', false), 'position');
  assert.equal(measure.cycleMeasureMode('remain', true), 'hit');
  assert.equal(measure.cycleMeasureMode('hit', true), 'position');
  assert.equal(measure.activeMeasureMode('hit', false), 'position');
  assert.equal(measure.activeMeasureMode('remain', false), 'remain');
});

test('measure line is one reading; totals stay on the anchor', () => {
  const base = {
    filterActive: true,
    row: 4,
    total: 10,
    timeMs: 62_000,
    durationMs: 120_000,
    hitIndex: 2,
    hitCount: 5,
    hitTimeMs: 12_000,
  };
  assert.equal(measure.formatMeasureLine({ ...base, mode: 'position' }), '4 / 10 · 01:02');
  assert.equal(measure.formatMeasureLine({ ...base, mode: 'remain' }), '52%');
  assert.equal(measure.formatMeasureLine({ ...base, mode: 'hit' }), '2 / 5 · 00:12');
  assert.equal(
    measure.formatMeasureLine({ ...base, mode: 'hit', filterActive: false }),
    '4 / 10 · 01:02',
  );
  assert.equal(measure.formatDialAnchor(366, 24 * 60 * 1000), '366 · 24:00');
  assert.equal(measure.measurePercent(0, 0), 0);
});

test('hit ordinal prefers the current row, else the nearest hit', () => {
  const hits = [
    { rowIndex: 2, startMs: 5_000 },
    { rowIndex: 8, startMs: 20_000 },
  ];
  assert.deepEqual(measure.nearestHitOrdinal(hits, 5_100, 2), { index: 1, count: 2, timeMs: 5_000 });
  assert.deepEqual(measure.nearestHitOrdinal(hits, 18_000, 7), { index: 2, count: 2, timeMs: 20_000 });
  assert.deepEqual(measure.nearestHitOrdinal([], 1_000, 0), { index: 0, count: 0, timeMs: 1_000 });
});

test('dial ticks reuse review items and line kinds; checked rows drop 待核', () => {
  const rows = [
    { index: 1, ts: ts(10, 12), text: '标题', type: 'note', cueKind: 'screen_text' },
    { index: 2, ts: ts(20, 22), text: '甲\nA', type: 'merged', cueKind: 'dialogue', alignment: 'coverage-merge' },
    { index: 3, ts: ts(30, 32), text: 'song', type: 'lyrics', cueKind: 'lyrics' },
    {
      index: 4,
      ts: ts(40, 42),
      text: '也许',
      type: 'note',
      cueKind: 'narration',
      auxiliary: {
        category: 'speech_context',
        confidence: 20,
        action: 'keep_auxiliary',
        reasons: ['low'],
        suspicion: { kind: 'needs_review', confidence: 20, reasons: ['low'], detail: '不确定' },
      },
    },
  ];
  const open = measure.buildDialTicks(rows, []);
  const byRow = Object.fromEntries(open.map((tick) => [tick.rowIndex, tick.label]));
  assert.equal(byRow[0], '标题告示');
  assert.equal(byRow[1], '待核 · 结构差异');
  assert.equal(byRow[2], '歌词');
  assert.equal(byRow[3], '待核 · 类别待定');
  assert.equal(open[1].kind, 'review');

  const queue = diff.buildMergeReviewQueue(rows);
  const structureId = queue.items.find((item) => item.category !== 'other-suspect')?.id;
  assert.ok(structureId);
  const closed = measure.buildDialTicks(rows, [structureId]);
  const structure = closed.find((tick) => tick.rowIndex === 1);
  assert.equal(structure.label, '结构差异');
  assert.equal(structure.kind, 'structure');
});

test('待核 count is structure remaining plus suspect remaining', () => {
  const rows = [
    { index: 1, ts: ts(1, 3), text: '甲\nA', type: 'merged', cueKind: 'dialogue', alignment: 'coverage-merge' },
    {
      index: 2,
      ts: ts(4, 6),
      text: '也许',
      type: 'note',
      cueKind: 'narration',
      auxiliary: {
        category: 'speech_context',
        confidence: 20,
        action: 'keep_auxiliary',
        reasons: ['low'],
        suspicion: { kind: 'needs_review', confidence: 20, reasons: ['low'], detail: '不确定' },
      },
    },
    { index: 3, ts: ts(8, 9), text: '标题', type: 'note', cueKind: 'screen_text' },
  ];
  const open = review.computeReviewGroupCounts(rows, []);
  assert.equal(open.reviewRemaining, open.structureRemaining + open.suspectRemaining);
  assert.ok(open.structureRemaining >= 1);
  assert.ok(open.suspectRemaining >= 1);
  assert.equal(open.screen, 1);

  const queue = diff.buildMergeReviewQueue(rows);
  const closed = review.computeReviewGroupCounts(rows, queue.items.map((item) => item.id));
  assert.equal(closed.reviewRemaining, 0);
  assert.equal(closed.reviewRemaining, closed.structureRemaining + closed.suspectRemaining);
  assert.equal(closed.screen, 1);
});
