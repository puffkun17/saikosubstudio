/**
 * Timeline agreement between two subtitle tracks, from their first few dozen cues.
 * Translations of the same episode share timing (often from the same template);
 * different episodes do not. A constant offset (different release cut) is tolerated.
 */
export interface CueTime { start: number; end: number }

export interface TimelineAgreement {
  /** 0..1 share of sampled cues in A with a matching cue in B after offset correction. */
  score: number;
  /** Median start offset B − A (ms). */
  offsetMs: number;
  sampled: number;
}

export const TIMELINE_AGREEMENT_POLICY = {
  sampleCues: 40,
  toleranceMs: 250,
  /** ≥ high → same episode (auto-merge when episode numbers are equal). Tuned on synthetic fixtures. */
  high: 0.6,
  /** ≥ low → plausible, ask the user. */
  low: 0.3,
  minCues: 5,
} as const;

const SRT_TS = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
export function tsToMs(t: string): number {
  const m = (t || '').match(SRT_TS);
  if (!m) return NaN;
  return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4].padEnd(3, '0');
}

export function cueTimesFromRows(rows: { ts: string }[], limit: number = TIMELINE_AGREEMENT_POLICY.sampleCues * 3): CueTime[] {
  const out: CueTime[] = [];
  for (const row of rows) {
    const [a, b] = (row.ts || '').split('-->');
    const start = tsToMs(a);
    const end = tsToMs(b);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ start, end });
    if (out.length >= limit) break;
  }
  return out.sort((x, y) => x.start - y.start);
}

function nearest(sorted: CueTime[], t: number): CueTime | null {
  let lo = 0;
  let hi = sorted.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].start < t) lo = mid + 1; else hi = mid;
  }
  const c = sorted[lo];
  const p = lo > 0 ? sorted[lo - 1] : null;
  return p && Math.abs(p.start - t) < Math.abs(c.start - t) ? p : c;
}

export function measureTimelineAgreement(a: CueTime[], b: CueTime[], policy = TIMELINE_AGREEMENT_POLICY): TimelineAgreement {
  // Skip the first cue or two: credits/watermarks often sit there and differ per file.
  const sampleA = a.slice(0, policy.sampleCues);
  if (sampleA.length < policy.minCues || b.length < policy.minCues) return { score: 0, offsetMs: 0, sampled: sampleA.length };
  // Candidate offsets: deltas of every A cue against B cues near it in index space.
  const deltas: number[] = [];
  sampleA.forEach((cue, i) => {
    for (let j = Math.max(0, i - 4); j < Math.min(b.length, i + 5); j++) deltas.push(b[j].start - cue.start);
  });
  // Vote: bucket deltas by tolerance, take the most supported.
  const buckets = new Map<number, number[]>();
  for (const d of deltas) {
    const k = Math.round(d / policy.toleranceMs);
    (buckets.get(k) || buckets.set(k, []).get(k)!).push(d);
  }
  let best: number[] = [];
  for (const [k, list] of buckets) {
    const merged = [...list, ...(buckets.get(k - 1) || []), ...(buckets.get(k + 1) || [])];
    if (merged.length > best.length) best = merged;
  }
  const sortedDeltas = best.sort((x, y) => x - y);
  const offsetMs = sortedDeltas.length ? sortedDeltas[sortedDeltas.length >> 1] : 0;
  let hits = 0;
  for (const cue of sampleA) {
    const n = nearest(b, cue.start + offsetMs);
    if (!n) continue;
    if (Math.abs(n.start - (cue.start + offsetMs)) <= policy.toleranceMs && Math.abs(n.end - (cue.end + offsetMs)) <= policy.toleranceMs * 2) hits++;
  }
  return { score: hits / sampleA.length, offsetMs, sampled: sampleA.length };
}
