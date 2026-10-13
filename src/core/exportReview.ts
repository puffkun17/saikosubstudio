/**
 * R-xx review list shown at export (not blocking). Derived from the finished timeline + task
 * identity only; the Act-2 algorithm is not consulted or changed.
 */
import { REVIEW_REASONS, type ReviewReason, type ReviewReasonCode } from './reviewReasons';

export interface ExportReviewInput {
  rows: { text: string; index?: number }[];
  hasTmdb: boolean;
  isTv: boolean;
  epKey: string;
  /** Single-track (unpaired) lines from the merge review queue — 1-based line numbers (row.index). */
  unresolvedRows: number[];
  /** Secondary statements moved off the timeline (credits plan) — 1-based line numbers. */
  movedStatementRows: number[];
}

const MAX_CUES = 50;
/** Every R-xx cue is a 1-based line number (row.index when present), the same number the UI shows. */
const lineNo = (row: { index?: number }, i: number) => (typeof row.index === 'number' && row.index > 0 ? row.index : i + 1);

export function deriveExportReview(input: ExportReviewInput): ReviewReason[] {
  const out: ReviewReason[] = [];
  const add = (code: ReviewReasonCode, cues: number[] = [], detail?: string) => out.push({ code, cues: cues.slice(0, MAX_CUES), detail });
  if (!input.hasTmdb) add('R-02');
  if (input.hasTmdb && input.isTv && !input.epKey) add('R-03');
  const bilingual = input.rows.some((r) => /\n|\\N/.test(r.text));
  if (input.rows.length > 0 && !bilingual) add('R-10');
  if (input.movedStatementRows.length) add('R-07', input.movedStatementRows);
  const positioned = input.rows.flatMap((r, i) => (/\\(?:frz|pos)\(?/i.test(r.text) ? [lineNo(r, i)] : []));
  if (positioned.length) add('R-08', positioned);
  const dialogue = input.rows.flatMap((r, i) => (/(^|\n|\\N)\s*-\s*\S.*(\n|\\N)\s*-\s*\S/.test(r.text) ? [lineNo(r, i)] : []));
  if (dialogue.length) add('R-09', dialogue);
  if (input.unresolvedRows.length) add('R-11', input.unresolvedRows);
  return out;
}

export const reviewLabel = (code: ReviewReasonCode): string => REVIEW_REASONS[code];
export const REVIEW_CODE_TABLE = Object.entries(REVIEW_REASONS) as [ReviewReasonCode, string][];
