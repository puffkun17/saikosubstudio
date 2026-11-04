import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const axis = loadCore()('core/workbenchAxis');

test('empty focus set dims every row; null focus dims none', () => {
  assert.equal(axis.isRowDimmed(null, 0), false);
  assert.equal(axis.isRowDimmed(undefined, 4), false);
  const empty = new Set();
  assert.equal(axis.isFocusChromeActive(empty), true);
  assert.equal(axis.isRowDimmed(empty, 0), true);
  assert.equal(axis.isRowDimmed(empty, 12), true);
  const hits = new Set([2]);
  assert.equal(axis.isRowDimmed(hits, 2), false);
  assert.equal(axis.isRowDimmed(hits, 3), true);
  assert.equal(axis.isFocusChromeActive(null), false);
});

test('provenance keeps the first original across later edits', () => {
  const history = [
    { index: 3, before: '原文', after: '一改' },
    { index: 8, before: '别行', after: '别行改' },
    { index: 3, before: '一改', after: '二改' },
  ];
  assert.deepEqual(axis.lineProvenance(history, 3, '二改'), { before: '原文' });
  assert.equal(axis.lineProvenance(history, 3, '原文'), null);
  assert.equal(axis.lineProvenance([], 3, '二改'), null);
  assert.deepEqual(axis.splitCueLines('上\\N下'), { primary: '上', secondary: '下' });
});
