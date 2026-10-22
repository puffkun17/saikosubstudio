/** Subtitle engine: merge / align algorithms. Must not import io or product. */
import {
  OFFSET_DIAGNOSIS_POLICY,
  estimateGlobalOffsetFromStarts,
  type GlobalOffsetDiagnosis,
} from '../timeline/offsetDiagnosis';
import {
  type AlignmentProvenance,
  type AlignmentSourceRef,
  type AuxiliaryCueCategory,
  type AuxiliaryCueClassification,
  type CueKind,
  type RawSub,
  type SubRow,
  cleanSubtitleContent,
  msToTime,
  areTimeRangesNearEqual,
  normalizeParsedCues,
  timeToMs,
} from './model';
import {
  classifyAuxiliaryCue,
  classifySubtitleCue,
  detectCueLanguage,
  isLyricText,
  isSentenceLikeDialogue,
  isSubtitleCreditText,
  splitSingleBilingualText,
} from './analysis';

function analyzeContentType(text: string): number {
  let score = 0;
  text = text.trim();
  if (/^\([^)]+\)$/.test(text)) score += 50;
  if (/^（[^）]+）$/.test(text)) score += 50;
  if (/^\[[^\]]+\]$/.test(text)) score += 50;
  if (/^【[^】]+】$/.test(text)) score += 50;
  if (/[♪♫♬♩🎵🎶]/.test(text)) score += 45;
  if (/^\*[^*]*\*$/.test(text)) score += 40;
  if (/^《[^》]*》$/.test(text)) score += 35;
  if (/(研究中心|医院|学校|公司|大学|机构|中心|办公室|实验室)/.test(text)) score += 25;
  if (/(音效|背景音乐|音乐|声音|响声|铃声|脚步声)/.test(text)) score += 30;
  if (/(旁白|画外音|独白|心想|回忆|闪回|字幕|解说)/.test(text)) score += 35;
  if (/(电视|广播|新闻|公告|通知|播报)/.test(text)) score += 20;
  if (/^\d+年\d+月\d+日/.test(text)) score += 15;
  if (/第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+集/.test(text)) score += 20;
  if (text.length <= 15 && !/[.!?。！？]/.test(text)) score += 15;
  if (!/(是|有|在|去|来|说|做|看|听|想|要|会|能|的|了|着|过)/.test(text)) score += 10;
  const specChars = text.match(/[^\w\u4e00-\u9fff\s]/g) || [];
  if (specChars.length / Math.max(text.length, 1) > 0.3) score += 8;
  if (text.length <= 8) score += 5;
  return score;
}

interface Extraction {
  dialogue: string;
  notes: string;
  type: 'note' | 'mixed' | 'dialogue';
}

function extractDialogueAndNotes(text: string): Extraction {
  text = cleanSubtitleContent(text.trim());
  if (!text) return { dialogue: "", notes: "", type: "dialogue" };
  if (isSentenceLikeDialogue(text)) return { dialogue: text, notes: "", type: "dialogue" };
  const score = analyzeContentType(text);
  if (score >= 40) return { dialogue: "", notes: text, type: "note" };
  if (score >= 20 && score < 40) {
    let dialogue = text;
    const notes: string[] = [];
    const noteMatches = text.match(/\([^)]+\)|（[^）]+）|\[[^\]]+\]|【[^】]+】|♪[^♪]*♪|\*[^*]*\*/g) || [];
    for (const note of noteMatches) {
      notes.push(note);
      dialogue = dialogue.replace(note, '').trim();
    }
    dialogue = dialogue.replace(/\s+/g, ' ');
    // Only strip edge punctuation after real note markers were peeled off.
    // Dialogue-only cues must keep original punctuation (V8).
    if (notes.length > 0) {
      dialogue = dialogue.replace(/^[^\w\u4e00-\u9fff]+/, '').replace(/[^\w\u4e00-\u9fff]+$/, '');
    }
    if (notes.length > 0 && !dialogue) return { dialogue: "", notes: notes.join(" "), type: "note" };
    if (notes.length > 0 && dialogue) return { dialogue, notes: notes.join(" "), type: "mixed" };
    return { dialogue, notes: "", type: "dialogue" };
  }
  return { dialogue: text, notes: "", type: "dialogue" };
}

const resolveCueKind = (text: string, explicit?: CueKind): CueKind => explicit || classifySubtitleCue(text).kind;

const combineCueKind = (...kinds: Array<CueKind | undefined>): CueKind | undefined => {
  const known = kinds.filter(Boolean) as CueKind[];
  if (known.includes('lyrics')) return 'lyrics';
  if (known.includes('credit')) return 'credit';
  if (known.length > 0 && known.every(kind => kind === 'screen_text')) return 'screen_text';
  if (known.length > 0 && known.every(kind => kind === 'sound_caption')) return 'sound_caption';
  if (known.length > 0 && known.every(kind => kind === 'narration')) return 'narration';
  if (known.includes('commentary')) return 'commentary';
  return known.length > 0 ? 'dialogue' : undefined;
};

const combineAuxiliaryCue = (...items: Array<AuxiliaryCueClassification | undefined>): AuxiliaryCueClassification | undefined => {
  const known = items.filter(Boolean) as AuxiliaryCueClassification[];
  if (known.length === 0) return undefined;
  const priority: AuxiliaryCueCategory[] = ['screen_text', 'semantic_sdh', 'speech_context', 'unknown', 'music', 'ambient_sdh'];
  const selected = [...known].sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category))[0];
  const suspicion = known.find(item => item.suspicion)?.suspicion
    || known.find(item => item.category === 'ambient_sdh' || item.category === 'speech_context')?.suspicion;
  const withSuspicion = suspicion && !selected.suspicion
    ? { ...selected, suspicion }
    : selected;
  // Drop empty unknown noise, but keep suspicion-only hints for user review.
  if (withSuspicion.category === 'unknown' && withSuspicion.confidence < 50 && !withSuspicion.suspicion) {
    return undefined;
  }
  return withSuspicion;
};

interface PreprocessedRow {
  ts: string;
  text: string;
  type: 'note' | 'dialogue';
  cueKind?: CueKind;
  auxiliary?: AuxiliaryCueClassification;
  sourceIndex: number;
  // 保留原始来源
  sourceText?: string;
}

