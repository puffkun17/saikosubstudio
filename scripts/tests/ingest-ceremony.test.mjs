/**
 * Act 1 · A3 ceremony controller — fake clock, no React / store.
 * Release = max(CEREMONY_MIN_MS, TMDB arrival); no forced release; choice at TMDB_PATIENCE_MS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flushIo } from 'node:timers/promises';
import { loadCore } from './_compile.mjs';

const {
  createIngestCeremony,
  CEREMONY_MIN_MS,
  TMDB_PATIENCE_MS,
} = loadCore()('core/ingestCeremony');

function createFakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await flushIo();
  };
  return {
    now: () => now,
    setTimeout: (fn, ms) => {
      seq += 1;
      timers.set(seq, { at: now + Math.max(0, ms), fn, seq });
      return seq;
    },
    clearTimeout: (id) => { timers.delete(id); },
    /** Advance to absolute time `t`, firing due timers in order and flushing promises. */
    async advanceTo(t) {
      await flush();
      while (true) {
        const due = [...timers.values()]
          .filter((timer) => timer.at <= t)
          .sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        timers.delete(due.seq);
        now = due.at;
        due.fn();
        await flush();
      }
      now = t;
      await flush();
    },
  };
}

/** A fake TMDB request that answers `outcome` after `ms` on the fake clock. */
const answerAfter = (clock, ms, outcome) => () =>
  new Promise((resolve) => clock.setTimeout(() => resolve(outcome), ms));

const watch = (ceremony) => {
  const seen = { releasedAt: null, reason: null };
  ceremony.released.then((r) => { seen.releasedAt = r.at; seen.reason = r.reason; });
  return seen;
};

test('constants match the 2026-10-30 decision', () => {
  assert.equal(CEREMONY_MIN_MS, 2400);
  assert.equal(TMDB_PATIENCE_MS, 8000);
});

test('TMDB answers within 1 s → release at 2.4 s', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  ceremony.runMatch(answerAfter(clock, 900, { kind: 'arrived' }));
  await clock.advanceTo(1000);
  assert.equal(ceremony.getSnapshot().match, 'arrived');
  assert.equal(ceremony.getSnapshot().phase, 'running', 'still holding the 2.4 s floor');
  await clock.advanceTo(2399);
  assert.equal(seen.releasedAt, null);
  await clock.advanceTo(2400);
  assert.equal(seen.releasedAt, 2400);
  assert.equal(seen.reason, 'arrived');
  assert.equal(ceremony.getSnapshot().needsChoice, false);
});

test('TMDB answers at 3.2 s → release at 3.2 s (no forced release before)', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  ceremony.runMatch(answerAfter(clock, 3200, { kind: 'arrived' }));
  await clock.advanceTo(3199);
  assert.equal(seen.releasedAt, null);
  assert.equal(ceremony.getSnapshot().match, 'pending');
  await clock.advanceTo(3200);
  assert.equal(seen.releasedAt, 3200);
  assert.equal(seen.reason, 'arrived');
});

test('still pending at 8 s → retry / manual offered, never released by time', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  ceremony.runMatch(() => new Promise(() => {})); // never answers
  await clock.advanceTo(7999);
  assert.equal(ceremony.getSnapshot().needsChoice, false);
  await clock.advanceTo(8000);
  const snap = ceremony.getSnapshot();
  assert.equal(snap.needsChoice, true);
  assert.equal(snap.choiceReason, 'slow');
  assert.equal(snap.match, 'pending');
  await clock.advanceTo(60_000);
  assert.equal(seen.releasedAt, null, 'no forced release (old 4.5 s / 6 s gates are gone)');
  ceremony.chooseManual();
  await clock.advanceTo(60_001);
  assert.equal(seen.reason, 'manual');
  assert.equal(seen.releasedAt, 60_000);
});

test('request failure → choice immediately, no release; retry then success releases', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  let calls = 0;
  ceremony.runMatch(() => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error('network down'));
    return answerAfter(clock, 500, { kind: 'arrived' })();
  });
  await clock.advanceTo(300);
  let snap = ceremony.getSnapshot();
  assert.equal(snap.match, 'failed');
  assert.equal(snap.needsChoice, true);
  assert.equal(snap.choiceReason, 'failed');
  assert.equal(snap.failureMessage, 'network down');
  await clock.advanceTo(5000);
  assert.equal(seen.releasedAt, null);
  ceremony.retry();
  snap = ceremony.getSnapshot();
  assert.equal(snap.needsChoice, false);
  assert.equal(snap.match, 'pending');
  assert.equal(snap.attempt, 2);
  await clock.advanceTo(5500);
  assert.equal(seen.releasedAt, 5500);
  assert.equal(seen.reason, 'arrived');
  assert.equal(calls, 2);
});

test('429 → queued auto retry after Retry-After, stays matching, then success', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  let calls = 0;
  ceremony.runMatch(() => {
    calls += 1;
    return calls === 1
      ? answerAfter(clock, 200, { kind: 'rate_limited', retryAfterMs: 3000 })()
      : answerAfter(clock, 400, { kind: 'arrived' })();
  });
  await clock.advanceTo(200);
  let snap = ceremony.getSnapshot();
  assert.equal(snap.match, 'rate_limited');
  assert.equal(snap.needsChoice, false, '429 is not a failure; UI stays on 匹配影片');
  assert.equal(snap.retryAt, 3200);
  await clock.advanceTo(3199);
  assert.equal(calls, 1);
  await clock.advanceTo(3200);
  assert.equal(calls, 2);
  assert.equal(ceremony.getSnapshot().match, 'pending');
  await clock.advanceTo(3600);
  assert.equal(seen.releasedAt, 3600);
  assert.equal(seen.reason, 'arrived');
  snap = ceremony.getSnapshot();
  assert.equal(snap.attempt, 2);
  assert.equal(snap.needsChoice, false);
});

test('long Retry-After still offers the choice at 8 s while the retry stays queued', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  watch(ceremony);
  let calls = 0;
  ceremony.runMatch(() => {
    calls += 1;
    return answerAfter(clock, 100, calls === 1 ? { kind: 'rate_limited', retryAfterMs: 60_000 } : { kind: 'arrived' })();
  });
  await clock.advanceTo(8000);
  const snap = ceremony.getSnapshot();
  assert.equal(snap.match, 'rate_limited');
  assert.equal(snap.needsChoice, true);
  assert.equal(snap.choiceReason, 'slow');
  assert.equal(calls, 1);
});

test('filename that never goes to TMDB keeps the old floor-only behaviour', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  await clock.advanceTo(700);
  ceremony.skipMatch();
  await clock.advanceTo(2400);
  assert.equal(seen.releasedAt, 2400);
  assert.equal(seen.reason, 'skipped');
});

test('late answer from a superseded attempt is ignored', async () => {
  const clock = createFakeClock();
  const ceremony = createIngestCeremony({ clock });
  const seen = watch(ceremony);
  let calls = 0;
  ceremony.runMatch(() => {
    calls += 1;
    return calls === 1
      ? answerAfter(clock, 9000, { kind: 'failed', message: 'late' })()
      : answerAfter(clock, 1000, { kind: 'arrived' })();
  });
  await clock.advanceTo(8000);
  ceremony.retry();
  await clock.advanceTo(9000);
  assert.equal(seen.releasedAt, 9000);
  assert.equal(seen.reason, 'arrived');
  assert.equal(ceremony.getSnapshot().failureMessage, null);
});
