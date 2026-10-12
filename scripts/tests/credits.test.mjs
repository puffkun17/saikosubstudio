import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_ZH } from './_fixtures.mjs';

const core = loadCore();
const cr = core('core/credits');

const rows = [
  { text: '本字幕由某某字幕组翻译，仅供学习交流' },
  ...LINES_ZH.slice(0, 30).map((text) => ({ text })),
  { text: '翻译：小林' },
  { text: '本字幕由网友校订' },
];

test('formal credit kept in place; secondary statements dropped and summarised as anonymous thanks', () => {
  const plan = cr.planCredits({ primaryRows: rows });
  assert.deepEqual(plan.formal.map((f) => [f.role, f.name, f.cueIndex]), [['translator', '小林', 31]]);
  assert.deepEqual(plan.dropCueIndexes, [0, 32]);
  assert.equal(plan.anonymousThanks, '另有网友校订');
  const out = cr.applyCreditPlan(rows, plan);
  assert.equal(out.length, rows.length - 2);
  assert.equal(out.at(-1).text, '翻译：小林；另有网友校订');
  assert.deepEqual(cr.buildClosingCreditLines(plan), []);
});

test('user 双语合并 credit: translator credit precedes it and cannot be disabled', () => {
  const inPlace = cr.planCredits({ primaryRows: rows, user: { name: 'Derek' } });
  assert.deepEqual(cr.buildClosingCreditLines(inPlace), ['双语合并：Derek']);
  // Even with the deep "move formal credits" switch, the translator line is re-emitted first.
  const moved = cr.planCredits({ primaryRows: rows, user: { name: 'Derek' }, keepFormalInPlace: false });
  assert.deepEqual(cr.buildClosingCreditLines(moved), ['翻译：小林；另有网友校订', '双语合并：Derek']);
});

test('ASS Script Info: proper fields, user never in Original Script', () => {
  const plan = cr.planCredits({ primaryRows: rows, user: { name: 'Derek' } });
  const lines = cr.scriptInfoLines(plan);
  assert.deepEqual(lines, ['Original Translation: 小林；另有网友校订', 'Script Updated By: Derek']);
  assert.ok(!lines.some((l) => l.startsWith('Original Script') && l.includes('Derek')));
});

test('dialogue in the middle is never treated as a credit', () => {
  const mid = [...LINES_ZH.slice(0, 15).map((text) => ({ text })), { text: '翻译：这句其实是台词' }, ...LINES_ZH.slice(15, 40).map((text) => ({ text }))];
  assert.equal(cr.planCredits({ primaryRows: mid }).formal.length, 0);
});
