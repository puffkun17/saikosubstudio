import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const S = core('core/stageObjects');
const W = core('core/workGrouping');

test('stage objectIds are stable and distinct', () => {
  const a = S.stageObjectId(':Ted.Lasso.zip:1000:1');
  assert.equal(a, S.stageObjectId(':Ted.Lasso.zip:1000:1'));
  assert.notEqual(a, S.stageObjectId(':Ted.Lasso.zip:1001:1'));
  assert.notEqual(a, S.stageObjectId('dir/:Ted.Lasso.zip:1000:1'));
  assert.match(a, /^obj:[0-9a-f]{12}$/);
  const e1 = S.archiveEntryObjectId(a, 'S04/a.srt');
  assert.equal(e1, S.archiveEntryObjectId(a, 'S04/a.srt'));
  assert.notEqual(e1, S.archiveEntryObjectId(a, 'S04/b.srt'));
  assert.ok(S.sameStageRoot(a, e1));
  assert.ok(!S.sameStageRoot(e1, S.archiveEntryObjectId(S.stageObjectId('x'), 'S04/a.srt')));
});

test('workTitleOf reads the title before episode / year / resolution', () => {
  assert.deepEqual(W.workTitleOf('Ted.Lasso.S04E01.Home.1080p.WEB-DL.EN&CHS.srt'), { key: 'ted lasso', title: 'Ted Lasso' });
  assert.equal(W.workTitleOf('Ted Lasso - S04E02.srt').key, 'ted lasso');
  assert.equal(W.workTitleOf('Slow.Horses.S04E01.chs.srt').key, 'slow horses');
  assert.equal(W.workTitleOf('Dune.Part.Two.2024.2160p.chs.srt').key, 'dune part two');
  assert.equal(W.workTitleOf('漫长的季节.第01集.srt').key, '漫长的季节');
  assert.equal(W.workTitleOf('S01E01.srt'), null);
  assert.equal(W.workTitleOf('chs.srt'), null);
});

test('groupQueueByWork: one work, two works, unknowns, archive majority', () => {
  const one = W.groupQueueByWork([
    { objectId: 'z', names: ['Ted.Lasso.S04E01.chs.srt', 'Ted.Lasso.S04E02.chs.srt', 'Ted.Lasso.S04E01.eng.srt'] },
    { objectId: 'a', names: ['Ted.Lasso.S04E03.chs.srt'] },
    { objectId: 'u', names: ['readme-subs.srt'] },
  ]);
  assert.equal(one.isMultiWork, false);
  assert.deepEqual(one.works.map((w) => w.objectIds), [['z', 'a']]);
  assert.deepEqual(one.unknown, ['u']);

  const two = W.groupQueueByWork([
    { objectId: 'z', names: ['Ted.Lasso.S04E01.chs.srt', 'Ted.Lasso.S04E02.chs.srt', 'Slow.Horses.S04E01.chs.srt'] },
    { objectId: 's1', names: ['Slow.Horses.S04E01.chs.srt'] },
    { objectId: 's2', names: ['Slow.Horses.S04E01.eng.srt'] },
  ]);
  assert.equal(two.isMultiWork, true);
  assert.deepEqual(two.works.map((w) => [w.title, w.objectIds]), [['Ted Lasso', ['z']], ['Slow Horses', ['s1', 's2']]]);
  assert.equal(W.workSignature(two), 'slow horses|ted lasso');
});
