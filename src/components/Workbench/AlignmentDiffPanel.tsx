'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Check, ChevronDown, ChevronUp, FileSearch2, LocateFixed, MoveHorizontal, Music2, Rows3, SplitSquareVertical, Star, Volume2 } from 'lucide-react';
import { describeAuxiliaryReason, isLyricText, isSubtitleCreditText, type AlignmentProvenance, type SubRow } from '@/utils/subtitleCore';
import {
  buildMergeReviewQueue,
  filterMergeReviewQueue,
  type MergeReviewCategory,
  type MergeReviewFilter,
  type MergeReviewItem,
} from '@/utils/timeline/alignmentDiff';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';
import { useStudioStore } from '@/store/useStudioStore';
import { EMPTY_CHECKED_IDS } from '@/lib/emptyCheckedIds';
import { MARK_COLOR, MARK_LABEL } from '@/components/Workbench/inspectionMarks';

type SurfaceTab = 'merge' | 'aux';
type UnifiedKind = MergeReviewCategory | 'screen-text' | 'sound-caption' | 'lyrics' | 'credit';

interface UnifiedReviewItem {
  id: string;
  kind: UnifiedKind;
  startMs: number;
  locateIndex: number;
  rowIndexes: number[];
  badge: string;
  text: string;
  reason: string;
  severity?: 'review' | 'watch';
  provenance?: AlignmentProvenance[];
}

const REVIEW_FILTERS: Array<{ id: MergeReviewFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'coverage-merge', label: '覆盖' },
  { id: 'expanded-dialogue', label: '对话' },
  { id: 'single-track', label: '单轨' },
  { id: 'shifted-match', label: '平移' },
  { id: 'other-suspect', label: '其他' },
];

/** Stable empty list so Zustand Object.is equality does not thrash when a task has no checked ids yet. */
const SURFACE_TABS: Array<{ id: SurfaceTab; label: string }> = [
  { id: 'merge', label: '合轴待复核' },
  { id: 'aux', label: '辅助内容' },
];

const CATEGORY_BADGE: Record<MergeReviewCategory, string> = {
  'coverage-merge': '时间覆盖合并',
  'expanded-dialogue': '已展开对话',
  'single-track': '单侧字轨',
  'shifted-match': '整体平移',
  'other-suspect': '其他存疑',
};

const isScreenTextRow = (row: SubRow) => (
  row.cueKind === 'screen_text' || row.auxiliary?.category === 'screen_text'
);

const isLyricsRow = (row: SubRow) => (
  row.type === 'lyrics'
  || row.cueKind === 'lyrics'
  || isLyricText(row.text)
);

const isCreditRow = (row: SubRow) => (
  row.type === 'credit'
  || row.cueKind === 'credit'
  || isSubtitleCreditText(row.text)
);

const isSoundCaptionRow = (row: SubRow) => (
  !isLyricsRow(row)
  && !isCreditRow(row)
  && (
    row.cueKind === 'sound_caption'
    || row.auxiliary?.category === 'ambient_sdh'
    || row.auxiliary?.category === 'music'
  )
);

const reasonFromRow = (row: SubRow) => {
  const reason = row.auxiliary?.reasons?.[0];
  return reason ? describeAuxiliaryReason(reason) : '辅助内容';
};

const badgeTone = (kind: UnifiedKind) => {
  if (kind === 'shifted-match') return 'bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]';
  if (kind === 'coverage-merge' || kind === 'other-suspect') {
    return 'bg-[var(--v4-warning)]/12 text-[var(--v4-warning)]';
  }
  if (kind === 'expanded-dialogue') return 'bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]';
  if (kind === 'screen-text' || kind === 'lyrics' || kind === 'credit') {
    return undefined;
  }
  if (kind === 'sound-caption') return 'bg-[var(--v4-warning)]/12 text-[var(--v4-warning)]';
  return 'bg-[var(--v4-danger)]/10 text-[var(--v4-danger)]';
};

const badgeToneStyle = (kind: UnifiedKind): React.CSSProperties | undefined => {
  if (kind === 'screen-text') {
    return {
      background: `color-mix(in srgb, ${MARK_COLOR.screen} 16%, transparent)`,
      color: MARK_COLOR.screen,
    };
  }
  if (kind === 'lyrics') {
    return {
      background: `color-mix(in srgb, ${MARK_COLOR.lyrics} 16%, transparent)`,
      color: MARK_COLOR.lyrics,
    };
  }
  if (kind === 'credit') {
    return {
      background: `color-mix(in srgb, ${MARK_COLOR.credit} 16%, transparent)`,
      color: MARK_COLOR.credit,
    };
  }
  return undefined;
};

