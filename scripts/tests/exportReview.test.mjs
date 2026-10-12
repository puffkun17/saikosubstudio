import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const er = loadCore()('core/exportReview');

test('export review: R-xx derived, not blocking data', () => {
  const rows = [{ text: '你好\nHello' }, { text: '{\\pos(10,10)}招牌\nSign' }, { text: '- 走\n- 好' }];
  const codes = er.deriveExportReview({ rows, hasTmdb: true, isTv: true, epKey: '', unresolvedRows: [2], movedStatementRows: [] }).map((r) => r.code);
  assert.deepEqual(codes, ['R-03', 'R-08', 'R-09', 'R-11']);
  const single = er.deriveExportReview({ rows: [{ text: 'Hello' }], hasTmdb: false, isTv: false, epKey: '', unresolvedRows: [], movedStatementRows: [] }).map((r) => r.code);
  assert.deepEqual(single, ['R-02', 'R-10']);
  assert.ok(er.REVIEW_CODE_TABLE.length >= 11);
});