function preprocessMixedContent(subs: RawSub[]): PreprocessedRow[] {
  const processed: PreprocessedRow[] = [];
  for (const [sourceOffset, sub] of subs.entries()) {
    const { ts, text } = sub;
    const sourceIndex = sourceOffset + 1;
    const cueKind = resolveCueKind(text, sub.cueKind);
    const auxiliary = sub.auxiliary || sub.cueMeta?.auxiliary || classifyAuxiliaryCue(text);
    const ex = extractDialogueAndNotes(text);
    if (ex.notes && !ex.dialogue) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics', auxiliary, sourceIndex, sourceText: text });
      } else {
        const noteMeta = classifySubtitleCue(ex.notes);
        const noteKind = noteMeta.kind === 'dialogue'
          ? (cueKind === 'screen_text' || cueKind === 'sound_caption' || cueKind === 'narration' ? cueKind : 'narration')
          : noteMeta.kind;
        processed.push({ ts, text: ex.notes, type: "note", cueKind: noteKind, auxiliary: noteMeta.auxiliary || auxiliary, sourceIndex, sourceText: text });
      }
    } else if (ex.dialogue && !ex.notes) {
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    } else if (ex.dialogue && ex.notes) {
      if (isLyricText(ex.notes)) {
        processed.push({ ts, text: ex.notes, type: "dialogue", cueKind: 'lyrics', auxiliary, sourceIndex, sourceText: text });
      } else {
        const noteMeta = classifySubtitleCue(ex.notes);
        const noteKind = noteMeta.kind === 'dialogue'
          ? (cueKind === 'screen_text' || cueKind === 'sound_caption' || cueKind === 'narration' ? cueKind : 'narration')
          : noteMeta.kind;
        processed.push({ ts, text: ex.notes, type: "note", cueKind: noteKind, auxiliary: noteMeta.auxiliary || auxiliary, sourceIndex, sourceText: text });
      }
      processed.push({ ts, text: ex.dialogue, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    } else {
      processed.push({ ts, text, type: "dialogue", cueKind, auxiliary, sourceIndex, sourceText: text });
    }
  }
  return processed;
}

/**
 * Overlap quality for cue pairing.
 * Union ratio alone fails when a short cue sits fully inside a long one (overlap/union < 0.5).
 * Containment (overlap / min duration) treats that case as a strong match without widening startDiff.
 */
export function calculateOverlapRatio(s1: number, e1: number, s2: number, e2: number): number {
  const oS = Math.max(s1, s2);
  const oE = Math.min(e1, e2);
  if (oS >= oE) return 0;
  const overlap = oE - oS;
  const union = Math.max(e1, e2) - Math.min(s1, s2);
  const unionRatio = union > 0 ? overlap / union : 0;
  const minDur = Math.min(Math.max(0, e1 - s1), Math.max(0, e2 - s2));
  const containmentRatio = minDur > 0 ? overlap / minDur : 0;
  return Math.max(unionRatio, containmentRatio);
}

/** True when the inner cue is mostly covered by the outer timespan (official 1:N coverage). */
export function isCueMostlyCoveredBy(
  outerStart: number,
  outerEnd: number,
  innerStart: number,
  innerEnd: number,
  coverage = 0.85,
): boolean {
  if (!(outerEnd > outerStart) || !(innerEnd > innerStart)) return false;
  const overlap = Math.max(0, Math.min(outerEnd, innerEnd) - Math.max(outerStart, innerStart));
  const innerDur = innerEnd - innerStart;
  if (innerDur <= 0) return false;
  if (overlap / innerDur >= coverage) return true;
  const mid = (innerStart + innerEnd) / 2;
  return mid >= outerStart && mid <= outerEnd && overlap / innerDur >= 0.55;
}

const isStructuralCueKind = (kind?: CueKind): boolean => (
  kind === 'screen_text'
  || kind === 'sound_caption'
  || kind === 'narration'
  || kind === 'lyrics'
  || kind === 'commentary'
  || kind === 'credit'
);

interface CueMergeCompatibility {
  canMerge: boolean;
  scoreAdjustment: number;
}

const getAuxiliaryCategory = (row: PreprocessedRow): AuxiliaryCueCategory | undefined => {
  const category = row.auxiliary?.category;
  return category && category !== 'unknown' ? category : undefined;
};

const isLyricsTranslationPair = (primaryKind: CueKind, secondaryKind: CueKind): boolean => (
  (primaryKind === 'lyrics' && secondaryKind === 'dialogue')
  || (primaryKind === 'dialogue' && secondaryKind === 'lyrics')
  || (primaryKind === 'lyrics' && secondaryKind === 'lyrics')
);

const getCueMergeCompatibility = (primary: PreprocessedRow, secondary: PreprocessedRow): CueMergeCompatibility => {
  const primaryKind = primary.cueKind || 'dialogue';
  const secondaryKind = secondary.cueKind || 'dialogue';
  if (!isStructuralCueKind(primaryKind) && !isStructuralCueKind(secondaryKind)) {
    return { canMerge: true, scoreAdjustment: 0 };
  }
  // 歌词原文（♪）与无音符译词：允许合并，并提高对齐分。
  if (isLyricsTranslationPair(primaryKind, secondaryKind)) {
    return { canMerge: true, scoreAdjustment: primaryKind === secondaryKind ? 10 : 8 };
  }
  // 其余辅助信息不混对白
  if (primaryKind !== secondaryKind) return { canMerge: false, scoreAdjustment: -40 };

  const primaryCategory = getAuxiliaryCategory(primary);
  const secondaryCategory = getAuxiliaryCategory(secondary);
  if (primaryCategory && secondaryCategory && primaryCategory !== secondaryCategory) {
    return { canMerge: false, scoreAdjustment: -36 };
  }
  if (primaryKind === 'screen_text') return { canMerge: true, scoreAdjustment: 2 };
  if (primaryCategory === 'semantic_sdh' || primaryCategory === 'speech_context') return { canMerge: true, scoreAdjustment: 1 };
  if (primaryCategory === 'ambient_sdh' || primaryCategory === 'music') return { canMerge: true, scoreAdjustment: -4 };
  if (primaryKind === 'lyrics') return { canMerge: true, scoreAdjustment: 10 };
  return { canMerge: true, scoreAdjustment: -1 };
};

const shouldAttemptCueMerge = (primary: PreprocessedRow, secondary: PreprocessedRow): boolean => (
  getCueMergeCompatibility(primary, secondary).canMerge
);

const getStartMs = (row: PreprocessedRow): number => timeToMs(row.ts.split(' --> ')[0] || '');

const estimateGlobalOffset = (
  primaryRows: PreprocessedRow[],
  secondaryRows: PreprocessedRow[],
): GlobalOffsetDiagnosis => estimateGlobalOffsetFromStarts(
  primaryRows.map(getStartMs),
  secondaryRows.map(getStartMs),
);

interface AlignmentStep {
  zhIdx: number | null;
  enIdx: number | null;
}

interface ExpandedDialogueRow {
  ts: string;
  text: string;
  type: 'merged';
  cueKind?: CueKind;
  auxiliary?: AuxiliaryCueClassification;
  alignment: 'expanded-dialogue' | 'coverage-merge';
  provenance: AlignmentProvenance;
}

interface DialogueTiming {
  start: number;
  end: number;
}

