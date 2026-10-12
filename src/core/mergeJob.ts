/**
 * Merge/alignment job: pure, runs in the Web Worker (src/workers/merge.worker.ts) and as an
 * in-thread fallback. Same algorithm calls and auto-upgrade rule as the old runSubtitleMerge.
 */
import {
  alignSubtitlesIndustrial,
  measureMergeOrphanRate,
  mergeSubtitles,
  normalizeSingleBilingualRows,
  parseSubtitle,
  type AlignmentFallbackInfo,
  type SubRow,
} from '../utils/subtitleCore';

export interface MergeJobInput {
  zhText: string;
  enText: string;
  commentaryText: string;
  mode: 'standard' | 'industrial';
  bilingualSingle: boolean;
}

export type MergeJobEvent =
  | { type: 'log'; msg: string; tone: 'info' | 'success' | 'error' }
  | { type: 'fallback'; info: AlignmentFallbackInfo; phase: 'primary' | 'auto-upgrade' }
  | { type: 'auto-industrial' };

export interface MergeJobResult { rows: SubRow[]; usedMode: 'standard' | 'industrial' | 'bilingual-single'; elapsedMs: number }

export const AUTO_INDUSTRIAL_ORPHAN_RATE = 0.22;

export function executeMergeJob(input: MergeJobInput, emit: (e: MergeJobEvent) => void): MergeJobResult {
  const t0 = Date.now();
  const log = (msg: string, tone: 'info' | 'success' | 'error') => emit({ type: 'log', msg, tone });
  if (input.bilingualSingle) {
    const rows = normalizeSingleBilingualRows(parseSubtitle(input.zhText));
    log(`已成功加载原生双语字幕，共包含 ${rows.length} 行流数据，并自动完成双语拆轨`, 'success');
    return { rows, usedMode: 'bilingual-single', elapsedMs: Date.now() - t0 };
  }
  const zh = parseSubtitle(input.zhText);
  const en = parseSubtitle(input.enText);
  const comm = parseSubtitle(input.commentaryText);
  let usedMode: 'standard' | 'industrial' = input.mode;
  let rows = input.mode === 'industrial'
    ? alignSubtitlesIndustrial(zh, en, comm, log, { onFallback: (info) => emit({ type: 'fallback', info, phase: 'primary' }) })
    : mergeSubtitles(zh, en, comm, log);
  if (input.mode === 'standard' && measureMergeOrphanRate(rows) >= AUTO_INDUSTRIAL_ORPHAN_RATE) {
    log('[合并] 智能对齐孤立行偏多，自动改用精校对齐', 'info');
    usedMode = 'industrial';
    rows = alignSubtitlesIndustrial(zh, en, comm, log, { onFallback: (info) => emit({ type: 'fallback', info, phase: 'auto-upgrade' }) });
    emit({ type: 'auto-industrial' });
  }
  return { rows, usedMode, elapsedMs: Date.now() - t0 };
}
