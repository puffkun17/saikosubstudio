/**
 * Global merge invariants for dual-track subtitle merge.
 *
 * - Every input cue appears in the output (by source index / text)
 * - Output rows are time-monotonic by start
 * - Original dialogue text is never silently rewritten (esp. punctuation stripping)
 *
 * Coverage-merge / expanded-dialogue may reference the same cueIndex on multiple
 * rows; set equality (not multiset) is the coverage rule.
 */

/** @param {string} ts */
export function startMs(ts) {
  const start = String(ts || '').split(' --> ')[0] || '';
  const m = start.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return NaN;
  const ms = m[4].length === 2 ? Number(m[4]) * 10 : Number(m[4].padEnd(3, '0').slice(0, 3));
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + ms;
}

/** Strip leading/trailing non-word chars the same way the old V8 path did. */
export function stripEdgePunct(text) {
  return String(text || '')
    .replace(/^[^\w\u4e00-\u9fff]+/, '')
    .replace(/[^\w\u4e00-\u9fff]+$/, '');
}

/**
 * Collect primary/secondary cueIndex sets from merge provenance.
 * Note rows keep preprocess `sourceIndex` but no track tag — counted separately.
 */
export function collectProvenanceIndexes(rows) {
  const primary = new Set();
  const secondary = new Set();
  const noteSourceIndexes = new Set();
  for (const row of rows) {
    if (row?.provenance?.primary?.cueIndex != null) primary.add(row.provenance.primary.cueIndex);
    if (row?.provenance?.secondary?.cueIndex != null) secondary.add(row.provenance.secondary.cueIndex);
    if (row?.type === 'note' && row.sourceIndex != null) noteSourceIndexes.add(row.sourceIndex);
  }
  return { primary, secondary, noteSourceIndexes };
}

/**
 * Whether an input cue's text is still visible in the merged output.
 * Allows packed-dialogue turn splits and coverage-merge reuse.
 */
export function inputCueTextPresent(cueText, rows) {
  const haystack = rows.map((r) => r.text).join('\n');
  const raw = String(cueText || '').replace(/\r/g, '').trim();
  if (!raw) return true;
  if (haystack.includes(raw)) return true;
  // Newline / ASS \N packed turns after dash strip
  const turns = raw.split(/\n+/).map((t) => t.replace(/^[-–—]\s*/, '').trim()).filter(Boolean);
  if (turns.length >= 2 && turns.every((t) => haystack.includes(t))) return true;
  // Space-joined SRT dual-speaker fallback (pre-V9): "-A -B"
  const spaced = raw.split(/\s+/).map((t) => t.replace(/^[-–—]/, '').trim()).filter(Boolean);
  if (spaced.length >= 2 && spaced.every((t) => haystack.includes(t) || haystack.includes(`-${t}`))) return true;
  return false;
}

/**
 * Detect silent punctuation-only rewrites (V8).
 * Skips expanded / coverage rows where text is intentionally reshaped.
 */
