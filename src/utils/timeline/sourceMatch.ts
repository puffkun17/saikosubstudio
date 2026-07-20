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
  /** 非对白 / 辅助字幕时间点（相对整条时间轴的比例位置 0-1） */
  specialMarks: Array<{ position: number; kind: 'auxiliary' | 'sound' | 'screen' }>;
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
      specialMarks: [],
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

  const specialMarks: SourceMatchReport['specialMarks'] = [];
  const seenMarkSlots = new Set<number>();
  rows.forEach((row) => {
    const isSound = row.cueKind === 'sound_caption' || row.auxiliary?.category === 'ambient_sdh';
    const isScreen = row.cueKind === 'screen_text';
    const isAux = Boolean(row.auxiliary) || row.cueKind === 'sound_caption' || row.cueKind === 'screen_text';
    if (!isAux) return;
    const startMs = parseSubtitleRange(row.ts).startMs;
    const position = clamp(startMs / basisDuration, 0, 1);
    const slot = Math.round(position * 80);
    if (seenMarkSlots.has(slot)) return;
    seenMarkSlots.add(slot);
    specialMarks.push({
      position,
      kind: isSound ? 'sound' : isScreen ? 'screen' : 'auxiliary',
    });
  });

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
    findings.push({
      id: 'overlap',
      label: '存在并行字幕',
      detail: `检测到 ${overlapCount} 处时间重叠，可能来自画面文字、声音说明或多角色排版，不直接判定为错误。`,
      severity: 'notice',
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
      label: '可加入片源参照',
      detail: '当前只展示字幕自身结构；选择本地视频后，可进一步检查时间覆盖范围。',
      severity: 'notice',
    });
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);
  const severeCount = findings.filter(item => item.severity === 'severe').length;
  const warningCount = findings.filter(item => item.severity === 'warning').length;

  let grade: SourceMatchGrade = 'matched';
  let title = '字幕结构可继续检查';
  let summary = '当前仅根据字幕时间轴给出结构概览。';
  let recommendedAction: SourceMatchReport['recommendedAction'] = 'continue';

  if (!videoDurationMs) {
    title = '字幕概览已准备';
    summary = '已读取字幕文本与时间轴。这里先看文本规模、时间跨度和对白分布，不对片源匹配度下结论。';
    recommendedAction = 'continue';
  } else if (normalizedScore < 45 || severeCount > 0) {
    grade = 'poor';
    title = '时长覆盖差异明显';
    summary = '字幕时间范围与片源时长差异较大，建议先试听关键位置，必要时更换字幕。';
    recommendedAction = 'replace';
  } else if (normalizedScore < 68 || warningCount > 0) {
    grade = 'complex';
    title = '时长覆盖存在风险';
    summary = '字幕时间范围与片源时长存在差异，只能提示版本风险，不能据此判断声音是否合轴。';
    recommendedAction = 'review';
  } else if (normalizedScore < 84 || findings.some(item => item.severity === 'notice')) {
    grade = 'fixable';
    title = '时长覆盖可继续检查';
    summary = '字幕时间范围未见明显越界；仍需通过实际播放确认整体偏移或中途漂移。';
    recommendedAction = 'review';
  } else if (videoDurationMs) {
    title = '时长覆盖未见明显异常';
    summary = '字幕起止范围与片源总时长基本协调；这不等同于声音对齐结论。';
  }

  return {
    score: normalizedScore,
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
    specialMarks,
    findings,
  };
};
