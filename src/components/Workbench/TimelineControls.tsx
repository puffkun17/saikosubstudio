'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LampCeiling, Pause, Play, SquareCenterlineDashedHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { reviewTaskKey } from '@/core/reviewKey';
import {
  activeMeasureMode,
  buildDialTicks,
  cycleMeasureMode,
  formatDialAnchor,
  formatMeasureLine,
  nearestHitOrdinal,
  type MeasureMode,
} from '@/core/timelineMeasure';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';

interface TimelineControlsProps {
  variant?: 'full' | 'compact' | 'theater';
  timelineDurationMs?: number;
  /** Act 2 dial: row / time / percent live on the bar; an empty filter still dims the track. */
  focusChrome?: TimelineFocusChrome;
  /** 放映厅：关灯仍保留播放+进度；画幅辅助线放在播放单元外侧，不打断进度条。 */
  theaterChrome?: {
    lightsOff: boolean;
    /** 选中特殊行分类时，在时间轴上画出该类的刻度（行号）。命中刻度保持全亮。空数组 = 该分类 0 命中，整条变暗。 */
    marks?: number[];
    /** 其他特殊行刻度：与第二幕非命中行一样降到 0.45。 */
    dimMarks?: number[];
    /** 每次跳转短暂高亮落点。 */
    pulse?: { row: number; key: number } | null;
    /** 当前播放头不在选中分类上。 */
    playheadDim?: boolean;
  };
}

type TimelinePoint = {
  rowIndex: number;
  startMs: number;
  endMs: number;
};

/** Focus ticks on the dial. `active` with an empty `marks` list dims the whole track. */
export type TimelineFocusChrome = {
  active: boolean;
  /** 0-based row indexes that stay bright. */
  marks?: number[];
  /** Short name of the active filter, used by the hit reading. */
  label?: string;
  pulse?: { row: number; key: number } | null;
  playheadDim?: boolean;
};

const sliderFocusClass = (active: boolean, playheadDim: boolean) =>
  `${active ? ' is-focus-dim' : ''}${playheadDim ? ' is-playhead-dim' : ''}`;