const PACKED_DIALOGUE_TURN = /(^|\n|[。！？!?…][”’」』】）\]]*\s*)[-—–]\s*/g;

/**
 * Split only explicit multi-speaker dialogue markers. Ordinary visual line wraps
 * are intentionally left untouched, so a wrapped French sentence never becomes
 * two invented subtitle turns.
 */
function splitPackedDialogueTurns(sourceText?: string): string[] | null {
  if (!sourceText) return null;

  const raw = sourceText
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\\N/gi, '\n')
    .trim();

  if (!raw) return null;

  let markerCount = 0;
  const separated = raw.replace(PACKED_DIALOGUE_TURN, (match, prefix: string) => {
    markerCount += 1;
    return `${prefix}\u0000`;
  });

  if (markerCount !== 2) return null;

  const turns = separated
    .split('\u0000')
    .map(turn => cleanSubtitleContent(turn))
    .filter(Boolean);

  return turns.length === 2 ? turns : null;
}

function canExpandPackedDialogue(
  packed: PreprocessedRow,
  firstCounterpart: PreprocessedRow,
  secondCounterpart: PreprocessedRow,
): boolean {
  // 歌词/译词行含 "A - B" 唱句，不得当密排双人对话展开。
  if (
    packed.cueKind === 'lyrics'
    || firstCounterpart.cueKind === 'lyrics'
    || secondCounterpart.cueKind === 'lyrics'
    || isLyricText(packed.text)
    || isLyricText(firstCounterpart.text)
    || isLyricText(secondCounterpart.text)
  ) {
    return false;
  }
  // 时间包络校验
  if (!shouldAttemptCueMerge(packed, firstCounterpart) || !shouldAttemptCueMerge(packed, secondCounterpart)) return false;
  const turns = splitPackedDialogueTurns(packed.sourceText);
  if (!turns) return false;

  const [packedStart, packedEnd] = packed.ts.split(' --> ').map(timeToMs);
  const [firstStart, firstEnd] = firstCounterpart.ts.split(' --> ').map(timeToMs);
  const [secondStart, secondEnd] = secondCounterpart.ts.split(' --> ').map(timeToMs);
  if ([packedStart, packedEnd, firstStart, firstEnd, secondStart, secondEnd].some(Number.isNaN)) return false;

  const envelopeToleranceMs = 1200;
  const maxInterCueGapMs = 1400;
  const isWithinPackedEnvelope = firstStart >= packedStart - envelopeToleranceMs
    && secondEnd <= packedEnd + envelopeToleranceMs;
  const isContinuous = firstStart <= secondStart
    && secondStart - firstEnd <= maxInterCueGapMs;

  return isWithinPackedEnvelope && isContinuous;
}

const createSourceRef = (row: PreprocessedRow): AlignmentSourceRef => ({
  cueIndex: row.sourceIndex,
  ts: row.ts,
  text: row.sourceText || row.text,
});

const createSingleTrackRow = (row: PreprocessedRow, timingSource: 'primary' | 'secondary') => ({
  ts: row.ts,
  text: row.text,
  type: 'dialogue',
  cueKind: row.cueKind,
  auxiliary: combineAuxiliaryCue(row.auxiliary),
  provenance: {
    method: 'single-track' as const,
    timingSource,
    [timingSource]: createSourceRef(row),
  },
});

const getRowTiming = (row: PreprocessedRow, offsetMs = 0): DialogueTiming => {
  const [start, end] = row.ts.split(' --> ').map(timeToMs);
  return { start: start - offsetMs, end: end - offsetMs };
};

const createMergedRow = (
  primary: PreprocessedRow,
  secondary: PreprocessedRow,
  primaryTiming: DialogueTiming,
  secondaryTiming: DialogueTiming,
  diagnosis?: GlobalOffsetDiagnosis,
) => {
  const shifted = Boolean(diagnosis?.shouldApply);
  const cueKind = combineCueKind(primary.cueKind, secondary.cueKind);
  const isLyricsRow = cueKind === 'lyrics'
    || isLyricText(primary.text)
    || isLyricText(secondary.text);
  return {
    // Prefer primary timing so a short secondary inside a long primary does not stretch
    // into the next cue (min/max envelope). Provenance still records both source cues.
    ts: `${msToTime(primaryTiming.start)} --> ${msToTime(primaryTiming.end)}`,
    text: `${primary.text}\n${secondary.text}`,
    type: isLyricsRow ? 'lyrics' : 'merged',
    cueKind: isLyricsRow ? 'lyrics' as CueKind : cueKind,
    auxiliary: combineAuxiliaryCue(primary.auxiliary, secondary.auxiliary),
    alignment: shifted ? 'shifted-match' as const : undefined,
    provenance: {
      method: shifted ? 'shifted-match' as const : 'exact-match' as const,
      timingSource: 'primary' as const,
      confidence: diagnosis?.confidence ?? 1,
      offsetMs: diagnosis?.shouldApply ? diagnosis.offsetMs : undefined,
      primary: createSourceRef(primary),
      secondary: createSourceRef(secondary),
    },
  };
};

function buildExpandedDialogueRows(
  packed: PreprocessedRow,
  firstCounterpart: PreprocessedRow,
  secondCounterpart: PreprocessedRow,
  packedIsZh: boolean,
): ExpandedDialogueRow[] | null {
  if (!canExpandPackedDialogue(packed, firstCounterpart, secondCounterpart)) return null;
  const turns = splitPackedDialogueTurns(packed.sourceText);
  if (!turns) return null;

  const primarySource = packedIsZh ? packed : firstCounterpart;
  const groupId = `dialogue-${packed.sourceIndex}-${firstCounterpart.sourceIndex}-${secondCounterpart.sourceIndex}`;

  const makeRow = (turn: string, counterpart: PreprocessedRow): ExpandedDialogueRow => ({
    // 以副轨细分
    ts: counterpart.ts,
    text: packedIsZh ? `${turn}\n${counterpart.text}` : `${counterpart.text}\n${turn}`,
    type: 'merged',
    cueKind: combineCueKind(packed.cueKind, counterpart.cueKind),
    auxiliary: combineAuxiliaryCue(packed.auxiliary, counterpart.auxiliary),
    alignment: 'expanded-dialogue',
    provenance: {
      method: 'expanded-dialogue',
      timingSource: packedIsZh ? 'secondary' : 'primary',
      groupId,
      primary: createSourceRef(primarySource),
      secondary: createSourceRef(packedIsZh ? counterpart : packed),
    },
  });

  return [
    makeRow(turns[0], firstCounterpart),
    makeRow(turns[1], secondCounterpart),
  ];
}

/**
 * General 1:N / N:1 coverage (no dash markers): one cue's timespan covers ≥2 counterparts.
 * Emit one merged row per covered counterpart using the finer (covered) cue timing to avoid stretch.
 */
