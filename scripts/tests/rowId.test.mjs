/**
 * Stable merged-row ids: fingerprint ignores display index; re-merge is deterministic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_EN, LINES_ZH, timeline, toSrt } from './_fixtures.mjs';

const core = loadCore();
const id = core('core/identity');
const { executeMergeJob } = core('core/mergeJob');

test('mintRowId: kind row, ignores display index, provenance-stable', () => {
  const prov = {
    ts: '00:00:01,000 --> 00:00:02,000',
    text: '你好\nHello',
    type: 'merged',
    cueKind: 'dialogue',
    provenance: {
      method: 'exact-match',
      timingSource: 'primary',
      primary: { cueIndex: 1, ts: '00:00:01,000 --> 00:00:02,000' },
      secondary: { cueIndex: 1, ts: '00:00:01,000 --> 00:00:02,000' },
    },
  };
  const a = id.mintRowId(prov);
  const b = id.mintRowId({ ...prov, index: 99 });
  assert.equal(a, b);
  assert.equal(id.isId(a, 'row'), true);
  assert.equal(id.parseId(a).kind, 'row');

  const other = id.mintRowId({
    ...prov,
    provenance: {
      ...prov.provenance,
      primary: { cueIndex: 2, ts: prov.provenance.primary.ts },
    },
  });
  assert.notEqual(a, other);

  const bare = id.mintRowId({
    ts: prov.ts,
    text: '[door]',
    type: 'note',
    cueKind: 'sound_caption',
    sourceIndex: 3,
  });
  assert.equal(id.isId(bare, 'row'), true);
  assert.notEqual(
    bare,
    id.mintRowId({ ts: prov.ts, text: '[door]', type: 'note', cueKind: 'sound_caption', sourceIndex: 4 }),
  );
});

test('merge job: every row has rowId; two runs identical; unique within result', () => {
  const t = timeline(12, 4);
  const input = {
    zhText: toSrt(LINES_ZH.slice(0, 12), t),
    enText: toSrt(LINES_EN.slice(0, 12), timeline(12, 4, 0, 60)),
    commentaryText: '',
    mode: 'standard',
    bilingualSingle: false,
  };
  const a = executeMergeJob(input, () => {});
  const b = executeMergeJob(input, () => {});
  assert.ok(a.rows.length >= 10);
  assert.equal(a.rows.length, b.rows.length);
  for (let i = 0; i < a.rows.length; i += 1) {
    assert.ok(id.isId(a.rows[i].rowId, 'row'), `row ${i} missing rowId`);
    assert.equal(a.rows[i].rowId, b.rows[i].rowId);
    assert.equal(a.rows[i].index, i + 1);
  }
  const ids = a.rows.map((r) => r.rowId);
  assert.equal(new Set(ids).size, ids.length, 'rowIds must be unique within one merge');
});

test('bilingual-single path also mints rowIds', () => {
  const bi = `1\n00:00:01,000 --> 00:00:02,000\n你好\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\n再见\nBye\n`;
  const res = executeMergeJob({
    zhText: bi, enText: '', commentaryText: '', mode: 'standard', bilingualSingle: true,
  }, () => {});
  assert.ok(res.rows.length >= 2);
  assert.ok(res.rows.every((r) => id.isId(r.rowId, 'row')));
  const again = executeMergeJob({
    zhText: bi, enText: '', commentaryText: '', mode: 'standard', bilingualSingle: true,
  }, () => {});
  assert.deepEqual(res.rows.map((r) => r.rowId), again.rows.map((r) => r.rowId));
});

test('mintRowIdDisambiguated: #2/#3 suffixes; parseable', () => {
  const row = { ts: '00:00:01,000 --> 00:00:02,000', text: 'same', type: 'dialogue' };
  const a = id.mintRowIdDisambiguated(row, 1);
  const b = id.mintRowIdDisambiguated(row, 2);
  const c = id.mintRowIdDisambiguated(row, 3);
  assert.equal(a, id.mintRowId(row));
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.equal(id.isId(b, 'row'), true);
  assert.match(id.parseId(b).body, /#2$/);
  assert.match(id.parseId(c).body, /#3$/);
});

test('bilingual: identical cues stay unique (sourceIndex + occurrence suffix)', () => {
  const { normalizeSingleBilingualRows } = core('utils/subtitle/engine');
  // parseSubtitle dedupes identical same-time cues — feed RawSub[] directly.
  const raw = [
    { ts: '00:00:01,000 --> 00:00:02,000', text: '重复' },
    { ts: '00:00:01,000 --> 00:00:02,000', text: '重复' },
    { ts: '00:00:01,000 --> 00:00:02,000', text: '重复' },
  ];
  const rows = normalizeSingleBilingualRows(raw);
  assert.equal(rows.length, 3);
  const ids = rows.map((r) => r.rowId);
  assert.equal(new Set(ids).size, 3, `unique rowIds required, got ${ids.join(',')}`);
  assert.deepEqual(normalizeSingleBilingualRows(raw).map((r) => r.rowId), ids);
});

test('same fingerprint → occurrence #2/#3 in finalize order (same-source split stand-in)', () => {
  // Simulate two output rows that share provenance fingerprint (same sources + text).
  const twin = {
    ts: '00:00:01,000 --> 00:00:02,000',
    text: '同一句\nSame',
    type: 'merged',
    cueKind: 'dialogue',
    provenance: {
      method: 'coverage-merge',
      timingSource: 'secondary',
      groupId: 'cover-1-2',
      primary: { cueIndex: 1, ts: '00:00:01,000 --> 00:00:03,000' },
      secondary: { cueIndex: 2, ts: '00:00:01,000 --> 00:00:02,000' },
    },
  };
  const ids = [1, 2, 3].map((n) => id.mintRowIdDisambiguated(twin, n));
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[0], id.mintRowId(twin));
  assert.match(id.parseId(ids[1]).body, /#2$/);
});

test('re-merge / insert / delete: review ids and rowIds do not shift to other cues', () => {
  const { buildMergeReviewQueue } = core('utils/timeline/alignmentDiff');
  const t = timeline(10, 4);
  const input = {
    zhText: toSrt(LINES_ZH.slice(0, 10), t),
    enText: toSrt(LINES_EN.slice(0, 10), timeline(10, 4, 0, 80)),
    commentaryText: '',
    mode: 'industrial',
    bilingualSingle: false,
  };
  const first = executeMergeJob(input, () => {});
  assert.ok(first.rows.every((r) => r.rowId));
  const queue1 = buildMergeReviewQueue(first.rows);
  const checked = new Set(queue1.items.slice(0, 3).map((item) => item.id));
  // Map each checked review id → rowId of its primary row
  const checkedRowIds = queue1.items
    .filter((item) => checked.has(item.id))
    .map((item) => {
      const row = first.rows.find((r) => r.index === item.rowIndexes[0]);
      return { reviewId: item.id, rowId: row.rowId, text: row.text };
    });

  // Re-merge identical input
  const second = executeMergeJob(input, () => {});
  assert.deepEqual(second.rows.map((r) => r.rowId), first.rows.map((r) => r.rowId));
  const queue2 = buildMergeReviewQueue(second.rows);
  for (const { reviewId, rowId, text } of checkedRowIds) {
    assert.ok(queue2.items.some((item) => item.id === reviewId), `review id ${reviewId} survived re-merge`);
    const row = second.rows.find((r) => r.rowId === rowId);
    assert.ok(row, `rowId ${rowId} survived re-merge`);
    assert.equal(row.text, text);
  }

  // Insert a leading cue → display indexes shift; rowIds of original cues stay put.
  const shifted = [
    { ...first.rows[0], index: 1, ts: '00:00:00,100 --> 00:00:00,500', text: '【插入】', type: 'note', rowId: 'row.v1.deadbeef00000001' },
    ...first.rows.map((r, i) => ({ ...r, index: i + 2 })),
  ];
  for (const { rowId, text } of checkedRowIds) {
    const row = shifted.find((r) => r.rowId === rowId);
    assert.ok(row);
    assert.equal(row.text, text);
    assert.notEqual(row.index, first.rows.find((r) => r.rowId === rowId).index);
  }

  // Delete middle row → remaining rowIds unchanged
  const without = first.rows.filter((_, i) => i !== 2).map((r, i) => ({ ...r, index: i + 1 }));
  assert.equal(without.some((r) => r.rowId === first.rows[2].rowId), false);
  assert.ok(without.every((r, i) => {
    const orig = first.rows.find((o) => o.rowId === r.rowId);
    return orig && orig.text === r.text;
  }));

  // Stale row without rowId: stable key falls back to index (no throw)
  assert.equal(id.rowStableKey({ index: 7 }), '7');
  assert.equal(id.rowStableKey({ index: 7, rowId: first.rows[0].rowId }), first.rows[0].rowId);
});
