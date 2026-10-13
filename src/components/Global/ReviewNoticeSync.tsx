'use client';

import { useEffect, useMemo } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { buildMergeReviewQueue } from '@/utils/timeline/alignmentDiff';
import { reviewProgress, reviewTaskKey } from '@/core/reviewKey';

/**
 * 「还有 N 项未复核」提示与复核勾选实时同步：数字随勾选更新，全部复核后自动消失。
 */
export function ReviewNoticeSync() {
  const processedSubs = useStudioStore((s) => s.processedSubs);
  const selectedTaskId = useStudioStore((s) => s.selectedTaskId);
  const checkedByTask = useStudioStore((s) => s.mergeReviewCheckedByTask);
  const hasNotice = useStudioStore((s) => s.statusNotices.some((n) => n.id === 'merge-review-unchecked'));
  const itemIds = useMemo(() => (processedSubs ? buildMergeReviewQueue(processedSubs).items.map((i) => i.id) : []), [processedSubs]);
  const key = reviewTaskKey(selectedTaskId, processedSubs);
  const { total, checked, remaining } = reviewProgress(itemIds, checkedByTask[key]);

  useEffect(() => {
    if (!hasNotice) return;
    const st = useStudioStore.getState();
    if (remaining === 0) { st.dismissStatusNotice('merge-review-unchecked'); return; }
    const current = st.statusNotices.find((n) => n.id === 'merge-review-unchecked');
    const title = reviewNoticeTitle(remaining);
    if (current && current.title !== title) {
      st.setStatusNotice({ ...current, title, message: reviewNoticeMessage(checked, total) });
    }
  }, [hasNotice, remaining, checked, total]);
  return null;
}

export const reviewNoticeTitle = (remaining: number) => `还有 ${remaining} 项待复核，可继续`;
export const reviewNoticeMessage = (checked: number, total: number) => `已复核 ${checked} / ${total}，不影响预览与导出。`;