function buildCoverageMergeRows(
  outer: PreprocessedRow,
  counterparts: PreprocessedRow[],
  outerIsPrimary: boolean,
): ExpandedDialogueRow[] | null {
  if (counterparts.length < 2) return null;
  if (counterparts.some((row) => !shouldAttemptCueMerge(outer, row))) return null;

  const [outerStart, outerEnd] = outer.ts.split(' --> ').map(timeToMs);
  if ([outerStart, outerEnd].some(Number.isNaN)) return null;

  for (const counterpart of counterparts) {
    const [innerStart, innerEnd] = counterpart.ts.split(' --> ').map(timeToMs);
    if ([innerStart, innerEnd].some(Number.isNaN)) return null;
    if (!isCueMostlyCoveredBy(outerStart, outerEnd, innerStart, innerEnd)) return null;
  }

  // Counterparts should be temporally contiguous (small gaps only).
  for (let index = 1; index < counterparts.length; index += 1) {
    const prevEnd = timeToMs(counterparts[index - 1].ts.split(' --> ')[1] || '');
    const nextStart = timeToMs(counterparts[index].ts.split(' --> ')[0] || '');
    if (Number.isNaN(prevEnd) || Number.isNaN(nextStart) || nextStart - prevEnd > 1600) {
      return null;
    }
  }

  const groupId = `cover-${outer.sourceIndex}-${counterparts.map((row) => row.sourceIndex).join('-')}`;
  return counterparts.map((counterpart) => ({
    ts: counterpart.ts,
    text: outerIsPrimary
      ? `${outer.text}\n${counterpart.text}`
      : `${counterpart.text}\n${outer.text}`,
    type: 'merged' as const,
    cueKind: combineCueKind(outer.cueKind, counterpart.cueKind),
    auxiliary: combineAuxiliaryCue(outer.auxiliary, counterpart.auxiliary),
    // Distinct from dash packed-dialogue expansion — full outer text is reused, not split.
    alignment: 'coverage-merge' as const,
    provenance: {
      method: 'coverage-merge' as const,
      timingSource: outerIsPrimary ? 'secondary' as const : 'primary' as const,
      groupId,
      primary: createSourceRef(outerIsPrimary ? outer : counterpart),
      secondary: createSourceRef(outerIsPrimary ? counterpart : outer),
    },
  }));
}

function collectCoveredRun(
  outer: PreprocessedRow,
  candidates: PreprocessedRow[],
  startIdx: number,
  maxCount = 4,
): PreprocessedRow[] {
  const [outerStart, outerEnd] = outer.ts.split(' --> ').map(timeToMs);
  if ([outerStart, outerEnd].some(Number.isNaN)) return [];
  const covered: PreprocessedRow[] = [];
  for (let index = startIdx; index < candidates.length && covered.length < maxCount; index += 1) {
    const candidate = candidates[index];
    const [innerStart, innerEnd] = candidate.ts.split(' --> ').map(timeToMs);
    if ([innerStart, innerEnd].some(Number.isNaN)) break;
    if (innerStart > outerEnd + 200) break;
    if (!shouldAttemptCueMerge(outer, candidate)) break;
    if (!isCueMostlyCoveredBy(outerStart, outerEnd, innerStart, innerEnd)) {
      if (covered.length === 0 && innerEnd < outerStart) continue;
      break;
    }
    if (covered.length > 0) {
      const prevEnd = timeToMs(covered[covered.length - 1].ts.split(' --> ')[1] || '');
      if (innerStart - prevEnd > 1600) break;
    }
    covered.push(candidate);
  }
  return covered;
}

/** Shared temporal match policy for fast merge and industrial DP (keep in sync via this table only). */
export const CUE_MATCH_POLICY = {
  strongOverlap: 0.5,
  nearStartMs: 300,
  looseOverlap: 0.2,
  looseStartMs: 1500,
  /** ~2000×2000 official packs stay in full industrial DP; banded kicks in above this. */
  maxAlignmentCells: 16_000_000,
  /** Sakoe–Chiba half-width when the full M×N matrix exceeds maxAlignmentCells. */
  minBandHalfWidth: 48,
  maxBandHalfWidth: 220,
} as const;

export function isTemporalCueMatch(overlap: number, startDiffMs: number): boolean {
  return (
    overlap > CUE_MATCH_POLICY.strongOverlap
    || startDiffMs < CUE_MATCH_POLICY.nearStartMs
    || (overlap > CUE_MATCH_POLICY.looseOverlap && startDiffMs < CUE_MATCH_POLICY.looseStartMs)
  );
}

export type AlignmentFallbackInfo = {
  reason: 'matrix_too_large' | 'banded';
  cells: number;
  limit: number;
  bandHalfWidth?: number;
};

export type AlignSubtitlesOptions = {
  onFallback?: (info: AlignmentFallbackInfo) => void;
};

const ALIGNMENT_NEG = -1e15;

/** Expected secondary column on the proportional diagonal for DP row `row` (1..M). */
function expectedAlignmentColumn(row: number, M: number, N: number): number {
  if (M <= 0) return 0;
  return Math.round((row * N) / M);
}

function resolveBandHalfWidth(M: number, N: number): number | null {
  const cells = M * N;
  if (cells <= CUE_MATCH_POLICY.maxAlignmentCells) return null;

  const slope = Math.max(
    1,
    Math.ceil(Math.max(N, 1) / Math.max(M, 1)),
    Math.ceil(Math.max(M, 1) / Math.max(N, 1)),
  );
  let half = Math.min(
    CUE_MATCH_POLICY.maxBandHalfWidth,
    Math.max(CUE_MATCH_POLICY.minBandHalfWidth, slope * 3 + 32),
  );
  const bandCells = M * (2 * half + 1);
  if (bandCells > CUE_MATCH_POLICY.maxAlignmentCells) {
    half = Math.max(
      CUE_MATCH_POLICY.minBandHalfWidth,
      Math.floor(CUE_MATCH_POLICY.maxAlignmentCells / (2 * Math.max(M, 1))),
    );
  }
  return half;
}

/**
 * Needleman–Wunsch path. When `halfBand` is set, only cells near the proportional
 * diagonal are scored (Sakoe–Chiba), keeping large tracks in industrial mode.
 */
