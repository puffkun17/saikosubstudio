'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HardDrive, MonitorPlay, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { isLyricText, isSubtitleCreditText } from '@/utils/subtitleCore';
import { createSourceMatchReport, type SourceMatchFinding, type SourceMatchReport } from '@/utils/timeline/sourceMatch';
import { analyzeAlignmentDiff } from '@/utils/timeline/alignmentDiff';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';
import { InfoHint } from '@/components/ui/InfoHint';
import { useStudioStore } from '@/store/useStudioStore';
import {
  InspectionMarkGlyph,
  MARK_COLOR,
  MARK_KIND_ORDER,
  MARK_LABEL,
  MARK_LANE_TOP,
  type InspectionMarkFilter,
  type InspectionMarkKind,
} from '@/components/Workbench/inspectionMarks';

export type { InspectionMarkFilter, InspectionMarkKind };

export type InspectionMark = {
  position: number;
  kind: InspectionMarkKind;
  arrayIndex: number;
  rowIndex: number;
};

type MarkCluster = {
  id: string;
  position: number;
  kind: InspectionMarkKind;
  marks: InspectionMark[];
};

const clusterMarks = (marks: InspectionMark[], threshold = 0.01): MarkCluster[] => {
  const sorted = [...marks].sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position);
  const clusters: MarkCluster[] = [];
  for (const mark of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.kind === mark.kind && Math.abs(last.position - mark.position) <= threshold) {
      last.marks.push(mark);
      last.position = last.marks.reduce((sum, item) => sum + item.position, 0) / last.marks.length;
    } else {
      clusters.push({
        id: `${mark.kind}-${mark.rowIndex}-${mark.position.toFixed(4)}`,
        position: mark.position,
        kind: mark.kind,
        marks: [mark],
      });
    }
  }
  return clusters.sort((a, b) => a.position - b.position);
};

const GRADE_META: Record<SourceMatchReport['grade'], { label: string; tone: string }> = {
  matched: { label: '跨度接近', tone: 'text-[var(--v4-text)]' },
  fixable: { label: '建议抽查', tone: 'text-[var(--v4-text-muted)]' },
  complex: { label: '跨度有差异', tone: 'text-[var(--v4-warning)]' },
  poor: { label: '差异较大', tone: 'text-[var(--v4-danger)]' },
};

const severityClass: Record<SourceMatchFinding['severity'], string> = {
  ok: 'border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]',
  notice: 'border-[var(--v4-line-strong)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]',
  warning: 'border-[var(--v4-warning)]/25 bg-[var(--v4-warning)]/10 text-[var(--v4-warning)]',
  severe: 'border-[var(--v4-danger)]/28 bg-[var(--v4-danger)]/10 text-[var(--v4-danger)]',
};

