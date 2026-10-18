/** Shared focus / jump types for the B7 workbench list. */
import type { ReviewFocusId, ReviewPagerItem } from '@/core/workbenchReview';
import type { MarkerRailHit } from '@/core/markerRail';
import type { LineKind } from '@/utils/subtitleCore';
import type { MergeReviewItem } from '@/utils/timeline/alignmentDiff';

export type WorkbenchListController = {
  focus: ReviewFocusId | null;
  focusedIndexes: Set<number> | null;
  /** Rows belonging to already-checked review items (show ✓) */
  passedArrayIndexes: Set<number>;
  /** Active pager item shown with inline actions */
  activeItem: ReviewPagerItem | null;
  checkedReviewIds: Set<string>;
  /** Brief orange sweep highlight target */
  highlightArrayIndex: number | null;
  highlightNonce: number;
  railHits: MarkerRailHit[];
  filterStatus: string | null;
  onClearFocus: () => void;
  onMarkReviewed: (itemId: string) => void;
  onConfirmCategory: (item: MergeReviewItem, kind: Exclude<LineKind, 'credit'>) => void;
  onIgnore: (itemId: string) => void;
  onJumpToArrayIndex: (arrayIndex: number) => void;
};
