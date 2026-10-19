import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const S = core('utils/importSummary');

test('buildImportSummary: ignored files and encoding conversions are auto-handled', () => {
  const summary = S.buildImportSummary({
    ignored: [
      { name: '__MACOSX/._a.srt', reason: 'macosx' },
      { name: 'cover.png', reason: 'image' },
    ],
    tracks: [
      { name: 'show.gbk.srt', lang: 'zh-CN', encoding: 'gbk', encodingConfidence: 'high' },
      { name: 'show.en.srt', lang: 'en', encoding: 'utf-8', encodingConfidence: 'high' },
    ],
  });
  assert.equal(summary.autoHandled.filter((i) => i.kind === 'ignored_file').length, 2);
  assert.equal(summary.autoHandled.filter((i) => i.kind === 'encoding_converted').length, 1);
  assert.equal(summary.needsAttention.length, 0);
  assert.ok(S.summarizeImportForChip(summary)?.includes('自动处理'));
});

test('buildImportSummary: low-confidence encoding and zh-only package need attention', () => {
  const summary = S.buildImportSummary({
    tracks: [
      { name: 'a.srt', lang: 'zh-CN', encoding: 'gbk', encodingConfidence: 'low' },
      { name: 'b.srt', lang: 'zh-TW', encoding: 'big5', encodingConfidence: 'high' },
    ],
  });
  assert.ok(summary.needsAttention.some((i) => i.kind === 'low_confidence_encoding'));
  assert.ok(summary.needsAttention.some((i) => i.kind === 'zh_only_package'));
  assert.ok(summary.autoHandled.some((i) => i.kind === 'encoding_converted' && i.name === 'b.srt'));
});

test('single Chinese file alone is not flagged as zh-only package', () => {
  const summary = S.buildImportSummary({
    tracks: [{ name: 'only.srt', lang: 'zh-CN', encoding: 'utf-8', encodingConfidence: 'high' }],
  });
  assert.equal(summary.needsAttention.length, 0);
});
