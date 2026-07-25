'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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

/** Active cue at time t, or null when in a gap. */
const findActivePoint = (points: TimelinePoint[], targetMs: number): TimelinePoint | null => {
  let low = 0;
  let high = points.length - 1;
  let candidate: TimelinePoint | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = points[middle];
    if (point.startMs <= targetMs) {
      candidate = point;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (candidate && targetMs < candidate.endMs) return candidate;
  return null;
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
    previewClockMs,
    setPreviewClockMs,
    isPreviewPlaying,
    setIsPreviewPlaying,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    previewIndex: state.previewIndex,
    jumpLineVal: state.jumpLineVal,
    setJumpLineVal: state.setJumpLineVal,
    setPreviewIndex: state.setPreviewIndex,
    showAllSubs: state.showAllSubs,
    setShowAllSubs: state.setShowAllSubs,
    previewClockMs: state.previewClockMs,
    setPreviewClockMs: state.setPreviewClockMs,
    isPreviewPlaying: state.isPreviewPlaying,
    setIsPreviewPlaying: state.setIsPreviewPlaying,
  })));
  const [scrubTimeMs, setScrubTimeMs] = useState<number | null>(null);
  const isPointerScrubbing = useRef(false);
  const playStartedAtRef = useRef(0);
  const playClockAtStartRef = useRef(0);
  const pointsRef = useRef<TimelinePoint[]>([]);
  const durationRef = useRef(1);

  const timelinePoints = useMemo<TimelinePoint[]>(() => (
    (processedSubs || [])
      .map((row, rowIndex) => {
        const range = parseSubtitleRange(row.ts);
        return { rowIndex, startMs: range.startMs, endMs: range.endMs };
      })
      .sort((a, b) => a.startMs - b.startMs)
  ), [processedSubs]);

  const subtitleEndMs = timelinePoints.reduce((latest, point) => Math.max(latest, point.endMs), 0);
  const sharedDurationMs = Math.max(timelineDurationMs || 0, subtitleEndMs, 1);

  useEffect(() => {
    pointsRef.current = timelinePoints;
    durationRef.current = sharedDurationMs;
  }, [timelinePoints, sharedDurationMs]);

  useEffect(() => {
    if (!isPointerScrubbing.current) setScrubTimeMs(null);
  }, [previewIndex]);

  // Keep clock aligned when jumping by line (paused only).
  useEffect(() => {
    if (!processedSubs?.length || isPreviewPlaying || isPointerScrubbing.current) return;
    const row = processedSubs[Math.max(0, Math.min(previewIndex, processedSubs.length - 1))];
    if (!row) return;
    const startMs = parseSubtitleRange(row.ts).startMs;
    if (Math.abs(previewClockMs - startMs) > 40) {
      setPreviewClockMs(startMs);
    }
  }, [previewIndex, processedSubs, isPreviewPlaying, previewClockMs, setPreviewClockMs]);

  useEffect(() => {
    if (!isPreviewPlaying) return;

    playStartedAtRef.current = performance.now();
    playClockAtStartRef.current = useStudioStore.getState().previewClockMs;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - playStartedAtRef.current;
      const nextMs = playClockAtStartRef.current + elapsed;
      const endMs = durationRef.current;
      const points = pointsRef.current;

      if (nextMs >= endMs) {
        setPreviewClockMs(endMs);
        setIsPreviewPlaying(false);
        if (points.length > 0) {
          const last = findNearestPoint(points, endMs);
          setPreviewIndex(last.rowIndex);
          setJumpLineVal(String(last.rowIndex + 1));
        }
        return;
      }

      setPreviewClockMs(nextMs);
      const active = findActivePoint(points, nextMs);
      if (active) {
        const state = useStudioStore.getState();
        if (active.rowIndex !== state.previewIndex) {
          setPreviewIndex(active.rowIndex);
          setJumpLineVal(String(active.rowIndex + 1));
          if (active.rowIndex >= 100 && !state.showAllSubs) setShowAllSubs(true);
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    isPreviewPlaying,
    setPreviewClockMs,
    setIsPreviewPlaying,
    setPreviewIndex,
    setJumpLineVal,
    setShowAllSubs,
  ]);

  if (!processedSubs || processedSubs.length === 0 || timelinePoints.length === 0) return null;

  const displayTimeMs = Math.max(
    0,
    Math.min(scrubTimeMs ?? previewClockMs, sharedDurationMs),
  );
  const timelinePercent = ((displayTimeMs / sharedDurationMs) * 100).toFixed(1);
  const timelineStyle = {
    '--timeline-progress': `${timelinePercent}%`,
  } as React.CSSProperties;

  const revealTarget = (targetIdx: number) => {
    if (targetIdx >= 100 && !showAllSubs) setShowAllSubs(true);
  };

  const selectRow = (targetIdx: number) => {
    const safeIndex = Math.max(0, Math.min(processedSubs.length - 1, targetIdx));
    setIsPreviewPlaying(false);
    setPreviewIndex(safeIndex);
    setJumpLineVal(String(safeIndex + 1));
    revealTarget(safeIndex);
    setPreviewClockMs(parseSubtitleRange(processedSubs[safeIndex].ts).startMs);
  };

  const seekToMs = (targetMs: number) => {
    const clamped = Math.max(0, Math.min(targetMs, sharedDurationMs));
    setPreviewClockMs(clamped);
    const active = findActivePoint(timelinePoints, clamped);
    const point = active || findNearestPoint(timelinePoints, clamped);
    setPreviewIndex(point.rowIndex);
    setJumpLineVal(String(point.rowIndex + 1));
    revealTarget(point.rowIndex);
  };

  const commitTimelineChange = (value: string) => {
    const targetMs = Number(value);
    if (!Number.isFinite(targetMs)) return;
    setIsPreviewPlaying(false);
    seekToMs(targetMs);
    setScrubTimeMs(null);
  };

  const handleTimelineChange = (value: string) => {
    const targetMs = Number(value);
    if (!Number.isFinite(targetMs)) return;
    if (isPointerScrubbing.current) {
      setScrubTimeMs(targetMs);
      setPreviewClockMs(targetMs);
    } else {
      commitTimelineChange(value);
    }
  };

  const beginScrub = (event: React.PointerEvent<HTMLInputElement>) => {
    isPointerScrubbing.current = true;
    setIsPreviewPlaying(false);
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

  const togglePlayback = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      return;
    }
    const startFrom = displayTimeMs >= sharedDurationMs - 20 ? 0 : displayTimeMs;
    setPreviewClockMs(startFrom);
    setIsPreviewPlaying(true);
  };

  const timeReadout = `${formatMsClock(displayTimeMs)} / ${formatMsClock(sharedDurationMs)}`;

  const playButton = (
    <button
      type="button"
      onClick={togglePlayback}
      className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel)] text-[var(--v4-accent-strong)] transition-colors hover:bg-[var(--v4-accent-soft)]"
      aria-label={isPreviewPlaying ? '暂停预览' : '播放字幕轴'}
      title={isPreviewPlaying ? '暂停' : '播放（便于查看渐入渐出）'}
    >
      {isPreviewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
    </button>
  );

  if (variant === 'compact') {
    return (
      <div className="flex w-full min-w-[220px] max-w-[420px] items-center gap-2 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-2">
        {playButton}
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="16"
          value={displayTimeMs}
          onChange={event => handleTimelineChange(event.target.value)}
          onPointerDown={beginScrub}
          onPointerUp={event => endScrub(event.currentTarget.value)}
          onPointerCancel={() => { isPointerScrubbing.current = false; setScrubTimeMs(null); }}
          onBlur={event => { if (scrubTimeMs !== null) endScrub(event.currentTarget.value); }}
          style={timelineStyle}
          className="v9-timeline-dial-slider min-w-0 flex-1"
          aria-label="字幕时间位置"
        />
        <span className="w-[4.5rem] text-right font-mono text-xs tabular-nums text-[var(--v4-accent-strong)]">
          {formatMsClock(displayTimeMs)}
        </span>
      </div>
    );
  }

  if (variant === 'theater') {
    return (
      <div className="theater-chrome-bar flex w-full flex-col gap-3 rounded-lg border border-[var(--v4-line)] px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          {playButton}
          <span className="text-xs font-semibold text-[var(--v4-text-muted)]">预览时间</span>
          <span className="font-mono text-xs tabular-nums text-[var(--v4-accent-strong)]">{timeReadout}</span>
        </div>
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="16"
          value={displayTimeMs}
          onChange={event => handleTimelineChange(event.target.value)}
          onPointerDown={beginScrub}
          onPointerUp={event => endScrub(event.currentTarget.value)}
          onPointerCancel={() => { isPointerScrubbing.current = false; setScrubTimeMs(null); }}
          onBlur={event => { if (scrubTimeMs !== null) endScrub(event.currentTarget.value); }}
          style={timelineStyle}
          className="v9-timeline-dial-slider w-full min-w-0 flex-1"
          aria-label="字幕预览时间"
        />
        <form onSubmit={handleJumpToLine} className="v9-dial-gauge flex shrink-0 items-center gap-2">
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
          <div className="h-3 w-px bg-[var(--v4-line-strong)]" />
          <span className="v9-dial-gauge-value text-[var(--v4-text-muted)]">{timelinePercent}%</span>
        </form>
      </div>
    );
  }

  return (
    <div className="v9-dial-slider-container flex w-full flex-col gap-2 rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="v9-dial-slider-wrapper flex min-w-0 flex-1 items-center gap-2.5">
        {playButton}
        <input
          type="range"
          min="0"
          max={sharedDurationMs}
          step="16"
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
        <span className="hidden min-w-[8.5rem] text-right font-mono text-[13px] font-semibold tabular-nums text-[var(--v4-text-muted)] md:block">
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
        <div className="h-3 w-px bg-[var(--v4-line-strong)]" />
        <span className="v9-dial-gauge-value">{timelinePercent}%</span>
      </form>
    </div>
  );
};
