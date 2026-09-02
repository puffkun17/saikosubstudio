{
  // buildMergeReviewQueue: coverage-merge + mid-film single-track must surface with reasons.
  const rows = [
    { index: 1, ts: '00:00:01,000 --> 00:00:02,000', text: '你好\nHello', type: 'merged' },
    {
      index: 2,
      ts: '00:00:03,000 --> 00:00:04,500',
      text: '覆盖中文\nOuter English span',
      type: 'merged',
      alignment: 'coverage-merge',
      provenance: {
        method: 'exact-match',
        timingSource: 'secondary',
        primary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:08,000', text: '覆盖中文' },
        secondary: { cueIndex: 2, ts: '00:00:03,000 --> 00:00:04,500', text: 'Outer English span' },
      },
    },
    {
      index: 3,
      ts: '00:05:00,000 --> 00:05:01,200',
      text: '片中单轨台词',
      type: 'dialogue',
      provenance: {
        method: 'single-track',
        timingSource: 'primary',
        primary: { cueIndex: 3, ts: '00:05:00,000 --> 00:05:01,200', text: '片中单轨台词' },
      },
    },
    {
      index: 4,
      ts: '00:10:00,000 --> 00:10:02,000',
      text: '平移\nShifted',
      type: 'merged',
      alignment: 'shifted-match',
      provenance: {
        method: 'shifted-match',
        timingSource: 'primary',
        confidence: 0.55,
        offsetMs: 3500,
        primary: { cueIndex: 4, ts: '00:10:00,000 --> 00:10:02,000', text: '平移' },
        secondary: { cueIndex: 4, ts: '00:10:03,500 --> 00:10:05,500', text: 'Shifted' },
      },
    },
    {
      index: 5,
      ts: '00:06:00,000 --> 00:06:01,000',
      text: '[something odd]',
      type: 'dialogue',
      auxiliary: {
        category: 'unknown',
        confidence: 38,
        action: 'keep_auxiliary',
        reasons: ['unknown-soft'],
        suspicion: {
          kind: 'needs_review',
          confidence: 40,
          reasons: ['soft-bracket'],
          detail: '括号内容分类不稳，建议人工确认',
        },
      },
    },
  ];

  const queue = buildMergeReviewQueue(rows);
  assert.ok(queue.total >= 3, 'Review queue should include coverage + single-track (+ more).');
  assert.equal(queue.counts['coverage-merge'], 1, 'coverage-merge must appear once in queue.');
  assert.equal(queue.counts['single-track'], 1, 'mid-film single-track must appear once in queue.');

  const coverage = queue.items.find((item) => item.category === 'coverage-merge');
  assert.ok(coverage, 'coverage-merge item missing');
  assert.match(coverage.reason, /覆盖|核对/, 'coverage-merge reason should ask for human check');
  assert.deepEqual(coverage.rowIndexes, [2]);

  const single = queue.items.find((item) => item.category === 'single-track');
  assert.ok(single, 'single-track item missing');
  assert.equal(single.isBoundaryCandidate, false, '00:05 mid-film orphan should not be boundary');
  assert.match(single.reason, /片中|未配对|核对/, 'single-track mid-film reason');
  assert.deepEqual(single.rowIndexes, [3]);

  const shifted = queue.items.find((item) => item.category === 'shifted-match');
  assert.ok(shifted, 'shifted-match should stay review-worthy');
  assert.equal(shifted.severity, 'review', 'low shifted confidence should be review severity');
  assert.match(shifted.reason, /偏低|抽查/, 'low-confidence shifted reason');

  const suspect = queue.items.find((item) => item.category === 'other-suspect');
  assert.ok(suspect, 'auxiliary suspicion should land in other-suspect');
  assert.match(suspect.reason, /人工|复核|存疑|确认/, 'other-suspect reason');

  const filtered = filterMergeReviewQueue(queue, 'coverage-merge');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].category, 'coverage-merge');
}

{
  // Live merge → queue: coverage N:1 rows must be queued with coverage-merge category.
  const zh = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: '第一句中文' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: '第二句中文' },
  ];
  const en = [{ ts: '00:00:01,000 --> 00:00:08,000', text: 'One English span covering both' }];
  const merged = mergeSubtitles(zh, en, [], noopLog).map((row, index) => ({ ...row, index: index + 1 }));
  const queue = buildMergeReviewQueue(merged);
  assert.ok(queue.counts['coverage-merge'] >= 2, 'Live coverage merge should enqueue coverage-merge rows');
  assert.ok(
    queue.items.some((item) => item.category === 'coverage-merge' && /覆盖|核对/.test(item.reason)),
    'Live coverage queue items need human-check reasons',
  );
}

