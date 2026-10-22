'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import '@/workers/registerMergeWorker';
import '@/workers/registerRecognitionWorker';
import { IngestStep } from '@/components/IngestStep';
import { WorkbenchStep } from '@/components/WorkbenchStep';
import { TheaterStep } from '@/components/TheaterStep';
import { FeedbackCenter } from '@/components/Global/FeedbackCenter';
import { HistoryPanel } from '@/components/Global/HistoryPanel';
import { useSessionLeaveWarning } from '@/hooks/useSessionLeaveWarning';

export default function Home() {
  // 精确订阅：页面根组件绝不能整仓订阅，否则播放时钟每帧都会重渲染全树。
  const workflowStep = useStudioStore((state) => state.workflowStep);
  const initializeLibrary = useStudioStore((state) => state.initializeLibrary);
  useSessionLeaveWarning();

  useEffect(() => {
    initializeLibrary();
  }, [initializeLibrary]);

  // E2E / Playwright hooks — read-only access to the studio store.
  useEffect(() => {
    (window as unknown as { __SAIKO_STORE__?: typeof useStudioStore }).__SAIKO_STORE__ = useStudioStore;
    return () => {
      delete (window as unknown as { __SAIKO_STORE__?: typeof useStudioStore }).__SAIKO_STORE__;
    };
  }, []);

  return (
    <main className="app-workspace flex-1 w-full h-full overflow-hidden flex flex-col font-sans relative">
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
        {workflowStep === 1 && <IngestStep />}
        {workflowStep === 2 && <WorkbenchStep />}
        {workflowStep === 3 && <TheaterStep />}
      </div>

      <FeedbackCenter />
      <HistoryPanel />
    </main>
  );
}
