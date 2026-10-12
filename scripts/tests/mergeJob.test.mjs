import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_EN, LINES_ZH, timeline, toSrt } from './_fixtures.mjs';

const core = loadCore();
const { executeMergeJob } = core('core/mergeJob');

test('merge job (worker body) produces paired rows and streams logs', () => {
  const t = timeline(40, 4);
  const events = [];
  const res = executeMergeJob({ zhText: toSrt(LINES_ZH, t), enText: toSrt(LINES_EN, timeline(40, 4, 0, 60)), commentaryText: '', mode: 'standard', bilingualSingle: false }, (e) => events.push(e));
  assert.ok(res.rows.length >= 38, `rows ${res.rows.length}`);
  assert.ok(res.rows.filter((r) => /\n/.test(r.text)).length >= 35);
  assert.ok(['standard', 'industrial'].includes(res.usedMode));
  // Structured-clone safe: what a Worker posts back.
  assert.deepEqual(structuredClone(res), res);
});
