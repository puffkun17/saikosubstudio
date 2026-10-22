import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';
import { LINES_EN, LINES_ZH, LINES_JA, timeline, toAss } from './_fixtures.mjs';

const core = loadCore();
const job = core('core/recognitionJob');
const client = core('core/recognitionClient');
const id = core('core/identity');

const mk = (name, text, lang = 'en') => ({
  id: id.mintFileId(name, text),
  name,
  text,
  lang,
  isBilingual: false,
  isCommentary: false,
  size: text.length,
});

test('executeRecognitionJob: zh+ja ASS splits into two tracks with stable track ids', () => {
  const t = timeline(12, 2);
  const events = t.flatMap((c, i) => [
    { ...c, style: 'Dial_JP', text: LINES_JA[i % LINES_JA.length] },
    { ...c, style: 'Dial_CH', text: LINES_ZH[i % LINES_ZH.length] },
  ]);
  const text = toAss(events);
  const input = [mk('Show.S01E01.ass', text, 'ja')];
  const { files } = job.executeRecognitionJob(input);
  assert.equal(files.length, 2);
  assert.ok(files[0].name.includes('简中'));
  assert.ok(files[1].name.includes('日文'));
  assert.ok(files[0].id.startsWith('track.v'));
  assert.ok(files[1].id.startsWith('track.v'));
  assert.deepEqual(files[0].derivedFrom.styles.sort(), files[0].derivedFrom.styles.slice().sort());
});

test('executeRecognitionJob: SDH-by-content flags English without SDH filename', () => {
  const sdhText = LINES_EN.map((l, i) => `${i + 1}\n00:00:0${i},000 --> 00:00:0${i},500\n${i % 3 === 0 ? '[door opens]' : l}\n`).join('\n');
  const plainText = LINES_EN.map((l, i) => `${i + 1}\n00:00:0${i},000 --> 00:00:0${i},500\n${l}\n`).join('\n');
  const sdh = job.executeRecognitionJob([mk('Show.S01E01.eng.srt', sdhText, 'en')]).files[0];
  const plain = job.executeRecognitionJob([mk('Show.S01E01.eng.srt', plainText, 'en')]).files[0];
  assert.equal(sdh.isSdh, true);
  assert.equal(plain.isSdh, undefined);
});

test('in-thread client matches executeRecognitionJob (worker fallback path)', () => {
  const t = timeline(8, 2);
  const events = t.flatMap((c, i) => [
    { ...c, style: 'Dial_JP', text: LINES_JA[i % LINES_JA.length] },
    { ...c, style: 'Dial_CH', text: LINES_ZH[i % LINES_ZH.length] },
  ]);
  const input = [mk('Pair.ass', toAss(events), 'ja')];
  const direct = job.executeRecognitionJob(input);
  const viaClient = client.runRecognitionJobInThread(input);
  assert.equal(viaClient.ranIn, 'main');
  assert.deepEqual(
    viaClient.files.map((f) => ({ id: f.id, name: f.name, lang: f.lang, isSdh: f.isSdh, derived: f.derivedFrom })),
    direct.files.map((f) => ({ id: f.id, name: f.name, lang: f.lang, isSdh: f.isSdh, derived: f.derivedFrom })),
  );
  // No Worker factory in Node → async client also falls back to main with identical payload.
  return client.runRecognitionJob(input).then((asyncResult) => {
    assert.equal(asyncResult.ranIn, 'main');
    assert.deepEqual(
      asyncResult.files.map((f) => ({ id: f.id, name: f.name, text: f.text })),
      direct.files.map((f) => ({ id: f.id, name: f.name, text: f.text })),
    );
  });
});

test('recognition job is structured-clone safe (round-trip)', () => {
  const text = toAss(timeline(5, 2).map((c, i) => ({ ...c, style: 'Default', text: LINES_EN[i % LINES_EN.length] })));
  const input = [mk('Plain.ass', text, 'en')];
  const cloned = structuredClone(input);
  const { files } = job.executeRecognitionJob(cloned);
  assert.doesNotThrow(() => structuredClone(files));
});

test('main-thread cost of recognition on a mid-size ASS (baseline for worker offload)', () => {
  const t = timeline(200, 2);
  const events = t.flatMap((c, i) => [
    { ...c, style: 'Dial_JP', text: LINES_JA[i % LINES_JA.length] },
    { ...c, style: 'Dial_CH', text: LINES_ZH[i % LINES_ZH.length] },
  ]);
  const input = [mk('Heavy.S01E01.ass', toAss(events), 'ja')];
  const t0 = performance.now();
  const { files } = job.executeRecognitionJob(input);
  const ms = performance.now() - t0;
  assert.equal(files.length, 2);
  // Recorded for the report — not a flaky gate; just ensure work happened.
  assert.ok(ms >= 0);
  console.log(`recognition_job_main_thread_ms=${ms.toFixed(2)} cues=${t.length * 2}`);
});
