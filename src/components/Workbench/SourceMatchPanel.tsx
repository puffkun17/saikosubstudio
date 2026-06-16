'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileVideo, Upload, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { createSourceMatchReport, type SourceMatchFinding, type SourceMatchReport } from '@/utils/timeline/sourceMatch';
import { formatMsClock } from '@/utils/timeline/timecode';

const GRADE_META: Record<SourceMatchReport['grade'], { label: string; tone: string; action: string }> = {
  matched: { label: '匹配良好', tone: 'text-neutral-100', action: '继续制作字幕' },
  fixable: { label: '可继续制作', tone: 'text-[#a8b7a3]', action: '进入预览校准' },
  complex: { label: '存在版本风险', tone: 'text-[#c0a89a]', action: '查看风险时间线' },
  poor: { label: '不建议处理', tone: 'text-[#b98982]', action: '更换字幕' },
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
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 text-[#a8b7a3]" />;
  if (severity === 'severe') return <XCircle className="h-4 w-4 text-[#b98982]" />;
  return <AlertTriangle className={`h-4 w-4 ${severity === 'warning' ? 'text-[#c0a89a]' : 'text-[#a8b7a3]'}`} />;
};

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

export const SourceMatchPanel: React.FC<{ rows: SubRow[] }> = ({ rows }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoName, setVideoName] = useState('');
  const [videoDurationMs, setVideoDurationMs] = useState<number | undefined>(undefined);
  const [metadataError, setMetadataError] = useState('');

  const report = useMemo(
    () => createSourceMatchReport(rows, videoDurationMs),
    [rows, videoDurationMs]
  );

  const chartWidth = 620;
  const chartHeight = 172;
  const sourceCurve = report.activityCurve.map((value, index, arr) => {
    const prev = arr[index - 1] ?? value;
    const next = arr[index + 1] ?? value;
    return Math.max(0.08, (prev + value + next) / 3 * 0.64 + 0.18);
  });
  const subtitlePath = getChartPath(report.activityCurve, chartWidth, chartHeight);
  const sourcePath = getChartPath(sourceCurve, chartWidth, chartHeight, -10);
  const subtitleArea = buildAreaPath(subtitlePath, chartWidth, chartHeight);
  const sourceArea = buildAreaPath(sourcePath, chartWidth, chartHeight);
  const coverageStart = report.videoDurationMs ? Math.max(0, Math.min(1, report.subtitleStartMs / report.videoDurationMs)) : 0;
  const coverageEnd = report.videoDurationMs ? Math.max(0, Math.min(1, report.subtitleEndMs / report.videoDurationMs)) : 1;
  const meta = GRADE_META[report.grade];
  const isMatchMode = report.mode === 'match';

  const handleVideoFile = (file: File | undefined) => {
    if (!file) return;
    setMetadataError('');
    setVideoName(file.name);
    setVideoDurationMs(undefined);

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDurationMs(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined);
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      setMetadataError('无法读取该片源时长，请尝试常见 MP4 / MKV / MOV 文件。');
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  return (
    <section className="w-full rounded-xl border border-white/[0.075] bg-[#080807]/72 shadow-[0_20px_70px_rgba(0,0,0,0.28)] overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border-b xl:border-b-0 xl:border-r border-white/[0.06] p-5 md:p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                <Activity className="h-4 w-4 text-[#a8b7a3]" />
                {isMatchMode ? '片源匹配体检' : '字幕档案'}
              </div>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                {isMatchMode ? '本地读取片源时长，生成结构匹配报告。' : '先看字幕自身质量，选择片源后再判断匹配度。'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              选择片源
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <motion.div
                  key={report.score}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-5xl font-semibold tracking-tight ${meta.tone}`}
                >
                  {report.score}
                </motion.div>
                <div className="mt-1 text-xs font-mono text-neutral-500">MATCH SCORE</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${meta.tone}`}>{meta.label}</div>
                <div className="mt-1 text-xs text-neutral-500">可信度 {report.confidence}%</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                <div className="text-[11px] text-neutral-500">字数</div>
                <div className="mt-2 text-xl font-semibold text-neutral-100">{formatCount(report.stats.characterCount)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                <div className="text-[11px] text-neutral-500">跨度</div>
                <div className="mt-2 text-xl font-semibold text-neutral-100">{formatMsClock(report.stats.spanMs)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                <div className="text-[11px] text-neutral-500">分布</div>
                <div className="mt-2 text-base font-semibold text-[#a8b7a3]">{report.stats.distributionLabel}</div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4">
            <div className="text-base font-semibold text-neutral-100">{report.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{report.summary}</p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="text-xs text-neutral-500">{isMatchMode ? '建议操作' : '下一步'}</div>
            <div className="mt-1 text-sm font-semibold text-neutral-100">
              {isMatchMode ? meta.action : '选择本地片源，生成匹配体检'}
            </div>
          </div>

          <div className="min-h-6 text-xs text-neutral-500 flex items-center gap-2">
            <FileVideo className="h-3.5 w-3.5 text-neutral-500" />
            <span className="truncate">
              {videoName ? `${videoName}${videoDurationMs ? ` · ${formatMsClock(videoDurationMs)}` : ''}` : '未选择片源时，仅显示字幕档案数据'}
            </span>
          </div>
          {metadataError && <div className="text-xs text-[#c0a89a]">{metadataError}</div>}
        </div>

        <div className="p-5 md:p-6 flex flex-col gap-5 min-w-0">
          <figure className="rounded-xl border border-white/[0.055] bg-black/22 p-4 overflow-hidden">
            <figcaption className="flex items-center justify-between gap-3 pb-3 text-xs text-neutral-500">
              <span>{isMatchMode ? '片源覆盖 / 字幕活动谱' : '字幕时间分布图'}</span>
              <span>{formatCount(report.stats.lineCount)} 行 · {report.stats.densityPerMinute}/分钟</span>
            </figcaption>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="片源与字幕活动谱图" className="w-full h-[172px] overflow-visible">
              <defs>
                <linearGradient id="sourceArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f5f5f4" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#f5f5f4" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="subtitleArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#a8b7a3" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#a8b7a3" stopOpacity="0.015" />
                </linearGradient>
              </defs>
              {Array.from({ length: 7 }).map((_, index) => (
                <line
                  key={index}
                  x1={(chartWidth / 6) * index}
                  x2={(chartWidth / 6) * index}
                  y1="12"
                  y2={chartHeight - 8}
                  stroke="rgba(255,255,255,0.045)"
                  strokeWidth="1"
                />
              ))}
              {isMatchMode && <path d={sourceArea} fill="url(#sourceArea)" />}
              <path d={subtitleArea} fill="url(#subtitleArea)" />
              {isMatchMode && (
                <motion.path
                  d={sourcePath}
                  fill="none"
                  stroke="rgba(245,245,244,0.68)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              )}
              <motion.path
                d={subtitlePath}
                fill="none"
                stroke="#a8b7a3"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.05, ease: 'easeOut', delay: 0.08 }}
              />
            </svg>
          </figure>

          <div className="rounded-xl border border-white/[0.055] bg-white/[0.012] p-4">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
              <span>{isMatchMode ? '覆盖范围' : '字幕跨度'}</span>
              <span>
                字幕 {formatMsClock(report.subtitleStartMs)} - {formatMsClock(report.subtitleEndMs)}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="absolute top-0 bottom-0 rounded-full bg-[#a8b7a3]/70"
                initial={{ left: `${coverageStart * 100}%`, right: `${100 - coverageStart * 100}%` }}
                animate={{ left: `${coverageStart * 100}%`, right: `${100 - coverageEnd * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {report.findings.slice(0, 3).map(finding => (
              <div key={finding.id} className={`rounded-xl border p-3 ${severityClass[finding.severity]}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FindingIcon severity={finding.severity} />
                  {finding.label}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-current/75">
                  {finding.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
