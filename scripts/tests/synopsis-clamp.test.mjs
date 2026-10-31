import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore()('core/synopsisClamp');
const { computeSynopsisLayout: layout, countLines, shouldCompactRematch: compact, SYNOPSIS_MIN_LINES, SYNOPSIS_TOGGLE_PX } = core;
const LH = 20.3; // 14px × 1.45（ds-body）
const T = { toggleReservePx: 44 };

test('常量：至少 2 行，展开按钮 44px', () => {
  assert.equal(SYNOPSIS_MIN_LINES, 2);
  assert.equal(SYNOPSIS_TOGGLE_PX, 44);
});

test('全文放得下 → 全文，封面不让', () => {
  assert.deepEqual(layout(10 * LH, LH, 7, T), { clamp: null, deficitPx: 0 });
  assert.deepEqual(layout(7 * LH, LH, 7, T), { clamp: null, deficitPx: 0 }); // 刚好放下
  assert.deepEqual(layout(7 * LH - 0.4, LH, 7, T), { clamp: null, deficitPx: 0 }); // 亚像素误差
});

test('不再从封面借行：只多 1 行也折叠', () => {
  assert.deepEqual(layout(6 * LH, LH, 7, T), { clamp: 3, deficitPx: 0 }); // 6 行空间 − 44px 按钮 = 3 行
});

test('折叠到扣掉展开按钮后的整行数', () => {
  assert.deepEqual(layout(8 * LH, LH, 20, T), { clamp: 5, deficitPx: 0 });
  assert.deepEqual(layout(2 * LH + 44, LH, 20, T), { clamp: 2, deficitPx: 0 }); // 刚好 2 行 + 按钮
});

test('连 2 行 + 按钮都放不下 → 折叠 2 行，封面让出差额', () => {
  assert.deepEqual(layout(40, LH, 10, T), { clamp: 2, deficitPx: Math.ceil(2 * LH + 44 - 40) });
  assert.deepEqual(layout(-30, LH, 10, T), { clamp: 2, deficitPx: Math.ceil(2 * LH + 44 + 30) });
  assert.deepEqual(layout(0, LH, 10, { ...T, minLines: 3 }), { clamp: 3, deficitPx: Math.ceil(3 * LH + 44) });
});

test('全文只有 ≤ 2 行但放不下 → 不折叠，封面让', () => {
  assert.deepEqual(layout(LH, LH, 2, T), { clamp: null, deficitPx: Math.ceil(LH) });
});

test('无效输入 → 全文、封面不让', () => {
  assert.deepEqual(layout(100, 0, 5, T), { clamp: null, deficitPx: 0 });
  assert.deepEqual(layout(100, LH, 0, T), { clamp: null, deficitPx: 0 });
  assert.deepEqual(layout(Number.NaN, LH, 3, T), { clamp: 2, deficitPx: Math.ceil(2 * LH + 44) });
});

test('countLines 四舍五入、至少 1 行', () => {
  assert.equal(countLines(142, LH), 7);
  assert.equal(countLines(141.6, LH), 7);
  assert.equal(countLines(5, LH), 1);
  assert.equal(countLines(0, LH), 0);
  assert.equal(countLines(100, 0), 0);
});

test('手动匹配收成放大镜：完整按钮口径下会折叠才收', () => {
  assert.equal(compact(7 * LH, LH, 7), false);
  assert.equal(compact(7 * LH - 0.4, LH, 7), false);
  assert.equal(compact(6 * LH, LH, 7), true);
  assert.equal(compact(2 * LH, LH, 12), true);
  assert.equal(compact(100, 0, 5), false);
  assert.equal(compact(100, LH, 0), false);
});
