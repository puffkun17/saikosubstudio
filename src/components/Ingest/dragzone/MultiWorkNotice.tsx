'use client';

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, MOTION_S } from '@/core/motion';
import type { WorkGrouping } from '@/core/workGrouping';

/**
 * 多作品提示（dragzone-proposal §7.1 步骤 8–9）：「这次拖入的文件可能包含 N 部作品」。
 *
 * 流程节点全部在这一块里，像对话框：
 * - 修改：选一部（单选，**不预选**——提示不是自动分拣）；
 * - 取消：「都留在这里」——不拆，同一组合不再提示；
 * - 确认：「只整理这部，其余放入暂存区」——没选之前不可点。
 * 「整理文件」不受这块影响（行为不变，仍整理本次清单里的全部文件）。
 */
export const MultiWorkNotice = ({
  grouping,
  onConfirm,
  onKeepAll,
}: {
  grouping: WorkGrouping;
  onConfirm: (workKey: string) => void;
  onKeepAll: () => void;
}) => {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const n = grouping.works.length;

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? MOTION_S.reduced : MOTION_S.slow, ease: EASE_OUT }}
      className="mb-4 rounded-[var(--pt-radius-md)] border border-[var(--rule-strong)] bg-[var(--paper-raised)] px-3 py-3 md:mb-5 md:px-4 md:py-4"
      role="group"
      aria-labelledby="multi-work-title"
      data-multi-work-notice
    >
      <h4 id="multi-work-title" className="text-[15px] font-semibold tracking-tight text-[var(--ink-strong)] md:text-base">
        <span className="mr-2 inline-block h-2 w-2 translate-y-[-1px] rounded-full bg-[var(--accent)] align-middle" aria-hidden="true" />
        这次拖入的文件可能包含 {n} 部作品
      </h4>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">一次整理一部更稳。选出这次要整理的，其余放入暂存区，稍后再整理。</p>

      <fieldset className="mt-3 grid gap-1.5 sm:grid-cols-2">
        <legend className="sr-only">选择这次要整理的作品</legend>
        {grouping.works.map((work) => {
          const active = picked === work.key;
          return (
            <label
              key={work.key}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm md:text-[15px] ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--rule-control)] bg-[var(--paper-sheet)] text-[var(--ink-body)] hover:border-[var(--rule-strong)]'
              }`}
              data-multi-work-option={work.key}
            >
              <input
                type="radio"
                name="multi-work"
                className="h-3.5 w-3.5 accent-[var(--accent)]"
                checked={active}
                onChange={() => setPicked(work.key)}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{work.title}</span>
              <span className="shrink-0 tabular-nums text-xs text-[var(--ink-muted)]">{work.objectIds.length} 项</span>
            </label>
          );
        })}
      </fieldset>
      {grouping.unknown.length > 0 && (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">另有 {grouping.unknown.length} 项认不出片名，会留在本次清单。</p>
      )}

      <footer className="mt-3 flex flex-wrap items-center justify-end gap-2" data-multi-work-footer>
        <button type="button" className="ui-action ui-action--quiet" onClick={onKeepAll} data-multi-work-keep>
          都留在这里
        </button>
        <button
          type="button"
          className="ui-action"
          disabled={!picked}
          aria-disabled={!picked || undefined}
          onClick={() => picked && onConfirm(picked)}
          data-multi-work-confirm
        >
          只整理这部，其余放入暂存区
        </button>
      </footer>
    </motion.section>
  );
};
