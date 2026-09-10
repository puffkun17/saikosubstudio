'use client';

import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlignmentDiffPanel } from '@/components/Workbench/AlignmentDiffPanel';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';
import type { SubRow } from '@/utils/subtitleCore';

export interface MergeReviewModalProps {
  open: boolean;
  rows: SubRow[];
  focusNonce: number;
  onClose: () => void;
}

/** Focused proof/analysis desk for merge-review queue (filters/severity/locate live in AlignmentDiffPanel). */
export const MergeReviewModal: React.FC<MergeReviewModalProps> = ({
  open,
  rows,
  focusNonce,
  onClose,
}) => {
  const reviewModalRef = useRef<HTMLDivElement>(null);
  useUiModalFocus(open, reviewModalRef, onClose);

  return (
    <OverlayPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="ui-modal-layer fixed inset-0 grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            <motion.div
              ref={reviewModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workbench-review-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="ui-modal ui-modal--wide flex max-h-[min(85vh,52rem)] w-full flex-col overflow-hidden !p-0"
              tabIndex={-1}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--v4-line)] px-4 py-3">
                <div className="min-w-0">
                  <h2 id="workbench-review-title" className="text-base font-bold tracking-wide text-[var(--v4-text)]">
                    合轴待复核
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--v4-text-faint)]">
                    概览保持精简；队列与筛选在此核对。已核对状态按会话保留。
                  </p>
                </div>
                <button
                  type="button"
                  className="ui-action ui-action--quiet ui-action--icon ui-action--icon-sm"
                  onClick={onClose}
                  aria-label="关闭合轴复核"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <AlignmentDiffPanel
                  rows={rows}
                  focusNonce={focusNonce}
                  preferredFilter="all"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};
