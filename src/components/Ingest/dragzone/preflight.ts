import type { Subfile } from '@/store/useStudioStore';
import { secondaryTermFor } from '@/core/trackTerms';
import { detectLanguageByFilename, isSdhOrCcSubtitleFilename } from '@/utils/subtitleCore';
import { getClientFileIssue } from '@/utils/importSafety';
import { stageObjectId } from '@/core/stageObjects';
import { detectLanguagePairByFilename, type FilenameLanguagePair } from '@/core/filenameLanguagePair';

/** DragZone 预检：队列条目类型、常量与纯函数（无 React、无 I/O 副作用）。 */

export type ParseStatus = 'reading' | 'analyzing' | 'success' | 'warning' | 'skipped';

export interface ParsingFileState {
  name: string;
  size: number;
  status: ParseStatus;
  note?: string;
}

export type PreflightKind = 'subtitle' | 'zip' | 'archive' | 'archive-unsupported' | 'too-large' | 'unsupported';

export interface ArchiveEntryPreview {
  name: string;
  languageLabel: string;
  /** 文件名里的双语标记（EN&CHS / chs_eng / 简英 …）；有则显示「简+En 双语」牌。 */
  languagePair?: FilenameLanguagePair;
  /** 稳定对象 id：父包 objectId + 包内路径（core/stageObjects）。 */
  objectId?: string;
}

export interface PreflightItem {
  file: File;
  /** 队列去重键：包含相对路径，同名不同目录的文件不再互斥。 */
  key: string;
  /** 舞台对象 id（core/stageObjects）：本次清单 ↔ 暂存区 ↔ 解码后的 Subfile 都用它。 */
  objectId: string;
  name: string;
  /** 文件夹导入时的本地相对路径（如 `剧集目录/S01/xx.srt`）。 */
  relativePath?: string;
  /** 顶层文件夹名——存在时该项归入对应文件夹分组树。 */
  folderName?: string;
  extension: string;
  kind: PreflightKind;
  label: string;
  accepted: boolean;
  note: string;
  archiveEntries?: ArchiveEntryPreview[];
  archivePeekStatus?: 'idle' | 'loading' | 'ready' | 'error';
  archivePeekError?: string;
}

/** 入队原始记录：拖入目录遍历得到的文件不带 webkitRelativePath，路径单独传递。 */
export interface IncomingFile {
  file: File;
  relativePath?: string;
}

export interface TrackSummary {
  name: string;
  format: 'ASS' | 'SRT';
  lang: string;
  isBilingual: boolean;
  isCommentary: boolean;
  source: 'file' | 'zip' | 'archive' | 'folder';
}

export type IngestPhase = 'idle' | 'reading' | 'parsing' | 'binding' | 'metadata' | 'ready' | 'needs_review' | 'error';

export const PHASE_STEPS: Array<{ id: IngestPhase; label: string }> = [
  { id: 'reading', label: '读取' },
  { id: 'parsing', label: '识轨' },
  { id: 'binding', label: '归组' },
  { id: 'metadata', label: '匹配' },
  { id: 'ready', label: '完成' },
];