const severityTone = (severity: 'review' | 'watch') => (
  severity === 'review'
    ? 'bg-[var(--v4-danger)]/12 text-[var(--v4-danger)]'
    : 'bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'
);

const BadgeIcon = ({ kind }: { kind: UnifiedKind }) => {
  if (kind === 'shifted-match') return <MoveHorizontal className="h-2.5 w-2.5" />;
  if (kind === 'coverage-merge' || kind === 'other-suspect') return <Rows3 className="h-2.5 w-2.5" />;
  if (kind === 'expanded-dialogue') return <SplitSquareVertical className="h-2.5 w-2.5" />;
  if (kind === 'screen-text') return <Captions className="h-2.5 w-2.5" />;
  if (kind === 'sound-caption') return <Volume2 className="h-2.5 w-2.5" />;
  if (kind === 'lyrics') return <Music2 className="h-2.5 w-2.5" />;
  if (kind === 'credit') return <Star className="h-2.5 w-2.5" />;
  return <Rows3 className="h-2.5 w-2.5" />;
};

const queueItemToUnified = (item: MergeReviewItem): UnifiedReviewItem => ({
  id: item.id,
  kind: item.category,
  startMs: item.startMs,
  locateIndex: item.rowIndexes[0],
  rowIndexes: item.rowIndexes,
  badge: item.category === 'single-track' && item.isBoundaryCandidate
    ? '片头/片尾单轨'
    : CATEGORY_BADGE[item.category],
  text: item.text,
  reason: item.reason,
  severity: item.severity,
  provenance: item.provenance,
});

const buildAuxItems = (rows: SubRow[], lyricPosition: 'top' | 'bottom'): UnifiedReviewItem[] => {
  const screenItems: UnifiedReviewItem[] = rows
    .filter(row => isScreenTextRow(row) && !isCreditRow(row) && !isLyricsRow(row))
    .map(row => ({
      id: `screen-${row.index}`,
      kind: 'screen-text' as const,
      startMs: parseSubtitleRange(row.ts).startMs,
      locateIndex: row.index,
      rowIndexes: [row.index],
      badge: MARK_LABEL.screen,
      text: row.text.replace(/\\N/gi, ' ').replace(/\s+/g, ' ').trim(),
      reason: reasonFromRow(row),
    }));

  const soundItems: UnifiedReviewItem[] = rows.filter(isSoundCaptionRow).map(row => ({
    id: `sound-${row.index}`,
    kind: 'sound-caption' as const,
    startMs: parseSubtitleRange(row.ts).startMs,
    locateIndex: row.index,
    rowIndexes: [row.index],
    badge: MARK_LABEL.sound,
    text: row.text.replace(/\\N/gi, ' ').replace(/\s+/g, ' ').trim(),
    reason: reasonFromRow(row),
  }));

  const lyricPosLabel = lyricPosition === 'bottom' ? '底部' : '顶部';
  const lyricItems: UnifiedReviewItem[] = rows.filter(isLyricsRow).map(row => ({
    id: `lyrics-${row.index}`,
    kind: 'lyrics' as const,
    startMs: parseSubtitleRange(row.ts).startMs,
    locateIndex: row.index,
    rowIndexes: [row.index],
    badge: MARK_LABEL.lyrics,
    text: row.text.replace(/\\N/gi, ' / ').replace(/\s+/g, ' ').trim(),
    reason: `歌词显示平面 · ${lyricPosLabel}`,
  }));

  const creditItems: UnifiedReviewItem[] = rows.filter(isCreditRow).map(row => ({
    id: `credit-${row.index}`,
    kind: 'credit' as const,
    startMs: parseSubtitleRange(row.ts).startMs,
    locateIndex: row.index,
    rowIndexes: [row.index],
    badge: MARK_LABEL.credit,
    text: row.text.replace(/\\N/gi, ' ').replace(/\s+/g, ' ').trim(),
    reason: '字幕制作署名，不属于影片画面或对白',
  }));

  return [...screenItems, ...soundItems, ...lyricItems, ...creditItems]
    .sort((a, b) => a.startMs - b.startMs || a.locateIndex - b.locateIndex);
};

