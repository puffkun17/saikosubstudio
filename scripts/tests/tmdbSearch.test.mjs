import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const {
  mergeResults,
  runSearch,
  clearTmdbClientCache,
  uniqueQueries,
  prepareCleanQuery,
  TmdbRequestError,
  parseRetryAfterMs,
  isTmdbRateLimitError,
} = core('core/tmdbSearch');

test('mergeResults: appends new media_type:id keys only', () => {
  const target = [
    { id: 1, media_type: 'movie', title: 'A' },
    { id: 2, media_type: 'tv', name: 'B' },
  ];
  mergeResults(target, [
    { id: 1, media_type: 'movie', title: 'A-dup' },
    { id: 2, media_type: 'movie', title: 'B-as-movie' },
    { id: 3, media_type: 'tv', name: 'C' },
  ]);
  assert.equal(target.length, 4);
  assert.deepEqual(target.map((t) => `${t.media_type}:${t.id}`), [
    'movie:1',
    'tv:2',
    'movie:2',
    'tv:3',
  ]);
});

test('uniqueQueries / prepareCleanQuery: planning helpers', () => {
  assert.deepEqual(uniqueQueries(['  Foo  ', 'Foo', 'x', 'Bar Bar'], 'Foo', '  '), ['Foo', 'Bar Bar']);
  assert.equal(prepareCleanQuery('Show.S02E01.2020.WEB', '2020'), 'Show WEB');
  assert.equal(prepareCleanQuery('Movie Name EP03', ''), 'Movie Name');
});

test('runSearch: cache hit skips second fetch', async () => {
  clearTmdbClientCache();
  let fetchCount = 0;
  const payload = {
    results: [
      { id: 42, media_type: 'movie', title: 'Cached', adult: false },
      { id: 99, media_type: 'person', name: 'Skip', adult: false },
    ],
  };
  const fetchFn = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => payload,
    };
  };
  const first = await runSearch({
    query: 'Cached',
    endpoint: 'multi',
    mode: 'auto',
    fetchFn,
    cacheEnabled: true,
  });
  const second = await runSearch({
    query: 'Cached',
    endpoint: 'multi',
    mode: 'auto',
    fetchFn,
    cacheEnabled: true,
  });
  assert.equal(fetchCount, 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].id, 42);
  assert.equal(second[0].id, 42);
  assert.equal(second, first);
});

test('runSearch: 429 surfaces as rate-limit error with Retry-After (not an empty result)', async () => {
  clearTmdbClientCache();
  const fetchFn = async () => ({
    ok: false,
    status: 429,
    headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? '60' : null) },
    json: async () => ({ error: 'rate_limited' }),
  });
  await assert.rejects(
    runSearch({ query: 'Busy', fetchFn, cacheEnabled: true }),
    (error) => {
      assert.ok(error instanceof TmdbRequestError);
      assert.ok(isTmdbRateLimitError(error));
      assert.equal(error.retryAfterMs, 60_000);
      return true;
    },
  );
});

test('runSearch: 5xx throws; other 4xx stays an empty result', async () => {
  clearTmdbClientCache();
  const res = (status) => async () => ({ ok: false, status, headers: { get: () => null }, json: async () => ({}) });
  await assert.rejects(runSearch({ query: 'Down', fetchFn: res(502), cacheEnabled: false }), (error) => {
    assert.ok(error instanceof TmdbRequestError);
    assert.equal(isTmdbRateLimitError(error), false);
    return true;
  });
  assert.deepEqual(await runSearch({ query: 'Bad', fetchFn: res(400), cacheEnabled: false }), []);
});

test('parseRetryAfterMs: seconds, HTTP-date, junk', () => {
  assert.equal(parseRetryAfterMs('5'), 5000);
  assert.equal(parseRetryAfterMs(null), null);
  assert.equal(parseRetryAfterMs('soon'), null);
  const now = Date.parse('2026-10-30T04:00:00Z');
  assert.equal(parseRetryAfterMs('Fri, 30 Oct 2026 04:00:30 GMT', now), 30_000);
});