const TimelineFocusLayer: React.FC<{
  rows: { ts: string }[];
  durationMs: number;
  marks: number[];
  dimMarks?: number[];
  pulse?: { row: number; key: number } | null;
}> = ({ rows, durationMs, marks, dimMarks, pulse }) => {
  if (marks.length === 0 && !(dimMarks && dimMarks.length) && !pulse) return null;
  const leftOf = (row: number) => {
    const cue = rows[row];
    if (!cue) return null;
    return `${(parseSubtitleRange(cue.ts).startMs / durationMs) * 100}%`;
  };
  return (
    <div className="timeline-marks" aria-hidden="true">
      {(dimMarks ?? []).map((row) => {
        const left = leftOf(row);
        if (left == null) return null;
        return <span key={`dim-${row}`} className="timeline-marks__tick timeline-marks__tick--dim" style={{ left }} />;
      })}
      {marks.map((row) => {
        const left = leftOf(row);
        if (left == null) return null;
        return <span key={row} className="timeline-marks__tick" style={{ left }} />;
      })}
      {pulse && leftOf(pulse.row) != null ? (
        <span key={pulse.key} className="timeline-marks__pulse" style={{ left: leftOf(pulse.row) ?? undefined }} />
      ) : null}
    </div>
  );
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
  focusChrome,
  theaterChrome,
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
    showGuides,
    setShowGuides,
    isLightsOff,
    setLightsOff,
    selectedTaskId,
    mergeReviewCheckedByTask,
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
    showGuides: state.showGuides,
    setShowGuides: state.setShowGuides,
    isLightsOff: state.isLightsOff,
    setLightsOff: state.setLightsOff,
    selectedTaskId: state.selectedTaskId,
    mergeReviewCheckedByTask: state.mergeReviewCheckedByTask,
  })));
  const [scrubTimeMs, setScrubTimeMs] = useState<number | null>(null);
  const [measureMode, setMeasureMode] = useState<MeasureMode>('position');
  const [trackedFilter, setTrackedFilter] = useState(false);
  const ignoreJumpBlur = useRef(false);
  const [sliderTip, setSliderTip] = useState<{ x: number; y: number } | null>(null);
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

  const dialCheckedIds = mergeReviewCheckedByTask[reviewTaskKey(selectedTaskId, processedSubs)];
  const dialTicks = useMemo(
    () => (variant === 'full' ? buildDialTicks(processedSubs ?? [], dialCheckedIds ?? []) : []),
    [variant, processedSubs, dialCheckedIds],
  );
  const filterActive = Boolean(focusChrome?.active);
  if (filterActive !== trackedFilter) {
    setTrackedFilter(filterActive);
    if (!filterActive && measureMode === 'hit') setMeasureMode('position');
  }

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
  const tipPoint = findActivePoint(timelinePoints, displayTimeMs) || findNearestPoint(timelinePoints, displayTimeMs);
  const tipLine = tipPoint.rowIndex + 1;

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

  const playButton = (
    <button
      type="button"
      onClick={togglePlayback}
      className={`v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--v4-line)] text-[var(--v4-accent-strong)] transition-colors hover:bg-[var(--v4-accent-soft)] ${
        variant === 'theater' ? 'theater-chrome-chip' : 'bg-[var(--v4-panel)]'
      }`}
      aria-label={isPreviewPlaying ? '暂停预览' : '播放字幕轴'}
      title={isPreviewPlaying ? '暂停' : '播放（便于查看渐入渐出）'}
    >
      {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
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
    const lightsOff = Boolean(theaterChrome?.lightsOff);
    const showSliderTip = sliderTip !== null;
    const theaterFocusOn = theaterChrome?.marks != null;

    const updateSliderTip = (clientX: number, clientY: number) => {
      setSliderTip({ x: clientX, y: clientY });
    };

    const guidesButton = (
      <button
        type="button"
        onClick={() => setShowGuides(!showGuides)}
        aria-pressed={showGuides}
        title="显示画幅辅助线"
        aria-label="显示画幅辅助线"
        className={`theater-chrome-chip v4-focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors
          ${showGuides
            ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
            : 'border-[var(--v4-line)] text-[var(--v4-text-muted)] hover:text-[var(--v4-text)]'}`}
      >
        <SquareCenterlineDashedHorizontal className="h-4 w-4 stroke-[2]" aria-hidden="true" />
        <span className="hidden sm:inline">画幅辅助线</span>
      </button>
    );

    // 播放+进度是固定肌肉记忆单元；画幅辅助线放在整条胶囊右侧，避免插在中间。
    // 关灯不省略播放——与开灯同相对位置。
    return (
      <div
        className={`theater-chrome-bar flex w-full items-center gap-1.5 rounded-lg border border-[var(--v4-line)] px-2 py-2 sm:gap-2 sm:px-2.5 ${
          lightsOff ? 'theater-chrome-bar--lights-off' : ''
        }`}
      >
        <div className="theater-playback-unit flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          {playButton}
          <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-[var(--v4-line)] sm:block" aria-hidden="true" />
          <div
            className="relative min-w-0 flex-1 px-0.5"
            onPointerEnter={(event) => updateSliderTip(event.clientX, event.clientY)}
            onPointerMove={(event) => updateSliderTip(event.clientX, event.clientY)}
            onPointerLeave={() => {
              if (!isPointerScrubbing.current) setSliderTip(null);
            }}
          >
            <input
              type="range"
              min="0"
              max={sharedDurationMs}
              step="16"
              value={displayTimeMs}
              onChange={(event) => handleTimelineChange(event.target.value)}
              onPointerDown={(event) => {
                beginScrub(event);
                updateSliderTip(event.clientX, event.clientY);
              }}
              onPointerUp={(event) => {
                endScrub(event.currentTarget.value);
                updateSliderTip(event.clientX, event.clientY);
              }}
              onPointerCancel={() => {
                isPointerScrubbing.current = false;
                setScrubTimeMs(null);
                setSliderTip(null);
              }}
              onBlur={(event) => {
                if (scrubTimeMs !== null) endScrub(event.currentTarget.value);
              }}
              style={timelineStyle}
              className={`v9-timeline-dial-slider w-full min-w-0${sliderFocusClass(theaterFocusOn, Boolean(theaterChrome?.playheadDim))}`}
              aria-label={`字幕预览时间，第 ${tipLine} 行，${timelinePercent}%`}
              title={`第 ${tipLine} 行 · ${timelinePercent}%`}
              data-timeline-focus={theaterFocusOn ? 'true' : undefined}
              data-focus-empty={theaterFocusOn && (theaterChrome?.marks?.length ?? 0) === 0 ? 'true' : undefined}
            />
            {theaterFocusOn ? (
              <TimelineFocusLayer
                rows={processedSubs}
                durationMs={sharedDurationMs}
                marks={theaterChrome?.marks ?? []}
                dimMarks={theaterChrome?.dimMarks}
                pulse={theaterChrome?.pulse}
              />
            ) : null}
            {showSliderTip && (
              <div
                className="pointer-events-none fixed z-[var(--z-dropdown)] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-[var(--radius-md)] border border-[var(--v4-line-strong)] bg-[var(--paper-raised)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--accent-text)] shadow-[var(--pt-elev-float)]"
                style={{ left: sliderTip.x, top: sliderTip.y }}
                role="status"
              >
                行 {tipLine} · {timelinePercent}%
              </div>
            )}
          </div>
        </div>

        <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-[var(--v4-line)] sm:block" aria-hidden="true" />
        {guidesButton}
        {/* 关灯：画面级视图开关，与画幅辅助线并列（不放在选项按钮行）。 */}
        <button
          type="button"
          onClick={() => setLightsOff(!isLightsOff)}
          aria-pressed={isLightsOff}
          title="关灯（L）；Esc 或 L 退出"
          className={`theater-chrome-chip theater-lights-toggle v4-focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors
            ${isLightsOff
              ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
              : 'border-[var(--v4-line)] text-[var(--v4-text-muted)] hover:text-[var(--v4-text)]'}`}
        >
          <LampCeiling className="h-4 w-4 stroke-[2]" aria-hidden="true" />
          <span className="hidden sm:inline">{isLightsOff ? '开灯' : '关灯'}</span>
        </button>
      </div>
    );
  }

  const dialFocusOn = Boolean(focusChrome?.active);
  const dialMarks = focusChrome?.marks ?? [];
  const dialMarkSet = new Set(dialMarks);
  const shownMode = activeMeasureMode(measureMode, dialFocusOn);
  const hitPoints = dialFocusOn
    ? timelinePoints
      .filter((point) => dialMarkSet.has(point.rowIndex))
      .map((point) => ({ rowIndex: point.rowIndex, startMs: point.startMs }))
    : [];
  const ordinal = nearestHitOrdinal(hitPoints, displayTimeMs, tipPoint.rowIndex);
  const reading = formatMeasureLine({
    mode: measureMode,
    filterActive: dialFocusOn,
    row: tipLine,
    total: processedSubs.length,
    timeMs: displayTimeMs,
    durationMs: sharedDurationMs,
    hitIndex: ordinal.index,
    hitCount: ordinal.count,
    hitTimeMs: ordinal.timeMs,
  });
  const anchor = formatDialAnchor(processedSubs.length, sharedDurationMs);
  const rowsLeft = Math.max(0, processedSubs.length - tipLine);
  const remainClock = formatMsClock(Math.max(0, sharedDurationMs - displayTimeMs));
  const measureTitle = shownMode === 'remain'
    ? `剩余 ${rowsLeft} 行 · ${remainClock}。点击切换读数`
    : shownMode === 'hit'
      ? `${focusChrome?.label ?? '筛选'} ${ordinal.index} / ${ordinal.count}。点击切换读数`
      : '当前行与时码。点击切换读数';
  const cycleMeasure = () => {
    setMeasureMode((mode) => cycleMeasureMode(mode, dialFocusOn));
  };

  return (
    <div className="v9-dial-slider-container flex w-full min-w-0 flex-row items-center gap-3" data-testid="timeline-instrument">
      <div className="v9-dial-slider-wrapper flex min-w-0 flex-1 items-center gap-2.5">
        {playButton}
        <div className="wb-dial-track relative min-w-0 flex-1">
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
            className={`v9-timeline-dial-slider w-full${sliderFocusClass(dialFocusOn, Boolean(focusChrome?.playheadDim))}`}
            aria-label={`${reading}。全片 ${anchor}`}
            data-timeline-focus={dialFocusOn ? 'true' : undefined}
            data-focus-empty={dialFocusOn && dialMarks.length === 0 ? 'true' : undefined}
          />
          {dialTicks.length > 0 ? (
            <div className="wb-dial-ticks" aria-label="时间轴刻度">
              {dialTicks.map((tick) => {
                const dim = dialFocusOn && !dialMarkSet.has(tick.rowIndex);
                return (
                  <button
                    key={tick.rowIndex}
                    type="button"
                    className={`wb-dial-tick${dim ? ' is-dim' : ''}`}
                    data-kind={tick.kind}
                    data-label={tick.label}
                    style={{ left: `${(tick.startMs / sharedDurationMs) * 100}%` }}
                    title={tick.label}
                    aria-label={tick.label}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      selectRow(tick.rowIndex);
                    }}
                  />
                );
              })}
            </div>
          ) : null}
          {dialFocusOn && focusChrome?.pulse ? (
            <TimelineFocusLayer
              rows={processedSubs}
              durationMs={sharedDurationMs}
              marks={[]}
              pulse={focusChrome.pulse}
            />
          ) : null}
          <form
            onSubmit={handleJumpToLine}
            className="wb-readout"
            data-testid="playhead-labels"
            data-measure={shownMode}
            style={{ left: `clamp(5.5rem, ${timelinePercent}%, calc(100% - 8.5rem))` }}
          >
            {shownMode === 'position' ? (
              <input
                type="number"
                min="1"
                max={processedSubs.length}
                value={jumpLineVal}
                onChange={event => setJumpLineVal(event.target.value)}
                onBlur={() => {
                  if (ignoreJumpBlur.current) {
                    ignoreJumpBlur.current = false;
                    return;
                  }
                  handleJumpToLine();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="no-spin wb-readout__jump"
                aria-label="跳转到字幕行"
              />
            ) : null}
            <button
              type="button"
              className="wb-readout__cycle wb-focus-ring"
              data-testid="measure-cycle"
              aria-label={`${reading}，点击切换读数`}
              title={measureTitle}
              onPointerDown={() => { ignoreJumpBlur.current = true; }}
              onClick={cycleMeasure}
            >
              {shownMode === 'position'
                ? ` / ${processedSubs.length} · ${formatMsClock(displayTimeMs)}`
                : reading}
            </button>
          </form>
          <span className="wb-dial-anchor" data-testid="dial-anchor">{anchor}</span>
        </div>
      </div>
    </div>
  );
};
