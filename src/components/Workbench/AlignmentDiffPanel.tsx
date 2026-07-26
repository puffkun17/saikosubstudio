'use client';

import React, { useMemo, useState } from 'react';
import { Captions, FileSearch2, LocateFixed, MoveHorizontal, Music2, Rows3, SplitSquareVertical, Star, Volume2 } from 'lucide-react';
import { describeAuxiliaryReason, isLyricText, isSubtitleCreditText, type SubRow } from '@/utils/subtitleCore';
import { analyzeAlignmentDiff, type AlignmentDiffEntry, type AlignmentDiffKind } from '@/utils/timeline/alignmentDiff';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';
import { useStudioStore } from '@/store/useStudioStore';
import { MARK_COLOR, MARK_LABEL } from '@/components/Workbench/inspectionMarks';

type UnifiedKind = AlignmentDiffKind | 'screen-text' | 'sound-caption' | 'lyrics' | 'credit';

interface UnifiedReviewItem {
  id: string;
  kind: UnifiedKind;
  startMs: number;
  locateIndex: number;
  badge: string;
  text: string;
  reason: string;
  provenance?: AlignmentDiffEntry['provenance'];
}

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

const BadgeIcon = ({ kind }: { kind: UnifiedKind }) => {
  if (kind === 'shifted-match') return <MoveHorizontal className="h-2.5 w-2.5" />;
  if (kind === 'expanded-dialogue') return <SplitSquareVertical className="h-2.5 w-2.5" />;
  if (kind === 'screen-text') return <Captions className="h-2.5 w-2.5" />;
  if (kind === 'sound-caption') return <Volume2 className="h-2.5 w-2.5" />;
  if (kind === 'lyrics') return <Music2 className="h-2.5 w-2.5" />;
  if (kind === 'credit') return <Star className="h-2.5 w-2.5" />;
  return <Rows3 className="h-2.5 w-2.5" />;
};