export function findPunctuationRewrites(rows) {
  const issues = [];
  for (const row of rows) {
    const prov = row?.provenance;
    if (!prov) continue;
    if (prov.method === 'expanded-dialogue' || prov.method === 'coverage-merge') continue;

    const check = (side, actual) => {
      if (!side?.text || actual == null) return;
      if (side.text === actual) return;
      // Legitimate note extraction leaves dialogue ≠ full sourceText.
      if (side.text.includes(actual) && /[(\[（【♪*]/.test(side.text)) return;
      if (stripEdgePunct(side.text) === stripEdgePunct(actual) || stripEdgePunct(side.text) === actual) {
        issues.push({
          index: row.index,
          method: prov.method,
          from: side.text,
          to: actual,
        });
      }
    };

    if (prov.method === 'single-track') {
      const side = prov[prov.timingSource];
      check(side, row.text);
    } else if (prov.method === 'exact-match' || prov.method === 'shifted-match') {
      const parts = String(row.text || '').split('\n');
      check(prov.primary, parts[0]);
      check(prov.secondary, parts.slice(1).join('\n') || parts[1]);
    }
  }
  return issues;
}

/**
 * @param {{ primary: Array<{text:string,ts?:string}>, secondary: Array<{text:string,ts?:string}>, rows: any[], label?: string }} args
 * @returns {{ ok: boolean, errors: string[], stats: object }}
 */
export function checkMergeInvariants({ primary, secondary, rows, label = 'merge' }) {
  const errors = [];
  const primarySubs = primary || [];
  const secondarySubs = secondary || [];
  const out = rows || [];

  // --- time monotonic ---
  let prev = -Infinity;
  for (const row of out) {
    const t = startMs(row.ts);
    if (Number.isNaN(t)) {
      errors.push(`${label}: row #${row.index} has unparseable ts ${JSON.stringify(row.ts)}`);
      continue;
    }
    if (t < prev) {
      errors.push(`${label}: time not monotonic at #${row.index} (${row.ts}, prevMs=${prev})`);
    }
    prev = t;
  }

  // --- cue index coverage (dialogues via provenance) ---
  const expectedPrimary = new Set(primarySubs.map((_, i) => i + 1));
  const expectedSecondary = new Set(secondarySubs.map((_, i) => i + 1));
  const seen = collectProvenanceIndexes(out);

  // A cue that became a pure note won't appear in provenance; treat note sourceIndex
  // as covering either track when text matches (best-effort).
  const lostPrimary = [...expectedPrimary].filter((idx) => {
    if (seen.primary.has(idx)) return false;
    if (seen.noteSourceIndexes.has(idx) && inputCueTextPresent(primarySubs[idx - 1]?.text, out)) return false;
    return !inputCueTextPresent(primarySubs[idx - 1]?.text, out);
  });
  const lostSecondary = [...expectedSecondary].filter((idx) => {
    if (seen.secondary.has(idx)) return false;
    if (seen.noteSourceIndexes.has(idx) && inputCueTextPresent(secondarySubs[idx - 1]?.text, out)) return false;
    return !inputCueTextPresent(secondarySubs[idx - 1]?.text, out);
  });

  if (lostPrimary.length) {
    errors.push(`${label}: lost primary cue(s) ${lostPrimary.join(',')}: ${lostPrimary.map((i) => JSON.stringify(primarySubs[i - 1]?.text)).join('; ')}`);
  }
  if (lostSecondary.length) {
    errors.push(`${label}: lost secondary cue(s) ${lostSecondary.join(',')}: ${lostSecondary.map((i) => JSON.stringify(secondarySubs[i - 1]?.text)).join('; ')}`);
  }

  // --- text rewrite (punctuation) ---
  for (const issue of findPunctuationRewrites(out)) {
    errors.push(`${label}: punctuation rewrite #${issue.index} ${JSON.stringify(issue.from)} → ${JSON.stringify(issue.to)}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      rows: out.length,
      primaryIn: primarySubs.length,
      secondaryIn: secondarySubs.length,
      primarySeen: seen.primary.size,
      secondarySeen: seen.secondary.size,
      lostPrimary: lostPrimary.length,
      lostSecondary: lostSecondary.length,
    },
  };
}

/**
 * Compact structural snapshot of merge rows (stable for golden compare).
 */
export function snapshotMergeStructure(rows) {
  return (rows || []).map((row) => ({
    index: row.index,
    ts: row.ts,
    type: row.type,
    cueKind: row.cueKind || null,
    method: row.provenance?.method || null,
    timingSource: row.provenance?.timingSource || null,
    primaryCue: row.provenance?.primary?.cueIndex ?? null,
    secondaryCue: row.provenance?.secondary?.cueIndex ?? null,
    groupId: row.provenance?.groupId || null,
    text: row.text,
  }));
}

/** Build a minimal SRT from [startMs, endMs, text] tuples. */
export function cuesToSrt(cues, msToTime) {
  return cues
    .map(([s, e, t], i) => `${i + 1}\n${msToTime(s)} --> ${msToTime(e)}\n${t}\n`)
    .join('\n');
}
