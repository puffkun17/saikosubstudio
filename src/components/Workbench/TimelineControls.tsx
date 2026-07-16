'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';

interface TimelineControlsProps {
  variant?: 'full' | 'compact' | 'theater';
  timelineDurationMs?: number;
}

type TimelinePoint = {
  rowIndex: number;
  startMs: number;
  endMs: number;
};

const findNearestPoint = (points: TimelinePoint[], targetMs: number): TimelinePoint => {
  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].startMs < targetMs) low = middle + 1;
    else high = middle;
  }

  const next = points[low];
  const previous = points[Math.max(0, low - 1)];
  return Math.abs(next.startMs - targetMs) < Math.abs(previous.startMs - targetMs)
    ? next
    : previous;
};

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  variant = 'full',
  timelineDurationMs,
}) => {
  const {
    processedSubs,
    previewIndex,
    jumpLineVal,
    setJumpLineVal,
    setPreviewIndex,
    showAllSubs,
    setShowAllSubs,
  } = useStudioStore();
  const [scrubTimeMs, setScrubTimeMs] = useState<number | null>(null);
  const isPointerScrubbing = useRef(false);

  const timelinePoints = useMemo<TimelinePoint[]>(() => (
    (processedSubs || [])
      .map((row, rowIndex) => {
        const range = parseSubtitleRange(row.ts);
        return { rowIndex, startMs: range.startMs, endMs: range.endMs };
      })
      .sort((a, b) => a.startMs - b.startMs)
  ), [processedSubs]);

  useEffect(() => {
    if (!isPointerScrubbing.current) setScrubTimeMs(null);
  }, [previewIndex]);

  if (!processedSubs || processedSubs.length === 0 || timelinePoints.length === 0) return null;

  const safePreviewIndex = Math.max(0, Math.min(previewIndex, processedSubs.length - 1));
  const activeRange = parseSubtitleRange(processedSubs[safePreviewIndex].ts);
  const subtitleEndMs = timelinePoints.reduce((latest, point) => Math.max(latest, point.endMs), 0);
  const sharedDurationMs = Math.max(timelineDurationMs || 0, subtitleEndMs, 1);
  const currentTimeMs = Math.max(0, Math.min(activeRange.startMs, sharedDurationMs));
  const displayTimeMs = Math.max(0, Math.min(scrubTimeMs ?? currentTimeMs, sharedDurationMs));
  const timelinePercent = ((displayTimeMs / sharedDurationMs) * 100).toFixed(1);
  const timelineStyle = {
    '--timeline-progress': `${timelinePercent}%`,
  } as React.CSSProperties;

  const revealTarget = (targetIdx: number) => {
    if (targetIdx >= 100 && !showAllSubs) setShowAllSubs(true);
  };

  const selectRow = (targetIdx: number) => {
    const safeIndex = Math.max(0, Math.min(processedSubs.length - 1, targetIdx));
    setPreviewIndex(safeIndex);
    setJumpLineVal(String(safeIndex + 1));
    revealTarget(safeIndex);
  };

  const commitTimelineChange = (value: string) => {
    const targetMs = Number(value);
    if (!Number.isFinite(targetMs)) return;
    selectRow(findNearestPoint(timelinePoints, targetMs).rowIndex);
    setScrubTimeMs(null);
  };

  const handleTimelineChange = (value: string) => {
    const targetMs = Number(value);
    if (!Number.isFinite(targetMs)) return;
    if (isPointerScrubbing.current) setScrubTimeMs(targetMs);
    else commitTimelineChange(value);
  };

  const beginScrub = (event: React.PointerEvent<HTMLInputElement>) => {
    isPointerScrubbing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endScrub = (value: string) => {
    isPointerScrubbing.current = false;
    commitTimelineChange(value);
  };

  const handleJumpToLine = (event?: React.FormEvent) => {
    event?.preventDefault();
    const lineNum = Number.parseInt(jumpLineVal, 10);
    if (!Number.isFinite(lineNum)) return;
    selectRow(lineNum - 1);
  };

  const timeReadout = `${formatMsClock(displayTimeMs)} / ${formatMsClock(sharedDurationMs)}`;

  if (variant === 'compact') {
    return (
      <div className="flex w-full min-w-[220px] max-w-[420px] items-center gap-3 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2">
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="100"
          value={displayTimeMs}
          onChange={event => handleTimelineChange(event.target.value)}
          onPointerDown={beginScrub}
          onPointerUp={event => endScrub(event.currentTarget.value)}
          onPointerCancel={() => { isPointerScrubbing.current = false; setScrubTimeMs(null); }}
          onBlur={event => { if (scrubTimeMs !== null) endScrub(event.currentTarget.value); }}
          style={timelineStyle}
          className="v9-timeline-dial-slider flex-1 min-w-0"
          aria-label="字幕时间位置"
        />
        <span className="w-[4.5rem] text-right font-mono text-xs tabular-nums text-[#c2cce3]">
          {formatMsClock(displayTimeMs)}
        </span>
      </div>
    );
  }

  if (variant === 'theater') {
    return (
      <div className="flex w-full flex-col gap-3 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-neutral-300">预览时间</span>
          <span className="font-mono text-xs tabular-nums text-[#c2cce3]">{timeReadout}</span>
        </div>
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="100"
          value={displayTimeMs}
          onChange={event => handleTimelineChange(event.target.value)}
          onPointerDown={beginScrub}
          onPointerUp={event => endScrub(event.currentTarget.value)}
          onPointerCancel={() => { isPointerScrubbing.current = false; setScrubTimeMs(null); }}
          onBlur={event => { if (scrubTimeMs !== null) endScrub(event.currentTarget.value); }}
          style={timelineStyle}
          className="v9-timeline-dial-slider w-full flex-1 min-w-0"
          aria-label="字幕预览时间"
        />
        <form onSubmit={handleJumpToLine} className="v9-dial-gauge flex items-center gap-2 shrink-0">
          <span className="v9-dial-gauge-label">行</span>
          <input
            type="number"
            min="1"
            max={processedSubs.length}
            value={jumpLineVal}
            onChange={event => setJumpLineVal(event.target.value)}
            onBlur={() => handleJumpToLine()}
            className="v9-dial-gauge-input no-spin"
            aria-label="跳转到字幕行"
          />
          <div className="h-3 w-px bg-[#8fa3d1]/25" />
          <span className="v9-dial-gauge-value text-[#c2cce3]">{timelinePercent}%</span>
        </form>
      </div>
    );
  }

  return (
    <div className="v9-dial-slider-container flex w-full flex-col gap-2.5 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="v9-dial-slider-wrapper flex min-w-0 flex-1 items-center gap-3">
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="100"
          value={displayTimeMs}
          onChange={event => handleTimelineChange(event.target.value)}
          onPointerDown={beginScrub}
          onPointerUp={event => endScrub(event.currentTarget.value)}
          onPointerCancel={() => { isPointerScrubbing.current = false; setScrubTimeMs(null); }}
          onBlur={event => { if (scrubTimeMs !== null) endScrub(event.currentTarget.value); }}
          style={timelineStyle}
          className="v9-timeline-dial-slider w-full"
          aria-label="字幕时间轴位置"
        />
        <span className="hidden min-w-[8.5rem] text-right font-mono text-xs tabular-nums text-neutral-400 md:block">
          {timeReadout}
        </span>
      </div>

      <form onSubmit={handleJumpToLine} className="v9-dial-gauge flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <span className="v9-dial-gauge-label">行</span>
        <input
          type="number"
          min="1"
          max={processedSubs.length}
          value={jumpLineVal}
          onChange={event => setJumpLineVal(event.target.value)}
          onBlur={() => handleJumpToLine()}
          className="v9-dial-gauge-input no-spin"
          aria-label="跳转到字幕行"
        />
        <div className="h-3 w-px bg-[#8fa3d1]/25" />
        <span className="v9-dial-gauge-value text-[#c2cce3]">{timelinePercent}%</span>
      </form>
    </div>
  );
};
