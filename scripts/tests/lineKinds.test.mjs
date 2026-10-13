import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const lk = loadCore()('core/lineKinds');
const er = loadCore()('core/exportReview');
const rk = loadCore()('core/reviewKey');
const tm = loadCore()('core/taskModel');

// Synthetic timeline shaped like the merge pipeline output (no real subtitle text).
const ts = (n) => `00:00:${String(n).padStart(2, '0')},000 --> 00:00:${String(n).padStart(2, '0')},900`;
const rows = [
  { index: 1, ts: ts(1), text: '[door slams]', type: 'note', cueKind: 'sound_caption', auxiliary: { category: 'ambient_sdh' } },
  { index: 2, ts: ts(2), text: '[music playing]', type: 'note', cueKind: 'sound_caption', auxiliary: { category: 'music' } },
  { index: 3, ts: ts(3), text: '[whispers] Run', type: 'note', cueKind: 'sound_caption', auxiliary: { category: 'semantic_sdh' } },
  { index: 4, ts: ts(4), text: '（某地）', type: 'note', cueKind: 'screen_text', auxiliary: { category: 'screen_text' } },
  { index: 5, ts: ts(5), text: '♪ la la ♪', type: 'lyrics', cueKind: 'lyrics', auxiliary: { category: 'music' } },
  { index: 6, ts: ts(6), text: '♪ na na ♪', type: 'lyrics', cueKind: 'lyrics' },
  { index: 7, ts: ts(7), text: '[narrator] Once', type: 'note', cueKind: 'narration', auxiliary: { category: 'unknown' } },
  { index: 8, ts: ts(8), text: 'Once upon', type: 'dialogue', cueKind: 'narration' },
  { index: 9, ts: ts(9), text: '你好\nHello', type: 'merged', cueKind: 'dialogue' },
  { index: 10, ts: ts(10), text: '字幕翻译：某某', type: 'credit', cueKind: 'credit', auxiliary: { category: 'unknown' } },
];

test('classifier: exclusive kinds with priority 署名 > 歌词 > 音效 > 标题告示 > 旁白 > 对白', () => {
  const kinds = rows.map((r) => lk.classifyLineKind(r));
  assert.deepEqual(kinds, ['sound', 'sound', 'sound', 'screen', 'lyrics', 'lyrics', 'narration', 'narration', 'dialogue', 'credit']);
  const c = lk.countLineKinds(rows);
  assert.equal(c.auxiliary, 9);
  assert.equal(c.credit + c.lyrics + c.sound + c.screen + c.narration + c.dialogue, rows.length);
});

test('policy: 智能 hides only ambient/music SDH (≤ 音效), never credits/lyrics; same function for counts and filtering', () => {
  const c = lk.countLineKinds(rows);
  const smart = lk.countHiddenByPolicy(rows, 'smart');
  const clean = lk.countHiddenByPolicy(rows, 'clean');
  assert.equal(smart, 2);
  assert.ok(smart <= c.sound);
  assert.equal(clean, 3); // ambient + music SDH + narration with category; semantic SDH stays
  assert.equal(lk.countHiddenByPolicy(rows, 'keep'), 0);
  for (const mode of ['keep', 'smart', 'clean']) {
    const kept = lk.applyLinePolicy(rows, mode);
    assert.equal(rows.length - kept.length, lk.countHiddenByPolicy(rows, mode));
    assert.ok(kept.some((r) => r.text.startsWith('字幕翻译')), 'credit is never hidden by the policy');
    assert.deepEqual(kept.map((r) => r.index), kept.map((_, i) => i + 1));
  }
});

test('line numbers are 1-based everywhere and jumps map back to the array position', () => {
  assert.equal(lk.lineNumberOf({ index: 7 }, 0), 7);
  assert.equal(lk.lineNumberOf({}, 0), 1);
  assert.equal(lk.arrayIndexOfLine(rows, 4), 3);
  assert.equal(lk.arrayIndexOfLine(rows, 99), -1);
  const review = er.deriveExportReview({ rows: [{ index: 1, text: 'a' }, { index: 2, text: '- 走\n- 好' }], hasTmdb: true, isTv: false, epKey: '', unresolvedRows: [2], movedStatementRows: [] });
  assert.deepEqual(review.find((r) => r.code === 'R-09').cues, [2]);
  assert.deepEqual(review.find((r) => r.code === 'R-11').cues, [2]);
});

test('review key never depends on the filename; progress is live', () => {
  assert.equal(rk.reviewTaskKey('task-1', rows), 'task-1');
  const k = rk.reviewTaskKey(null, rows);
  assert.equal(k, rk.reviewTaskKey(undefined, rows.map((r) => ({ ...r }))));
  assert.equal(rk.reviewProgress(['a', 'b'], ['a']).remaining, 1);
  assert.equal(rk.reviewProgress(['a', 'b'], ['a', 'b', 'zz']).remaining, 0);
});

test('export base name: original title by default, zh prefix by mode, video name wins', () => {
  const meta = { title: '示例剧', originalTitle: 'Example Show', year: '2025' };
  assert.equal(tm.buildExportBaseFromMeta(meta, 's01e02', 'original'), 'Example.Show.2025.S01E02');
  assert.equal(tm.buildExportBaseFromMeta(meta, 'S01E02', 'zh+original'), '示例剧.Example.Show.2025.S01E02');
  assert.equal(tm.buildExportBaseFromMeta(meta, 'S01E02', 'original', { videoName: 'My.Video.mkv' }), 'My.Video');
  assert.equal(tm.buildExportBaseFromMeta(null, '', 'original', { fallback: 'Track.Stem' }), 'Track.Stem');
});
