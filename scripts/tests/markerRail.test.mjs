import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const rail = loadCore()('core/markerRail');
const review = loadCore()('core/workbenchReview');

test('marker rail: 40 buckets, levels by count, first hit for jump', () => {
  const totalLines = 733;
  // 733/40 ≈ 18.325 lines per bucket — pack 5 hits into one bucket (arrayIndex 200–204
  // can split across buckets, so use a tight cluster well inside one bucket).
  const hits = [
    { arrayIndex: 0, lineNumber: 1 },
    { arrayIndex: 10, lineNumber: 11 },
    { arrayIndex: 11, lineNumber: 12 },
    { arrayIndex: 220, lineNumber: 221 },
    { arrayIndex: 221, lineNumber: 222 },
    { arrayIndex: 222, lineNumber: 223 },
    { arrayIndex: 223, lineNumber: 224 },
    { arrayIndex: 224, lineNumber: 225 },
  ];
  const model = rail.buildMarkerRail({ totalLines, hits, focus: 'screen' });
  assert.equal(model.bucketCount, 40);
  assert.equal(model.buckets.length, 40);
  const withHits = model.buckets.filter((b) => b.count > 0);
  assert.ok(withHits.length >= 2);
  const dense = model.buckets.find((b) => b.count >= 4);
  assert.ok(dense, `expected a 4+ bucket, got counts: ${model.buckets.map((b) => b.count).filter(Boolean)}`);
  assert.equal(dense.level, 3);
  assert.equal(typeof dense.firstHitArrayIndex, 'number');
  assert.match(rail.markerRailTooltip(dense, '标题告示'), /处标题告示/);
  assert.match(rail.markerRailTooltip(dense, '标题告示'), /点击跳到第一处/);
});

test('marker rail: empty timeline yields empty buckets', () => {
  const model = rail.buildMarkerRail({ totalLines: 0, hits: [] });
  assert.equal(model.totalLines, 0);
  assert.equal(model.buckets.every((b) => b.count === 0), true);
});

test('visible range fraction maps first/last array indexes', () => {
  const r = rail.visibleRangeFraction({
    totalLines: 100,
    firstVisibleArrayIndex: 10,
    lastVisibleArrayIndex: 29,
  });
  assert.equal(r.start, 0.1);
  assert.equal(r.end, 0.3);
});

test('review focus: structure vs suspect split and pager items', () => {
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '覆\nA', type: 'merged', cueKind: 'dialogue', alignment: 'coverage-merge' },
    {
      index: 2,
      ts: '00:00:03,000 --> 00:00:04,000',
      text: '存疑',
      type: 'note',
      cueKind: 'sound_caption',
      auxiliary: {
        category: 'ambient_sdh',
        confidence: 40,
        action: 'keep_auxiliary',
        reasons: [],
        suspicion: { kind: 'needs_review', confidence: 40, reasons: ['x'], detail: '不确定' },
      },
    },
    { index: 3, ts: '00:00:05,000 --> 00:00:06,000', text: '告示', type: 'note', cueKind: 'screen_text', auxiliary: { category: 'screen_text', confidence: 90, action: 'keep_auxiliary', reasons: [] } },
  ];
  const counts = review.computeReviewGroupCounts(rows, []);
  assert.ok(counts.structure >= 1);
  assert.ok(counts.suspect >= 1);
  assert.equal(counts.screen, 1);
  assert.equal(counts.reviewTotal, counts.structure + counts.suspect);

  const structureItems = review.buildPagerItems(rows, 'structure');
  assert.ok(structureItems.every((i) => i.kind === 'structure'));
  const screenItems = review.buildPagerItems(rows, 'screen');
  assert.equal(screenItems.length, 1);
  assert.equal(screenItems[0].lineNumbers[0], 3);

  const focused = review.focusedArrayIndexes(rows, 'screen');
  assert.ok(focused.has(2));
  assert.equal(focused.size, 1);
});

test('chars over time buckets sum to total chars', () => {
  const chars = loadCore()('core/charsOverTime');
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '你好世界' },
    { index: 2, ts: '00:00:10,000 --> 00:00:11,000', text: 'Hello' },
  ];
  const dist = chars.buildCharsOverTime(rows, { bucketCount: 10 });
  const sum = dist.buckets.reduce((n, b) => n + b.chars, 0);
  assert.equal(sum, dist.totalChars);
  assert.equal(dist.totalChars, 4 + 5);
  const vitals = chars.computeSubtitleVitals(rows);
  assert.equal(vitals.totalLines, 2);
  assert.equal(vitals.totalChars, 9);
});
