import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const tm = core('core/taskModel');
const ts = core('core/taskStore');
const rr = core('core/reviewReasons');

const bear = { id: 136315, mediaType: 'tv', season: 1, episode: 1, title: '熊家餐馆', originalTitle: 'The Bear', year: '2022', confidence: 'strong' };

test('naming: 原文名 default, 中文 + 原文名 option, from TMDB (The Bear 2022 / 熊家餐馆)', () => {
  let task = tm.createTask({ episode: { season: 1, episode: 1 }, fallbackTitle: 'the bear' });
  task = tm.linkTmdb(task, bear);
  assert.equal(task.exportBaseName.value, 'The.Bear.2022.S01E01');
  assert.equal(tm.exportFileName(task, 'ass'), 'The.Bear.2022.S01E01.zh-Hans.ass');
  assert.equal(tm.buildExportBaseName(task, 'zh+original'), '熊家餐馆.The.Bear.2022.S01E01');
  assert.equal(task.name.value, '熊家餐馆 S01E01');
  const omitb = tm.linkTmdb(tm.createTask({ episode: { season: 5, episode: 8 }, fallbackTitle: '' }), { id: 107113, mediaType: 'tv', season: 5, episode: 8, title: '大楼里只有谋杀', originalTitle: 'Only Murders in the Building', year: '2021', confidence: 'strong' });
  assert.equal(omitb.exportBaseName.value, 'Only.Murders.in.the.Building.2021.S05E08');
});

test('episode #02 without season never becomes S01E01 (Frieren export bug)', () => {
  const task = tm.createTask({ episode: { season: null, episode: 2 }, fallbackTitle: 'Show' });
  assert.equal(task.exportBaseName.value, 'Show.S01E02');
});

test('auto name regenerates until the user edits; then locked', () => {
  let task = tm.createTask({ episode: { season: 2, episode: 15 }, fallbackTitle: 'the pitt' });
  task = tm.renameTask(task, '匹兹堡 第二季 15');
  task = tm.linkTmdb(task, { id: 250307, mediaType: 'tv', season: 2, episode: 15, title: '匹兹堡医护前线', originalTitle: 'The Pitt', year: '2025', confidence: 'strong' });
  assert.equal(task.name.value, '匹兹堡 第二季 15');
  assert.equal(task.name.state, 'locked');
  assert.equal(task.exportBaseName.value, 'The.Pitt.2025.S02E15');
  task = tm.unlockNames(task);
  assert.equal(task.name.value, '匹兹堡医护前线 S02E15');
});

test('slots are replaceable without touching identity; video slot keeps filename only and wins naming', () => {
  let task = tm.linkTmdb(tm.createTask({ episode: { season: 1, episode: 8 }, fallbackTitle: '' }), { id: 1, mediaType: 'tv', season: 1, episode: 8, title: '绿灯军团', originalTitle: 'Lanterns', year: '2026', confidence: 'strong' });
  const id = task.id;
  task = tm.setSlot(task, { role: 'primary', sourceId: 's1', fileName: 'a.zh.srt', language: 'zh-CN', isSdh: false, boundAt: 1 });
  assert.equal(task.singleLanguage, true);
  task = tm.setSlot(task, { role: 'secondary', sourceId: 's2', fileName: 'a.en.srt', language: 'en', isSdh: false, boundAt: 2 });
  task = tm.setSlot(task, { role: 'secondary', sourceId: 's3', fileName: 'b.en.srt', language: 'en', isSdh: false, boundAt: 3 });
  assert.equal(task.id, id);
  assert.equal(task.slots.length, 2);
  assert.equal(task.singleLanguage, false);
  task = tm.attachVideo(task, 'Lanterns.S01E08.2160p.WEB.mkv', 7_000_000_000);
  assert.equal(task.exportBaseName.value, 'Lanterns.S01E08.2160p.WEB');
  assert.equal(Object.keys(task.video).sort().join(), 'attachedAt,fileName,sizeBytes');
  assert.equal(tm.isVideoFileName('x.mkv'), true);
});

test('stage transitions are guarded', () => {
  let task = tm.createTask({ episode: { season: null, episode: null }, fallbackTitle: 'Animals' });
  assert.throws(() => tm.advanceStage(task, 'exported'));
  task = tm.setSlot(task, { role: 'primary', sourceId: 's', fileName: 'x', language: 'zh-CN', isSdh: false, boundAt: 1 });
  task = tm.advanceStage(tm.advanceStage(task, 'merging'), 'merged');
  assert.equal(task.stage, 'merged');
});

test('retention: 30 days default; legacy archive item maps to a finished task', () => {
  const now = Date.UTC(2026, 9, 13);
  assert.equal(ts.expiryFor(now) - now, 30 * 86_400_000);
  assert.equal(ts.isExpired({ expiresAt: now }, now), true);
  const { task, rows } = ts.legacyItemToTask({ id: '42', name: 'The.Bear.2022.S01E01', date: '2026-10-01T00:00:00Z', subs: [{ ts: 'x', text: 'y', index: 0 }] }, now);
  assert.equal(task.id, 'legacy_42');
  assert.equal(task.name.state, 'locked');
  assert.equal(rows.length, 1);
});

test('review reasons: stable codes, de-duplicated', () => {
  let list = rr.addReviewReason([], { code: 'R-01', cues: [1] });
  list = rr.addReviewReason(list, { code: 'R-01', cues: [2] });
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].cues, [1, 2]);
  assert.ok(rr.REVIEW_REASONS['R-04'].includes('Dial_CH'));
});

test('legacy store naming (buildExportBaseFromMeta): 原文名 default, 中文 + 原文名, video filename wins', () => {
  const meta = { title: '熊家餐馆', originalTitle: 'The Bear', year: '2022' };
  assert.equal(tm.buildExportBaseFromMeta(meta, 's01e01', 'original'), 'The.Bear.2022.S01E01');
  assert.equal(tm.buildExportBaseFromMeta(meta, 'S01E01', 'zh+original'), '熊家餐馆.The.Bear.2022.S01E01');
  assert.equal(tm.buildExportBaseFromMeta(meta, '', 'original', { videoName: 'The.Bear.S01E01.1080p.WEB.mkv' }), 'The.Bear.S01E01.1080p.WEB');
  assert.equal(tm.buildExportBaseFromMeta(null, '', 'original', { fallback: '熊家餐馆 S01E01' }), '熊家餐馆 S01E01');
});