const getChartPath = (values: number[], width: number, height: number, offset = 0) => {
  if (values.length === 0) return '';
  const binCount = values.length;
  return values.map((value, index) => {
    const x = ((index + 0.5) / binCount) * width;
    const y = height - 10 - value * (height - 22) + offset;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
};

const buildAreaPath = (linePath: string, width: number, height: number) => {
  if (!linePath) return '';
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
};

const FindingIcon = ({ severity }: { severity: SourceMatchFinding['severity'] }) => {
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 text-[var(--v4-accent-strong)]" />;
  if (severity === 'severe') return <XCircle className="h-4 w-4 text-[var(--v4-danger)]" />;
  return <AlertTriangle className={`h-4 w-4 ${severity === 'warning' ? 'text-[var(--v4-warning)]' : 'text-[var(--v4-accent-strong)]'}`} />;
};

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

const isLyricsInspectionRow = (row: SubRow) => (
  row.type === 'lyrics'
  || row.cueKind === 'lyrics'
  || isLyricText(row.text)
);

const isCreditInspectionRow = (row: SubRow) => (
  row.type === 'credit'
  || row.cueKind === 'credit'
  || isSubtitleCreditText(row.text)
);

export function buildInspectionMarks(rows: SubRow[], basisDurationMs: number): InspectionMark[] {
  const marks: InspectionMark[] = [];
  const seen = new Set<string>();
  const push = (kind: InspectionMarkKind, arrayIndex: number, rowIndex: number, startMs: number) => {
    const position = Math.min(1, Math.max(0, startMs / Math.max(basisDurationMs, 1)));
    const key = `${kind}:${Math.round(position * 200)}:${rowIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    marks.push({ position, kind, arrayIndex, rowIndex });
  };

  rows.forEach((row, arrayIndex) => {
    const startMs = parseSubtitleRange(row.ts).startMs;
    if (isCreditInspectionRow(row)) {
      push('credit', arrayIndex, row.index, startMs);
      return;
    }
    if (isLyricsInspectionRow(row)) {
      push('lyrics', arrayIndex, row.index, startMs);
      return;
    }
    if (row.cueKind === 'sound_caption' || row.auxiliary?.category === 'ambient_sdh' || row.auxiliary?.category === 'music') {
      push('sound', arrayIndex, row.index, startMs);
    } else if (row.cueKind === 'screen_text' || row.auxiliary?.category === 'screen_text') {
      push('screen', arrayIndex, row.index, startMs);
    }
  });

  const alignment = analyzeAlignmentDiff(rows);
  for (const entry of alignment.entries) {
    const rowIndex = entry.rowIndexes[0];
    const arrayIndex = Math.max(0, rowIndex - 1);
    push('structure', arrayIndex, rowIndex, entry.startMs);
  }

  return marks.sort((a, b) => a.position - b.position);
}

interface SourceMatchPanelProps {
  rows: SubRow[];
  onTimelineDurationChange?: (durationMs: number | undefined) => void;
  markFilter?: InspectionMarkFilter;
}

export const SourceMatchPanel: React.FC<SourceMatchPanelProps> = ({
  rows,
  onTimelineDurationChange,
  markFilter = 'all',
}) => {
  const previewIndex = useStudioStore(state => state.previewIndex);
  const setPreviewIndex = useStudioStore(state => state.setPreviewIndex);
  const setJumpLineVal = useStudioStore(state => state.setJumpLineVal);
  const showAllSubs = useStudioStore(state => state.showAllSubs);
  const setShowAllSubs = useStudioStore(state => state.setShowAllSubs);
  const inputRef = useRef<HTMLInputElement>(null);
  const densityScrubRef = useRef<HTMLDivElement>(null);
  const [videoName, setVideoName] = useState('');
  const [videoDurationMs, setVideoDurationMs] = useState<number | undefined>(undefined);
  const [metadataError, setMetadataError] = useState('');

  const report = useMemo(
    () => createSourceMatchReport(rows, videoDurationMs),
    [rows, videoDurationMs]
  );

  const timelineDurationMs = Math.max(report.videoDurationMs || 0, report.subtitleEndMs, 1);
  const coverageStart = Math.max(0, Math.min(1, report.subtitleStartMs / timelineDurationMs));
  const coverageEnd = Math.max(0, Math.min(1, report.subtitleEndMs / timelineDurationMs));
  const videoEnd = report.videoDurationMs
    ? Math.max(0, Math.min(1, report.videoDurationMs / timelineDurationMs))
    : undefined;
  const activeRow = rows[Math.max(0, Math.min(previewIndex, rows.length - 1))];
  const activeTimeMs = activeRow ? parseSubtitleRange(activeRow.ts).startMs : 0;
  const activePosition = Math.max(0, Math.min(1, activeTimeMs / timelineDurationMs));
  const meta = GRADE_META[report.grade];
  const isMatchMode = report.mode === 'match';

  const chartWidth = 640;
  const chartHeight = 72;
  const subtitlePath = getChartPath(report.activityCurve, chartWidth, chartHeight, 0);
  const subtitleArea = buildAreaPath(subtitlePath, chartWidth, chartHeight);

  const inspectionMarks = useMemo(
    () => buildInspectionMarks(rows, timelineDurationMs),
    [rows, timelineDurationMs],
  );

  const visibleMarks = useMemo(() => {
    if (markFilter === 'all') return inspectionMarks;
    if (markFilter === 'structure') return inspectionMarks.filter(m => m.kind === 'structure');
    if (markFilter === 'screen-text') return inspectionMarks.filter(m => m.kind === 'screen');
    if (markFilter === 'sound-caption') return inspectionMarks.filter(m => m.kind === 'sound');
    if (markFilter === 'lyrics') return inspectionMarks.filter(m => m.kind === 'lyrics');
    return inspectionMarks.filter(m => m.kind === 'credit');
  }, [inspectionMarks, markFilter]);

  const visibleClusters = useMemo(() => clusterMarks(visibleMarks), [visibleMarks]);
  const dimClusters = useMemo(() => {
    if (markFilter === 'all') return [] as MarkCluster[];
    const visibleKeys = new Set(visibleMarks.map(m => `${m.kind}:${m.rowIndex}`));
    const hidden = inspectionMarks.filter(m => !visibleKeys.has(`${m.kind}:${m.rowIndex}`));
    return clusterMarks(hidden);
  }, [inspectionMarks, markFilter, visibleMarks]);

  const timelinePoints = useMemo(() => rows
    .map((row, arrayIndex) => ({
      arrayIndex,
      rowIndex: row.index,
      startMs: parseSubtitleRange(row.ts).startMs,
    }))
    .sort((left, right) => left.startMs - right.startMs), [rows]);

  const selectTimelineTime = useCallback((targetMs: number) => {
    if (timelinePoints.length === 0) return;
    let low = 0;
    let high = timelinePoints.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (timelinePoints[middle].startMs < targetMs) low = middle + 1;
      else high = middle;
    }
    const next = timelinePoints[low];
    const previous = timelinePoints[Math.max(0, low - 1)];
    const nearest = Math.abs(next.startMs - targetMs) < Math.abs(previous.startMs - targetMs)
      ? next
      : previous;
    setPreviewIndex(nearest.arrayIndex);
    setJumpLineVal(String(nearest.rowIndex));
    if (nearest.arrayIndex >= 100 && !showAllSubs) setShowAllSubs(true);
  }, [setJumpLineVal, setPreviewIndex, setShowAllSubs, showAllSubs, timelinePoints]);

  const scrubDensityFromClientX = useCallback((clientX: number) => {
    const el = densityScrubRef.current;
    if (!el || timelineDurationMs <= 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    selectTimelineTime(ratio * timelineDurationMs);
  }, [selectTimelineTime, timelineDurationMs]);

  const onDensityPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubDensityFromClientX(event.clientX);
  }, [scrubDensityFromClientX]);

  const onDensityPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    scrubDensityFromClientX(event.clientX);
  }, [scrubDensityFromClientX]);

  const jumpToMark = (mark: InspectionMark) => {
    setPreviewIndex(mark.arrayIndex);
    setJumpLineVal(String(mark.rowIndex));
    if (mark.arrayIndex >= 100 && !showAllSubs) setShowAllSubs(true);
  };

  const handleVideoFile = (file: File | undefined) => {
    if (!file) return;
    setMetadataError('');
    setVideoName(file.name);
    setVideoDurationMs(undefined);
    onTimelineDurationChange?.(undefined);

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined;
      setVideoDurationMs(durationMs);
      onTimelineDurationChange?.(durationMs);
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      setMetadataError('无法读取该文件，请尝试常见 MP4 / MKV / MOV 等支持的视频文件。');
      onTimelineDurationChange?.(undefined);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  return (
    <section className="v4-panel w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 md:px-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--v4-text)]">
            {isMatchMode ? '片源覆盖分布' : '字幕时间分布'}
            <InfoHint label="字幕分布图说明">
              上方曲线表示字幕疏密；下方标记轨表示分类（结构差异、画面文字、声音描述、歌词、署名信息），点击可定位到对应行。
            </InfoHint>
          </div>
          <div className="mt-0.5 text-xs text-[var(--v4-text-faint)]">
            {report.stats.distributionLabel} · {formatCount(report.stats.lineCount)} 行
            {isMatchMode ? ` · ${meta.label}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-[11px] text-[var(--v4-text-faint)] sm:flex">
            {MARK_KIND_ORDER.map((kind) => (
              <span key={kind} className="inline-flex items-center gap-1.5">
                <InspectionMarkGlyph kind={kind} size={8} />
                {MARK_LABEL[kind]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ui-action ui-action--secondary shrink-0"
          >
            <MonitorPlay className="h-4 w-4" />
            {isMatchMode ? '更换视频文件' : '视频文件对比'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mkv"
            className="hidden"
            onChange={(event) => handleVideoFile(event.target.files?.[0])}
          />
        </div>
      </div>

      <div className="px-4 pb-3 pt-2 md:px-5 md:pb-4">
        <div className="relative overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--v4-panel-muted)_70%,transparent)] ring-1 ring-[var(--v4-line)]">
          {/* Density curve — marks live in HTML lane below to avoid SVG stretch */}
          <div
            ref={densityScrubRef}
            className="relative cursor-ew-resize px-3 pt-3"
            onPointerDown={onDensityPointerDown}
            onPointerMove={onDensityPointerMove}
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="字幕密度曲线"
              className="pointer-events-none h-14 w-full"
            >
              <defs>
                <linearGradient id="densityFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#c4893a" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#c4893a" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map(tick => (
                <line
                  key={tick}
                  x1={tick * chartWidth}
                  x2={tick * chartWidth}
                  y1="0"
                  y2={chartHeight}
                  stroke="var(--v4-line)"
                  strokeOpacity="0.55"
                />
              ))}
              <rect
                x={coverageStart * chartWidth}
                y="0"
                width={Math.max(1, (coverageEnd - coverageStart) * chartWidth)}
                height={chartHeight}
                fill="var(--v4-accent)"
                opacity="0.05"
              />
              <path d={subtitleArea} fill="url(#densityFill)" />
              <motion.path
                d={subtitlePath}
                fill="none"
                stroke="#c4893a"
                strokeOpacity="0.55"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              />
              {videoEnd !== undefined && videoEnd < 0.999 && (
                <line
                  x1={videoEnd * chartWidth}
                  x2={videoEnd * chartWidth}
                  y1="4"
                  y2={chartHeight - 2}
                  stroke="var(--v4-warning)"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* 键盘/读屏仍可用；pointer-events-none 退出鼠标命中，避免 ↔/箭头闪烁 */}
            <input
              type="range"
              min="0"
              max={timelineDurationMs}
              step="100"
              value={activeTimeMs}
              onChange={event => selectTimelineTime(Number(event.target.value))}
              className="pointer-events-none absolute inset-0 z-10 h-full w-full opacity-0"
              aria-label="在字幕分布图中定位时间"
            />
          </div>

          {/* Five-lane mark rail — 容器统一光标，避免空白/标记来回切 */}
          <div className="relative mx-3 mb-1.5 h-11 cursor-ew-resize">
            <div className="pointer-events-none absolute inset-x-0 top-[4px] h-px bg-[var(--v4-line)]/70" />
            <div className="pointer-events-none absolute inset-x-0 top-[12px] h-px bg-[var(--v4-line)]/70" />
            <div className="pointer-events-none absolute inset-x-0 top-[20px] h-px bg-[var(--v4-line)]/70" />
            <div className="pointer-events-none absolute inset-x-0 top-[28px] h-px bg-[var(--v4-line)]/70" />
            <div className="pointer-events-none absolute inset-x-0 top-[36px] h-px bg-[var(--v4-line)]/70" />

            {dimClusters.map(cluster => (
              <span
                key={`dim-${cluster.id}`}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{
                  left: `${cluster.position * 100}%`,
                  top: MARK_LANE_TOP[cluster.kind],
                }}
              >
                <InspectionMarkGlyph kind={cluster.kind} size={6} muted />
              </span>
            ))}

            {visibleClusters.map(cluster => {
              const primary = cluster.marks[0];
              const count = cluster.marks.length;
              return (
                <button
                  key={cluster.id}
                  type="button"
                  className="group absolute z-20 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--v4-accent)]"
                  style={{
                    left: `${cluster.position * 100}%`,
                    top: MARK_LANE_TOP[cluster.kind],
                  }}
                  title={
                    count > 1
                      ? `${MARK_LABEL[cluster.kind]} ×${count}（点击定位首条 · 第 ${primary.rowIndex} 行）`
                      : `${MARK_LABEL[cluster.kind]} · 第 ${primary.rowIndex} 行`
                  }
                  aria-label={`${MARK_LABEL[cluster.kind]}，第 ${primary.rowIndex} 行`}
                  onClick={(event) => {
                    event.stopPropagation();
                    jumpToMark(primary);
                  }}
                >
                  <span className="flex items-center justify-center transition-transform group-hover:scale-125">
                    <InspectionMarkGlyph kind={cluster.kind} size={8} />
                  </span>
                  {count > 1 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 min-w-3 rounded-md px-0.5 text-center text-[9px] font-semibold leading-3 text-white"
                      style={{ background: MARK_COLOR[cluster.kind] }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Continuous playhead across density + marks */}
          <div className="pointer-events-none absolute inset-x-3 top-3 bottom-7 z-[15]">
            <motion.div
              className="absolute top-0 bottom-0 w-px bg-[var(--v4-accent-strong)]"
              style={{ opacity: 0.75 }}
              animate={{ left: `${activePosition * 100}%` }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--v4-accent-strong)]" />
            </motion.div>
          </div>

          <div className="flex items-center justify-between px-3 pb-2 font-mono text-[10px] tabular-nums text-[var(--v4-text-faint)]">
            <span>00:00</span>
            <span>{formatMsClock(timelineDurationMs / 2)}</span>
            <span>{formatMsClock(timelineDurationMs)}</span>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--v4-text-faint)]">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <HardDrive className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {videoName
                ? `${videoName}${videoDurationMs ? ` · ${formatMsClock(videoDurationMs)}` : ''}`
                : '仅用于查询元数据信息，不关联任何用户'}
            </span>
          </span>
          <span className="tabular-nums">
            当前 {formatMsClock(activeTimeMs)}
            <span className="mx-1.5 text-[var(--v4-line-strong)]">·</span>
            字幕 {formatMsClock(report.subtitleStartMs)}–{formatMsClock(report.subtitleEndMs)}
          </span>
        </div>
        {metadataError && <div className="mt-1 text-xs text-[var(--v4-warning)]">{metadataError}</div>}

        {isMatchMode ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
            {report.findings.slice(0, 3).map(finding => (
              <div key={finding.id} className={`rounded-lg border p-2.5 ${severityClass[finding.severity]}`}>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <FindingIcon severity={finding.severity} />
                  {finding.label}
                </div>
                <p className="mt-1 text-xs leading-5 text-current/75">{finding.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};
