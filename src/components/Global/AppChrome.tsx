'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';
import { WorkflowChromeProvider } from '@/components/Global/WorkflowChrome';

/** Client shell for workflow info bar + edge next (layout stays a Server Component). */
export const AppChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">
    <WorkflowChromeProvider>{children}</WorkflowChromeProvider>
  </MotionConfig>
);
