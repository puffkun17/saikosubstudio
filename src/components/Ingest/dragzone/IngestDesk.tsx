'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { FilePlus, FolderPlus, LayoutGrid, Layers, List, RotateCcw, X } from 'lucide-react';
import { WorkflowContinueInFlow } from '@/components/Global/WorkflowChrome';
import { LanguageMark } from '@/components/ui/FileFormatIcon';
import { DeskVolumeIcon } from '@/components/Ingest/dragzone/DeskVolumeIcon';
import { CLEAR_CONFIRM_TIMEOUT_MS } from '@/components/Ingest/dragzone/QueueActionBar';
import { FOLDER_UNSUPPORTED_HINT } from '@/components/Ingest/dragzone/environment';
import { stageObjectMotion, useHandoffLayoutAllow } from '@/components/Ingest/dragzone/handoffLayout';
import { groupDeskItems, normalizeDeskExt, type DeskExt, type DeskGroup } from '@/core/deskGrouping';
import {
  createShakeTracker,
  isEditableKeyboardTarget,
  recordShakeMove,
  resetShakeTracker,
} from '@/core/deskGestures';
import { EASE_OUT, MOTION_S, springNoBounce } from '@/core/motion';
import {
  formatBytes,
  languagesForItem,
  type PreflightItem,
} from '@/components/Ingest/dragzone/preflight';

type DeskItem = PreflightItem & { sizeBytes: number };
type DeskLayoutMode = 'folio' | 'gallery';

const LONG_MOVE = springNoBounce(MOTION_S.longMove);

const renderMiniGhostSvg = (ext: DeskExt) => {
  const isAss = ext === 'ass';
  const isArchive = ext === 'zip' || ext === 'rar' || ext === '7z';
  if (isArchive) {
    return `<svg viewBox="0 0 84 84" width="100%" height="100%" fill="none"><rect x="15" y="16" width="54" height="52" rx="7" fill="var(--paper-raised)" stroke="var(--desk-icon-rim-strong)" stroke-width="1"/><rect x="15" y="16" width="54" height="18" rx="6" fill="var(--ink-strong)"/></svg>`;
  }
  return `<svg viewBox="0 0 84 84" width="100%" height="100%" fill="none"><rect x="20" y="12" width="44" height="58" rx="7" fill="var(--paper-raised)" stroke="var(--desk-icon-rim)" stroke-width="1"/>${
    isAss ? '<path d="M49 12 H64 V27 Z" fill="var(--accent)"/>' : ''
  }</svg>`;
};

/**
 * Modern homepage mounted desk (v24):
 * - Loose mounted icons on the dot-matrix studio canvas (pick one, mount one).
 * - Mouse shake or button click triggers a GPU-only FLIP coalesce into stacked groups + trailing attribute folios.
 * - Floating command dock keeps <WorkflowContinueInFlow /> ("整理文件 >") permanently accessible to enter Act 2.
 */
