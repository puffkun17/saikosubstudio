/**
 * Pin current useStudioStore behaviour before the C+A store split.
 * Covers: edit/undo/redo, review ticks, style save, history save/load,
 * cancelCurrentUpload + restartSystem field lists, file/task deletion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

process.env.NODE_PATH = join(process.cwd(), 'node_modules');
Module._initPaths();

const memory = new Map();
const localStorageMock = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
  key: (i) => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};
globalThis.localStorage = localStorageMock;
globalThis.window = globalThis;

const out = mkdtempSync(join(tmpdir(), 'saiko-store-actions-'));
execFileSync(
  'npx',
  [
    'tsc', 'src/store/useStudioStore.ts',
    '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'bundler',
    '--outDir', out, '--skipLibCheck', '--ignoreConfig', '--esModuleInterop',
  ],
  { stdio: 'inherit' },
);
const req = createRequire(join(out, 'x.js'));
const { useStudioStore } = req('./store/useStudioStore.js');

const row = (index, text, extra = {}) => ({
  index, ts: '00:00:01,000 --> 00:00:02,000', text, type: 'dialogue', cueKind: 'dialogue', ...extra,
});

const makeFile = (id, name, text = '1\n00:00:01,000 --> 00:00:02,000\n你好\n') => ({
  id, name, text, lang: 'zh-CN', isBilingual: false, isCommentary: false, size: text.length,
});

function seedWorkbench(overrides = {}) {
  const subs = [row(1, '你好'), row(2, '世界')];
  const fZh = makeFile('f-zh', 'Show.S01E01.chs.srt');
  const fEn = makeFile('f-en', 'Show.S01E01.eng.srt', '1\n00:00:01,000 --> 00:00:02,000\nHello\n');
  useStudioStore.setState({
    workflowStep: 2,
    processedSubs: subs,
    previewIndex: 0,
    editHistory: [],
    editFuture: [],
    mergeReviewCheckedByTask: {},
    isOriginalWork: true,
    uploadedFiles: [fZh, fEn],
    files: { zh: fZh, en: fEn, commentary: null },
    tasks: [{
      id: 'task-a', title: 'Show', epKey: 'S01E01', zh: fZh, en: fEn, commentary: null,
      status: 'paired', files: [fZh, fEn],
    }],
    selectedTaskId: 'task-a',
    customFilename: 'Show.S01E01',
    filenameSource: 'manual',
    filenameEpKey: 'S01E01',
    borrowedVideoName: 'Show.S01E01.mkv',
    locateGroupIndexes: [0],
    previewClockMs: 1234,
    isPreviewPlaying: true,
    tmdbSuggestions: [{ id: 1, media_type: 'tv', title: 'X' }],
    tmdbAlternateSuggestion: null,
    selectedSuggestion: { id: 1, media_type: 'tv', title: 'X' },
    isSearchingTmdb: true,
    tmdbData: { title: 'Show', year: '2022' },
    tmdbBackdrop: 'https://example/b.jpg',
    tmdbBackdropList: ['https://example/b.jpg'],
    tmdbManualOpen: true,
    statusNotices: [{ id: 'n1', message: 'hi', tone: 'info', createdAt: 1 }],
    logs: [{ id: 1, message: 'old', type: 'info', createdAt: 1, fading: false }],
    isOfficialSubtitle: true,
    creditDeclaration: 'translated',
    creatorCredit: 'Nias',
    appendCreatorCredit: true,
    isLightsOff: true,
    libraryList: [],
    ...overrides,
  });
}

test.after(() => {
  try { rmSync(out, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('edit / undo / redo round-trip; credit locked unless isOriginalWork', () => {
  seedWorkbench();
  const s = () => useStudioStore.getState();
  s().editSubtitleText(1, '早上好');
  assert.equal(s().processedSubs.find((r) => r.index === 1).text, '早上好');
  assert.equal(s().editHistory.length, 1);
  assert.equal(s().editFuture.length, 0);
  s().undoSubtitleEdit();
  assert.equal(s().processedSubs.find((r) => r.index === 1).text, '你好');
  assert.equal(s().editHistory.length, 0);
  assert.equal(s().editFuture.length, 1);
  s().redoSubtitleEdit();
  assert.equal(s().processedSubs.find((r) => r.index === 1).text, '早上好');
  assert.equal(s().editHistory.length, 1);

  // No-op when text unchanged
  s().editSubtitleText(1, '早上好');
  assert.equal(s().editHistory.length, 1);

  // Credit row locked when not original work
  useStudioStore.setState({
    isOriginalWork: false,
    processedSubs: [
      row(1, '翻译：Alice', { cueKind: 'credit', type: 'note' }),
      row(2, '对话'),
    ],
    editHistory: [],
    editFuture: [],
  });
  s().editSubtitleText(1, '翻译：Bob');
  assert.equal(s().processedSubs.find((r) => r.index === 1).text, '翻译：Alice');
  assert.equal(s().editHistory.length, 0);
});

test('merge review ticks: set / toggle / mark / clear (per task + all)', () => {
  seedWorkbench();
  const s = () => useStudioStore.getState();
  s().setMergeReviewChecked('task-a', ['r1', 'r1', 'r2']);
  assert.deepEqual(s().mergeReviewCheckedByTask['task-a'], ['r1', 'r2']);
  s().toggleMergeReviewChecked('task-a', 'r2');
  assert.deepEqual(s().mergeReviewCheckedByTask['task-a'], ['r1']);
  s().toggleMergeReviewChecked('task-a', 'r3');
  assert.deepEqual(s().mergeReviewCheckedByTask['task-a'], ['r1', 'r3']);
  s().markMergeReviewChecked('task-a', 'r1'); // already present
  s().markMergeReviewChecked('task-a', 'r4');
  assert.deepEqual(s().mergeReviewCheckedByTask['task-a'], ['r1', 'r3', 'r4']);
  s().setMergeReviewChecked('task-b', ['x']);
  s().clearMergeReviewChecked('task-a');
  assert.equal('task-a' in s().mergeReviewCheckedByTask, false);
  assert.deepEqual(s().mergeReviewCheckedByTask['task-b'], ['x']);
  s().clearMergeReviewChecked();
  assert.deepEqual(s().mergeReviewCheckedByTask, {});
});

test('style save: setCustomStyle + saveCustomTemplate persist nexus_subtitle_styles_v4', () => {
  memory.clear();
  seedWorkbench();
  const s = () => useStudioStore.getState();
  const next = { ...s().customStyle, zhFontSize: 28, zhColor: '#FF0000' };
  s().setCustomStyle(next);
  const raw = JSON.parse(memory.get('nexus_subtitle_styles_v4'));
  assert.equal(raw.style.zhFontSize, 28);
  assert.equal(raw.style.zhColor, '#FF0000');
  assert.ok(Array.isArray(raw.templates));

  s().saveCustomTemplate('pin-tpl', { styles: { zhFontSize: 30 }, source: 'saved' });
  const after = JSON.parse(memory.get('nexus_subtitle_styles_v4'));
  assert.ok(after.templates.some((t) => t.name === 'pin-tpl'));
  assert.equal(s().customTemplates.some((t) => t.name === 'pin-tpl'), true);
});

test('history save/load (in-memory libraryList; IDB may be unavailable in Node)', () => {
  seedWorkbench({
    processedSubs: [row(1, '你好\nHello')],
    libraryList: [],
  });
  const s = () => useStudioStore.getState();
  s().saveToLibrary();
  assert.equal(s().libraryList.length, 1);
  const item = s().libraryList[0];
  assert.equal(item.name, 'Show.S01E01');
  assert.equal(item.subs[0].text, '你好\nHello');

  // Mutate workbench then reload
  useStudioStore.setState({ processedSubs: [row(1, 'changed')], workflowStep: 1, customFilename: '' });
  s().loadFromLibrary(item);
  assert.equal(s().workflowStep, 2);
  assert.equal(s().customFilename, item.name);
  assert.equal(s().processedSubs[0].text, '你好\nHello');
  assert.equal(s().filenameSource, 'library');
  assert.deepEqual(s().editHistory, []);
  assert.deepEqual(s().editFuture, []);

  s().deleteFromLibrary(item.id);
  assert.equal(s().libraryList.length, 0);
});

test('cancelCurrentUpload clears the pinned field set (S3 per-slice reset)', () => {
  seedWorkbench({
    mergeReviewCheckedByTask: { 'task-a': ['r1'] },
    editHistory: [{ index: 1, before: 'a', after: 'b' }],
    editFuture: [{ index: 1, before: 'b', after: 'a' }],
  });
  const before = useStudioStore.getState();
  assert.equal(before.filenameEpKey, 'S01E01');
  assert.equal(before.borrowedVideoName, 'Show.S01E01.mkv');
  assert.equal(before.previewClockMs, 1234);
  assert.equal(before.locateGroupIndexes[0], 0);
  assert.equal(before.creatorCredit, 'Nias');

  useStudioStore.getState().cancelCurrentUpload();
  const s = useStudioStore.getState();
  assert.equal(s.workflowStep, 1);
  assert.equal(s.uploadedFiles.length, 0);
  assert.equal(s.tasks.length, 0);
  assert.equal(s.selectedTaskId, null);
  assert.equal(s.processedSubs, null);
  assert.equal(s.tmdbData, null);
  assert.equal(s.tmdbBackdrop, null);
  assert.deepEqual(s.tmdbSuggestions, []);
  assert.equal(s.tmdbAlternateSuggestion, null);
  assert.equal(s.selectedSuggestion, null);
  assert.equal(s.tmdbManualOpen, false);
  assert.equal(s.isSearchingTmdb, false);
  assert.deepEqual(s.statusNotices, []);
  assert.deepEqual(s.editHistory, []);
  assert.deepEqual(s.editFuture, []);
  assert.deepEqual(s.mergeReviewCheckedByTask, {});
  assert.equal(s.isLightsOff, false);
  assert.equal(s.isProcessing, false);
  // S3: ingest + workbench + tmdb suggestion state now reset
  assert.equal(s.filenameEpKey, '');
  assert.equal(s.borrowedVideoName, null);
  assert.deepEqual(s.locateGroupIndexes, []);
  // Still NOT cleared by cancel (credit fields / theater clock):
  assert.equal(s.previewClockMs, 1234);
  assert.equal(s.isPreviewPlaying, true);
  assert.equal(s.creatorCredit, 'Nias');
  assert.equal(s.appendCreatorCredit, true);
});

test('restartSystem clears the pinned field set (S3 per-slice reset)', () => {
  seedWorkbench({
    mergeReviewCheckedByTask: { 'task-a': ['r1'] },
    isSearchingTmdb: true,
    tmdbSuggestions: [{ id: 9, media_type: 'movie', title: 'Y' }],
    selectedSuggestion: { id: 9, media_type: 'movie', title: 'Y' },
    tmdbAlternateSuggestion: { id: 8, media_type: 'movie', title: 'Z' },
    tmdbManualOpen: true,
  });
  useStudioStore.getState().restartSystem();
  const s = useStudioStore.getState();
  assert.equal(s.workflowStep, 1);
  assert.equal(s.uploadedFiles.length, 0);
  assert.equal(s.tasks.length, 0);
  assert.equal(s.selectedTaskId, null);
  assert.equal(s.processedSubs, null);
  assert.equal(s.tmdbData, null);
  assert.equal(s.tmdbBackdrop, null);
  assert.deepEqual(s.tmdbBackdropList, []);
  // restart clears then addLog("已重启…") — pin: only that one info log remains
  assert.equal(s.logs.length, 1);
  assert.match(s.logs[0].msg, /已重启/);
  assert.deepEqual(s.statusNotices, []);
  assert.deepEqual(s.editHistory, []);
  assert.deepEqual(s.mergeReviewCheckedByTask, {});
  assert.equal(s.isOfficialSubtitle, false);
  assert.equal(s.isOriginalWork, false);
  assert.equal(s.creditDeclaration, 'none');
  assert.equal(s.creatorCredit, '');
  assert.equal(s.appendCreatorCredit, false);
  // S3: TMDB suggestion/search + ingest ep/borrowed + locate also reset
  assert.equal(s.isSearchingTmdb, false);
  assert.deepEqual(s.tmdbSuggestions, []);
  assert.equal(s.tmdbAlternateSuggestion, null);
  assert.equal(s.selectedSuggestion, null);
  assert.equal(s.tmdbManualOpen, false);
  assert.equal(s.filenameEpKey, '');
  assert.equal(s.borrowedVideoName, null);
  assert.deepEqual(s.locateGroupIndexes, []);
  // Still NOT cleared by restart (theater clock):
  assert.equal(s.previewClockMs, 1234);
  assert.equal(s.isPreviewPlaying, true);
});

test('S8: selectTask clears stuck isSearchingTmdb when new task skips search', async () => {
  const fA = makeFile('f-a', 'Show.S01E01.chs.srt');
  const fB = makeFile('f-b', 'Show.S01E02.chs.srt');
  useStudioStore.setState({
    isSearchingTmdb: true,
    tmdbSuggestions: [{ id: 1, media_type: 'tv', title: 'X' }],
    uploadedFiles: [fA, fB],
    tasks: [
      { id: 'task-a', title: 'A', epKey: 'S01E01', zh: fA, en: null, commentary: null, status: 'partial', files: [fA] },
      {
        id: 'task-b', title: 'B', epKey: 'S01E02', zh: fB, en: null, commentary: null, status: 'partial', files: [fB],
        tmdbData: { title: 'Show', year: '2022' }, tmdbBackdrop: null, tmdbBackdropList: [],
      },
    ],
    selectedTaskId: 'task-a',
    files: { zh: fA, en: null, commentary: null },
    tmdbData: null,
  });
  assert.equal(useStudioStore.getState().isSearchingTmdb, true);
  useStudioStore.getState().selectTask('task-b');
  // task-b already has metadata → no deferred search; spinner must not stick
  assert.equal(useStudioStore.getState().isSearchingTmdb, false);
  assert.equal(useStudioStore.getState().selectedTaskId, 'task-b');
});

test('deleteTask and removeFileFromTask (prefer content id; name still works)', async () => {
  const fZh = makeFile('f-zh', 'Show.S01E01.chs.srt');
  const fEn = makeFile('f-en', 'Show.S01E01.eng.srt', '1\n00:00:01,000 --> 00:00:02,000\nHello\n');
  const fZh2 = makeFile('f-zh2', 'Show.S01E02.chs.srt');
  // Same basename, different content id — both must stay until explicitly removed (S2).
  const fDupName = makeFile('f-dup', 'Show.S01E01.chs.srt', '1\n00:00:01,000 --> 00:00:02,000\n另一版\n');
  useStudioStore.setState({
    uploadedFiles: [fZh, fEn, fZh2, fDupName],
    tasks: [
      { id: 'task-a', title: 'A', epKey: 'S01E01', zh: fZh, en: fEn, commentary: null, status: 'paired', files: [fZh, fEn, fDupName] },
      { id: 'task-b', title: 'B', epKey: 'S01E02', zh: fZh2, en: null, commentary: null, status: 'partial', files: [fZh2] },
    ],
    selectedTaskId: 'task-a',
    files: { zh: fZh, en: fEn, commentary: null },
    customFilename: 'A',
    filenameSource: 'manual',
    borrowedVideoName: 'vid.mkv',
    filenameEpKey: 'S01E01',
  });

  // Prefer content id
  useStudioStore.getState().removeFileFromTask('task-a', 'f-en');
  await delay(20);
  let s = useStudioStore.getState();
  assert.equal(s.uploadedFiles.some((f) => f.id === 'f-en'), false);
  assert.equal(s.tasks.find((t) => t.id === 'task-a')?.en, null);
  // Same-name sibling still present
  assert.equal(s.uploadedFiles.filter((f) => f.name === 'Show.S01E01.chs.srt').length, 2);

  // Basename still accepted (removes first match by id||name — here unique eng already gone)
  useStudioStore.getState().removeFileFromTask('task-a', 'f-dup');
  await delay(20);
  s = useStudioStore.getState();
  assert.equal(s.uploadedFiles.some((f) => f.id === 'f-dup'), false);
  assert.equal(s.uploadedFiles.some((f) => f.id === 'f-zh'), true);

  useStudioStore.getState().deleteTask('task-a');
  await delay(20);
  s = useStudioStore.getState();
  assert.equal(s.tasks.some((t) => t.id === 'task-a'), false);
  assert.equal(s.uploadedFiles.some((f) => f.id === 'f-zh'), false);
  // Reselects remaining task via setTimeout(0)
  assert.equal(s.selectedTaskId, 'task-b');

  useStudioStore.getState().deleteTask('task-b');
  await delay(20);
  s = useStudioStore.getState();
  assert.equal(s.tasks.length, 0);
  assert.equal(s.selectedTaskId, null);
  assert.equal(s.borrowedVideoName, null);
  assert.equal(s.filenameEpKey, '');
});

test('A3: deferred auto match — processFiles waits for the ceremony; 429 surfaces without a notice', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? '7' : null) },
      json: async () => ({}),
    };
  };
  try {
    useStudioStore.getState().restartSystem();
    useStudioStore.setState({ statusNotices: [], tmdbData: null, selectedTaskId: null, tasks: [], uploadedFiles: [] });
    const f = makeFile('f-rl', 'Ratelimit.Movie.2021.1080p.chs.srt');
    const taskId = await useStudioStore.getState().processFiles([f], { recognized: true, deferAutoMatch: true });
    assert.ok(taskId, 'processFiles resolves with the selected task id');
    await delay(80);
    assert.equal(calls, 0, 'deferred: selectTask must not start its own search');
    const outcome = await useStudioStore.getState().autoMatchTask(taskId, { ceremony: true });
    assert.equal(outcome.kind, 'rate_limited');
    assert.equal(outcome.retryAfterMs, 7000);
    assert.ok(calls >= 1);
    assert.equal(
      useStudioStore.getState().statusNotices.some((n) => n.id === 'media-match'),
      false,
      'ceremony owns the retry / manual choice — no duplicate notice',
    );
    assert.equal(useStudioStore.getState().isSearchingTmdb, false);
    assert.equal((await useStudioStore.getState().autoMatchTask('other-task')).kind, 'skipped');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('ceremony polish: 5xx surfaces as failed with status so the ceremony can retry silently', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) });
  try {
    useStudioStore.getState().restartSystem();
    useStudioStore.setState({ statusNotices: [], tmdbData: null, selectedTaskId: null, tasks: [], uploadedFiles: [] });
    const f = makeFile('f-5xx', 'Outage.Movie.2020.1080p.chs.srt');
    const taskId = await useStudioStore.getState().processFiles([f], { recognized: true, deferAutoMatch: true });
    const outcome = await useStudioStore.getState().autoMatchTask(taskId, { ceremony: true });
    assert.equal(outcome.kind, 'failed');
    assert.equal(outcome.status, 503);
    assert.equal(useStudioStore.getState().statusNotices.length, 0, 'silent in ceremony mode: no banner / toast');
  } finally {
    globalThis.fetch = realFetch;
  }
});
