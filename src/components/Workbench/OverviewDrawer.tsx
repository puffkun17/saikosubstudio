'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { SubRow } from '@/utils/subtitleCore';
import { buildCharsOverTime, computeSubtitleVitals } from '@/core/charsOverTime';
import type { WorkbenchScoreBreakdown } from '@/core/workbenchScore';
import { formatMsClock, parseSubtitleRange } from '@/utils/timeline/timecode';
import { CreditPanel } from '@/components/Workbench/CreditPanel';
import { useStudioStore } from '@/store/useStudioStore';

type OverviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  rows: SubRow[];
  score: WorkbenchScoreBreakdown;
  videoDurationMs?: number;
  onOpenLegacyReview?: () => void;
};

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

export const OverviewDrawer: React.FC<OverviewDrawerProps> = ({
  open,
  onClose,
  rows,
  score,
  videoDurationMs,
  onOpenLegacyReview,
}) => {
  const previewIndex = useStudioStore((s) => s.previewIndex);
  const vitals = useMemo(() => computeSubtitleVitals(rows), [rows]);
  const dist = useMemo(
    () => buildCharsOverTime(rows, { spanEndMs: videoDurationMs }),
    [rows, videoDurationMs],
  );

  const nowBucket = useMemo(() => {
    const row = rows[Math.max(0, Math.min(previewIndex, rows.length - 1))];
    if (!row || dist.spanMs <= 0) return -1;
    const t = parseSubtitleRange(row.ts).startMs;
    const idx = Math.min(
      dist.bucketCount - 1,
      Math.max(0, Math.floor(((t - dist.startMs) / dist.spanMs) * dist.bucketCount)),
    );
    return idx;
  }, [rows, previewIndex, dist]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="wb-drawer-backdrop"
        aria-label="关闭概览"
        onClick={onClose}
      />
      <aside className="wb-drawer" role="dialog" aria-modal="true" aria-label="概览" data-testid="overview-drawer">
        <div className="wb-drawer__hd">
          <h2>概览</h2>
          <button type="button" className="ui-action ui-action--quiet ui-action--icon wb-focus-ring" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="sec">
            <h3>
              字幕三围
              <small>字量 / 行数 · 跨度 {formatMsClock(vitals.spanMs)}</small>
            </h3>
            <div className="wb-vit">
              <div>
                <b>{formatCount(vitals.totalChars)}</b>
                <span>总字量</span>
              </div>
              <div>
                <b>{formatCount(vitals.totalLines)}</b>
                <span>总行数</span>
              </div>
              <div>
                <b>{vitals.avgCharsPerLine}</b>
                <span>平均每行字数</span>
              </div>
              <div>
                <b>{vitals.linesPerMinute}</b>
                <span>每分钟行数</span>
              </div>
            </div>
            <p className="wb-note">
              总字量按可见字符计（不含空白与换行）；平均每行字数 = 总字量 ÷ 总行数；每分钟行数按字幕时间跨度估算。
            </p>
          </section>

          <section className="sec">
            <h3>
              字数随时间分布
              <small>{formatMsClock(dist.startMs)} – {formatMsClock(dist.endMs)}</small>
            </h3>
            <div className="wb-chart" role="img" aria-label="字数随时间分布柱状图">
              {dist.buckets.map((bucket) => {
                const h = dist.maxChars > 0 ? Math.max(2, (bucket.chars / dist.maxChars) * 100) : 2;
                return (
                  <div
                    key={bucket.index}
                    className={`wb-chart__bar ${bucket.index === nowBucket ? 'is-now' : ''}`}
                    style={{ height: `${h}%` }}
                    title={`${formatMsClock(bucket.startMs)} · ${bucket.chars} 字`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-[var(--v5-text-muted)]">
              <span>{formatMsClock(dist.startMs)}</span>
              <span>{formatMsClock(dist.endMs)}</span>
            </div>
          </section>

          <section className="sec">
            <h3>评分说明</h3>
            <div className="wb-form">
              <div className="row2">
                <span>质量分</span>
                <span>{score.quality}</span>
              </div>
              <p className="src">{score.formulaZh.quality}</p>
              <div className="row2">
                <span>契合度</span>
                <span>{score.fit}</span>
              </div>
              <p className="src">{score.formulaZh.fit}</p>
              <div className="row2">
                <span>总分</span>
                <span>{score.total}</span>
              </div>
              <p className="src">{score.formulaZh.total}</p>
              <div className="row2">
                <span>处理完可到</span>
                <span>{score.potential}</span>
              </div>
              <p className="src">{score.formulaZh.potential}</p>
            </div>
            <p className="wb-note">
              质量分只扣未解决的复核项与片中长空窗；契合度看直接配对与结构差异核对进度。不编造阅读速度等指标。
            </p>
          </section>

          <section className="sec !p-0 empty:hidden">
            <CreditPanel />
          </section>

          {onOpenLegacyReview ? (
            <section className="sec">
              <button
                type="button"
                className="ui-action ui-action--secondary w-full wb-focus-ring"
                onClick={() => {
                  onOpenLegacyReview();
                  onClose();
                }}
              >
                打开合轴复核明细（旧版弹窗）
              </button>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
};
