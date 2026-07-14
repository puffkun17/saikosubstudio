'use client';

import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { IngestStep } from '@/components/IngestStep';
import { WorkbenchStep } from '@/components/WorkbenchStep';
import { TheaterStep } from '@/components/TheaterStep';
import { FeedbackCenter } from '@/components/Global/FeedbackCenter';

export default function Home() {
  const { workflowStep, initializeLibrary } = useStudioStore();

  useEffect(() => {
    initializeLibrary();
  }, [initializeLibrary]);

  return (
    <main className="app-workspace flex-1 w-full h-full overflow-hidden flex flex-col font-sans relative">
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
        {workflowStep === 1 && <IngestStep />}
        {workflowStep === 2 && <WorkbenchStep />}
        {workflowStep === 3 && <TheaterStep />}
      </div>

      <FeedbackCenter />
    </main>
  );
}
