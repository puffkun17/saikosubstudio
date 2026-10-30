'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { FileFormatIcon, resolveFileFormat } from '@/components/ui/FileFormatIcon';
import { MiddleTruncate } from '@/components/ui/MiddleTruncate';
import { EASE_OUT, MOTION_S, springNoBounce } from '@/core/motion';
import { workTitleOf } from '@/core/workGrouping';
import { CLEAR_CONFIRM_TIMEOUT_MS } from '@/components/Ingest/dragzone/QueueActionBar';
import type { PreflightItem } from '@/components/Ingest/dragzone/preflight';

/** 一条暂存文件在列表里显示的作品名（压缩包按包内轨）。 */
const workLabelOf = (item: PreflightItem) =>
  workTitleOf(item.archiveEntries?.[0]?.name || item.name)?.title ?? null;

/**
 * 暂存区（plan B，dragzone-proposal §7.1 步骤 10–14）。
 *
 * 流程节点（像对话框页脚，一处收齐）：
 * - 修改：每行「移回」——单个文件回到本次清单；
 * - 取消：「清空暂存区」——二次确认（与队列「清空」同一套 4 s 自动收回）；
 * - 确认：「全部移回」（清单里还有文件时）/「放回清单」（清单空了时，主按钮）。
 * 每行的「移回」在行尾而不在页脚：它只作用于那一行，放页脚就得先选中再点，多一步。
 */
export const StagingTray = ({
  stagedItems,
  queueEmpty,
  onUnstage,
  onUnstageAll,
  onClear,
}: {
  stagedItems: PreflightItem[];
  queueEmpty: boolean;
  onUnstage: (objectId: string) => void;
  onUnstageAll: () => void;
  onClear: () => void;
}) => {
  const reduce = useReducedMotion();
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  if (stagedItems.length === 0) return null;
  const count = stagedItems.length;
  const longMove = springNoBounce(MOTION_S.longMove);

  return (
    <motion.section
      layout={reduce ? false : 'position'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce
        ? { duration: MOTION_S.reduced, ease: EASE_OUT }
        : { duration: MOTION_S.slow, ease: EASE_OUT, layout: longMove }}
      className={`ingest-staging w-full rounded-[var(--pt-radius-md)] border border-[var(--rule-hair)] bg-[var(--paper-sheet)] px-3 py-3 md:px-4 md:py-4 ${queueEmpty ? 'mx-auto mb-3 max-w-[36rem] md:mb-4' : 'mb-4 md:mb-5'}`}
      data-stage-zone="staging"
      aria-label="暂存区"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--ink-strong)] md:text-base" data-staging-title>
          {queueEmpty ? `暂存区还有 ${count} 个文件，继续整理？` : `暂存区 · ${count} 个文件`}
        </h3>
        <p className="text-xs text-[var(--ink-muted)] md:text-sm">
          {queueEmpty ? '放回清单后再点「整理文件」。' : '不参与这次「整理文件」，稍后再整理。'}
        </p>
      </header>

      <ul className="mt-2.5 space-y-0.5 md:mt-3">
        <AnimatePresence initial={false}>
          {stagedItems.map((item) => {
            const work = workLabelOf(item);
            const entries = item.archiveEntries?.length ?? 0;
            return (
              <motion.li
                key={item.objectId}
                layoutId={reduce ? undefined : item.objectId}
                initial={reduce ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? MOTION_S.reduced : MOTION_S.exit } }}
                transition={reduce ? { duration: MOTION_S.reduced } : { layout: longMove }}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1 py-1.5 md:gap-3.5"
                data-staged-item={item.objectId}
              >
                <FileFormatIcon format={resolveFileFormat(item.name)} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--ink-body)] md:text-[15px]">
                    <MiddleTruncate text={item.relativePath || item.name} />
                  </p>
                  {(work || entries > 0) && (
                    <p className="text-xs text-[var(--ink-muted)]">
                      {[work, entries > 0 ? `包内 ${entries} 条` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="ui-action ui-action--quiet"
                  onClick={() => onUnstage(item.objectId)}
                  aria-label={`移回 ${item.name}`}
                  data-staged-return
                >
                  移回
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <footer className="mt-2.5 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--rule-hair)] px-1 pt-2.5 md:mt-3 md:pt-3" data-staging-footer>
        {confirmingClear ? (
          <span role="group" aria-label="确认清空暂存区" className="inline-flex items-center gap-1">
            <span className="whitespace-nowrap px-1 text-sm text-[var(--ink-muted)]">清空暂存区 {count} 项？</span>
            <button
              type="button"
              className="ui-action ui-action--danger"
              onClick={() => { setConfirmingClear(false); onClear(); }}
              data-staging-clear-yes
            >
              清空
            </button>
            <button type="button" className="ui-action ui-action--quiet" onClick={() => setConfirmingClear(false)}>
              取消
            </button>
          </span>
        ) : (
          <>
            <button type="button" className="ui-action ui-action--quiet" onClick={() => setConfirmingClear(true)} data-staging-clear>
              清空暂存区
            </button>
            <button
              type="button"
              className={queueEmpty ? 'ui-action' : 'ui-action ui-action--secondary'}
              onClick={onUnstageAll}
              data-staging-return-all
            >
              {queueEmpty ? '放回清单' : '全部移回'}
            </button>
          </>
        )}
      </footer>
    </motion.section>
  );
};
