import React, { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStudioStore } from "@/store/useStudioStore";
import { EASE_OUT, MOTION_S } from "@/core/motion";
import "@/workers/registerMergeWorker";
import "@/workers/registerRecognitionWorker";
import { IngestStep } from "@/components/IngestStep";
import { WorkbenchStep } from "@/components/WorkbenchStep";
import { TheaterStep } from "@/components/TheaterStep";
import { FeedbackCenter } from "@/components/Global/FeedbackCenter";
import { HistoryPanel } from "@/components/Global/HistoryPanel";
import { useSessionLeaveWarning } from "@/hooks/useSessionLeaveWarning";

export default function HomePage() {
  // 精确订阅：页面根组件绝不能整仓订阅，否则播放时钟每帧都会重渲染全树。
  const workflowStep = useStudioStore((state) => state.workflowStep);
  const tasksCount = useStudioStore((state) => state.tasks.length);
  const initializeLibrary = useStudioStore((state) => state.initializeLibrary);
  const reduce = useReducedMotion();
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

  const isEmptyIngestReturn = workflowStep === 1 && tasksCount === 0;

  return (
    <main className="app-workspace flex-1 w-full h-full overflow-hidden flex flex-col font-sans relative">
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={workflowStep}
            initial={reduce || isEmptyIngestReturn ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: reduce ? 0 : MOTION_S.fast, ease: EASE_OUT }}
            className="flex flex-1 h-full w-full flex-col overflow-hidden"
          >
            {workflowStep === 1 && <IngestStep />}
            {workflowStep === 2 && <WorkbenchStep />}
            {workflowStep === 3 && <TheaterStep />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FeedbackCenter />
      <HistoryPanel />
    </main>
  );
}