function computeAlignmentPath(
  M: number,
  N: number,
  getPairScore: (zhIdx: number, enIdx: number) => number,
  halfBand: number | null,
): AlignmentStep[] {
  const gapPenalty = -6;
  let previousScores = new Float64Array(N + 1);
  let currentScores = new Float64Array(N + 1);
  previousScores[0] = 0;
  for (let column = 1; column <= N; column += 1) {
    previousScores[column] = column * gapPenalty;
  }

  const useBand = halfBand != null;
  const bandWidth = useBand ? 2 * halfBand + 1 : N + 1;
  const jLo = new Int32Array(M + 1);
  const directions = new Int8Array((M + 1) * bandWidth);
  directions.fill(-1);

  const setDir = (row: number, col: number, dir: number) => {
    if (!useBand) {
      directions[row * (N + 1) + col] = dir;
      return;
    }
    const idx = col - jLo[row];
    if (idx < 0 || idx >= bandWidth) return;
    directions[row * bandWidth + idx] = dir;
  };

  const getDir = (row: number, col: number): number => {
    if (!useBand) return directions[row * (N + 1) + col];
    const idx = col - jLo[row];
    if (idx < 0 || idx >= bandWidth) return -1;
    return directions[row * bandWidth + idx];
  };

  if (!useBand) {
    jLo[0] = 0;
    for (let column = 1; column <= N; column += 1) setDir(0, column, 2);
    for (let row = 1; row <= M; row += 1) {
      jLo[row] = 0;
      currentScores[0] = row * gapPenalty;
      setDir(row, 0, 1);
      for (let column = 1; column <= N; column += 1) {
        const scoreMatch = previousScores[column - 1] + getPairScore(row - 1, column - 1);
        const scoreGapZh = previousScores[column] + gapPenalty;
        const scoreGapEn = currentScores[column - 1] + gapPenalty;
        if (scoreMatch >= scoreGapZh && scoreMatch >= scoreGapEn) {
          currentScores[column] = scoreMatch;
          setDir(row, column, 0);
        } else if (scoreGapZh >= scoreGapEn) {
          currentScores[column] = scoreGapZh;
          setDir(row, column, 1);
        } else {
          currentScores[column] = scoreGapEn;
          setDir(row, column, 2);
        }
      }
      [previousScores, currentScores] = [currentScores, previousScores];
    }
  } else {
    jLo[0] = 0;
    for (let row = 1; row <= M; row += 1) {
      const center = expectedAlignmentColumn(row, M, N);
      const storeLo = Math.max(0, center - halfBand);
      const storeHi = Math.min(N, center + halfBand);
      jLo[row] = storeLo;

      currentScores.fill(ALIGNMENT_NEG);
      currentScores[0] = row * gapPenalty;
      if (storeLo === 0) setDir(row, 0, 1);

      for (let column = Math.max(1, storeLo); column <= storeHi; column += 1) {
        const prevDiag = previousScores[column - 1];
        const prevUp = previousScores[column];
        const prevLeft = currentScores[column - 1];
        const scoreMatch = prevDiag > ALIGNMENT_NEG / 2
          ? prevDiag + getPairScore(row - 1, column - 1)
          : ALIGNMENT_NEG;
        const scoreGapZh = prevUp > ALIGNMENT_NEG / 2 ? prevUp + gapPenalty : ALIGNMENT_NEG;
        const scoreGapEn = prevLeft > ALIGNMENT_NEG / 2 ? prevLeft + gapPenalty : ALIGNMENT_NEG;

        if (scoreMatch >= scoreGapZh && scoreMatch >= scoreGapEn && scoreMatch > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreMatch;
          setDir(row, column, 0);
        } else if (scoreGapZh >= scoreGapEn && scoreGapZh > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreGapZh;
          setDir(row, column, 1);
        } else if (scoreGapEn > ALIGNMENT_NEG / 2) {
          currentScores[column] = scoreGapEn;
          setDir(row, column, 2);
        }
      }
      [previousScores, currentScores] = [currentScores, previousScores];
    }
  }

  const path: AlignmentStep[] = [];
  let i = M;
  let j = N;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const direction = getDir(i, j);
      if (direction === 0) {
        path.push({ zhIdx: i - 1, enIdx: j - 1 });
        i -= 1;
        j -= 1;
      } else if (direction === 1) {
        path.push({ zhIdx: i - 1, enIdx: null });
        i -= 1;
      } else if (direction === 2) {
        path.push({ zhIdx: null, enIdx: j - 1 });
        j -= 1;
      } else {
        // Outside the scored band: walk toward the proportional diagonal.
        const center = expectedAlignmentColumn(i, M, N);
        if (j > center) {
          path.push({ zhIdx: null, enIdx: j - 1 });
          j -= 1;
        } else {
          path.push({ zhIdx: i - 1, enIdx: null });
          i -= 1;
        }
      }
    } else if (i > 0) {
      path.push({ zhIdx: i - 1, enIdx: null });
      i -= 1;
    } else {
      path.push({ zhIdx: null, enIdx: j - 1 });
      j -= 1;
    }
  }
  path.reverse();
  return path;
}

type ExpandedDialoguePlan = {
  rows: ExpandedDialogueRow[];
  /** Extra path steps to skip after consuming the current match (0 or 1). */
  advancePath: number;
  skipEnIdx?: number;
  skipZhIdx?: number;
  skipEnIdxs?: number[];
  skipZhIdxs?: number[];
};

/**
 * Expand a packed two-speaker cue when the path (or array neighbors) expose two counterpart turns.
 * Prefer the next path step; fall back to idx+1 when the path ends or an intervening unpaired cue blocks it.
 */