export const IngestDesk: React.FC<{
  queuedItems: PreflightItem[];
  isParsing: boolean;
  onRemoveFile: (key: string) => void;
  onRemoveKeys: (keys: string[]) => void;
  onClear: () => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  folderPickSupported: boolean;
  shouldReduceMotion: boolean | null;
}> = ({
  queuedItems,
  isParsing,
  onRemoveFile,
  onRemoveKeys,
  onClear,
  onPickFiles,
  onPickFolder,
  folderPickSupported,
  shouldReduceMotion,
}) => {
  const layoutAllow = useHandoffLayoutAllow();
  const [isOrganized, setIsOrganized] = useState(false);
  const [layoutMode, setLayoutMode] = useState<DeskLayoutMode>('folio');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [settledGroupIds, setSettledGroupIds] = useState<ReadonlySet<string>>(new Set());

  const deskRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef(createShakeTracker());
  const shakeCueTimerRef = useRef<number | null>(null);
  const deskMountedRef = useRef(true);
  const flightHandleRef = useRef<{
    rafId: number | null;
    ghosts: HTMLElement[];
    animations: Animation[];
    timers: number[];
  }>({ rafId: null, ghosts: [], animations: [], timers: [] });

  const clearShakeCue = useCallback(() => {
    if (shakeCueTimerRef.current != null) {
      window.clearTimeout(shakeCueTimerRef.current);
      shakeCueTimerRef.current = null;
    }
  }, []);

  const clearDeskFlights = useCallback(() => {
    const handle = flightHandleRef.current;
    if (handle.rafId != null) {
      window.cancelAnimationFrame(handle.rafId);
      handle.rafId = null;
    }
    for (const anim of handle.animations) {
      try { anim.cancel(); } catch { /* already finished */ }
    }
    handle.animations = [];
    for (const ghost of handle.ghosts) {
      ghost.remove();
    }
    handle.ghosts = [];
    for (const timer of handle.timers) {
      window.clearTimeout(timer);
    }
    handle.timers = [];
  }, []);

  useEffect(() => {
    deskMountedRef.current = true;
    const shake = shakeRef.current;
    return () => {
      deskMountedRef.current = false;
      clearShakeCue();
      resetShakeTracker(shake);
      clearDeskFlights();
    };
  }, [clearDeskFlights, clearShakeCue]);

  const deskItems: DeskItem[] = useMemo(
    () => queuedItems.map((item) => ({ ...item, sizeBytes: item.file.size })),
    [queuedItems],
  );
  const groups = useMemo(() => groupDeskItems(deskItems), [deskItems]);

  // Clear confirmation timeout (matches QueueActionBar contract)
  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  // Outside click / Escape to close Add popover
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (isOrganized || isParsing || queuedItems.length === 0) {
      resetShakeTracker(shakeRef.current);
      clearShakeCue();
    }
  }, [clearShakeCue, isOrganized, isParsing, queuedItems.length]);

  const runFlipOrganize = useCallback(() => {
    if (isParsing || queuedItems.length === 0 || isOrganized) return;
    clearDeskFlights();
    resetShakeTracker(shakeRef.current);
    clearShakeCue();
    const root = deskRef.current;
    const reduce = Boolean(shouldReduceMotion);

    // 1. FIRST: single batched DOM read of all loose icon bounding boxes
    const origins = new Map<string, { rect: DOMRect; ext: DeskExt }>();
    if (!reduce && root) {
      root.querySelectorAll<HTMLElement>('[data-desk-loose-tile]').forEach((tile) => {
        const key = tile.dataset.fileKey;
        const icon = tile.querySelector<HTMLElement>('.desk-icon-canvas');
        if (key && icon) {
          origins.set(key, {
            rect: icon.getBoundingClientRect(),
            ext: (tile.dataset.ext as DeskExt) || 'srt',
          });
        }
      });
    }

    // 2. LAST: commit organized state and run FLIP in the next animation frame
    setIsOrganized(true);
    setSelectedId(null);

    if (reduce || origins.size === 0) return;

    const handle = flightHandleRef.current;
    handle.rafId = window.requestAnimationFrame(() => {
      handle.rafId = null;
      if (!deskMountedRef.current) return;
      const container = deskRef.current;
      if (!container) return;

      const targetByKey = new Map<string, { rect: DOMRect; groupId: string }>();
      container.querySelectorAll<HTMLElement>('[data-desk-group-id]').forEach((unitEl) => {
        const gid = unitEl.dataset.deskGroupId;
        const iconEl = unitEl.querySelector<HTMLElement>('.desk-icon-canvas');
        if (!gid || !iconEl) return;
        const trect = iconEl.getBoundingClientRect();
        const group = groups.find((g) => g.id === gid);
        group?.items.forEach((it) => targetByKey.set(it.key, { rect: trect, groupId: gid }));
      });

      const fragment = document.createDocumentFragment();
      const flights: Array<{ el: HTMLDivElement; dx: number; dy: number; delay: number; groupId: string }> = [];
      let index = 0;

      origins.forEach((orig, key) => {
        const target = targetByKey.get(key);
        if (!target) return;
        const ghost = document.createElement('div');
        ghost.style.cssText = `
          position: fixed;
          left: ${orig.rect.left}px;
          top: ${orig.rect.top}px;
          width: ${orig.rect.width}px;
          height: ${orig.rect.height}px;
          pointer-events: none;
          z-index: 90;
          will-change: transform, opacity;
        `;
        ghost.innerHTML = renderMiniGhostSvg(orig.ext);
        fragment.appendChild(ghost);
        flights.push({
          el: ghost,
          dx: target.rect.left - orig.rect.left,
          dy: target.rect.top - orig.rect.top,
          delay: Math.min(index * 16, 110),
          groupId: target.groupId,
        });
        index += 1;
      });

      if (flights.length === 0) return;
      handle.ghosts.push(...flights.map((flight) => flight.el));
      document.body.appendChild(fragment);

      let completed = 0;
      const settled = new Set<string>();
      for (const flight of flights) {
        settled.add(flight.groupId);
        const anim = flight.el.animate(
          [
            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
            { transform: `translate3d(${flight.dx}px, ${flight.dy}px, 0) scale(0.92)`, opacity: 0.14 },
          ],
          {
            duration: 320,
            delay: flight.delay,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards',
          },
        );
        handle.animations.push(anim);
        anim.onfinish = () => {
          if (!deskMountedRef.current) return;
          flight.el.remove();
          handle.ghosts = handle.ghosts.filter((node) => node !== flight.el);
          completed += 1;
          if (completed === flights.length) {
            setSettledGroupIds(new Set(settled));
            const timer = window.setTimeout(() => {
              handle.timers = handle.timers.filter((id) => id !== timer);
              if (!deskMountedRef.current) return;
              setSettledGroupIds(new Set());
            }, 280);
            handle.timers.push(timer);
          }
        };
      }
    });
  }, [clearDeskFlights, clearShakeCue, groups, isOrganized, isParsing, queuedItems.length, shouldReduceMotion]);

  // Keyboard ergonomics on the mounted desk (`R` organize/unstack, `Esc` deselect, `ArrowUp`/`ArrowDown` navigate)
  useEffect(() => {
    if (isParsing || queuedItems.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target) || isEditableKeyboardTarget(document.activeElement)) {
        return;
      }
      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        if (isOrganized) {
          setIsOrganized(false);
          setSelectedId(null);
        } else {
          runFlipOrganize();
        }
      } else if (event.key === 'Escape') {
        setSelectedId(null);
        setMenuOpen(false);
        setConfirmingClear(false);
      } else if (isOrganized && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        if (groups.length === 0) return;
        event.preventDefault();
        const cur = groups.findIndex((g) => g.id === selectedId);
        const nextIdx = event.key === 'ArrowDown'
          ? (cur < 0 ? 0 : Math.min(cur + 1, groups.length - 1))
          : (cur <= 0 ? groups.length - 1 : cur - 1);
        setSelectedId(groups[nextIdx].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [groups, isOrganized, isParsing, queuedItems.length, runFlipOrganize, selectedId]);

  // Horizontal shake: sampling stays in a ref. Only a run of long reversals organizes.
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isParsing || isOrganized || queuedItems.length === 0) {
      resetShakeTracker(shakeRef.current);
      return;
    }
    const result = recordShakeMove(shakeRef.current, event.clientX, Date.now());
    if (result === 'none') return;
    if (result === 'trigger') {
      clearShakeCue();
      setIsShaking(false);
      runFlipOrganize();
      return;
    }
    // 'cue' after two counted reversals — do not setState on ordinary movement.
    setIsShaking(true);
    clearShakeCue();
    shakeCueTimerRef.current = window.setTimeout(() => {
      shakeCueTimerRef.current = null;
      if (!deskMountedRef.current) return;
      setIsShaking(false);
    }, 400);
  };

  const formatArchivePeekSummary = (item: DeskItem) => {
    if (item.kind !== 'zip' && item.kind !== 'archive') return item.note;
    if (item.archivePeekStatus === 'loading') return '正在读取包内目录…';
    if (item.archivePeekStatus === 'error') return item.archivePeekError || item.note;
    const n = item.archiveEntries?.length ?? 0;
    return n > 0 ? `压缩包分区 · 内含 ${n} 条字幕轨` : item.note;
  };

  const renderGroupDrawerItems = (group: DeskGroup<DeskItem>) => {
    if (group.items.length === 1 && (group.items[0].kind === 'zip' || group.items[0].kind === 'archive')) {
      const entries = group.items[0].archiveEntries || [];
      if (entries.length === 0) {
        return <span className="desk-ep-chip">{group.items[0].note}</span>;
      }
      return entries.slice(0, 24).map((entry) => (
        <span key={entry.objectId || entry.name} className="desk-ep-chip">
          <span>{entry.name}</span>
        </span>
      ));
    }
    return group.items.map((item) => (
      <span key={item.key} className="desk-ep-chip">
        <span>{item.name}</span>
        <span className="text-[11px] text-[var(--ink-faint)]">{formatBytes(item.sizeBytes)}</span>
        {!isParsing && (
          <button
            type="button"
            className="desk-ep-chip-x"
            aria-label={`移出 ${item.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveFile(item.key);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    ));
  };

  return (
    <div
      ref={deskRef}
      className="relative flex min-h-0 flex-1 flex-col"
      onMouseMove={handleMouseMove}
      onClick={() => setSelectedId(null)}
    >
      {/* Shake / Status Cue Strip */}
      {!isParsing && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)] md:text-[13px]">
            <span
              className={`h-2 w-2 rounded-full ${isOrganized ? 'bg-[var(--accent)]' : 'bg-[var(--ink-muted)]'}`}
              aria-hidden="true"
            />
            <span>
              {isOrganized
                ? `已按同源规律归组为 ${groups.length} 组（共 ${queuedItems.length} 项）`
                : `桌面已挂载 ${queuedItems.length} 项 · 选一个多一个`}
            </span>
          </div>
          {!isOrganized && (
            <span className={`desk-shake-chip ${isShaking ? 'is-shaking' : ''}`}>
              左右晃动鼠标或点「归组叠放」可按同名归组
            </span>
          )}
        </div>
      )}

      {/* Loose Mounted Grid OR Organized Folio Stream / Desktop Shelf */}
      <div className={`min-h-0 flex-1 ${!isParsing ? 'pb-16' : ''}`}>
        {!isOrganized ? (
          <div className="desk-loose-grid">
            {deskItems.map((item) => {
              const ext = normalizeDeskExt(item.name);
              const sel = selectedId === item.key;
              const entryCount = item.archiveEntries?.length ?? 0;
              return (
                <motion.div
                  key={item.objectId}
                  {...stageObjectMotion(item.objectId, shouldReduceMotion, layoutAllow)}
                  data-stage-object={item.objectId}
                  data-desk-loose-tile
                  data-file-key={item.key}
                  data-ext={ext}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(sel ? null : item.key);
                  }}
                  transition={{ duration: shouldReduceMotion ? MOTION_S.reduced : MOTION_S.slow, ease: EASE_OUT, layout: LONG_MOVE }}
                  className={`desk-loose-tile desk-interactive-unit ${sel ? 'is-selected' : ''} ${!item.accepted ? 'is-rejected' : ''}`}
                >
                  <DeskVolumeIcon ext={ext} count={1} />
                  <span className="desk-loose-name" title={item.relativePath || item.name}>
                    {item.name}
                  </span>
                  <span className="desk-loose-meta">
                    {entryCount > 0 ? `${ext.toUpperCase()} · ${entryCount} 轨` : formatBytes(item.sizeBytes)}
                  </span>
                  {sel && !isParsing && (
                    <button
                      type="button"
                      className="ui-action ui-action--quiet mt-0.5 !h-6 !px-2 !text-xs text-[var(--state-danger)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveFile(item.key);
                      }}
                    >
                      移出
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : layoutMode === 'folio' ? (
          <div className="desk-folio-stream">
            {groups.map((group) => {
              const sel = selectedId === group.id;
              const settled = settledGroupIds.has(group.id);
              const firstItem = group.items[0];
              const langs = languagesForItem(firstItem);
              const leadObjectId = firstItem.objectId;
              const desc = group.isStack
                ? `${group.ext.toUpperCase()} 同源序列（${group.continuityNote || `共 ${group.items.length} 份`}） · ${formatBytes(group.totalBytes)}`
                : `${formatArchivePeekSummary(firstItem)} · ${formatBytes(group.totalBytes)}`;

              return (
                <div
                  key={group.id}
                  data-desk-group-id={group.id}
                  className={`desk-folio-row desk-interactive-unit ${sel ? 'is-selected' : ''} ${settled ? 'is-settled' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(sel ? null : group.id);
                  }}
                >
                  <motion.div
                    {...stageObjectMotion(leadObjectId, shouldReduceMotion, layoutAllow)}
                    data-stage-object={leadObjectId}
                    className="desk-detached-icon"
                  >
                    <DeskVolumeIcon ext={group.ext} count={group.items.length} />
                  </motion.div>
                  <div className="desk-folio-card">
                    <div className="desk-folio-head">
                      <span className="desk-folio-title" title={group.displayTitle}>
                        {group.displayTitle}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {langs.slice(0, 2).map((spec) => (
                          <LanguageMark
                            key={`${group.id}:${spec.pair ? `${spec.pair.primary}+${spec.pair.secondary}` : spec.label}`}
                            label={spec.label}
                            languagePair={spec.pair}
                            size="sm"
                          />
                        ))}
                        <span className={`desk-kind-badge ${group.isStack ? 'is-stack' : ''}`}>
                          {group.isStack ? `叠放组 ×${group.items.length}` : group.ext === 'zip' || group.ext === 'rar' || group.ext === '7z' ? '压缩分区' : '单份样式'}
                        </span>
                      </div>
                    </div>
                    <div className="desk-folio-meta">
                      <span>{desc}</span>
                      <span className="inline-flex items-center gap-2 text-xs text-[var(--ink-faint)]">
                        <span>{sel ? '▾ 明细已展开' : '点选展开附页'}</span>
                        {!isParsing && (
                          <button
                            type="button"
                            className="ui-action ui-action--quiet !h-6 !px-1.5 !text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveKeys(group.items.map((it) => it.key));
                            }}
                          >
                            移除
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="desk-folio-drawer-wrap">
                      <div className="desk-folio-drawer-inner">
                        <div className="desk-folio-drawer-content">
                          {renderGroupDrawerItems(group)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="desk-gallery">
            {groups.map((group) => {
              const sel = selectedId === group.id;
              const firstItem = group.items[0];
              const langs = languagesForItem(firstItem);
              return (
                <div
                  key={group.id}
                  data-desk-group-id={group.id}
                  className={`desk-gallery-unit desk-interactive-unit ${sel ? 'is-selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(sel ? null : group.id);
                  }}
                >
                  <motion.div
                    {...stageObjectMotion(firstItem.objectId, shouldReduceMotion, layoutAllow)}
                    data-stage-object={firstItem.objectId}
                  >
                    <DeskVolumeIcon ext={group.ext} count={group.items.length} />
                  </motion.div>
                  <div className="desk-gallery-rider">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="min-w-0 truncate text-sm font-semibold text-[var(--ink-strong)]" title={group.displayTitle}>
                        {group.displayTitle}
                      </span>
                      <span className={`desk-kind-badge ${group.isStack ? 'is-stack' : ''}`}>×{group.items.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                      {langs[0] && (
                        <LanguageMark label={langs[0].label} languagePair={langs[0].pair} size="sm" />
                      )}
                      <span>{formatBytes(group.totalBytes)}</span>
                    </div>
                    {sel && (
                      <div className="desk-folio-drawer-content mt-2 border-t border-[var(--rule-hair)] pt-2">
                        {renderGroupDrawerItems(group)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Command Dock — ALWAYS keeps <WorkflowContinueInFlow /> ("整理文件 >") reachable! */}
      {!isParsing && (
        <div className="desk-floating-dock-anchor" onClick={(event) => event.stopPropagation()}>
          {confirmingClear ? (
            <div
              className="desk-floating-dock desk-floating-dock--confirm"
              data-queue-action-bar
              data-queue-clear-confirm
              role="group"
              aria-label="确认清空"
            >
              <span className="px-1.5 text-sm font-medium text-[var(--ink-muted)]">
                清空 {queuedItems.length} 项？
              </span>
              <button type="button" className="ui-action ui-action--quiet" onClick={() => setConfirmingClear(false)}>
                取消
              </button>
              <button
                type="button"
                className="ui-action ui-action--danger"
                onClick={() => {
                  setConfirmingClear(false);
                  onClear();
                }}
                data-queue-clear-yes
              >
                清空
              </button>
            </div>
          ) : (
            <div className="desk-floating-dock" data-queue-action-bar>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="ui-action ui-action--secondary !h-8 !px-2.5 !text-[13px]"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  data-queue-add
                >
                  <FilePlus className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                  <span>+ 添加</span>
                </button>
                {menuOpen && (
                  <div role="menu" className="ui-menu absolute bottom-full left-0 z-30 mb-2 min-w-[11.5rem]">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-[var(--ink-strong)] hover:bg-[var(--accent-soft)]"
                      onClick={() => {
                        setMenuOpen(false);
                        onPickFiles();
                      }}
                    >
                      <FilePlus className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
                      <span>文件 / 压缩包</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`flex w-full items-center gap-2 border-t border-[var(--rule-hair)] px-3.5 py-2.5 text-left text-sm ${
                        folderPickSupported
                          ? 'text-[var(--ink-strong)] hover:bg-[var(--accent-soft)]'
                          : 'cursor-help text-[var(--ink-faint)]'
                      }`}
                      title={folderPickSupported ? undefined : FOLDER_UNSUPPORTED_HINT}
                      aria-disabled={!folderPickSupported || undefined}
                      onClick={() => {
                        setMenuOpen(false);
                        onPickFolder();
                      }}
                    >
                      <FolderPlus className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
                      <span>{folderPickSupported ? '文件夹' : '文件夹（不可用）'}</span>
                    </button>
                  </div>
                )}
              </div>

              {!isOrganized ? (
                <button
                  type="button"
                  onClick={runFlipOrganize}
                  className="ui-action ui-action--secondary !h-8 !px-2.5 !text-[13px]"
                  title="将同名/规律命名的字幕在桌面归组叠放（快捷键 R，不会开始整理文件）"
                >
                  <Layers className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                  <span>归组叠放</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrganized(false);
                      setSelectedId(null);
                    }}
                    className="ui-action ui-action--quiet !h-8 !px-2 !text-[13px]"
                    title="返回散落挂载视图 (快捷键 R)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>打散</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode((m) => (m === 'folio' ? 'gallery' : 'folio'))}
                    className="ui-action ui-action--quiet !h-8 !px-2 !text-[13px]"
                  >
                    {layoutMode === 'folio' ? (
                      <>
                        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>桌面</span>
                      </>
                    ) : (
                      <>
                        <List className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>附页</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                className="ui-action ui-action--quiet !h-8 !px-2 !text-[13px]"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmingClear(true);
                }}
                aria-label="清空导入队列"
                data-queue-clear
              >
                清空
              </button>

              <span className="h-5 w-px bg-[var(--rule-hair)]" aria-hidden="true" />

              {/* Primary progression CTA always stays visible & wired to useIngestPipeline */}
              <WorkflowContinueInFlow className="!h-9 min-w-[7.5rem] justify-center" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
