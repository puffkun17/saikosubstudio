'use client';

import React, { useEffect, useRef, useState } from 'react';
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
 * 「整理文件」不被拦截：提示还没处理时，第一次点只把这块滚到眼前并描一圈酒红（减少动态 = 静态描边），
 * 第二次点照常整理本次清单里的全部文件（`shouldNudgeBeforeProcess`）。
 */
export const MultiWorkNotice = ({
  grouping,
  onConfirm,
  onKeepAll,
  nudgeSeq = 0,
}: {
  grouping: WorkGrouping;
  onConfirm: (workKey: string) => void;
  onKeepAll: () => void;
  /** >0 且变化时：滚到眼前 + 描一圈（只一次）。 */
  nudgeSeq?: number;
}) => {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const n = grouping.works.length;

  useEffect(() => {
    if (!nudgeSeq) return;
    const node = sectionRef.current;
    if (!node) return;
    node.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    node.focus({ preventScroll: true });
  }, [nudgeSeq, reduce]);

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? MOTION_S.reduced : MOTION_S.slow, ease: EASE_OUT }}
      ref={sectionRef}
      tabIndex={-1}
      className="relative mb-4 scroll-my-3 rounded-[var(--pt-radius-md)] border outline-none border-[var(--rule-strong)] bg-[var(--paper-raised)] px-3 py-3 md:mb-5 md:px-4 md:py-4"
      role="group"
      aria-labelledby="multi-work-title"
      data-multi-work-notice
      data-multi-work-nudged={nudgeSeq > 0 || undefined}
    >
      {nudgeSeq > 0 && (
        // 描边只动 opacity（合成层），不影响布局；减少动态时静态显示。
        <motion.span
          key={nudgeSeq}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[3px] rounded-[calc(var(--pt-radius-md)+3px)] border-2 border-[var(--accent)]"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, times: [0, 0.15, 0.6, 1], ease: EASE_OUT }}
          data-multi-work-pulse
        />
      )}
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
              <span className="shrink-0 tabular-nums text-xs text-[var(--ink-muted)]">{work.fileCount} 个文件</span>
            </label>
          );
        })}
      </fieldset>
      {grouping.unknownFileCount > 0 && (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">另有 {grouping.unknownFileCount} 个文件认不出片名，会留在本次清单。</p>
      )}
      {nudgeSeq > 0 && (
        <p className="mt-2 text-xs text-[var(--ink-body)]" role="status" data-multi-work-nudge-hint>
          先选一部再整理；要全部一起整理，再点一次「整理文件」。
        </p>
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
