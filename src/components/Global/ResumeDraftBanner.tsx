'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';

const DISMISS_KEY = 'nexus_resume_banner_dismissed';

/**
 * Light home/ingest banner when local 历史存档 has a restorable merge and the
 * current session is empty. LibraryItem has no export/unfinished flag — we only
 * offer the newest archive entry. Leftover: true "unexported draft" needs schema.
 */
export const ResumeDraftBanner: React.FC = () => {
  const {
    historyReady,
    libraryList,
    loadFromLibrary,
    hasSessionWork,
    workflowStep,
  } = useStudioStore(useShallow((s) => ({
    historyReady: s.historyReady,
    libraryList: s.libraryList,
    loadFromLibrary: s.loadFromLibrary,
    hasSessionWork: s.tasks.length > 0
      || s.uploadedFiles.length > 0
      || Boolean(s.processedSubs?.length),
    workflowStep: s.workflowStep,
  })));

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const latest = useMemo(
    () => (libraryList.length > 0 ? libraryList[0] : null),
    [libraryList],
  );

  if (!historyReady || dismissed || hasSessionWork || workflowStep !== 1 || !latest) {
    return null;
  }

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className="mx-auto mb-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded-[var(--pt-radius-lg)] border border-[var(--rule-hair)] bg-[var(--paper-raised)] px-3 py-2 text-sm text-[var(--ink-body)]"
      role="status"
      data-testid="resume-draft-banner"
    >
      <p className="min-w-0 flex-1 leading-[var(--pt-leading-ui)]">
        本机存档有未继续的项目「{latest.name}」，要恢复吗？
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="ui-action ui-action--quiet"
          onClick={dismiss}
          title="本次不再提示；存档仍保留"
        >
          丢弃
        </button>
        <button
          type="button"
          className="ui-action ui-action--secondary"
          onClick={() => {
            loadFromLibrary(latest);
            dismiss();
          }}
        >
          恢复
        </button>
      </div>
    </div>
  );
};
