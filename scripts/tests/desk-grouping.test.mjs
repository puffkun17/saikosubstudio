import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const DG = core('core/deskGrouping');

test('pure numeric series (07..01.ass) stack together, sort ascending, and detect gaps', () => {
  const input = [
    { key: 'k7', name: '07.ass', folderName: 'Frieren_S01', sizeBytes: 88_000 },
    { key: 'k2', name: '02.ass', folderName: 'Frieren_S01', sizeBytes: 81_000 },
    { key: 'k6', name: '06.ass', folderName: 'Frieren_S01', sizeBytes: 84_000 },
    { key: 'k1', name: '01.ass', folderName: 'Frieren_S01', sizeBytes: 82_000 },
  ];
  const groups = DG.groupDeskItems(input);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isStack, true);
  assert.deepEqual(groups[0].items.map((i) => i.name), ['01.ass', '02.ass', '06.ass', '07.ass']);
  assert.equal(groups[0].displayTitle, 'Frieren_S01 / 01.ass – 07.ass');
  assert.equal(groups[0].continuityNote, '缺第 03、04、05 集');
});

test('contiguous 01.ass–07.ass batch without folder path still stacks and reports complete', () => {
  const input = [7, 5, 3, 1, 6, 4, 2].map((n) => ({
    key: `b${n}`,
    name: `${String(n).padStart(2, '0')}.ass`,
    sizeBytes: 80_000,
  }));
  const groups = DG.groupDeskItems(input);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isStack, true);
  assert.equal(groups[0].continuityNote, '编号 01–07 连续齐备');
});

test('single pure-numeric file stays unstacked', () => {
  const groups = DG.groupDeskItems([{ key: 'one', name: '06.ass', sizeBytes: 84_000 }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isStack, false);
  assert.equal(groups[0].displayTitle, '06.ass');
});

test('same filenames in different folders stay separate stacks', () => {
  const groups = DG.groupDeskItems([
    { key: 'a1', name: '01.ass', folderName: 'ShowA', sizeBytes: 100 },
    { key: 'a2', name: '02.ass', folderName: 'ShowA', sizeBytes: 100 },
    { key: 'b1', name: '01.ass', folderName: 'ShowB', sizeBytes: 100 },
    { key: 'b2', name: '02.ass', folderName: 'ShowB', sizeBytes: 100 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].folderName, 'ShowA');
  assert.equal(groups[1].folderName, 'ShowB');
});

test('S01E01..E10.srt ignores 1080p noise and groups into one stack', () => {
  const input = Array.from({ length: 10 }, (_, idx) => {
    const ep = String(10 - idx).padStart(2, '0');
    return { key: `s${ep}`, name: `Frieren.S01E${ep}.1080p.WEB.EN.srt`, sizeBytes: 24_000 };
  });
  const groups = DG.groupDeskItems(input);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].ext, 'srt');
  assert.equal(groups[0].items.length, 10);
  assert.equal(groups[0].continuityNote, '编号 01–10 连续齐备');
});

test('archives stay distinct archival units', () => {
  const groups = DG.groupDeskItems([
    { key: 'z1', name: 'Frieren_S01_Extras.zip', sizeBytes: 318_000 },
    { key: 'z2', name: 'Frieren_S02_Extras.zip', sizeBytes: 210_000 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].ext, 'zip');
  assert.equal(groups[0].isStack, false);
});
