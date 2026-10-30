'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, FilePlus, FolderPlus, HardDrive, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import { FOLDER_UNSUPPORTED_HINT } from '@/components/Ingest/dragzone/environment';
import { EASE_OUT, MOTION_S } from '@/core/motion';

/** 清空确认窗口：超时自动收回，避免误触后一直挂着危险按钮。 */
export const CLEAR_CONFIRM_TIMEOUT_MS = 4000;

/**
 * 队列底栏（list v2，问题 3）：像对话框页脚，一处收齐所有动作。
 *
 * 桌面：左「仅在本地读取」，右依次「清空」（文字次按钮，二次确认）→「+ 继续添加」（描边次按钮，菜单向上开）→「整理文件 >」（主按钮，最右）。
 * 390 px：底栏 sticky 贴底；上一行是说明 + 两个紧凑次按钮，下一行「整理文件」占满整行。
 * 「整理文件」仍由 WorkflowContinueInFlow 渲染，点击行为不变。
 */
export const QueueActionBar = ({
  itemCount,
  onClear,
  onPickFiles,
  onPickFolder,
  folderPickSupported,
}: {
  itemCount: number;
  onClear: () => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  folderPickSupported: boolean;
}) => {
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  const swap = {
    initial: reduce ? false : { opacity: 0 },
    animate: { opacity: 1 },
    exit: reduce ? undefined : { opacity: 0 },
    transition: { duration: reduce ? 0 : MOTION_S.fast, ease: EASE_OUT },
  } as const;

  const clearControl = (
    <AnimatePresence initial={false} mode="wait">
      {confirmingClear ? (
        <motion.span key="confirm" {...swap} role="group" aria-label="确认清空" className="inline-flex items-center gap-1" data-queue-clear-confirm>
          <span className="whitespace-nowrap px-1 text-sm text-[var(--v4-text-muted)]">清空 {itemCount} 项？</span>
          <button
            type="button"
            className="ui-action ui-action--danger"
            onClick={() => { setConfirmingClear(false); onClear(); }}
            data-queue-clear-yes
          >
            清空
          </button>
          <button type="button" className="ui-action ui-action--quiet" onClick={() => setConfirmingClear(false)}>
            取消
          </button>
        </motion.span>
      ) : (
        <motion.span key="idle" {...swap} className="inline-flex">
          <button
            type="button"
            className="ui-action ui-action--quiet"
            onClick={() => setConfirmingClear(true)}
            aria-label="清空导入队列"
            data-queue-clear
          >
            清空
          </button>
        </motion.span>
      )}
    </AnimatePresence>
  );

  const addControl = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="ui-action ui-action--secondary"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        data-queue-add
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        继续添加
        <ChevronUp className={`h-4 w-4 opacity-70 transition-transform ${menuOpen ? '' : 'rotate-180'}`} aria-hidden="true" />
      </button>
      {menuOpen && (
        <div role="menu" className="ui-menu absolute bottom-full right-0 z-30 mb-1.5 min-w-[11rem]">
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)] md:text-[15px]"
            onClick={() => { setMenuOpen(false); onPickFiles(); }}
          >
            <FilePlus className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />
            文件 / 压缩包
          </button>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full items-center gap-2 border-t border-[var(--v4-line)] px-3.5 py-3 text-left text-sm font-normal md:text-[15px] ${
              folderPickSupported
                ? 'text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]'
                : 'cursor-help text-[var(--v4-text-faint)]'
            }`}
            title={folderPickSupported ? undefined : FOLDER_UNSUPPORTED_HINT}
            aria-disabled={!folderPickSupported || undefined}
            onClick={() => { setMenuOpen(false); onPickFolder(); }}
          >
            <FolderPlus className="h-4 w-4 text-[var(--v4-accent-strong)]" aria-hidden="true" />
            {folderPickSupported ? '文件夹' : '文件夹（不可用）'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="ingest-action-bar" data-queue-action-bar>
      <span className={`ingest-action-bar__note inline-flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--v4-text-muted)] md:text-[15px] ${confirmingClear ? 'max-md:hidden' : ''}`}>
        <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">仅在本地读取<span className="max-md:hidden">，不上传</span></span>
      </span>
      <div className="ingest-action-bar__secondary">
        {clearControl}
        {addControl}
      </div>
      <div className="ingest-action-bar__primary">
        <WorkflowContinueInFlow className="min-w-[8.5rem] justify-center" />
      </div>
    </div>
  );
};