function tryExpandPackedDialogueAtPath(
  path: AlignmentStep[],
  pathIndex: number,
  zhDialogues: PreprocessedRow[],
  enDialogues: PreprocessedRow[],
): ExpandedDialoguePlan | null {
  const current = path[pathIndex];
  if (!current || current.zhIdx === null || current.enIdx === null) return null;
  const next = path[pathIndex + 1];

  if (next && next.zhIdx === null && next.enIdx !== null) {
    const rows = buildExpandedDialogueRows(
      zhDialogues[current.zhIdx],
      enDialogues[current.enIdx],
      enDialogues[next.enIdx],
      true,
    );
    if (rows) return { rows, advancePath: 1 };
  }

  if (next && next.enIdx === null && next.zhIdx !== null) {
    const rows = buildExpandedDialogueRows(
      enDialogues[current.enIdx],
      zhDialogues[current.zhIdx],
      zhDialogues[next.zhIdx],
      false,
    );
    if (rows) return { rows, advancePath: 1 };
  }

  const nextEnIdx = current.enIdx + 1;
  const nextZhIdx = current.zhIdx + 1;

  if (enDialogues[nextEnIdx]) {
    const laterPaired = path.slice(pathIndex + 1).some(
      (step) => step.enIdx === nextEnIdx && step.zhIdx !== null,
    );
    if (!laterPaired) {
      const rows = buildExpandedDialogueRows(
        zhDialogues[current.zhIdx],
        enDialogues[current.enIdx],
        enDialogues[nextEnIdx],
        true,
      );
      if (rows) {
        const advancePath = next?.zhIdx === null && next.enIdx === nextEnIdx ? 1 : 0;
        return { rows, advancePath, skipEnIdx: nextEnIdx };
      }

      // Coverage 1:N without dash markers.
      const coveredEn = collectCoveredRun(zhDialogues[current.zhIdx], enDialogues, current.enIdx);
      if (coveredEn.length >= 2) {
        const coverageRows = buildCoverageMergeRows(zhDialogues[current.zhIdx], coveredEn, true);
        if (coverageRows) {
          const skipEnIdxs = coveredEn
            .slice(1)
            .map((row) => enDialogues.indexOf(row))
            .filter((idx) => idx >= 0);
          let advancePath = 0;
          for (let look = pathIndex + 1; look < path.length; look += 1) {
            const step = path[look];
            if (step.zhIdx !== null) break;
            if (step.enIdx !== null && skipEnIdxs.includes(step.enIdx)) advancePath += 1;
            else break;
          }
          return { rows: coverageRows, advancePath, skipEnIdxs };
        }
      }
    }
  }

  if (zhDialogues[nextZhIdx]) {
    const laterPaired = path.slice(pathIndex + 1).some(
      (step) => step.zhIdx === nextZhIdx && step.enIdx !== null,
    );
    if (!laterPaired) {
      const rows = buildExpandedDialogueRows(
        enDialogues[current.enIdx],
        zhDialogues[current.zhIdx],
        zhDialogues[nextZhIdx],
        false,
      );
      if (rows) {
        const advancePath = next?.enIdx === null && next.zhIdx === nextZhIdx ? 1 : 0;
        return { rows, advancePath, skipZhIdx: nextZhIdx };
      }

      const coveredZh = collectCoveredRun(enDialogues[current.enIdx], zhDialogues, current.zhIdx);
      if (coveredZh.length >= 2) {
        const coverageRows = buildCoverageMergeRows(enDialogues[current.enIdx], coveredZh, false);
        if (coverageRows) {
          const skipZhIdxs = coveredZh
            .slice(1)
            .map((row) => zhDialogues.indexOf(row))
            .filter((idx) => idx >= 0);
          let advancePath = 0;
          for (let look = pathIndex + 1; look < path.length; look += 1) {
            const step = path[look];
            if (step.enIdx !== null) break;
            if (step.zhIdx !== null && skipZhIdxs.includes(step.zhIdx)) advancePath += 1;
            else break;
          }
          return { rows: coverageRows, advancePath, skipZhIdxs };
        }
      }
    }
  }

  return null;
}

/**
 * Merge two subtitle tracks.
 */
export function mergeSubtitles(
  zhSubs: RawSub[], 
  enSubs: RawSub[], 
  commSubs: RawSub[] = [], 
  addLog: (msg: string, type: 'info' | 'success' | 'error') => void = () => {}
): SubRow[] {
  const zhProc = preprocessMixedContent(normalizeParsedCues(zhSubs));
  const enProc = preprocessMixedContent(normalizeParsedCues(enSubs));
  const zhNotes = zhProc.filter(s => s.type === "note");
  const zhDialogues = zhProc.filter(s => s.type === "dialogue");
  const enNotes = enProc.filter(s => s.type === "note");
  const enDialogues = enProc.filter(s => s.type === "dialogue");
  
  const commProc = normalizeParsedCues(commSubs).map(s => ({
    ...s,
    type: "commentary",
    cueKind: 'commentary' as CueKind
  }));
  
  const mergedDialogues: Array<{ ts: string; text: string; type: string; cueKind?: CueKind; auxiliary?: AuxiliaryCueClassification; alignment?: SubRow['alignment']; provenance?: AlignmentProvenance }> = [];
  let i = 0, j = 0;
  while (i < zhDialogues.length && j < enDialogues.length) {
    const zh = zhDialogues[i];
    const en = enDialogues[j];
    const [zhS, zhE] = zh.ts.split(" --> ").map(timeToMs);
    const [enS, enE] = en.ts.split(" --> ").map(timeToMs);
    const overlap = calculateOverlapRatio(zhS, zhE, enS, enE);
    const diff = Math.abs(zhS - enS);
    const compatibleCueKinds = shouldAttemptCueMerge(zh, en);
    
    if (compatibleCueKinds && isTemporalCueMatch(overlap, diff)) {
      const expandedZh = enDialogues[j + 1]
        ? buildExpandedDialogueRows(zh, en, enDialogues[j + 1], true)
        : null;
      if (expandedZh) {
        mergedDialogues.push(...expandedZh);
        i += 1;
        j += 2;
        continue;
      }

      const expandedForeign = zhDialogues[i + 1]
        ? buildExpandedDialogueRows(en, zh, zhDialogues[i + 1], false)
        : null;
      if (expandedForeign) {
        mergedDialogues.push(...expandedForeign);
        i += 2;
        j += 1;
        continue;
      }

      // Coverage 1:N — one CN timespan covers multiple EN cues (no dash markers required).
      const coveredEn = collectCoveredRun(zh, enDialogues, j);
      if (coveredEn.length >= 2) {
        const coverageRows = buildCoverageMergeRows(zh, coveredEn, true);
        if (coverageRows) {
          mergedDialogues.push(...coverageRows);
          i += 1;
          j += coveredEn.length;
          continue;
        }
      }

      // Coverage N:1 — one EN timespan covers multiple CN cues.
      const coveredZh = collectCoveredRun(en, zhDialogues, i);
      if (coveredZh.length >= 2) {
        const coverageRows = buildCoverageMergeRows(en, coveredZh, false);
        if (coverageRows) {
          mergedDialogues.push(...coverageRows);
          i += coveredZh.length;
          j += 1;
          continue;
        }
      }

      mergedDialogues.push(createMergedRow(
        zh,
        en,
        { start: zhS, end: zhE },
        { start: enS, end: enE },
      ));
      i++; j++;
    } else {
      // Look-ahead recovery: one extra cue must not permanently derail the rest of the track.
      const nextEn = enDialogues[j + 1];
      const nextZh = zhDialogues[i + 1];
      let skipSecondary = false;
      let skipPrimary = false;
      if (nextEn && shouldAttemptCueMerge(zh, nextEn)) {
        const [nS, nE] = nextEn.ts.split(' --> ').map(timeToMs);
        const nextOverlap = calculateOverlapRatio(zhS, zhE, nS, nE);
        const nextDiff = Math.abs(zhS - nS);
        if (isTemporalCueMatch(nextOverlap, nextDiff)) {
          const enWouldMatchNextZh = nextZh && shouldAttemptCueMerge(nextZh, en)
            ? (() => {
              const [nzS, nzE] = nextZh.ts.split(' --> ').map(timeToMs);
              return isTemporalCueMatch(calculateOverlapRatio(nzS, nzE, enS, enE), Math.abs(nzS - enS));
            })()
            : false;
          if (!enWouldMatchNextZh) skipSecondary = true;
        }
      }
      if (!skipSecondary && nextZh && shouldAttemptCueMerge(nextZh, en)) {
        const [nzS, nzE] = nextZh.ts.split(' --> ').map(timeToMs);
        const nextOverlap = calculateOverlapRatio(nzS, nzE, enS, enE);
        const nextDiff = Math.abs(nzS - enS);
        if (isTemporalCueMatch(nextOverlap, nextDiff)) {
          const zhWouldMatchNextEn = nextEn && shouldAttemptCueMerge(zh, nextEn)
            ? (() => {
              const [nS, nE] = nextEn.ts.split(' --> ').map(timeToMs);
              return isTemporalCueMatch(calculateOverlapRatio(zhS, zhE, nS, nE), Math.abs(zhS - nS));
            })()
            : false;
          if (!zhWouldMatchNextEn) skipPrimary = true;
        }
      }

      if (skipSecondary) {
        mergedDialogues.push(createSingleTrackRow(en, 'secondary'));
        j += 1;
      } else if (skipPrimary) {
        mergedDialogues.push(createSingleTrackRow(zh, 'primary'));
        i += 1;
      } else if (zhS <= enS) {
        mergedDialogues.push(createSingleTrackRow(zh, 'primary')); i++;
      } else {
        mergedDialogues.push(createSingleTrackRow(en, 'secondary')); j++;
      }
    }
  }
  while (i < zhDialogues.length) {
    mergedDialogues.push(createSingleTrackRow(zhDialogues[i], 'primary'));
    i++;
  }
  while (j < enDialogues.length) {
    mergedDialogues.push(createSingleTrackRow(enDialogues[j], 'secondary'));
    j++;
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      let cueKind = item.cueKind === 'lyrics' || isLyricText(item.text)
        ? 'lyrics' as CueKind
        : (item.cueKind || resolveCueKind(item.text));
      if (cueKind === 'credit' || (!item.cueKind && isSubtitleCreditText(item.text))) {
        cueKind = 'credit';
        type = 'credit';
      } else if (cueKind === 'lyrics' || isLyricText(item.text)) {
        type = 'lyrics';
      }
      return { ...item, type, cueKind, index: idx + 1 };
    });
  
  addLog(`[合并] 处理完成，生成 ${result.length} 条对齐块`, "success");
  return result;
}

