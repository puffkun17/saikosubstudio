import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const id = core('core/identity');
const ts = core('core/taskStore');
const tm = core('core/taskModel');

test('mint/parse: typed versioned ids round-trip', () => {
  const work = id.workIdentityFromFileName('The.Bear.S01E01.chs.srt', 'S01E01');
  const taskId = id.mintTaskId(work);
  const fileId = id.mintFileId('The.Bear.S01E01.chs.srt', '1\n00:00:01,000 --> 00:00:02,000\n你好\n');
  const parsed = id.parseId(taskId);
  assert.equal(parsed.kind, 'task');
  assert.equal(parsed.version, 1);
  assert.ok(/^[0-9a-f]+$/i.test(parsed.body));
  assert.equal(id.formatId(parsed), taskId);
  assert.equal(id.isId(taskId, 'task'), true);
  assert.equal(id.isId(fileId, 'file'), true);
  assert.equal(id.isId('task_tv_S01E01_123_abc'), false);
});

test('same input → same task/file ids; different episode → different task', () => {
  const a = id.mintTaskId(id.workIdentityFromFileName('Show.S01E01.zh.srt', 'S01E01'));
  const b = id.mintTaskId(id.workIdentityFromFileName('Show.S01E01.eng.srt', 'S01E01'));
  const c = id.mintTaskId(id.workIdentityFromFileName('Show.S01E02.zh.srt', 'S01E02'));
  assert.equal(a, b);
  assert.notEqual(a, c);
  const text = 'hello';
  assert.equal(id.mintFileId('a.srt', text), id.mintFileId('A.SRT', text));
  assert.notEqual(id.mintFileId('a.srt', text), id.mintFileId('a.srt', 'other'));
});

test('track id derives from parent file; storage/react keys stay separate from identity', () => {
  const fileId = id.mintFileId('bi.ass', 'Dialogue: 0,0:00:01.00,0:00:02.00,Dial_CH,,0,0,0,,中文');
  const track = id.mintTrackId(fileId, 'zh');
  const parsed = id.parseId(track);
  assert.equal(parsed.kind, 'track');
  assert.match(parsed.body, /#zh$/);
  const taskId = id.mintTaskId(id.workIdentityFromFileName('X.S01E01.srt', 'S01E01'));
  const hist = id.historyIdFor(taskId);
  assert.equal(hist, `history:${taskId}`);
  assert.equal(id.identityFromStorageKey(hist, 'history'), taskId);
  assert.equal(id.reactKeyFor('task.v1.abc', 'tab'), 'tab:task.v1.abc');
});

test('createTask uses mintTaskId (stable across calls)', () => {
  const t1 = tm.createTask({ episode: { season: 1, episode: 1 }, fallbackTitle: 'the bear' });
  const t2 = tm.createTask({ episode: { season: 1, episode: 1 }, fallbackTitle: 'the bear' });
  assert.equal(t1.id, t2.id);
  assert.equal(id.isId(t1.id, 'task'), true);
});

test('schema upgrade discards prior stores; fresh open is empty and error-free', () => {
  assert.equal(ts.shouldDiscardStoresOnUpgrade(0, 3), false);
  assert.equal(ts.shouldDiscardStoresOnUpgrade(1, 3), true);
  assert.equal(ts.shouldDiscardStoresOnUpgrade(2, 3), true);
  assert.equal(ts.shouldDiscardStoresOnUpgrade(3, 3), false);

  // Minimal IDBDatabase mock: upgrade from v1 → v3 drops old stores then recreates.
  const stores = new Set(['tasks', 'sources', 'merged', 'meta', 'legacyJunk']);
  const db = {
    objectStoreNames: {
      contains: (n) => stores.has(n),
      [Symbol.iterator]: () => stores.values(),
    },
    deleteObjectStore: (n) => { stores.delete(n); },
    createObjectStore: (n) => {
      stores.add(n);
      return { createIndex() { return undefined; } };
    },
  };
  const { discarded } = ts.applySchemaUpgrade(db, 1, 3);
  assert.equal(discarded, true);
  assert.deepEqual([...stores].sort(), ['merged', 'meta', 'sources', 'tasks']);

  const fresh = {
    objectStoreNames: {
      contains: () => false,
      [Symbol.iterator]: () => [][Symbol.iterator](),
    },
    deleteObjectStore() { throw new Error('should not delete on fresh'); },
    createObjectStore: (n) => {
      stores.add(n);
      return { createIndex() { return undefined; } };
    },
  };
  const stores2 = new Set();
  fresh.objectStoreNames.contains = (n) => stores2.has(n);
  fresh.objectStoreNames[Symbol.iterator] = () => stores2.values();
  fresh.createObjectStore = (n) => {
    stores2.add(n);
    return { createIndex() { return undefined; } };
  };
  const r2 = ts.applySchemaUpgrade(fresh, 0, 3);
  assert.equal(r2.discarded, false);
  assert.deepEqual([...stores2].sort(), ['merged', 'meta', 'sources', 'tasks']);
});
