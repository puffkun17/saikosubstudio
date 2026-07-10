'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clapperboard, HardDrive, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SubRow } from '@/utils/subtitleCore';
import { createSourceMatchReport, type SourceMatchFinding, type SourceMatchReport } from '@/utils/timeline/sourceMatch';
import { formatMsClock } from '@/utils/timeline/timecode';
import { InfoHint } from '@/components/ui/InfoHint';

const GRADE_META: Record<SourceMatchReport['grade'], { label: string; tone: string; action: string }> = {
  matched: { label: '覆盖完整', tone: 'text-neutral-100', action: '继续检查字幕' },
  fixable: { label: '需要试听', tone: 'text-[#a8b7a3]', action: '检查关键位置' },
  complex: { label: '覆盖有风险', tone: 'text-[#c0a89a]', action: '查看风险时间线' },
  poor: { label: '差异明显', tone: 'text-[#b98982]', action: '考虑更换字幕' },
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
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 text-[#9ddacb]" />;
  if (severity === 'severe') return <XCircle className="h-4 w-4 text-[#b98982]" />;
  return <AlertTriangle className={`h-4 w-4 ${severity === 'warning' ? 'text-[#c0a89a]' : 'text-[#9ddacb]'}`} />;
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
  const chartHeight = 142;
  const subtitlePath = getChartPath(report.activityCurve, chartWidth, chartHeight);
  const subtitleArea = buildAreaPath(subtitlePath, chartWidth, chartHeight);
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
    <section className="w-full rounded-xl border border-white/[0.075] bg-[#080807]/72 shadow-[0_20px_70px_rgba(0,0,0,0.24)] overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-0">
        <div className="border-b xl:border-b-0 xl:border-r border-white/[0.055] px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-neutral-100">
                <Activity className="h-4 w-4 text-[#9ddacb]" />
                {isMatchMode ? '片源时长参照' : '字幕概览'}
              </div>
              <p className="mt-1 max-w-[28ch] text-[13px] leading-5 text-neutral-400">
                {isMatchMode ? '已读取片源时长，用于检查字幕覆盖范围。' : '先确认字幕规模与分布，再加入本地片源检查时长覆盖。'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#9ddacb]/20 bg-[#9ddacb]/[0.045] px-3.5 py-2.5 text-[13px] font-medium text-[#d5f2ec] transition hover:border-[#9ddacb]/38 hover:bg-[#9ddacb]/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ddacb]/70 active:translate-y-px cursor-pointer"
            >
              <Clapperboard className="h-3.5 w-3.5" />
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
                  className={`text-[46px] leading-none font-semibold tracking-[-0.04em] ${meta.tone}`}
                >
                  {report.coverageRatio ? `${Math.round(report.coverageRatio * 100)}%` : '--'}
                </motion.div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.12em] text-neutral-500">
                  时间覆盖
                  <InfoHint label="时间覆盖说明">
                    这里只比较字幕起止范围与片源总时长，不读取音频，也不能判断对白是否合轴。
                  </InfoHint>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[15px] font-semibold ${meta.tone}`}>{meta.label}</div>
                <div className="mt-1 text-xs text-neutral-500">依据：时长与字幕时间轴</div>
              </div>
            </div>
          ) : (
            <dl className="mt-5 grid grid-cols-3 gap-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.016]">
              <div className="px-3.5 py-3">
                <dt className="text-[11px] text-neutral-500">文本量</dt>
                <dd className="mt-1.5 text-[19px] leading-none font-semibold tracking-[-0.02em] text-neutral-100">{formatCount(report.stats.characterCount)}</dd>
              </div>
              <div className="border-l border-white/[0.055] px-3.5 py-3">
                <dt className="text-[11px] text-neutral-500">时间跨度</dt>
                <dd className="mt-1.5 text-[19px] leading-none font-semibold tracking-[-0.02em] text-neutral-100">{formatMsClock(report.stats.spanMs)}</dd>
              </div>
              <div className="border-l border-white/[0.055] px-3.5 py-3">
                <dt className="text-[11px] text-neutral-500 inline-flex items-center gap-1.5">
                  对白密度
                  <InfoHint label="对白密度说明">
                    每分钟字幕行数，用于观察字幕分布是否异常。声音说明、歌词和画面文字也会影响这个指标。
                  </InfoHint>
                </dt>
                <dd className="mt-1.5 text-[18px] leading-none font-semibold tracking-[-0.02em] text-[#9ddacb]">{report.stats.densityPerMinute}</dd>
              </div>
            </dl>
          )}

          <div className="mt-4">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-100">{report.title}</div>
            <p className="mt-1.5 max-w-[36ch] text-[13px] leading-5 text-neutral-400">{report.summary}</p>
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
                <div className="text-[13px] font-medium text-neutral-300 inline-flex items-center gap-1.5">
                  {isMatchMode ? '片源时长内的字幕分布' : '字幕时间分布'}
                  <InfoHint label="字幕分布图说明">
                    曲线只展示字幕事件在时间轴中的分布。加入片源后，横轴按片源总时长计算，可用于发现明显越界或覆盖不足。
                  </InfoHint>
                </div>
                <div className="mt-0.5 text-[12px] text-neutral-500">{report.stats.distributionLabel} · {formatCount(report.stats.lineCount)} 行</div>
              </div>
              <span className="shrink-0 tabular-nums">{report.stats.densityPerMinute} 行/分钟</span>
            </figcaption>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={isMatchMode ? '片源覆盖与字幕活动图' : '字幕时间分布图'} className="w-full h-[142px] overflow-visible">
              <defs>
                <linearGradient id="subtitleArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#9ddacb" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#9ddacb" stopOpacity="0.015" />
                </linearGradient>
              </defs>
              {Array.from({ length: 7 }).map((_, index) => (
                <line
                  key={index}
                  x1={(chartWidth / 6) * index}
                  x2={(chartWidth / 6) * index}
                  y1="12"
                  y2={chartHeight - 8}
                  stroke="rgba(157,218,203,0.06)"
                  strokeWidth="1"
                />
              ))}
              <path d={subtitleArea} fill="url(#subtitleArea)" />
              <motion.path
                d={subtitlePath}
                fill="none"
                stroke="#9ddacb"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.05, ease: 'easeOut', delay: 0.08 }}
              />
            </svg>
          </figure>

          <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.012] px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-neutral-500 mb-2.5">
              <span>{isMatchMode ? '片源覆盖' : '字幕跨度'}</span>
              <span>
                {formatMsClock(report.subtitleStartMs)} - {formatMsClock(report.subtitleEndMs)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="absolute top-0 bottom-0 rounded-full bg-[#9ddacb]/75"
                initial={{ left: `${coverageStart * 100}%`, right: `${100 - coverageStart * 100}%` }}
                animate={{ left: `${coverageStart * 100}%`, right: `${100 - coverageEnd * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {isMatchMode ? (
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {report.findings.slice(0, 3).map(finding => (
                <div key={finding.id} className={`rounded-lg border p-3 ${severityClass[finding.severity]}`}>
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
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