/** Orphan / structure-diff rate used to auto-upgrade 智能 → 精校 without wiping ingest. */
export function measureMergeOrphanRate(rows: SubRow[]): number {
  if (rows.length === 0) return 0;
  const dialogueLike = rows.filter((row) => row.type === 'merged' || row.type === 'dialogue' || row.type === 'lyrics');
  if (dialogueLike.length === 0) return 0;
  const orphans = dialogueLike.filter((row) => row.type === 'dialogue' || row.provenance?.method === 'single-track');
  return orphans.length / dialogueLike.length;
}

/**
 * Industrial sequence alignment algorithm using Needleman-Wunsch dynamic programming.
 * Detects insertions/deletions/shifts to prevent misalignment cascades.
 */
export function alignSubtitlesIndustrial(
  zhSubs: RawSub[], 
  enSubs: RawSub[], 
  commSubs: RawSub[] = [], 
  addLog: (msg: string, type: 'info' | 'success' | 'error') => void = () => {},
  options: AlignSubtitlesOptions = {},
): SubRow[] {
  const zhProc = preprocessMixedContent(normalizeParsedCues(zhSubs));
  const enProc = preprocessMixedContent(normalizeParsedCues(enSubs));
  const zhNotes = zhProc.filter(s => s.type === "note");
  const zhDialogues = zhProc.filter(s => s.type === "dialogue");
  const enNotes = enProc.filter(s => s.type === "note");
  const enDialogues = enProc.filter(s => s.type === "dialogue");
  
  const commProc = normalizeParsedCues(commSubs).map(s => ({
    ...s,
    type: "commentary",
    cueKind: 'commentary' as CueKind
  }));

  const M = zhDialogues.length;
  const N = enDialogues.length;
  const offsetDiagnosis = estimateGlobalOffset(zhDialogues, enDialogues);
  const secondaryOffsetMs = offsetDiagnosis.shouldApply ? offsetDiagnosis.offsetMs : 0;
  
  const alignmentCells = M * N;
  const halfBand = resolveBandHalfWidth(M, N);
  if (halfBand != null) {
    const bandCells = M * (2 * halfBand + 1);
    // Extreme tracks: banded fill still exceeds the cell budget → low-memory escape hatch.
    if (bandCells > CUE_MATCH_POLICY.maxAlignmentCells) {
      addLog(`[工业级合并] 对齐矩阵约 ${Math.round(alignmentCells / 1_000_000)}M 单元，已切换为低内存快速合并`, 'info');
      options.onFallback?.({
        reason: 'matrix_too_large',
        cells: alignmentCells,
        limit: CUE_MATCH_POLICY.maxAlignmentCells,
      });
      return mergeSubtitles(zhSubs, enSubs, commSubs, addLog);
    }
    addLog(
      `[工业级合并] 对齐矩阵约 ${Math.round(alignmentCells / 1_000_000)}M 单元，启用带宽 ${2 * halfBand + 1} 的带状 DP`,
      'info',
    );
    options.onFallback?.({
      reason: 'banded',
      cells: alignmentCells,
      limit: CUE_MATCH_POLICY.maxAlignmentCells,
      bandHalfWidth: halfBand,
    });
  }
  if (Math.abs(offsetDiagnosis.offsetMs) >= OFFSET_DIAGNOSIS_POLICY.logAbsMs) {
    addLog(
      offsetDiagnosis.shouldApply
        ? `[时间轴诊断] 检测到稳定整体偏移 ${offsetDiagnosis.offsetMs}ms，已用于对齐判断`
        : `[时间轴诊断] 发现疑似偏移 ${offsetDiagnosis.offsetMs}ms，但${offsetDiagnosis.reason}，未自动平移`,
      'info',
    );
  }
  
  const mismatchPenalty = -15;
  
  // Score matrix calculation between Chinese and English nodes
  const getPairScore = (zhIdx: number, enIdx: number) => {
    const zh = zhDialogues[zhIdx];
    const en = enDialogues[enIdx];
    const compatibility = getCueMergeCompatibility(zh, en);
    if (!compatibility.canMerge) return mismatchPenalty - 25;
    const zhTiming = getRowTiming(zh);
    const enTiming = getRowTiming(en, secondaryOffsetMs);
    const overlap = calculateOverlapRatio(zhTiming.start, zhTiming.end, enTiming.start, enTiming.end);
    const diff = Math.abs(zhTiming.start - enTiming.start);
    
    const isMatch = isTemporalCueMatch(overlap, diff);
    if (isMatch) {
      // Optimal alignment bonus based on similarity and time proximity
      return 15 + overlap * 10 - (diff / CUE_MATCH_POLICY.looseStartMs) * 5 + compatibility.scoreAdjustment;
    }
    // Moderate penalty if they are relatively close (within 3s) but don't overlap
    if (diff < 3000) {
      return -2 - (diff / 3000) * 4 + Math.min(0, compatibility.scoreAdjustment);
    }
    return mismatchPenalty;
  };

  const path = computeAlignmentPath(M, N, getPairScore, halfBand);
  
  const mergedDialogues: Array<{ ts: string; text: string; type: string; cueKind?: CueKind; auxiliary?: AuxiliaryCueClassification; alignment?: SubRow['alignment']; provenance?: AlignmentProvenance }> = [];
  const skippedEn = new Set<number>();
  const skippedZh = new Set<number>();

  for (let pathIndex = 0; pathIndex < path.length; pathIndex++) {
    const step = path[pathIndex];
    // Coverage/expand marks counterpart idxs as skipped so they are not paired again.
    // Never `continue` the whole step when only one side was consumed — emit the other
    // side as single-track (V5: overlapping primary was previously dropped).
    const enSkipped = step.enIdx !== null && skippedEn.has(step.enIdx);
    const zhSkipped = step.zhIdx !== null && skippedZh.has(step.zhIdx);
    if (enSkipped || zhSkipped) {
      if (!zhSkipped && step.zhIdx !== null) {
        mergedDialogues.push(createSingleTrackRow(zhDialogues[step.zhIdx], 'primary'));
      }
      if (!enSkipped && step.enIdx !== null) {
        mergedDialogues.push(createSingleTrackRow(enDialogues[step.enIdx], 'secondary'));
      }
      continue;
    }

    const expanded = tryExpandPackedDialogueAtPath(path, pathIndex, zhDialogues, enDialogues);
    if (expanded) {
      mergedDialogues.push(...expanded.rows);
      if (expanded.skipEnIdx != null) skippedEn.add(expanded.skipEnIdx);
      if (expanded.skipZhIdx != null) skippedZh.add(expanded.skipZhIdx);
      for (const idx of expanded.skipEnIdxs || []) skippedEn.add(idx);
      for (const idx of expanded.skipZhIdxs || []) skippedZh.add(idx);
      pathIndex += expanded.advancePath;
      continue;
    }

    if (step.zhIdx !== null && step.enIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      const en = enDialogues[step.enIdx];
      const zhTiming = getRowTiming(zh);
      const enTiming = getRowTiming(en, secondaryOffsetMs);
      const overlap = calculateOverlapRatio(zhTiming.start, zhTiming.end, enTiming.start, enTiming.end);
      const diff = Math.abs(zhTiming.start - enTiming.start);
      const compatibility = getCueMergeCompatibility(zh, en);
      const isMatch = compatibility.canMerge && isTemporalCueMatch(overlap, diff);
      
      if (isMatch) {
        mergedDialogues.push(createMergedRow(
          zh,
          en,
          zhTiming,
          enTiming,
          offsetDiagnosis.shouldApply ? offsetDiagnosis : undefined,
        ));
      } else {
        // Aligned globally by sequence DP, but too far to merge (e.g. ad insertion on one track).
        // Separate as individual tracks to avoid mismatch.
        mergedDialogues.push(createSingleTrackRow(zh, 'primary'));
        mergedDialogues.push(createSingleTrackRow(en, 'secondary'));
      }
    } else if (step.zhIdx !== null) {
      const zh = zhDialogues[step.zhIdx];
      mergedDialogues.push(createSingleTrackRow(zh, 'primary'));
    } else if (step.enIdx !== null) {
      const en = enDialogues[step.enIdx];
      mergedDialogues.push(createSingleTrackRow(en, 'secondary'));
    }
  }
  
  const result = [...mergedDialogues, ...zhNotes, ...enNotes, ...commProc]
    .sort((a, b) => timeToMs(a.ts.split(" --> ")[0]) - timeToMs(b.ts.split(" --> ")[0]))
    .map((item, idx) => {
      let type = item.type;
      let cueKind = item.cueKind === 'lyrics' || isLyricText(item.text)
        ? 'lyrics' as CueKind
        : (item.cueKind || resolveCueKind(item.text));
      if (cueKind === 'credit' || (!item.cueKind && isSubtitleCreditText(item.text))) {
        cueKind = 'credit';
        type = 'credit';
      } else if (cueKind === 'lyrics' || isLyricText(item.text)) {
        type = 'lyrics';
      }
      return { ...item, type, cueKind, index: idx + 1 };
    });
  addLog(`[工业级合并] 处理完成，生成 ${result.length} 条对齐块`, "success");
  return result;
}

