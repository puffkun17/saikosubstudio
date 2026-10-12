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

test('error codes: keyword rules attach E-xx once', () => {
  const ec = loadCore()('core/errorCodes');
  assert.equal(ec.codeErrorMessage('导出失败: boom'), '[E-04] 导出失败: boom');
  assert.equal(ec.codeErrorMessage('[E-03] 合并失败'), '[E-03] 合并失败');
  assert.equal(ec.codeErrorMessage('有 2 个分卷压缩包需先在本地完整解压').slice(0, 6), '[E-02]');
  assert.equal(ec.errorCodeOf('nothing'), null);
});
