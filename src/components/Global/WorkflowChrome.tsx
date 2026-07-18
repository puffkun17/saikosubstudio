'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type EdgeNextConfig = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
} | null;

export type InfoBarConfig = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
} | null;

type WorkflowChromeValue = {
  edgeNext: EdgeNextConfig;
  infoBar: InfoBarConfig;
  setEdgeNext: (config: EdgeNextConfig) => void;
  setInfoBar: (config: InfoBarConfig) => void;
};

const WorkflowChromeContext = createContext<WorkflowChromeValue | null>(null);

export const useWorkflowChrome = () => {
  const ctx = useContext(WorkflowChromeContext);
  if (!ctx) {
    throw new Error('useWorkflowChrome must be used within WorkflowChromeProvider');
  }
  return ctx;
};

/** Optional hook for components that may render outside the provider (e.g. tests). */
export const useWorkflowChromeOptional = () => useContext(WorkflowChromeContext);

export const WorkflowChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [edgeNext, setEdgeNextState] = useState<EdgeNextConfig>(null);
  const [infoBar, setInfoBarState] = useState<InfoBarConfig>(null);

  const setEdgeNext = useCallback((config: EdgeNextConfig) => {
    setEdgeNextState(config);
  }, []);

  const setInfoBar = useCallback((config: InfoBarConfig) => {
    setInfoBarState(config);
  }, []);

  const value = useMemo(
    () => ({ edgeNext, infoBar, setEdgeNext, setInfoBar }),
    [edgeNext, infoBar, setEdgeNext, setInfoBar],
  );

  const infoBarActive = Boolean(infoBar);
  const edgeNextActive = Boolean(edgeNext);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--info-bar-h',
      infoBarActive ? '56px' : '0px',
    );
    return () => {
      document.documentElement.style.setProperty('--info-bar-h', '0px');
    };
  }, [infoBarActive]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--edge-next-w',
      edgeNextActive ? '2.75rem' : '0px',
    );
    return () => {
      document.documentElement.style.setProperty('--edge-next-w', '0px');
    };
  }, [edgeNextActive]);

  return (
    <WorkflowChromeContext.Provider value={value}>
      {children}
      <WorkflowInfoBar config={infoBar} />
      <WorkflowEdgeNext config={edgeNext} />
    </WorkflowChromeContext.Provider>
  );
};

const WorkflowInfoBar: React.FC<{ config: InfoBarConfig }> = ({ config }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key={`${config.title}:${config.subtitle || ''}`}
          role="region"
          aria-label="信息栏"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="workflow-info-bar"
        >
          <div className="workflow-info-bar__inner">
            <div className="flex min-w-0 items-center gap-3">
              {config.onBack && (
                <button
                  type="button"
                  onClick={config.onBack}
                  className="v4-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-accent-strong)] transition-colors hover:bg-[var(--v4-panel)]"
                  aria-label="返回"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--v4-text)]">
                  {config.title}
                </h2>
                {config.subtitle && (
                  <p className="mt-0.5 truncate text-[13px] text-[var(--v4-text-muted)]" title={config.subtitle}>
                    {config.subtitle}
                  </p>
                )}
              </div>
            </div>
            {config.actions && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {config.actions}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const WorkflowEdgeNext: React.FC<{ config: EdgeNextConfig }> = ({ config }) => {
  const shouldReduceMotion = useReducedMotion();
  if (!config) return null;

  return (
    <button
      type="button"
      disabled={config.disabled}
      onClick={config.onClick}
      aria-label={config.label}
      title={config.label}
      className={`workflow-edge-next v4-focus-ring ${config.disabled ? 'is-disabled' : ''}`}
    >
      <span className="workflow-edge-next__rail" aria-hidden="true" />
      <motion.span
        className="workflow-edge-next__glyph"
        animate={shouldReduceMotion || config.disabled ? undefined : { x: [0, 3, 0] }}
        transition={shouldReduceMotion || config.disabled ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
      </motion.span>
      <span className="workflow-edge-next__label">{config.label}</span>
    </button>
  );
};