/** Detail table only — filters/stats live in the 字幕检查 header. */
export const AlignmentDiffPanel: React.FC<{ rows: SubRow[] }> = ({ rows }) => {
  const [sourceEntryId, setSourceEntryId] = useState<string | null>(null);
  const setPreviewIndex = useStudioStore((state) => state.setPreviewIndex);
  const setJumpLineVal = useStudioStore((state) => state.setJumpLineVal);
  const showAllSubs = useStudioStore((state) => state.showAllSubs);
  const setShowAllSubs = useStudioStore((state) => state.setShowAllSubs);
  const lyricPosition = useStudioStore((state) => state.customStyle.lyricPosition ?? 'top');

  const summary = useMemo(() => analyzeAlignmentDiff(rows), [rows]);

  const items = useMemo((): UnifiedReviewItem[] => {
    const structureItems: UnifiedReviewItem[] = summary.entries.map(entry => ({
      id: entry.id,
      kind: entry.kind,
      startMs: entry.startMs,
      locateIndex: entry.rowIndexes[0],
      badge: entry.label,
      text: entry.primaryText || entry.secondaryText || '--',
      reason: entry.detail,
      provenance: entry.provenance,
    }));

    const screenItems: UnifiedReviewItem[] = rows
      .filter(row => isScreenTextRow(row) && !isCreditRow(row) && !isLyricsRow(row))
      .map(row => ({
        id: `screen-${row.index}`,
        kind: 'screen-text' as const,
        startMs: parseSubtitleRange(row.ts).startMs,
        locateIndex: row.index,
        badge: MARK_LABEL.screen,
        text: row.text.replace(/\\N/gi, ' ').replace(/\s+/g, ' ').trim(),
        reason: reasonFromRow(row),
      }));

    const soundItems: UnifiedReviewItem[] = rows.filter(isSoundCaptionRow).map(row => ({
      id: `sound-${row.index}`,
      kind: 'sound-caption' as const,
      startMs: parseSubtitleRange(row.ts).startMs,
      locateIndex: row.index,
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
      badge: MARK_LABEL.lyrics,
      text: row.text.replace(/\\N/gi, ' / ').replace(/\s+/g, ' ').trim(),
      reason: `歌词显示平面 · ${lyricPosLabel}`,
    }));

    const creditItems: UnifiedReviewItem[] = rows.filter(isCreditRow).map(row => ({
      id: `credit-${row.index}`,
      kind: 'credit' as const,
      startMs: parseSubtitleRange(row.ts).startMs,
      locateIndex: row.index,
      badge: MARK_LABEL.credit,
      text: row.text.replace(/\\N/gi, ' ').replace(/\s+/g, ' ').trim(),
      reason: '字幕制作署名，不属于影片画面或对白',
    }));

    return [...structureItems, ...screenItems, ...soundItems, ...lyricItems, ...creditItems]
      .sort((a, b) => a.startMs - b.startMs || a.locateIndex - b.locateIndex);
  }, [summary.entries, rows, lyricPosition]);

  const handleLocate = (rowIndex: number) => {
    const arrayIndex = Math.max(0, rowIndex - 1);
    setPreviewIndex(arrayIndex);
    setJumpLineVal(String(rowIndex));
    if (arrayIndex >= 100 && !showAllSubs) setShowAllSubs(true);
  };

  if (items.length === 0) {
    return (
      <div className="v4-panel px-4 py-6 text-center text-xs text-[var(--v4-text-faint)]">
        没有需要列出的非直接配对或存疑内容
      </div>
    );
  }

  return (
    <section className="v4-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--v4-line)] px-4 py-2 md:px-5">
        <p className="text-xs text-[var(--v4-text-faint)]">
          完整列出结构差异、画面文字、声音描述、歌词与署名信息（{items.length}）
        </p>
      </div>

      <div className="max-h-[min(32vh,280px)] overflow-y-auto">
        <div className="sticky top-0 z-10 hidden grid-cols-[4.75rem_minmax(0,1.35fr)_minmax(0,1fr)_auto] gap-3 border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-1.5 text-xs font-medium text-[var(--v4-text-faint)] md:grid md:px-5">
          <span>时间</span>
          <span>内容</span>
          <span>判定</span>
          <span className="text-right">操作</span>
        </div>

        {items.map((item) => {
          const hasSource = Boolean(item.provenance && item.provenance.length > 0);
          const isSourceOpen = sourceEntryId === item.id;
          return (
            <div
              key={item.id}
              className="border-b border-[var(--v4-line)] last:border-b-0"
              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
            >
              <div className="grid grid-cols-1 gap-1.5 px-4 py-2 md:grid-cols-[4.75rem_minmax(0,1.35fr)_minmax(0,1fr)_auto] md:items-center md:gap-3 md:px-5">
                <div className="min-w-0">
                  <div className="font-mono text-xs tabular-nums text-[var(--v4-text-muted)]">
                    {formatMsClock(item.startMs)}
                  </div>
                  <span
                    className={`mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${badgeTone(item.kind) ?? ''}`}
                    style={badgeToneStyle(item.kind)}
                  >
                    <BadgeIcon kind={item.kind} />
                    <span className="truncate">{item.badge}</span>
                  </span>
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
                    onClick={() => handleLocate(item.locateIndex)}
                    className="ui-action ui-action--quiet"
                    title={`定位到第 ${item.locateIndex} 行`}
                  >
                    <LocateFixed className="h-3 w-3" />
                    定位
                  </button>
                </div>
              </div>

              {isSourceOpen && item.provenance && (
                <div className="border-t border-[var(--v4-line)] bg-[var(--v4-panel-muted)]/40 px-4 py-2 md:px-5">
                  <div className="grid gap-2 lg:grid-cols-2">
                    {item.provenance.slice(0, 4).map((source, sourceIndex) => (
                      <div key={`${item.id}-src-${sourceIndex}`} className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] px-2.5 py-2 text-xs leading-5">
                        {source.primary && (
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--v4-accent-strong)]/70">主轨 #{source.primary.cueIndex}</div>
                            <div className="mt-0.5 whitespace-pre-wrap text-[var(--v4-text-muted)]">{source.primary.text}</div>
                          </div>
                        )}
                        {source.secondary && (
                          <div className={source.primary ? 'mt-1.5 border-t border-[var(--v4-line)] pt-1.5' : ''}>
                            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--v4-text-faint)]">第二语言 #{source.secondary.cueIndex}</div>
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
    </section>
  );
};