const combineRowCueKind = (...kinds: Array<CueKind | undefined>): CueKind | undefined => {
  const known = kinds.filter(Boolean) as CueKind[];
  if (known.length === 0) return undefined;
  if (known.includes('lyrics')) return 'lyrics';
  if (known.includes('credit')) return 'credit';
  if (known.every(kind => kind === 'screen_text')) return 'screen_text';
  if (known.every(kind => kind === 'narration')) return 'narration';
  if (known.includes('commentary')) return 'commentary';
  return known.includes('screen_text') ? 'screen_text' : known[0];
};

export function normalizeSingleBilingualRows(rows: RawSub[]): SubRow[] {
  const result: SubRow[] = [];
  let i = 0;

  while (i < rows.length) {
    const current = rows[i];
    const next = rows[i + 1];
    const currentText = splitSingleBilingualText(current.text);
    const currentLang = detectCueLanguage(currentText);
    const nextText = next ? splitSingleBilingualText(next.text) : '';
    const nextLang = next ? detectCueLanguage(nextText) : 'unknown';

    const canFoldPair = next
      && areTimeRangesNearEqual(current.ts, next.ts)
      && ((currentLang === 'zh' && nextLang === 'foreign') || (currentLang === 'foreign' && nextLang === 'zh'));

    if (canFoldPair) {
      const zhText = currentLang === 'zh' ? currentText : nextText;
      const foreignText = currentLang === 'foreign' ? currentText : nextText;
      result.push({
        ts: current.ts,
        text: `${zhText}\n${foreignText}`,
        type: 'merged',
        cueKind: combineRowCueKind(current.cueKind, next.cueKind),
        index: result.length + 1,
      });
      i += 2;
      continue;
    }

    result.push({
      ts: current.ts,
      text: currentText,
      type: currentLang === 'mixed' || currentText.includes('\n') ? 'merged' : 'dialogue',
      cueKind: current.cueKind,
      index: result.length + 1,
    });
    i += 1;
  }

  return result;
}
