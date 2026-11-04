/**
 * Act 2 axis helpers: focus dimming (including a 0-hit filter) and edit provenance.
 * Dimming is a dashboard affordance — an empty selection still means "this filter is on".
 */

export type AxisEditRecord = {
  index: number;
  before: string;
  after: string;
};

/**
 * `null` / `undefined` = no filter, every row stays bright.
 * An empty set is a real filter with zero hits: dim the whole axis.
 */
export function isRowDimmed(
  focused: ReadonlySet<number> | null | undefined,
  rowIndex: number,
): boolean {
  if (focused == null) return false;
  if (focused.size === 0) return true;
  return !focused.has(rowIndex);
}

/** Same rule for the timeline dial: a filter is on even when it has no ticks. */
export function isFocusChromeActive(focused: ReadonlySet<number> | null | undefined): boolean {
  return focused != null;
}

export function splitCueLines(text: string): { primary: string; secondary: string } {
  const parts = text.replace(/\\N/gi, '\n').split('\n');
  return {
    primary: parts[0] ?? '',
    secondary: parts.slice(1).join('\n'),
  };
}

/**
 * Original text still explained by the undo stack.
 * The first `before` for this line is the pre-edit original; later records are intermediate.
 * Returns null once the line matches that original again (undone, or no net change).
 */
export function lineProvenance(
  history: readonly AxisEditRecord[],
  index: number,
  current: string,
): { before: string } | null {
  let before: string | undefined;
  for (const record of history) {
    if (record.index !== index) continue;
    if (before === undefined) before = record.before;
  }
  if (before === undefined || before === current) return null;
  return { before };
}
