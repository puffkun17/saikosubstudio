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
import { useStudioStore } from '@/store/useStudioStore';

export type EdgeNextConfig = {
  label: string;
  disabled?: boolean;
  /** 置灰时点按给出的原因提示（走 statusNotice，而不是无响应）。 */
  disabledReason?: string;
  /**
   * 就绪呼吸：必要工序已齐、可进入下一场景时为 true。
   * 省略时默认按 !disabled 推断。处理中请显式传 false。
   *
   * 各步就绪条件（判「可前进」，不判「一切完美」）：
   * - 收件队列：至少 1 条可接受字幕，无阻断 queueIssue
   * - 核对清单：当前任务有主轨（中/英），且未在合并处理中
   * - 工作台：已有合轴字幕行，可打开预览
   * 警告类问题不挡前进；样式/导出偏好有默认即可。
   */
  ready?: boolean;
  onClick: () => void;
} | null;

export type InfoBarConfig = {
  title: string;
  /**
   * 片源元数据徽章（集数、年份等），紧贴标题。
   * 兼容旧的单一 `badge` 字段。
   */
  badges?: string[];
  /** @deprecated 使用 badges；仍支持单徽章 */
  badge?: string;
  /**
   * 本地状态通知（已匹配 / 匹配中 / 未匹配），与副行本地信息同组。
   */
  status?: {
    label: string;
    tone?: 'ok' | 'progress' | 'warn' | 'muted';
  };
  /**
   * 本地状态副行：任务数、格式构成、导入来源等（不含冗余「字幕文件」）。
   */
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
} | null;

/** 底栏工序/统计状态（非 T0）。顶栏 InfoBar 只留给身份与关键操作。 */
export type BottomStatusConfig = {
  title: string;
  subtitle?: string;
  steps?: Array<{ label: string; done: boolean }>;
} | null;

type WorkflowChromeValue = {
  edgeNext: EdgeNextConfig;
  infoBar: InfoBarConfig;
  bottomStatus: BottomStatusConfig;
  setEdgeNext: (config: EdgeNextConfig) => void;
  setInfoBar: (config: InfoBarConfig) => void;
  setBottomStatus: (config: BottomStatusConfig) => void;
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
  const [bottomStatus, setBottomStatusState] = useState<BottomStatusConfig>(null);

  const setEdgeNext = useCallback((config: EdgeNextConfig) => {
    setEdgeNextState(config);
  }, []);

  const setInfoBar = useCallback((config: InfoBarConfig) => {
    setInfoBarState(config);
  }, []);

  const setBottomStatus = useCallback((config: BottomStatusConfig) => {
    setBottomStatusState(config);
  }, []);

  const value = useMemo(
    () => ({ edgeNext, infoBar, bottomStatus, setEdgeNext, setInfoBar, setBottomStatus }),
    [edgeNext, infoBar, bottomStatus, setEdgeNext, setInfoBar, setBottomStatus],
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
  const metaBadges = [
    ...(config?.badges || []),
    ...(config?.badge && !(config.badges || []).includes(config.badge) ? [config.badge] : []),
  ];

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key={`${config.title}:${metaBadges.join('|')}:${config.status?.label || ''}:${config.subtitle || ''}`}
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
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--v4-text)]">
                    {config.title}
                  </h2>
                  {metaBadges.map((item) => (
                    <span
                      key={item}
                      className="inline-flex h-7 shrink-0 items-center rounded-md border border-[var(--v4-accent)]/35 bg-[var(--v4-accent-soft)] px-2.5 font-mono text-[13px] font-bold tracking-wide text-[var(--v4-accent-strong)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                {(config.status || config.subtitle) && (
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    {config.status && (
                      <span
                        className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[11px] font-bold tracking-wide ${
                          config.status.tone === 'ok'
                            ? 'border-[var(--v4-accent)]/35 bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                            : config.status.tone === 'progress'
                              ? 'border-[var(--v4-line-strong)] bg-[var(--v4-panel)] text-[var(--v4-text)]'
                              : config.status.tone === 'warn'
                                ? 'border-[color:rgba(196,137,58,0.35)] bg-[color:rgba(196,137,58,0.12)] text-[var(--v4-warning)]'
                                : 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'
                        }`}
                      >
                        {config.status.label}
                      </span>
                    )}
                    {config.subtitle && (
                      <p className="min-w-0 truncate text-[13px] font-medium text-[var(--v4-text-muted)]" title={config.subtitle}>
                        {config.subtitle}
                      </p>
                    )}
                  </div>
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

/**
 * 通往下一步的右缘按钮。
 * 就绪时可点：琥珀光圈缓慢呼吸；置灰无呼吸，点按说明缺什么；
 * 挂载时仍有一次性「点亮」（edgeNextIgnite）；hover 向左展开标签。
 */
const WorkflowEdgeNext: React.FC<{ config: EdgeNextConfig }> = ({ config }) => {
  const setStatusNotice = useStudioStore((state) => state.setStatusNotice);
  if (!config) return null;

  const isReady = !config.disabled && (config.ready ?? true);

  const handleClick = () => {
    if (config.disabled) {
      setStatusNotice({
        id: 'edge-next-blocked',
        tone: 'notice',
        title: '暂时无法继续',
        message: config.disabledReason || '请先完成当前步骤的必要操作。',
      });
      return;
    }
    config.onClick();
  };

  return (
    <button
      type="button"
      aria-disabled={config.disabled || undefined}
      onClick={handleClick}
      aria-label={config.label}
      title={config.label}
      className={`workflow-edge-next v4-focus-ring ${config.disabled ? 'is-disabled' : ''} ${isReady ? 'is-ready' : ''}`}
    >
      <span className="workflow-edge-next__rail" aria-hidden="true" />
      <span className="workflow-edge-next__glyph">
        <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="workflow-edge-next__label">{config.label}</span>
      <span className="workflow-edge-next__expanded" aria-hidden="true">
        {config.label}
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </span>
    </button>
  );
};
