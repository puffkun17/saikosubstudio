import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const { computeSynopsisClamp: clamp, countLines } = loadCore()('core/synopsisClamp');
const LH = 20.3; // 14px × 1.45（ds-body）

test('全文放得下 → null（不折叠、无展开）', () => {
  assert.equal(clamp(10 * LH, LH, 7), null);
  assert.equal(clamp(7 * LH, LH, 7), null); // 刚好放下
  assert.equal(clamp(7 * LH - 0.4, LH, 7), null); // 亚像素误差不算溢出
});

test('只多出 1–2 行 → 仍显示全文（回差）', () => {
  assert.equal(clamp(6 * LH, LH, 7), null); // 多 1 行
  assert.equal(clamp(5 * LH, LH, 7), null); // 多 2 行
  assert.equal(clamp(5 * LH, LH, 7, { slackLines: 1 }), 5); // 回差可配置
});

test('多出 3 行及以上 → 折叠到能完整放下的整行数', () => {
  assert.equal(clamp(4 * LH, LH, 7), 4);
  assert.equal(clamp(6 * LH + 10, LH, 12), 6);
  assert.equal(clamp(8 * LH, LH, 20, { toggleReservePx: 24 }), 6); // 扣掉展开按钮高度
});

test('至少 3 行', () => {
  assert.equal(clamp(0, LH, 10), 3);
  assert.equal(clamp(-50, LH, 10), 3);
  assert.equal(clamp(1.5 * LH, LH, 10), 3);
  assert.equal(clamp(LH, LH, 10, { minLines: 2 }), 2);
});

test('最少行数 ≥ 总行数时不折叠', () => {
  assert.equal(clamp(0, LH, 3), null);
  assert.equal(clamp(0, LH, 2), null);
});

test('非法输入 → null', () => {
  assert.equal(clamp(100, 0, 10), null);
  assert.equal(clamp(100, Number.NaN, 10), null);
  assert.equal(clamp(100, LH, 0), null);
  assert.equal(clamp(Number.NaN, LH, 10), 3);
});

test('countLines 吸收亚像素误差', () => {
  assert.equal(countLines(142.1, LH), 7);
  assert.equal(countLines(141.6, LH), 7);
  assert.equal(countLines(0, LH), 0);
  assert.equal(countLines(10, LH), 1);
});