export const PHASE_COPY: Record<IngestPhase, string> = {
  idle: '将字幕文件加入清单',
  reading: '正在读取文件…',
  parsing: '正在识别字幕轨…',
  binding: '正在按集数归组…',
  metadata: '正在匹配影片资料…',
  ready: '整理完成，可进入核对',
  needs_review: '部分轨道或影片信息需要确认',
  error: '部分内容需要处理',
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const getQueueKey = (file: File, relativePath?: string) =>
  `${relativePath || ''}:${file.name}:${file.size}:${file.lastModified}`;

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 树杈伸展节奏：主干先长，叶枝随后逐条抽出（封顶避免长列表拖沓）。 */
export const leafDelayMs = (index: number) => Math.min(90 + index * 70, 480);

export const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

export const isSubtitleExtension = (ext: string) => ext === 'srt' || ext === 'ass';
export const isMultipartArchiveName = (name: string) => /\.part\d+\.rar$|\.r\d{2}$|\.7z\.\d+$/i.test(name);

export const PREFLIGHT_LANGUAGE_LABELS = {
  'zh-CN': '简中',
  'zh-TW': '繁中',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  es: '西语',
  fr: '法语',
  pt: '葡语',
  de: '德语',
  it: '意语',
  latin: '拉丁文字',
  bilingual: '双语',
  commentary: '导评',
  unknown: '语言待识别',
} as const;

export const createPreflightItem = (file: File, relativePath?: string): PreflightItem => {
  const extension = getExtension(file.name);
  const decorate = (
    item: Omit<PreflightItem, 'key' | 'objectId' | 'relativePath' | 'folderName'>,
  ): PreflightItem => ({
    ...item,
    key: getQueueKey(file, relativePath),
    objectId: stageObjectId(getQueueKey(file, relativePath)),
    relativePath,
    folderName: relativePath && relativePath.includes('/') ? relativePath.split('/')[0] : undefined,
  });

  const sizeIssue = getClientFileIssue(file);
  if (sizeIssue) {
    return decorate({
      file,
      name: file.name,
      extension: extension || 'unknown',
      kind: 'too-large',
      label: extension ? extension.toUpperCase() : '未知',
      accepted: false,
      note: sizeIssue,
    });
  }
  if (isSubtitleExtension(extension)) {
    const language = languageSpecForName(file.name);
    return decorate({
      file,
      name: file.name,
      extension,
      kind: 'subtitle',
      label: extension.toUpperCase(),
      accepted: true,
      note: `${language.label} · ${extension === 'ass' ? '样式字幕轨' : '标准字幕轨'}`,
    });
  }
  if (extension === 'zip') {
    return decorate({
      file,
      name: file.name,
      extension,
      kind: 'zip',
      label: 'ZIP',
      accepted: true,
      note: '正在查看包内字幕…',
      archivePeekStatus: 'loading',
      archiveEntries: [],
    });
  }
  if (isMultipartArchiveName(file.name)) {
    return decorate({
      file,
      name: file.name,
      extension,
      kind: 'archive-unsupported',
      label: extension.toUpperCase(),
      accepted: false,
      note: '分卷压缩包请先在本地完整解压',
    });
  }
  if (extension === '7z' || extension === 'rar') {
    return decorate({
      file,
      name: file.name,
      extension,
      kind: 'archive',
      label: extension.toUpperCase(),
      accepted: true,
      note: '正在查看包内字幕…',
      archivePeekStatus: 'loading',
      archiveEntries: [],
    });
  }
  return decorate({
    file,
    name: file.name,
    extension: extension || 'unknown',
    kind: 'unsupported',
    label: extension ? extension.toUpperCase() : '未知',
    accepted: false,
    note: '已忽略非字幕资源',
  });
};

/** 拖入目录时递归收集文件（webkitGetAsEntry），并保留相对路径。 */
export const MAX_DROPPED_ENTRIES = 400;

export const collectEntryFiles = async (
  entry: FileSystemEntry,
  out: IncomingFile[],
  budget: { remaining: number },
): Promise<void> => {
  if (budget.remaining <= 0) return;
  if (entry.isFile) {
    budget.remaining -= 1;
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    ).catch(() => null);
    if (!file) return;
    const fullPath = entry.fullPath.replace(/^\//, '');
    out.push({ file, relativePath: fullPath.includes('/') ? fullPath : undefined });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries 每批最多返回 ~100 条，需循环读到空批为止
    while (budget.remaining > 0) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      ).catch(() => [] as FileSystemEntry[]);
      if (batch.length === 0) break;
      for (const child of batch) {
        await collectEntryFiles(child, out, budget);
        if (budget.remaining <= 0) break;
      }
    }
  }
};

export const describeTrack = (file: Subfile) => {
  if (file.isCommentary || file.lang === 'commentary') return '导评轨';
  if (file.isBilingual || file.lang === 'bilingual') {
    const labels: Record<string, string> = { 'zh-CN': '简中', 'zh-TW': '繁中', en: '英语', ja: '日语', ko: '韩语', es: '西语', fr: '法语', pt: '葡语', de: '德语', it: '意语', latin: '拉丁文字' };
    const pair = file.languagePair;
    return pair ? `${labels[pair.primary]} / ${labels[pair.secondary]} 双语轨` : '双语轨';
  }
  if (file.lang === 'zh-CN' || file.lang === 'zh-TW') return '主字幕';
  if (file.lang === 'en') {
    return isSdhOrCcSubtitleFilename(file.name) ? '副字幕 · 英语 SDH/CC' : '副字幕 · 英语';
  }
  if (['es', 'fr', 'pt', 'de', 'it'].includes(file.lang)) return secondaryTermFor(file.lang);
  if (['ja', 'ko', 'latin'].includes(file.lang)) return '其他语种轨';
  return '待确认轨';
};

export const VIDEO_EXT = /\.(mkv|mp4|m4v|mov|avi|webm|ts|m2ts|wmv|flv)$/i;
export const isVideoFile = (file: File) => file.type.startsWith('video/') || VIDEO_EXT.test(file.name);

/** 一条轨在列表里的语言：中文名，双语时带上配对（牌面显示 简+En）。 */
export interface LanguageSpec {
  label: string;
  pair?: FilenameLanguagePair;
}

/** 只看文件名：双语标记优先，其次单语种；都没有 = 待识别。 */
export const languageSpecForName = (name: string): LanguageSpec => {
  const pair = detectLanguagePairByFilename(name);
  if (pair) return { label: PREFLIGHT_LANGUAGE_LABELS.bilingual, pair };
  return { label: PREFLIGHT_LANGUAGE_LABELS[detectLanguageByFilename(name)] || '语言待识别' };
};

