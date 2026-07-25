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
   * 年份锚点：紧跟片名，非 chip；用等宽数字字体与片名区分。
   */
  year?: string;
  /**
   * 片源元数据（集数等）——静态排印，非 chip。
   */
  badges?: string[];
  /** @deprecated 使用 badges */
  badge?: string;
  /**
   * 本地状态摘要（任务数、格式、来源等）——静态文案行，非 chip。
   */
  localChips?: string[];
  /** @deprecated 改用 localChips；若仍传入则拆成芯片展示 */
  subtitle?: string;
  /**
   * @deprecated 匹配成功改由片源卡「Powered by TMDB」表达；过程态请放入 localChips。
   */
  status?: {
    label: string;
    tone?: 'ok' | 'progress' | 'warn' | 'muted';
  };
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
      // 片名 + 旁侧元数据（去 chip 后更矮）
      infoBarActive ? '3.75rem' : '0px',
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

const YEAR_LIKE = /^\d{4}$/;

const WorkflowInfoBar: React.FC<{ config: InfoBarConfig }> = ({ config }) => {
  const shouldReduceMotion = useReducedMotion();
  const year = config?.year?.trim() || undefined;
  const metaBadges = [
    ...(config?.badges || []),
    ...(config?.badge && !(config.badges || []).includes(config.badge) ? [config.badge] : []),
  ]
    // 年份改走片名锚点，不再当 chip；兼容误塞进 badges 的四位年份
    .filter((item) => !(YEAR_LIKE.test(item) && (!year || item === year)));
  const localChips = [
    ...(config?.localChips || []),
    // 兼容：旧 status 非「已匹配」时并入本地芯片；成功匹配不再在顶栏重复
    ...(config?.status && config.status.label !== '已匹配' ? [config.status.label] : []),
    ...(config?.subtitle
      ? config.subtitle.split(' · ').map((part) => part.trim()).filter(Boolean)
      : []),
  ].filter((item, index, all) => all.indexOf(item) === index);
  // 兼容旧调用：未传 year 时从 badges 里捞四位年份作锚点
  const yearAnchor = year
    || [...(config?.badges || []), config?.badge].find((item): item is string => Boolean(item && YEAR_LIKE.test(item)));

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key={`${config.title}:${yearAnchor || ''}:${metaBadges.join('|')}:${localChips.join('|')}`}
          role="region"
          aria-label="信息栏"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="workflow-info-bar"
        >
          <div className="workflow-info-bar__inner">
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
              {config.onBack && (
                <button
                  type="button"
                  onClick={config.onBack}
                  className="ui-action ui-action--secondary ui-action--icon"
                  aria-label="返回"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {/* 片名 + 年份锚点：年份紧跟片名，等宽数字体与 CJK 片名区分 */}
              <div className="flex min-w-0 max-w-[min(52%,24rem)] shrink-0 items-baseline gap-2 md:max-w-[min(56%,28rem)] md:gap-2.5">
                <h2
                  className="min-w-0 truncate text-[22px] font-semibold leading-none tracking-tight text-[var(--v4-text)] md:text-[26px]"
                  title={config.title}
                >
                  {config.title}
                </h2>
                {yearAnchor ? (
                  <time
                    dateTime={yearAnchor}
                    className="workflow-info-bar__year shrink-0"
                    title={`${yearAnchor} 年`}
                  >
                    {yearAnchor}
                  </time>
                ) : null}
              </div>
              {/* 旁侧：静态元数据（非 chip / 非按钮） */}
              {(metaBadges.length > 0 || localChips.length > 0) && (
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                  {metaBadges.length > 0 && (
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      {metaBadges.map((item) => (
                        <span key={`meta:${item}`} className="ui-meta ui-meta--key">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {localChips.length > 0 && (
                    <p
                      className="ui-meta-row truncate"
                      title={localChips.join(' · ')}
                    >
                      {localChips.join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </div>
            {config.actions && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-center">
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
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="workflow-edge-next__label">{config.label}</span>
      <span className="workflow-edge-next__expanded" aria-hidden="true">
        {config.label}
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </span>
    </button>
  );
};
