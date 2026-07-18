'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, HardDrive, MonitorPlay, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { createSourceMatchReport, type SourceMatchFinding, type SourceMatchReport } from '@/utils/timeline/sourceMatch';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';
import { InfoHint } from '@/components/ui/InfoHint';
import { useStudioStore } from '@/store/useStudioStore';

const GRADE_META: Record<SourceMatchReport['grade'], { label: string; tone: string }> = {
  matched: { label: '跨度接近', tone: 'text-neutral-100' },
  fixable: { label: '建议抽查', tone: 'text-[#a8b7a3]' },
  complex: { label: '跨度有差异', tone: 'text-[#c0a89a]' },
  poor: { label: '差异较大', tone: 'text-[#b98982]' },
};

const severityClass: Record<SourceMatchFinding['severity'], string> = {
  ok: 'border-white/[0.07] bg-white/[0.018] text-neutral-300',
  notice: 'border-[#a8b7a3]/18 bg-[#a8b7a3]/[0.035] text-[#d7ded2]',
  warning: 'border-[#c0a89a]/22 bg-[#c0a89a]/[0.04] text-[#eaded4]',
  severe: 'border-[#9f6f68]/28 bg-[#9f6f68]/[0.055] text-[#efcfca]',
};

const getChartPath = (values: number[], width: number, height: number, offset = 0) => {
  if (values.length === 0) return '';
  const step = width / Math.max(1, values.length - 1);
  return values.map((value, index) => {
    const x = index * step;
    const y = height - 10 - value * (height - 22) + offset;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
};

const buildAreaPath = (linePath: string, width: number, height: number) => {
  if (!linePath) return '';
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
};

const FindingIcon = ({ severity }: { severity: SourceMatchFinding['severity'] }) => {
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 text-[#8fa3d1]" />;
  if (severity === 'severe') return <XCircle className="h-4 w-4 text-[#b98982]" />;
  return <AlertTriangle className={`h-4 w-4 ${severity === 'warning' ? 'text-[#c0a89a]' : 'text-[#8fa3d1]'}`} />;
};

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

interface SourceMatchPanelProps {
  rows: SubRow[];
  onTimelineDurationChange?: (durationMs: number | undefined) => void;
}

export const SourceMatchPanel: React.FC<SourceMatchPanelProps> = ({
  rows,
  onTimelineDurationChange,
}) => {
  const previewIndex = useStudioStore(state => state.previewIndex);
  const setPreviewIndex = useStudioStore(state => state.setPreviewIndex);
  const setJumpLineVal = useStudioStore(state => state.setJumpLineVal);
  const showAllSubs = useStudioStore(state => state.showAllSubs);
  const setShowAllSubs = useStudioStore(state => state.setShowAllSubs);
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoName, setVideoName] = useState('');
  const [videoDurationMs, setVideoDurationMs] = useState<number | undefined>(undefined);
  const [metadataError, setMetadataError] = useState('');

  const report = useMemo(
    () => createSourceMatchReport(rows, videoDurationMs),
    [rows, videoDurationMs]
  );

  const chartWidth = 620;
  const chartHeight = 142;
  const subtitlePath = getChartPath(report.activityCurve, chartWidth, chartHeight);
  const subtitleArea = buildAreaPath(subtitlePath, chartWidth, chartHeight);
  const timelineDurationMs = Math.max(report.videoDurationMs || 0, report.subtitleEndMs, 1);
  const coverageStart = Math.max(0, Math.min(1, report.subtitleStartMs / timelineDurationMs));
  const coverageEnd = Math.max(0, Math.min(1, report.subtitleEndMs / timelineDurationMs));
  const videoEnd = report.videoDurationMs
    ? Math.max(0, Math.min(1, report.videoDurationMs / timelineDurationMs))
    : undefined;
  const activeRow = rows[Math.max(0, Math.min(previewIndex, rows.length - 1))];
  const activeTimeMs = activeRow ? parseSubtitleRange(activeRow.ts).startMs : 0;
  const activePosition = Math.max(0, Math.min(1, activeTimeMs / timelineDurationMs));
  const activeX = activePosition * chartWidth;
  const meta = GRADE_META[report.grade];
  const isMatchMode = report.mode === 'match';
  const timelinePoints = useMemo(() => rows
    .map((row, arrayIndex) => ({
      arrayIndex,
      rowIndex: row.index,
      startMs: parseSubtitleRange(row.ts).startMs,
    }))
    .sort((left, right) => left.startMs - right.startMs), [rows]);

  const selectTimelineTime = (targetMs: number) => {
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
      setMetadataError('无法读取该片源时长，请尝试常见 MP4 / MKV / MOV 文件。');
      onTimelineDurationChange?.(undefined);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  return (
    <section className="w-full overflow-hidden rounded-lg border border-[var(--v4-line)] bg-[var(--v4-panel)]">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-0">
        <div className="border-b xl:border-b-0 xl:border-r border-white/[0.055] px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-normal text-neutral-100">
                <Activity className="h-4 w-4 text-[#8fa3d1]" />
                {isMatchMode ? '片源时长参照' : '字幕概览'}
              </div>
              <p className="mt-1 max-w-[28ch] text-xs leading-5 text-neutral-400">
                {isMatchMode ? '已读取片源时长，用于检查字幕覆盖范围。' : '先确认字幕规模与分布，再加入本地片源检查时长覆盖。'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#8fa3d1]/20 bg-[#8fa3d1]/[0.045] px-3.5 py-2.5 text-xs font-medium text-[#dce2ef] transition hover:border-[#8fa3d1]/38 hover:bg-[#8fa3d1]/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fa3d1]/70 active:translate-y-px cursor-pointer"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              {isMatchMode ? '更换片源' : '加入片源'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="video/*,.mkv"
              className="hidden"
              onChange={(event) => handleVideoFile(event.target.files?.[0])}
            />
          </div>

          {isMatchMode ? (
            <div className="mt-5 flex items-end justify-between gap-4 border-y border-white/[0.055] py-4">
              <div>
                <motion.div
                  key={report.coverageRatio}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-[2rem] leading-none font-semibold ${meta.tone}`}
                >
                  {report.coverageRatio ? `${Math.round(report.coverageRatio * 100)}%` : '--'}
                </motion.div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.12em] text-neutral-500">
                  字幕跨度占比
                  <InfoHint label="时间覆盖说明">
                    这里只比较字幕起止范围与片源总时长，不读取音频，也不代表对白已经合轴。
                  </InfoHint>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${meta.tone}`}>{meta.label}</div>
                <div className="mt-1 text-xs text-neutral-500">依据：时长与字幕时间轴</div>
              </div>
            </div>
          ) : (
            <dl className="mt-5 grid grid-cols-3 gap-0 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.016]">
              <div className="min-w-0 px-3 py-3">
                <dt className="whitespace-nowrap text-xs text-neutral-500">文本量</dt>
                <dd className="mt-1.5 whitespace-nowrap text-lg leading-none font-semibold tabular-nums text-neutral-100">{formatCount(report.stats.characterCount)}</dd>
              </div>
              <div className="min-w-0 border-l border-white/[0.055] px-3 py-3">
                <dt className="whitespace-nowrap text-xs text-neutral-500">时间跨度</dt>
                <dd className="mt-1.5 whitespace-nowrap text-lg leading-none font-semibold tabular-nums text-neutral-100">{formatMsClock(report.stats.spanMs)}</dd>
              </div>
              <div className="min-w-0 border-l border-white/[0.055] px-3 py-3">
                <dt className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-neutral-500">
                  字幕密度
                  <InfoHint label="字幕密度说明">
                    每分钟字幕行数，用于观察字幕分布是否异常。声音说明、歌词和画面文字也会影响这个指标。
                  </InfoHint>
                </dt>
                <dd className="mt-1.5 whitespace-nowrap text-lg leading-none font-semibold tabular-nums text-[#8fa3d1]">{report.stats.densityPerMinute}</dd>
              </div>
            </dl>
          )}

          <div className="mt-4">
            <div className="text-sm font-semibold tracking-normal text-neutral-100">{report.title}</div>
            <p className="mt-1.5 max-w-[36ch] text-xs leading-5 text-neutral-400">{report.summary}</p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
            <HardDrive className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            <span className="min-w-0 truncate">
              {videoName ? `${videoName}${videoDurationMs ? ` · ${formatMsClock(videoDurationMs)}` : ''}` : '本地读取元数据，不上传文件'}
            </span>
          </div>
          {metadataError && <div className="mt-2 text-xs text-[#c0a89a]">{metadataError}</div>}
        </div>

        <div className="px-5 py-4 md:px-6 md:py-5 min-w-0">
          <figure className="overflow-visible">
            <figcaption className="flex items-start justify-between gap-3 pb-2 text-xs text-neutral-500">
              <div>
                <div className="text-xs font-medium text-neutral-300 inline-flex items-center gap-1.5">
                  {isMatchMode ? '统一时间轴上的字幕分布' : '字幕时间分布'}
                  <InfoHint label="字幕分布图说明">
                    曲线、跨度条和下方时间线共用同一时间刻度。加入片源后，较长的一方决定横轴终点，避免隐藏字幕越界。
                  </InfoHint>
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">{report.stats.distributionLabel} · {formatCount(report.stats.lineCount)} 行</div>
              </div>
              <span className="shrink-0 tabular-nums">{report.stats.densityPerMinute} 行/分钟</span>
            </figcaption>
            <div className="px-4">
              <div className="relative">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={isMatchMode ? '片源覆盖与字幕活动图' : '字幕时间分布图'} className="h-[142px] w-full overflow-visible">
                  <defs>
                    <linearGradient id="subtitleArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#8fa3d1" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#8fa3d1" stopOpacity="0.015" />
                    </linearGradient>
                  </defs>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <line
                      key={index}
                      x1={(chartWidth / 6) * index}
                      x2={(chartWidth / 6) * index}
                      y1="12"
                      y2={chartHeight - 8}
                      stroke="rgba(143, 163, 209,0.07)"
                      strokeWidth="1"
                    />
                  ))}
                  <path d={subtitleArea} fill="url(#subtitleArea)" />
                  <motion.path
                    d={subtitlePath}
                    fill="none"
                    stroke="#8fa3d1"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.05, ease: 'easeOut', delay: 0.08 }}
                  />
                  {videoEnd !== undefined && videoEnd < 0.999 && (
                    <line
                      x1={videoEnd * chartWidth}
                      x2={videoEnd * chartWidth}
                      y1="12"
                      y2={chartHeight - 8}
                      stroke="rgba(192, 168, 154, 0.72)"
                      strokeWidth="1.5"
                      strokeDasharray="4 5"
                    />
                  )}
                  <motion.line
                    x1={activeX}
                    x2={activeX}
                    y1="8"
                    y2={chartHeight - 4}
                    stroke="rgba(225, 231, 245, 0.56)"
                    strokeWidth="1"
                    animate={{ x1: activeX, x2: activeX }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  />
                  <motion.circle
                    cy={chartHeight - 7}
                    r="4"
                    fill="#dce2ef"
                    stroke="#0a0b0f"
                    strokeWidth="2"
                    animate={{ cx: activeX }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  />
                </svg>
                <input
                  type="range"
                  min="0"
                  max={timelineDurationMs}
                  step="100"
                  value={activeTimeMs}
                  onChange={event => selectTimelineTime(Number(event.target.value))}
                  className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                  aria-label="在字幕分布图中定位时间"
                />
              </div>

              <div className="mt-1 grid grid-cols-3 font-mono text-[11px] tabular-nums text-neutral-600">
                <span>00:00</span>
                <span className="text-center">{formatMsClock(timelineDurationMs / 2)}</span>
                <span className="text-right">{formatMsClock(timelineDurationMs)}</span>
              </div>

              <div className="mt-3 border-t border-white/[0.05] pt-3">
                <div className="mb-2.5 flex items-center justify-between gap-3 text-xs text-neutral-500">
                  <span>{isMatchMode ? '片源与字幕跨度' : '字幕跨度'}</span>
                  <span className="tabular-nums">
                    当前 {formatMsClock(activeTimeMs)} · 字幕 {formatMsClock(report.subtitleStartMs)} - {formatMsClock(report.subtitleEndMs)}
                  </span>
                </div>
                <div className="relative py-1.5">
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.045]">
                    {videoEnd !== undefined && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/[0.09]"
                        style={{ width: `${videoEnd * 100}%` }}
                      />
                    )}
                    <motion.div
                      className="absolute inset-y-0 rounded-full bg-[#8fa3d1]/78"
                      initial={{ left: `${coverageStart * 100}%`, right: `${100 - coverageStart * 100}%` }}
                      animate={{ left: `${coverageStart * 100}%`, right: `${100 - coverageEnd * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  {videoEnd !== undefined && videoEnd < 0.999 && (
                    <span
                      className="absolute top-0 h-5 w-px bg-[#c0a89a]/80"
                      style={{ left: `${videoEnd * 100}%` }}
                      title={`片源结束于 ${formatMsClock(report.videoDurationMs || 0)}`}
                    />
                  )}
                  <motion.span
                    className="absolute top-0 h-5 w-px bg-[#dce2ef] shadow-[0_0_8px_rgba(220,226,239,0.45)]"
                    animate={{ left: `${activePosition * 100}%` }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </figure>

          {isMatchMode ? (
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {report.findings.slice(0, 3).map(finding => (
                <div key={finding.id} className={`rounded-lg border p-3 ${severityClass[finding.severity]}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FindingIcon severity={finding.severity} />
                    {finding.label}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-current/75">
                    {finding.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              这张图只描述字幕自身的时间分布。加入片源后也只检查时长覆盖，不会分析声音。
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
