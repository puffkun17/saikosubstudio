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
    <main className="flex-1 w-full h-full bg-[#050507] text-white overflow-hidden flex flex-col font-sans relative">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-glow/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-accent-glow/10 blur-[150px]" />
      </div>

      {/* Main step container */}
      <div className="flex-1 w-full h-full flex flex-col z-10 overflow-hidden">
        {workflowStep === 1 && <IngestStep />}
        {workflowStep === 2 && <WorkbenchStep />}
        {workflowStep === 3 && <TheaterStep />}
      </div>

      <FeedbackCenter />
    </main>
  );
}
