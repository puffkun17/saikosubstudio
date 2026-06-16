import type { SubRow } from '@/utils/subtitleCore';
import { parseSubtitleRange } from '@/utils/timeline/timecode';

export type SourceMatchGrade = 'matched' | 'fixable' | 'complex' | 'poor';

export type SourceMatchFinding = {
  id: string;
  label: string;
  detail: string;
  severity: 'ok' | 'notice' | 'warning' | 'severe';
  startMs?: number;
  endMs?: number;
};

export type SourceMatchReport = {
  score: number;
  confidence: number;
  mode: 'profile' | 'match';
  grade: SourceMatchGrade;
  title: string;
  summary: string;
  recommendedAction: 'continue' | 'auto-fix' | 'review' | 'replace';
  videoDurationMs?: number;
  subtitleStartMs: number;
  subtitleEndMs: number;
  coverageRatio?: number;
  stats: {
    lineCount: number;
    characterCount: number;
    spanMs: number;
    densityPerMinute: number;
    distributionLabel: string;
  };
  activityCurve: number[];
  findings: SourceMatchFinding[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createSourceMatchReport = (
  rows: SubRow[],
  videoDurationMs?: number
): SourceMatchReport => {
  const ranges = rows
    .map(row => parseSubtitleRange(row.ts))
    .filter(range => range.endMs > range.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (ranges.length === 0) {
    return {
      score: 0,
      confidence: 0,
      mode: videoDurationMs ? 'match' : 'profile',
      grade: 'poor',
      title: '无法生成体检报告',
      summary: '当前字幕缺少可用时间轴。',
      recommendedAction: 'replace',
      subtitleStartMs: 0,
      subtitleEndMs: 0,
      stats: {
        lineCount: rows.length,
        characterCount: rows.reduce((total, row) => total + (row.text || '').replace(/\s+/g, '').length, 0),
        spanMs: 0,
        densityPerMinute: 0,
        distributionLabel: '无时间轴',
      },
      activityCurve: Array.from({ length: 48 }, () => 0),
      findings: [{
        id: 'empty',
        label: '缺少时间轴',
        detail: '没有检测到可用于匹配片源的字幕时间范围。',
        severity: 'severe',
      }],
    };
  }

  const subtitleStartMs = ranges[0].startMs;
  const subtitleEndMs = ranges[ranges.length - 1].endMs;
  const subtitleSpanMs = Math.max(0, subtitleEndMs - subtitleStartMs);
  const basisDuration = Math.max(videoDurationMs || subtitleEndMs, subtitleEndMs, 1);
  const binCount = 56;
  const bins = Array.from({ length: binCount }, () => 0);

  ranges.forEach(range => {
    const startBin = clamp(Math.floor((range.startMs / basisDuration) * binCount), 0, binCount - 1);
    const endBin = clamp(Math.ceil((range.endMs / basisDuration) * binCount), startBin, binCount - 1);
    for (let i = startBin; i <= endBin; i += 1) {
      bins[i] += 1;
    }
  });

  const maxBin = Math.max(...bins, 1);
  const activityCurve = bins.map(value => Math.sqrt(value / maxBin));
  const activeBinCount = bins.filter(value => value > 0).length;
  const activeRatio = activeBinCount / binCount;
  const distributionLabel = activeRatio > 0.68 ? '分布舒展' : activeRatio > 0.42 ? '分布集中' : '分布稀疏';
  const characterCount = rows.reduce(
    (total, row) => total + (row.text || '').replace(/\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, '').length,
    0
  );
  const stats: SourceMatchReport['stats'] = {
    lineCount: ranges.length,
    characterCount,
    spanMs: subtitleSpanMs,
    densityPerMinute: subtitleSpanMs > 0 ? Math.round((ranges.length / (subtitleSpanMs / 60_000)) * 10) / 10 : 0,
    distributionLabel,
  };

  const findings: SourceMatchFinding[] = [];
  let score = 86;

  const overlapCount = ranges.reduce((count, range, index) => {
    if (index === 0) return count;
    return range.startMs < ranges[index - 1].endMs ? count + 1 : count;
  }, 0);

  if (overlapCount > 0) {
    score -= Math.min(24, overlapCount * 4);
    findings.push({
      id: 'overlap',
      label: '时间轴重叠',
      detail: `检测到 ${overlapCount} 处字幕时间重叠，导出前建议修正。`,
      severity: overlapCount > 5 ? 'warning' : 'notice',
    });
  } else {
    findings.push({
      id: 'overlap-ok',
      label: '时间轴结构正常',
      detail: '未发现明显字幕时间重叠。',
      severity: 'ok',
    });
  }

  const gaps = ranges.slice(1).map((range, index) => ({
    startMs: ranges[index].endMs,
    endMs: range.startMs,
    gapMs: range.startMs - ranges[index].endMs,
  })).filter(item => item.gapMs > 0);

  const longestGap = gaps.sort((a, b) => b.gapMs - a.gapMs)[0];
  const longGapThreshold = Math.max(90_000, basisDuration * 0.08);
  if (longestGap && longestGap.gapMs > longGapThreshold) {
    score -= longestGap.gapMs > basisDuration * 0.16 ? 22 : 12;
    findings.push({
      id: 'long-gap',
      label: '存在长空窗',
      detail: '片中出现较长无字幕区间，可能是无对白段，也可能是版本差异或字幕缺段。',
      severity: longestGap.gapMs > basisDuration * 0.16 ? 'warning' : 'notice',
      startMs: longestGap.startMs,
      endMs: longestGap.endMs,
    });
  }

  let coverageRatio: number | undefined;
  if (videoDurationMs && videoDurationMs > 0) {
    coverageRatio = subtitleEndMs / videoDurationMs;
    const earlyStart = subtitleStartMs > Math.min(180_000, videoDurationMs * 0.08);
    const earlyEnd = coverageRatio < 0.72;
    const overEnd = subtitleEndMs > videoDurationMs + 90_000;

    if (earlyStart) {
      score -= 10;
      findings.push({
        id: 'late-start',
        label: '字幕起点偏后',
        detail: '字幕开始时间明显晚于片源起点，可能存在片头贴片或字幕缺少开场段。',
        severity: 'notice',
        startMs: 0,
        endMs: subtitleStartMs,
      });
    }

    if (earlyEnd) {
      score -= 26;
      findings.push({
        id: 'early-end',
        label: '字幕覆盖不足',
        detail: '字幕结束时间明显早于片源结尾，若片尾仍有对白，建议更换字幕或进入人工校准。',
        severity: 'warning',
        startMs: subtitleEndMs,
        endMs: videoDurationMs,
      });
    } else if (coverageRatio < 0.9) {
      score -= 8;
      findings.push({
        id: 'tail-risk',
        label: '片尾覆盖偏短',
        detail: '字幕比片源更早结束，可能只是片尾无对白，也可能存在版本差异。',
        severity: 'notice',
        startMs: subtitleEndMs,
        endMs: videoDurationMs,
      });
    }

    if (overEnd) {
      score -= 18;
      findings.push({
        id: 'over-end',
        label: '字幕长于片源',
        detail: '字幕时间轴超过片源时长，可能是不同版本字幕。',
        severity: 'warning',
      });
    }
  } else {
    findings.push({
      id: 'no-video',
      label: '等待片源参照',
      detail: '当前仅展示字幕自身结构；选择本地视频后，才会生成匹配结论。',
      severity: 'notice',
    });
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);
  const severeCount = findings.filter(item => item.severity === 'severe').length;
  const warningCount = findings.filter(item => item.severity === 'warning').length;
  const confidence = videoDurationMs ? clamp(62 + ranges.length / 12 - warningCount * 6, 42, 88) : 0;

  let grade: SourceMatchGrade = 'matched';
  let title = '匹配结构良好';
  let summary = '当前字幕时间轴结构稳定，可继续进行样式与导出。';
  let recommendedAction: SourceMatchReport['recommendedAction'] = 'continue';

  if (!videoDurationMs) {
    title = '字幕档案已生成';
    summary = '这里先呈现字幕的字数、时间跨度与分布情况，不对片源匹配度下结论。';
    recommendedAction = 'continue';
  } else if (normalizedScore < 45 || severeCount > 0) {
    grade = 'poor';
    title = '不建议继续处理';
    summary = '字幕与片源结构差异较大，继续修复成本可能高于重新寻找更匹配字幕。';
    recommendedAction = 'replace';
  } else if (normalizedScore < 68 || warningCount > 0) {
    grade = 'complex';
    title = '存在版本风险';
    summary = '当前字幕可继续检查，但建议先查看风险时间线，确认是否值得分段修复。';
    recommendedAction = 'review';
  } else if (normalizedScore < 84 || findings.some(item => item.severity === 'notice')) {
    grade = 'fixable';
    title = '可继续制作';
    summary = '未发现严重结构问题，若播放时出现整体快慢，可进入校准工具微调。';
    recommendedAction = 'auto-fix';
  }

  return {
    score: normalizedScore,
    confidence: Math.round(confidence),
    mode: videoDurationMs ? 'match' : 'profile',
    grade,
    title,
    summary,
    recommendedAction,
    videoDurationMs,
    subtitleStartMs,
    subtitleEndMs,
    coverageRatio,
    stats,
    activityCurve,
    findings,
  };
};