const specKey = (spec: LanguageSpec) => (spec.pair ? `${spec.pair.primary}+${spec.pair.secondary}` : spec.label);

export const languagesForItem = (item: PreflightItem): LanguageSpec[] => {
  if (item.archiveEntries && item.archiveEntries.length > 0) {
    const seen = new Map<string, LanguageSpec>();
    for (const entry of item.archiveEntries) {
      const spec: LanguageSpec = { label: entry.languageLabel, pair: entry.languagePair };
      if (!seen.has(specKey(spec))) seen.set(specKey(spec), spec);
    }
    return [...seen.values()];
  }
  if (item.kind === 'subtitle') {
    return [languageSpecForName(item.name)];
  }
  return [];
};

/** 队列头部统计行：条目数 · 轨格式 · 来源 · 体积 · 忽略数。 */
export const summarizeQueue = (
  queuedItems: PreflightItem[],
  { isOfficialSubtitle, isOriginalWork }: { isOfficialSubtitle: boolean; isOriginalWork: boolean },
) => {
  const rejectedItems = queuedItems.filter(item => !item.accepted);
  const looseSubtitleCount = queuedItems.filter(item => item.kind === 'subtitle').length;
  const peekedTrackCount = queuedItems.reduce((sum, item) => sum + (item.archiveEntries?.length || 0), 0);
  const trackCount = looseSubtitleCount + peekedTrackCount;
  const archivePeekPending = queuedItems.some(item => (item.kind === 'zip' || item.kind === 'archive') && item.archivePeekStatus === 'loading');
  const totalBytes = queuedItems.reduce((sum, item) => sum + item.file.size, 0);

  const queueFormatSummary = (() => {
    let srt = 0;
    let ass = 0;
    for (const item of queuedItems) {
      if (item.kind === 'subtitle') {
        if (item.extension === 'ass') ass += 1;
        else srt += 1;
      }
      for (const entry of item.archiveEntries || []) {
        if (/\.ass$/i.test(entry.name)) ass += 1;
        else srt += 1;
      }
    }
    const parts: string[] = [];
    if (srt > 0) parts.push(`${srt} SRT`);
    if (ass > 0) parts.push(`${ass} ASS`);
    return parts.join(' · ');
  })();

  const queueSourceSummary = (() => {
    const hasArchive = queuedItems.some((item) => item.kind === 'zip' || item.kind === 'archive');
    const hasFolder = queuedItems.some((item) => Boolean(item.folderName));
    const hasLoose = queuedItems.some((item) => item.kind === 'subtitle' && !item.folderName);
    const parts: string[] = [];
    if (hasArchive) parts.push('来自压缩包');
    if (hasFolder) parts.push('来自文件夹');
    if (hasLoose && parts.length === 0) parts.push('本地文件');
    else if (hasLoose && (hasArchive || hasFolder)) parts.push('含本地文件');
    if (isOfficialSubtitle) parts.unshift('官方字幕');
    if (isOriginalWork) parts.unshift('原创');
    return parts.join(' · ');
  })();

  const queueStatsLine = archivePeekPending && trackCount === 0
    ? '正在读取…'
    : [
        // 与多作品提示、暂存区同一口径：按文件算（压缩包 = 包内轨数），不按清单项算。
        `${queuedItems.reduce((sum, item) => sum + Math.max(1, item.archiveEntries?.length ?? 0), 0)} 个文件`,
        queueFormatSummary || (trackCount > 0 ? `${trackCount} 轨` : null),
        queueSourceSummary,
        formatBytes(totalBytes),
        rejectedItems.length > 0 ? `${rejectedItems.length} 项已忽略` : null,
      ].filter(Boolean).join(' · ');

  return { rejectedItems, queueStatsLine };
};

// 文件夹导入的条目按顶层目录归组，队列渲染为「文件夹 → 子文件」树
export type RenderNode =
  | { type: 'item'; item: PreflightItem }
  | { type: 'folder'; folder: string; items: PreflightItem[] };

export const buildRenderNodes = (queuedItems: PreflightItem[]): RenderNode[] => {
  const renderNodes: RenderNode[] = [];
  {
    const folderBuckets = new Map<string, PreflightItem[]>();
    for (const item of queuedItems) {
      if (item.folderName) {
        let bucket = folderBuckets.get(item.folderName);
        if (!bucket) {
          bucket = [];
          folderBuckets.set(item.folderName, bucket);
          renderNodes.push({ type: 'folder', folder: item.folderName, items: bucket });
        }
        bucket.push(item);
      } else {
        renderNodes.push({ type: 'item', item });
      }
    }
  }
  return renderNodes;
};
