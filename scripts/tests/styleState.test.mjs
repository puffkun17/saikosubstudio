// 样式状态：预设 + 用户微调 → 预览/导出同源；截图估计样式。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const out = mkdtempSync(join(tmpdir(), 'saiko-style-'));
execFileSync('npx', ['tsc', 'src/utils/previewStyle.ts', 'src/utils/styleFromImage.ts', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', out, '--skipLibCheck', '--rootDir', 'src', '--lib', 'ES2022,DOM', '--noEmitOnError', 'false'], { stdio: 'ignore' });
const req = createRequire(join(out, 'x.js'));
const { resolveEffectiveStyle, resolvePreviewStyle } = req('./utils/previewStyle.js');
const { estimateStyleFromPixels } = req('./utils/styleFromImage.js');
const base = { zhFontSize: 30, enFontSize: 18, zhColor: '#FF0000', marginV: 40 };

test('fixed preset wins over sidebar base, user overrides win over preset', () => {
  const s = resolveEffectiveStyle(base, 'libass-ass', {});
  assert.equal(s.zhFontSize, 20);
  const o = resolveEffectiveStyle(base, 'libass-ass', { zhFontSize: 26, zhColor: '#00FF00' });
  assert.equal(o.zhFontSize, 26);
  assert.equal(o.zhColor, '#00FF00');
  assert.equal(resolveEffectiveStyle(base, 'current', {}).zhFontSize, 30);
});

test('presets produce different effective styles', () => {
  assert.notEqual(resolveEffectiveStyle(base, 'navy-outline').zhOutline, resolveEffectiveStyle(base, 'libass-ass').zhOutline);
});

test('preview with HDR keeps overrides and dims fills', () => {
  const p = resolvePreviewStyle(base, 'libass-ass', 'soft', { zhFontSize: 26 });
  assert.equal(p.zhFontSize, 26);
  assert.equal(p.zhColor.toUpperCase(), '#EBE6DC');
});

test('screenshot estimate finds white text with black outline near bottom', () => {
  const w = 200, h = 288, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 40; data[i + 1] = 60; data[i + 2] = 80; data[i + 3] = 255; }
  for (let y = 250; y < 268; y++) for (let x = 40; x < 160; x++) {
    const i = (y * w + x) * 4; const edge = x < 43 || x > 156;
    const v = edge ? 0 : 250; data[i] = v; data[i + 1] = v; data[i + 2] = v;
  }
  const s = estimateStyleFromPixels({ width: w, height: h, data });
  assert.ok(s);
  assert.equal(s.zhColor, '#FAFAFA');
  assert.equal(s.zhOutline, '#000000');
  assert.ok(Math.abs(s.marginV - 20) <= 2, `marginV ${s.marginV}`);
  assert.ok(s.zhFontSize >= 18 && s.zhFontSize <= 24, `size ${s.zhFontSize}`);
});

test('navy stacked layout follows user overrides (export == preview)', () => {
  const { applyOverridesToProfile } = req('./utils/previewStyle.js');
  const { EXPORT_PRESETS } = req('./utils/exportPresets.js');
  const navy = EXPORT_PRESETS['navy-outline'];
  assert.equal(applyOverridesToProfile(navy, {}), navy.profile);
  const p = applyOverridesToProfile(navy, { zhFontSize: 30, zhOutline: '#FF0000' });
  assert.equal(p.stacked.primaryFontSize, 75 * 1.5);
  assert.equal(p.stacked.primaryOutlineColour, '#FF0000');
  assert.ok(Math.abs(p.stacked.primaryFontSize * p.stacked.secondaryScale - 51) < 0.01);
});