export interface AlignmentDiffPanelProps {
  rows: SubRow[];
  /** Increment to scroll/focus the panel (e.g. overview 待复核 badge). */
  focusNonce?: number;
  /** When focusNonce changes, optionally force this filter. */
  preferredFilter?: MergeReviewFilter;
}

/** Detail table — merge review queue primary; auxiliary listing on a secondary tab. */
export const AlignmentDiffPanel: React.FC<AlignmentDiffPanelProps> = ({
  rows,
  focusNonce = 0,
  preferredFilter,
}) => {
  const panelRef = useRef<HTMLElement>(null);
  const [sourceEntryId, setSourceEntryId] = useState<string | null>(null);
  const [surfaceTab, setSurfaceTab] = useState<SurfaceTab>('merge');
  const [reviewFilter, setReviewFilter] = useState<MergeReviewFilter>('all');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const selectedTaskId = useStudioStore((state) => state.selectedTaskId);
  const customFilename = useStudioStore((state) => state.customFilename);
  const taskKey = selectedTaskId || customFilename || '_default';
  const checkedIdList = useStudioStore((state) => state.mergeReviewCheckedByTask[taskKey] ?? EMPTY_CHECKED_IDS);
  const checkedIds = useMemo(() => new Set(checkedIdList), [checkedIdList]);
  const toggleMergeReviewChecked = useStudioStore((state) => state.toggleMergeReviewChecked);
  const markMergeReviewChecked = useStudioStore((state) => state.markMergeReviewChecked);
  const setPreviewIndex = useStudioStore((state) => state.setPreviewIndex);
  const setLocateGroupIndexes = useStudioStore((state) => state.setLocateGroupIndexes);
  const setJumpLineVal = useStudioStore((state) => state.setJumpLineVal);
  const showAllSubs = useStudioStore((state) => state.showAllSubs);
  const setShowAllSubs = useStudioStore((state) => state.setShowAllSubs);
  const lyricPosition = useStudioStore((state) => state.customStyle.lyricPosition ?? 'top');

  const queue = useMemo(() => buildMergeReviewQueue(rows), [rows]);
  const auxItems = useMemo(() => buildAuxItems(rows, lyricPosition), [rows, lyricPosition]);

  useEffect(() => {
    if (!focusNonce) return;
    setSurfaceTab('merge');
    if (preferredFilter) setReviewFilter(preferredFilter);
    const el = panelRef.current;
    if (el) {
      // Modal host owns scrolling; avoid yanking the workbench behind the dialog.
      el.focus({ preventScroll: true });
    }
  }, [focusNonce, preferredFilter]);

  const mergeItems = useMemo((): UnifiedReviewItem[] => (
    filterMergeReviewQueue(queue, reviewFilter)
      .map(queueItemToUnified)
      .sort((a, b) => a.startMs - b.startMs || a.locateIndex - b.locateIndex)
  ), [queue, reviewFilter]);

  const items = surfaceTab === 'merge' ? mergeItems : auxItems;

  const activeIndex = useMemo(() => {
    if (!activeItemId) return items.length > 0 ? 0 : -1;
    const idx = items.findIndex(item => item.id === activeItemId);
    return idx >= 0 ? idx : (items.length > 0 ? 0 : -1);
  }, [activeItemId, items]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveItemId(null);
      return;
    }
    if (!activeItemId || !items.some(item => item.id === activeItemId)) {
      setActiveItemId(items[0].id);
    }
  }, [items, activeItemId]);

  const handleLocate = (item: UnifiedReviewItem) => {
    const indexes = (item.rowIndexes.length > 0 ? item.rowIndexes : [item.locateIndex])
      .map(rowIndex => Math.max(0, rowIndex - 1));
    const first = indexes[0] ?? 0;
    setActiveItemId(item.id);
    setPreviewIndex(first);
    setJumpLineVal(String(first + 1));
    setLocateGroupIndexes(indexes.length > 1 ? indexes : []);
    if (first >= 100 && !showAllSubs) setShowAllSubs(true);
  };

  const goRelative = (delta: number) => {
    if (items.length === 0 || activeIndex < 0) return;
    const next = (activeIndex + delta + items.length) % items.length;
    const item = items[next];
    setActiveItemId(item.id);
    handleLocate(item);
  };

  const toggleChecked = (id: string) => {
    toggleMergeReviewChecked(taskKey, id);
  };

  const markCheckedAndMaybeNext = (id: string) => {
    markMergeReviewChecked(taskKey, id);
    const idx = items.findIndex(item => item.id === id);
    if (idx >= 0 && idx < items.length - 1) {
      const item = items[idx + 1];
      setActiveItemId(item.id);
      handleLocate(item);
    }
  };

  const chipCount = (id: MergeReviewFilter) => {
    if (id === 'all') return queue.total;
    return queue.counts[id];
  };

  const mergeCheckedCount = queue.items.filter(item => checkedIds.has(item.id)).length;
  const mergeRemaining = Math.max(0, queue.total - mergeCheckedCount);
  const listCheckedCount = items.filter(item => checkedIds.has(item.id)).length;


  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="v4-panel overflow-hidden outline-none"
      aria-label="合轴待复核明细"
    >
      <div className="flex flex-col gap-2 border-b border-[var(--v4-line)] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex flex-wrap items-center gap-x-1 text-xs text-[var(--v4-text-faint)]">
            <span className="font-medium text-[var(--v4-text-muted)]">合轴待复核</span>
            {queue.total > 0 ? (
              <>
                <span>· 已核对</span>
                <span className="font-semibold tabular-nums text-[var(--v4-accent-strong)]">
                  {mergeCheckedCount}
                </span>
                <span>/</span>
                <span className="font-semibold tabular-nums text-[var(--v4-text-muted)]">
                  {queue.total}
                </span>
                {mergeRemaining > 0 && (
                  <>
                    <span>· 未核</span>
                    <span className="font-semibold tabular-nums text-[var(--v4-danger)]">
                      {mergeRemaining}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span>· 暂无合轴待复核项</span>
            )}
            {surfaceTab === 'aux' && auxItems.length > 0 && (
              <>
                <span>· 辅助</span>
                <span className="font-semibold tabular-nums text-[var(--v4-text-muted)]">
                  {auxItems.length}
                </span>
                {listCheckedCount > 0 && (
                  <>
                    <span>· 已看</span>
                    <span className="font-semibold tabular-nums text-[var(--v4-accent-strong)]">
                      {listCheckedCount}
                    </span>
                  </>
                )}
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="ui-action ui-action--quiet"
              disabled={items.length === 0}
              onClick={() => goRelative(-1)}
              title="上一项"
            >
              <ChevronUp className="h-3 w-3" />
              上一项
            </button>
            <button
              type="button"
              className="ui-action ui-action--quiet"
              disabled={items.length === 0}
              onClick={() => goRelative(1)}
              title="下一项"
            >
              <ChevronDown className="h-3 w-3" />
              下一项
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="ui-choice-group" role="tablist" aria-label="复核面">
            {SURFACE_TABS.map((tab) => {
              const count = tab.id === 'merge' ? queue.total : auxItems.length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={surfaceTab === tab.id}
                  onClick={() => setSurfaceTab(tab.id)}
                  className={`ui-choice inline-flex items-center gap-1.5 ${surfaceTab === tab.id ? 'ui-choice--on' : ''}`}
                >
                  {tab.label}
                  {count > 0 ? (
                    <span className="tabular-nums opacity-70">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {surfaceTab === 'merge' && (
          <div className="ui-choice-group max-w-full overflow-x-auto" role="tablist" aria-label="合轴待复核筛选">
            {REVIEW_FILTERS.map((item) => {
              const count = chipCount(item.id);
              const disabled = item.id !== 'all' && count === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={reviewFilter === item.id}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setReviewFilter(item.id);
                  }}
                  className={`ui-choice inline-flex items-center gap-1.5 ${reviewFilter === item.id ? 'ui-choice--on' : ''} ${disabled ? 'opacity-40' : ''}`}
                >
                  {item.label}
                  {count > 0 ? (
                    <span className="tabular-nums opacity-70">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--v4-text-faint)]">
          {surfaceTab === 'aux'
            ? '没有列出的辅助内容（画面字 / 声音描述 / 歌词 / 署名）'
            : reviewFilter === 'all'
              ? '没有需要合轴复核的结构项'
              : '当前筛选下暂无待复核项'}
        </div>
      ) : (
        <div className="max-h-[min(58vh,36rem)] overflow-y-auto">
          <div className="sticky top-0 z-10 hidden grid-cols-[4.75rem_minmax(0,1.35fr)_minmax(0,1fr)_auto] gap-3 border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-1.5 text-xs font-medium text-[var(--v4-text-faint)] md:grid">
            <span>时间</span>
            <span>内容</span>
            <span>判定</span>
            <span className="text-right">操作</span>
          </div>

          {items.map((item) => {
            const hasSource = Boolean(item.provenance && item.provenance.length > 0);
            const isSourceOpen = sourceEntryId === item.id;
            const isActive = activeItemId === item.id;
            const isChecked = checkedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`border-b border-[var(--v4-line)] last:border-b-0 ${isActive ? 'bg-[var(--v4-accent-soft)]/35' : ''} ${isChecked ? 'opacity-70' : ''}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
              >
                <div className="grid grid-cols-1 gap-1.5 px-4 py-2 md:grid-cols-[4.75rem_minmax(0,1.35fr)_minmax(0,1fr)_auto] md:items-center md:gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs tabular-nums text-[var(--v4-text-muted)]">
                      {formatMsClock(item.startMs)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs font-medium ${badgeTone(item.kind) ?? ''}`}
                        style={badgeToneStyle(item.kind)}
                      >
                        <BadgeIcon kind={item.kind} />
                        <span className="truncate">{item.badge}</span>
                      </span>
                      {item.severity && (
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${severityTone(item.severity)}`}>
                          {item.severity === 'review' ? '需复核' : '留意'}
                        </span>
                      )}
                      {isChecked && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--v4-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--v4-accent-strong)]">
                          <Check className="h-2.5 w-2.5" />
                          已核对
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 truncate text-xs leading-5 text-[var(--v4-text-muted)]" title={item.text}>
                    {item.text}
                  </div>
                  <div className="min-w-0 truncate text-xs leading-5 text-[var(--v4-text-faint)]" title={item.reason}>
                    {item.reason}
                  </div>
                  <div className="flex justify-end gap-1">
                    {hasSource && (
                      <button
                        type="button"
                        onClick={() => setSourceEntryId(current => current === item.id ? null : item.id)}
                        className={isSourceOpen ? 'ui-action' : 'ui-action ui-action--quiet'}
                        aria-expanded={isSourceOpen}
                      >
                        <FileSearch2 className="h-3 w-3" />
                        来源
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => (isChecked ? toggleChecked(item.id) : markCheckedAndMaybeNext(item.id))}
                      className={isChecked ? 'ui-action' : 'ui-action ui-action--quiet'}
                      title={isChecked ? '取消已核对' : '标记已核对并跳到下一项'}
                    >
                      <Check className="h-3 w-3" />
                      已核对
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLocate(item)}
                      className="ui-action ui-action--quiet"
                      title={item.rowIndexes.length > 1
                        ? `定位并高亮 ${item.rowIndexes.length} 行`
                        : `定位到第 ${item.locateIndex} 行`}
                    >
                      <LocateFixed className="h-3 w-3" />
                      定位
                    </button>
                  </div>
                </div>

                {isSourceOpen && item.provenance && (
                  <div className="border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)]/40 px-4 py-2">
                    <div className="grid gap-2 lg:grid-cols-2">
                      {item.provenance.slice(0, 4).map((source, sourceIndex) => (
                        <div key={`${item.id}-src-${sourceIndex}`} className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] px-2.5 py-2 text-xs leading-5">
                          {source.primary && (
                            <div>
                              <div className="text-xs font-medium uppercase tracking-[var(--tracking-eyebrow-wide)] text-[var(--v4-accent-strong)]/70">主轨 #{source.primary.cueIndex}</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-[var(--v4-text-muted)]">{source.primary.text}</div>
                            </div>
                          )}
                          {source.secondary && (
                            <div className={source.primary ? 'mt-1.5 border-t border-[var(--v4-line)] pt-1.5' : ''}>
                              <div className="text-xs font-medium uppercase tracking-[var(--tracking-eyebrow-wide)] text-[var(--v4-text-faint)]">原文 #{source.secondary.cueIndex}</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-[var(--v4-text-faint)]">{source.secondary.text}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
