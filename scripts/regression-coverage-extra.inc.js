{
  // Coverage N:1 — one EN covers two CN cues (mirror of 1:N).
  const zh = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: '第一句中文' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: '第二句中文' },
  ];
  const en = [{ ts: '00:00:01,000 --> 00:00:08,000', text: 'One English span covering both' }];
  const fast = mergeSubtitles(zh, en, [], noopLog);
  const industrial = alignSubtitlesIndustrial(zh, en, [], noopLog);
  for (const [label, merged] of [['fast', fast], ['industrial', industrial]]) {
    const expanded = merged.filter((row) => row.alignment === 'coverage-merge');
    assert.equal(expanded.length, 2, `${label}: Coverage N:1 should emit two merged rows.`);
    assert.ok(expanded.every((row) => row.text.includes('One English span covering both')), `${label}: outer EN text must be reused.`);
    assert.ok(expanded.every((row) => /第一句中文|第二句中文/.test(row.text)), `${label}: each CN beat kept.`);
  }
}

{
  // Counterpart gap > 1600ms must NOT coverage-merge (avoid stitching distant beats).
  const zh = [{ ts: '00:00:01,000 --> 00:00:12,000', text: '很长的中文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,000', text: 'Early beat' },
    { ts: '00:00:08,000 --> 00:00:10,000', text: 'Late beat after big gap' },
  ];
  const merged = mergeSubtitles(zh, en, [], noopLog);
  assert.equal(
    merged.filter((row) => row.alignment === 'coverage-merge').length,
    0,
    'Large gap between covered cues must not produce coverage-merge.',
  );
}

{
  // Industrial path must also emit coverage 1:N (parity with fast merge).
  const zh = [{ ts: '00:00:01,000 --> 00:00:08,000', text: '一句中文覆盖两句英文' }];
  const en = [
    { ts: '00:00:01,200 --> 00:00:03,500', text: 'First English beat' },
    { ts: '00:00:03,800 --> 00:00:07,200', text: 'Second English beat' },
  ];
  const industrial = alignSubtitlesIndustrial(zh, en, [], noopLog);
  const expanded = industrial.filter((row) => row.alignment === 'coverage-merge');
  assert.equal(expanded.length, 2, 'Industrial coverage 1:N should emit two merged rows.');
  const diff = analyzeAlignmentDiff(industrial.map((row, index) => ({ ...row, index: index + 1 })));
  assert.equal(diff.coverageMergeCount, 2, 'Review summary must count coverage-merge separately.');
  assert.equal(diff.expandedDialogueCount, 0, 'Coverage rows must not inflate expanded-dialogue count.');
}

