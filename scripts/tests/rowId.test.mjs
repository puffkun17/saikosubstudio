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
