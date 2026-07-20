'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectLanguageByFilename, detectSubtitleLanguage, parseMediaFilename, assessMediaIdentity } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { ChevronDown, FilePlus, FolderPlus, HardDrive, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CLIENT_IMPORT_LIMITS, getClientBatchIssue, getClientFileIssue } from '@/utils/importSafety';
import {
  extractLocalArchiveSubtitles,
  listLocalArchiveSubtitles,
  LocalArchiveError,
  warmLocalArchiveEngine,
} from '@/utils/localArchive';
import { FileFormatIcon, LanguageMark, resolveFileFormat } from '@/components/ui/FileFormatIcon';
import { useWorkflowChrome } from '@/components/Global/WorkflowChrome';

type ParseStatus = 'reading' | 'analyzing' | 'success' | 'warning' | 'skipped';

interface ParsingFileState {
  name: string;
  size: number;
  status: ParseStatus;
  note?: string;
}

type PreflightKind = 'subtitle' | 'zip' | 'archive' | 'archive-unsupported' | 'too-large' | 'unsupported';

interface ArchiveEntryPreview {
  name: string;
  languageLabel: string;
}

interface PreflightItem {
  file: File;
  /** 队列去重键：包含相对路径，同名不同目录的文件不再互斥。 */
  key: string;
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
interface IncomingFile {
  file: File;
  relativePath?: string;
}

interface TrackSummary {
  name: string;
  format: 'ASS' | 'SRT';
  lang: string;
  isBilingual: boolean;
  isCommentary: boolean;
  source: 'file' | 'zip' | 'archive';
}

type IngestPhase = 'idle' | 'reading' | 'parsing' | 'binding' | 'metadata' | 'ready' | 'needs_review' | 'error';

const PHASE_STEPS: Array<{ id: IngestPhase; label: string }> = [
  { id: 'reading', label: '读取' },
  { id: 'parsing', label: '识轨' },
  { id: 'binding', label: '归组' },
  { id: 'metadata', label: '匹配' },
  { id: 'ready', label: '完成' },
];

const PHASE_COPY: Record<IngestPhase, string> = {
  idle: '将字幕文件加入清单',
  reading: '正在读取文件…',
  parsing: '正在识别字幕轨…',
  binding: '正在按集数归组…',
  metadata: '正在匹配影片资料…',
  ready: '整理完成，可进入核对',
  needs_review: '部分轨道或影片信息需要确认',
  error: '部分内容需要处理',
};

const formatBytes = (bytes: number) => {
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

const getQueueKey = (file: File, relativePath?: string) =>
  `${relativePath || ''}:${file.name}:${file.size}:${file.lastModified}`;

/** 树杈伸展节奏：主干先长，叶枝随后逐条抽出（封顶避免长列表拖沓）。 */
const leafDelayMs = (index: number) => Math.min(90 + index * 70, 480);

const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

const isSubtitleExtension = (ext: string) => ext === 'srt' || ext === 'ass';
const isMultipartArchiveName = (name: string) => /\.part\d+\.rar$|\.r\d{2}$|\.7z\.\d+$/i.test(name);

const PREFLIGHT_LANGUAGE_LABELS = {
  'zh-CN': '简中',
  'zh-TW': '繁中',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  es: '西语',
  latin: '拉丁文字',
  bilingual: '双语',
  commentary: '导评',
  unknown: '语言待识别',
} as const;

const createPreflightItem = (file: File, relativePath?: string): PreflightItem => {
  const extension = getExtension(file.name);
  const decorate = (
    item: Omit<PreflightItem, 'key' | 'relativePath' | 'folderName'>,
  ): PreflightItem => ({
    ...item,
    key: getQueueKey(file, relativePath),
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
    const language = detectLanguageByFilename(file.name);
    return decorate({
      file,
      name: file.name,
      extension,
      kind: 'subtitle',
      label: extension.toUpperCase(),
      accepted: true,
      note: `${PREFLIGHT_LANGUAGE_LABELS[language]} · ${extension === 'ass' ? '样式字幕轨' : '标准字幕轨'}`,
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
const MAX_DROPPED_ENTRIES = 400;

const collectEntryFiles = async (
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

const describeTrack = (file: Subfile) => {
  if (file.isCommentary || file.lang === 'commentary') return '导评轨';
  if (file.isBilingual || file.lang === 'bilingual') {
    const labels: Record<string, string> = { 'zh-CN': '简中', 'zh-TW': '繁中', en: '英语', ja: '日语', ko: '韩语', fr: '法语', es: '西语', latin: '拉丁文字' };
    const pair = file.languagePair;
    return pair ? `${labels[pair.primary]} / ${labels[pair.secondary]} 双语轨` : '双语轨';
  }
  if (file.lang === 'zh-CN' || file.lang === 'zh-TW') return '主字幕轨';
  if (['en', 'ja', 'ko', 'fr', 'es', 'latin'].includes(file.lang)) return '第二语言轨';
  return '待确认轨';
};

export const DragZone: React.FC = () => {
  const { isDragging, setIsDragging, processFiles, addLog, setIngestClearing } = useStudioStore(useShallow((state) => ({
    isDragging: state.isDragging,
    setIsDragging: state.setIsDragging,
    processFiles: state.processFiles,
    addLog: state.addLog,
    setIngestClearing: state.setIngestClearing,
  })));
  const { setEdgeNext, setInfoBar } = useWorkflowChrome();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  // Parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [, setParsingFiles] = useState<ParsingFileState[]>([]);
  const [ingestPhase, setIngestPhase] = useState<IngestPhase>('idle');
  const [ingestMessage, setIngestMessage] = useState(PHASE_COPY.idle);
  const [resultChips, setResultChips] = useState<string[]>([]);
  const [queuedItems, setQueuedItems] = useState<PreflightItem[]>([]);
  const [queueIssue, setQueueIssue] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const setPhase = (phase: IngestPhase, message = PHASE_COPY[phase]) => {
    setIngestPhase(phase);
    setIngestMessage(message);
  };

  useEffect(() => {
    warmLocalArchiveEngine();
  }, []);

  useEffect(() => {
    if (!addMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [addMenuOpen]);

  // Clearing → progress lives in the global info bar
  useEffect(() => {
    if (!isParsing) return;
    const activeStepIndex = Math.max(0, PHASE_STEPS.findIndex((step) => step.id === ingestPhase));
    const stepLabel = PHASE_STEPS.map((step, index) => {
      const mark = activeStepIndex >= index || ingestPhase === 'ready' ? '●' : '○';
      return `${mark}${step.label}`;
    }).join('  ');
    const chipSummary = resultChips.length > 0 ? resultChips.slice(0, 3).join(' · ') : undefined;
    setInfoBar({
      title: ingestMessage,
      subtitle: chipSummary ? `${stepLabel} · ${chipSummary}` : stepLabel,
    });
    return () => setInfoBar(null);
  }, [isParsing, ingestPhase, ingestMessage, resultChips, setInfoBar]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /** Ceremony release gate: honest work + perceptual floor, not fake padding. */
  const CEREMONY_MIN_MS = 2400;
  const CEREMONY_SOFT_MS = 4500;
  const CEREMONY_HARD_MS = 6000;
  const PHASE_FLOOR_MS = 160;

  const holdPhaseFloor = async (startedAt: number, phaseStartedAt: number) => {
    const phaseElapsed = Date.now() - phaseStartedAt;
    if (phaseElapsed < PHASE_FLOOR_MS) {
      await sleep(PHASE_FLOOR_MS - phaseElapsed);
    }
    void startedAt;
  };

  const waitForCeremonyRelease = async (startedAt: number) => {
    // Give selectTask's deferred TMDB search a tick to flip isSearchingTmdb.
    await sleep(120);
    while (true) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= CEREMONY_HARD_MS) break;
      const { isSearchingTmdb } = useStudioStore.getState();
      // After MIN: release when TMDB is idle, or at SOFT if still in flight.
      if (elapsed >= CEREMONY_MIN_MS && (!isSearchingTmdb || elapsed >= CEREMONY_SOFT_MS)) break;
      await sleep(80);
    }
  };

  const peekArchiveContents = async (item: PreflightItem) => {
    const key = item.key;

    // Hint only — never flip to ready/empty (that used to show「0 条字幕」as a fake success).
    const softWatchdog = window.setTimeout(() => {
      setQueuedItems((current) => current.map((row) => {
        if (row.key !== key) return row;
        if (row.archivePeekStatus !== 'loading') return row;
        return {
          ...row,
          note: '读取较慢，可先继续',
        };
      }));
    }, 8_000);

    try {
      let names: string[] = [];
      if (item.kind === 'zip') {
        const zip = await JSZip.loadAsync(item.file);
        names = Object.values(zip.files)
          .filter(entry => !entry.dir && isSubtitleExtension(getExtension(entry.name)))
          .map(entry => entry.name.split('/').pop() || entry.name);
      } else if (item.kind === 'archive') {
        const listed = await listLocalArchiveSubtitles(item.file, {
          maxEntries: CLIENT_IMPORT_LIMITS.maxArchiveEntries,
          maxSubtitleEntries: CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries,
        });
        names = listed.names;
      } else {
        return;
      }

      const archiveEntries = names.map(name => ({
        name,
        languageLabel: PREFLIGHT_LANGUAGE_LABELS[detectLanguageByFilename(name)],
      }));

      setQueuedItems(current => current.map(row => {
        if (row.key !== key) return row;
        if (archiveEntries.length === 0) {
          return {
            ...row,
            accepted: false,
            archivePeekStatus: 'error',
            archiveEntries: [],
            archivePeekError: '包内未检测到 SRT / ASS',
            note: '包内未检测到可用字幕',
          };
        }
        return {
          ...row,
          accepted: true,
          archivePeekStatus: 'ready',
          archiveEntries,
          archivePeekError: undefined,
          note: `包内 ${archiveEntries.length} 条字幕轨`,
        };
      }));
    } catch (error: unknown) {
      const encrypted = error instanceof LocalArchiveError && error.code === 'encrypted';
      const message = encrypted
        ? '压缩包已加密，请先在本地解压'
        : error instanceof LocalArchiveError
          ? error.message
          : '预览失败；包内字幕将在开始整理时读取';
      addLog(`${item.name}: ${message}`, encrypted ? 'error' : 'info');
      setQueuedItems(current => current.map(row => {
        if (row.key !== key) return row;
        if (encrypted) {
          return {
            ...row,
            accepted: false,
            archivePeekStatus: 'error',
            archiveEntries: [],
            archivePeekError: message,
            note: message,
          };
        }
        // Stay importable, but surface the real peek error (no silent「0 条字幕」).
        return {
          ...row,
          accepted: true,
          archivePeekStatus: 'error',
          archiveEntries: row.archiveEntries?.length ? row.archiveEntries : [],
          archivePeekError: `${message}（仍可开始整理）`,
          note: message,
        };
      }));
    } finally {
      window.clearTimeout(softWatchdog);
    }
  };

  const addFilesToQueue = (incoming: IncomingFile[]) => {
    if (incoming.length === 0) return;
    const seenKeys = new Set(queuedItems.map(item => item.key));
    const additions: PreflightItem[] = [];
    let duplicateCount = 0;
    let skippedInFolder = 0;

    for (const record of incoming) {
      const relativePath = record.relativePath || record.file.webkitRelativePath || undefined;
      const item = createPreflightItem(record.file, relativePath);
      if (seenKeys.has(item.key)) {
        duplicateCount += 1;
        continue;
      }
      seenKeys.add(item.key);
      // 文件夹整包导入常混着视频/nfo 等杂项，静默汇总而不是刷满整屏「已忽略」
      if (item.folderName && item.kind === 'unsupported') {
        skippedInFolder += 1;
        continue;
      }
      additions.push(item);
    }

    const nextItems = [...queuedItems, ...additions];
    const batchIssue = getClientBatchIssue(nextItems.map(item => item.file));

    if (batchIssue) {
      setQueueIssue(batchIssue);
      addLog(batchIssue, 'error');
      return;
    }

    setQueueIssue(null);
    setQueuedItems(nextItems);
    if (duplicateCount > 0) {
      addLog(`已忽略 ${duplicateCount} 个重复文件`, 'info');
    }
    if (skippedInFolder > 0) {
      addLog(`文件夹内已忽略 ${skippedInFolder} 个非字幕资源`, 'info');
    }
    additions
      .filter(item => item.kind === 'zip' || item.kind === 'archive')
      .forEach(item => {
        void peekArchiveContents(item);
      });
  };

  const removeQueuedFile = (key: string) => {
    setQueuedItems(items => items.filter(item => item.key !== key));
    setQueueIssue(null);
  };

  const removeFolderGroup = (folderName: string) => {
    setQueuedItems(items => items.filter(item => item.folderName !== folderName));
    setQueueIssue(null);
  };

  const readAndDecodeFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const decoded = decodeBuffer(reader.result as ArrayBuffer);
          resolve(decoded.text);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const processZipFile = async (zipFile: File, detectedFiles: Subfile[], summaries: TrackSummary[]) => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const entries = Object.values(zip.files).filter(entry => !entry.dir);
      if (entries.length > CLIENT_IMPORT_LIMITS.maxArchiveEntries) {
        addLog(`字幕包条目过多，最多允许 ${CLIENT_IMPORT_LIMITS.maxArchiveEntries} 项：${zipFile.name}`, 'error');
        return 0;
      }

      const subtitleEntries = entries.filter(entry => isSubtitleExtension(getExtension(entry.name)));
      if (subtitleEntries.length > CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries) {
        addLog(`字幕包内字幕轨过多，最多允许 ${CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries} 条：${zipFile.name}`, 'error');
        return 0;
      }

      const zipDetectedFiles: Subfile[] = [];
      const zipSummaries: TrackSummary[] = [];
      let decodedBytes = 0;
      const ignoredCount = entries.length - subtitleEntries.length;

      for (const zipEntry of subtitleEntries) {
        const buffer = await zipEntry.async('arraybuffer');
        decodedBytes += buffer.byteLength;
        if (buffer.byteLength > CLIENT_IMPORT_LIMITS.maxSubtitleBytes || decodedBytes > CLIENT_IMPORT_LIMITS.maxArchiveUncompressedBytes) {
          addLog(`字幕包解压后体积超出安全限制，已拒绝导入：${zipFile.name}`, 'error');
          return ignoredCount;
        }

        const decoded = decodeBuffer(buffer);
        const detected = detectSubtitleLanguage(zipEntry.name, decoded.text);
        const ext = getExtension(zipEntry.name);
        const subfile: Subfile = {
          id: `zip_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
          name: zipEntry.name.split('/').pop() || zipEntry.name,
          text: decoded.text,
          lang: detected.lang,
          languagePair: detected.languagePair,
          isBilingual: detected.isBilingual,
          isCommentary: /(commentary|comment|director|解说|导轨)/i.test(zipEntry.name),
          size: decoded.text.length
        };
        zipDetectedFiles.push(subfile);
        zipSummaries.push({
          name: subfile.name,
          format: ext === 'ass' ? 'ASS' : 'SRT',
          lang: describeTrack(subfile),
          isBilingual: detected.isBilingual,
          isCommentary: subfile.isCommentary,
          source: 'zip',
        });
      }

      if (subtitleEntries.length === 0) {
        addLog(`字幕包内未检测到可用字幕：${zipFile.name}`, 'error');
      } else {
        detectedFiles.push(...zipDetectedFiles);
        summaries.push(...zipSummaries);
      }
      return ignoredCount;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`字幕包读取失败：${message}`, "error");
      return 0;
    }
  };

  const processLocalArchiveFile = async (archiveFile: File, detectedFiles: Subfile[], summaries: TrackSummary[]) => {
    try {
      const { files, ignoredEntries } = await extractLocalArchiveSubtitles(archiveFile, {
        maxEntries: CLIENT_IMPORT_LIMITS.maxArchiveEntries,
        maxSubtitleEntries: CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries,
        maxSubtitleBytes: CLIENT_IMPORT_LIMITS.maxSubtitleBytes,
        maxUncompressedBytes: CLIENT_IMPORT_LIMITS.maxArchiveUncompressedBytes,
      });

      for (const extractedFile of files) {
        const text = await readAndDecodeFile(extractedFile);
        const detected = detectSubtitleLanguage(extractedFile.name, text);
        const ext = getExtension(extractedFile.name);
        const subfile: Subfile = {
          id: `archive_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: extractedFile.name,
          text,
          lang: detected.lang,
          languagePair: detected.languagePair,
          isBilingual: detected.isBilingual,
          isCommentary: /(commentary|comment|director|解说|导轨)/i.test(extractedFile.name),
          size: extractedFile.size,
        };
        detectedFiles.push(subfile);
        summaries.push({
          name: subfile.name,
          format: ext === 'ass' ? 'ASS' : 'SRT',
          lang: describeTrack(subfile),
          isBilingual: detected.isBilingual,
          isCommentary: subfile.isCommentary,
          source: 'archive',
        });
      }

      if (files.length === 0) addLog(`字幕包内未检测到可用字幕：${archiveFile.name}`, 'error');
      return ignoredEntries;
    } catch (error: unknown) {
      const message = error instanceof LocalArchiveError
        ? error.code === 'encrypted'
          ? '压缩包已加密，请先在本地解压后导入'
          : error.code === 'limits'
            ? `压缩包超出本地导入安全限制：${error.message}`
            : `压缩包无法读取：${error.message}`
        : error instanceof Error
          ? `压缩包无法读取：${error.message}`
          : '压缩包无法读取，请先在本地解压后导入';
      addLog(`${message}：${archiveFile.name}`, 'error');
      return 0;
    }
  };

  const handleFilesProcess = async (filesList: File[]) => {
    const batchIssue = getClientBatchIssue(filesList);
    if (batchIssue) {
      setIngestClearing(false);
      setPhase('error', '本次导入超出安全限制');
      addLog(batchIssue, 'error');
      return;
    }

    const preflight = filesList.map((file) => createPreflightItem(file));
    setResultChips([]);

    const validItems = preflight.filter(item => item.accepted);
    const rejectedItems = preflight.filter(item => !item.accepted);

    if (rejectedItems.length > 0) {
      const archiveCount = rejectedItems.filter(item => item.kind === 'archive-unsupported').length;
      const tooLargeCount = rejectedItems.filter(item => item.kind === 'too-large').length;
      const unsupportedCount = rejectedItems.length - archiveCount - tooLargeCount;
      if (archiveCount > 0) {
        addLog(`有 ${archiveCount} 个分卷压缩包需先在本地完整解压`, 'error');
      }
      if (tooLargeCount > 0) {
        addLog(`有 ${tooLargeCount} 个文件超过本地导入安全限制`, 'error');
      }
      if (unsupportedCount > 0) {
        addLog(`已忽略 ${unsupportedCount} 个非字幕资源`, 'info');
      }
    }

    if (validItems.length === 0) {
      setIngestClearing(false);
      setPhase('error', '未检测到可用字幕');
      return;
    }

    // Cold-start clearing ceremony (not replayed when appending from TaskList).
    const ceremonyStartedAt = Date.now();
    setIngestClearing(true);
    setIsParsing(true);
    let phaseStartedAt = Date.now();
    setPhase('reading');
    setParsingFiles(preflight.map(item => ({
      name: item.name,
      size: item.file.size,
      status: item.accepted ? 'reading' : 'skipped',
      note: item.note,
    })));

    const detectedFiles: Subfile[] = [];
    const summaries: TrackSummary[] = [];
    let ignoredInArchiveCount = 0;

    setResultChips([`${filesList.length} 个文件`, `${validItems.length} 个可整理`]);
    await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);

    phaseStartedAt = Date.now();
    setPhase('parsing');
    for (const item of validItems) {
      const file = item.file;
      if (item.kind === 'zip') {
        ignoredInArchiveCount += await processZipFile(file, detectedFiles, summaries);
      } else if (item.kind === 'archive') {
        ignoredInArchiveCount += await processLocalArchiveFile(file, detectedFiles, summaries);
      } else {
        try {
          const text = await readAndDecodeFile(file);
          const detected = detectSubtitleLanguage(file.name, text);
          const ext = getExtension(file.name);
          const subfile: Subfile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            name: file.name,
            text,
            lang: detected.lang,
            languagePair: detected.languagePair,
            isBilingual: detected.isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: text.length
          };
          detectedFiles.push(subfile);
          summaries.push({
            name: file.name,
            format: ext === 'ass' ? 'ASS' : 'SRT',
            lang: describeTrack(subfile),
            isBilingual: detected.isBilingual,
            isCommentary: subfile.isCommentary,
            source: 'file',
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          addLog(`字幕文件读取失败：${message}`, "error");
        }
      }
    }
    await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);

    if (detectedFiles.length > 0) {
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'analyzing' : 'skipped',
        note: item.note,
      })));

      const bilingualCount = summaries.filter(item => item.isBilingual).length;
      const assCount = summaries.filter(item => item.format === 'ASS').length;
      const srtCount = summaries.filter(item => item.format === 'SRT').length;
      const sourceArchiveCount = preflight.filter(item => item.kind === 'zip' || item.kind === 'archive').length;
      const chips = [
        `${detectedFiles.length} 条字幕轨`,
        assCount > 0 ? `${assCount} 条样式字幕轨` : '',
        srtCount > 0 ? `${srtCount} 条标准字幕轨` : '',
        bilingualCount > 0 ? `${bilingualCount} 条双语轨` : '',
        sourceArchiveCount > 0 ? `${sourceArchiveCount} 个字幕包` : '',
        ignoredInArchiveCount > 0 ? `已忽略 ${ignoredInArchiveCount} 个非字幕资源` : '',
      ].filter(Boolean);
      setResultChips(chips);

      phaseStartedAt = Date.now();
      setPhase('binding');
      await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);

      phaseStartedAt = Date.now();
      setPhase('metadata');
      let displayTitle = '影视数据';
      if (validItems[0]) {
        const parsedCandidates = validItems.map(item => parseMediaFilename(item.name));
        const titleCandidate = parsedCandidates.find(item => item.hasUsableTitle);
        const episodeCandidate = parsedCandidates.find(item => item.episodeKey);
        const guess = `${titleCandidate?.title || ''} ${episodeCandidate?.episodeKey || ''}`.trim() || validItems[0].name;
        const identity = assessMediaIdentity(guess);
        if (identity.shouldAutoSearchTmdb) {
          displayTitle = identity.title.length > 42 ? identity.title.slice(0, 40) + '…' : identity.title;
          setIngestMessage(`已识别影片信息：${displayTitle}`);
        } else {
          setIngestMessage(identity.episodeKey ? '已识别集数，请补充片名以匹配影片资料' : '文件名信息不足，先完成轨道整理');
        }
      }
      setResultChips(prev => [...prev.slice(0, 5), displayTitle === '影视数据' ? '影片待确认' : '影片信息已识别']);

      // Establish tasks early so TMDB can run in parallel with the release gate.
      processFiles(detectedFiles);
      await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);
      await waitForCeremonyRelease(ceremonyStartedAt);

      setPhase('ready');
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'success' : 'skipped',
        note: item.note,
      })));
      setIngestMessage('整理完成，可开始核对');
      await sleep(PHASE_FLOOR_MS);

      setIsParsing(false);
      setIngestClearing(false);
      addLog('字幕已整理完成', 'success');
    } else {
      setIsParsing(false);
      setIngestClearing(false);
      setPhase('error');
      addLog("未检测到可用字幕", "error");
    }
  };

  useEffect(() => {
    if (isParsing || queuedItems.length === 0) {
      setEdgeNext(null);
      return;
    }
    const acceptedCount = queuedItems.filter((item) => item.accepted).length;
    const disabled = acceptedCount === 0 || Boolean(queueIssue);
    const files = queuedItems.map((item) => item.file);
    setEdgeNext({
      label: '下一步',
      disabled,
      disabledReason: queueIssue || '清单中暂无可整理的字幕文件，移除无效项或补充文件后继续。',
      onClick: () => {
        if (disabled) return;
        void handleFilesProcess(files);
      },
    });
    return () => setEdgeNext(null);
    // handleFilesProcess closes over current ingest helpers; rebind when queue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on queue snapshot
  }, [isParsing, queuedItems, queueIssue, setEdgeNext]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    // 目录句柄必须在事件同步阶段取出（await 之后 dataTransfer 即失效）
    const droppedEntries: FileSystemEntry[] = [];
    const plainFiles: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          droppedEntries.push(entry);
        } else {
          const file = item.getAsFile();
          if (file) plainFiles.push(file);
        }
      }
    } else {
      const filesList = e.dataTransfer.files;
      for (let i = 0; i < filesList.length; i++) {
        plainFiles.push(filesList[i]);
      }
    }

    const incoming: IncomingFile[] = plainFiles.map((file) => ({ file }));
    if (droppedEntries.length > 0) {
      const budget = { remaining: MAX_DROPPED_ENTRIES };
      for (const entry of droppedEntries) {
        await collectEntryFiles(entry, incoming, budget);
      }
      if (budget.remaining <= 0) {
        addLog(`拖入内容过多，仅读取前 ${MAX_DROPPED_ENTRIES} 个文件`, 'info');
      }
    }

    if (incoming.length === 0) return;

    // Empty → queue: short accept flash (CSS only), then reveal tree.
    if (queuedItems.length === 0 && !shouldReduceMotion) {
      setIsAccepting(true);
      await sleep(180);
      addFilesToQueue(incoming);
      setIsAccepting(false);
      return;
    }
    addFilesToQueue(incoming);
  };

  if (isParsing) {
    return (
      <div className="relative mx-auto flex w-full max-w-lg min-h-[280px] flex-col items-center justify-center px-2">
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="h-9 w-9 rounded-full border-2 border-[var(--v4-line-strong)] border-t-[var(--v4-accent)] animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[var(--v4-text-muted)]">文件仅在本机处理</p>
        </div>
      </div>
    );
  }

  const rejectedItems = queuedItems.filter(item => !item.accepted);
  const looseSubtitleCount = queuedItems.filter(item => item.kind === 'subtitle').length;
  const peekedTrackCount = queuedItems.reduce((sum, item) => sum + (item.archiveEntries?.length || 0), 0);
  const trackCount = looseSubtitleCount + peekedTrackCount;
  const archivePeekPending = queuedItems.some(item => (item.kind === 'zip' || item.kind === 'archive') && item.archivePeekStatus === 'loading');
  const totalBytes = queuedItems.reduce((sum, item) => sum + item.file.size, 0);

  const languagesForItem = (item: PreflightItem): string[] => {
    if (item.archiveEntries && item.archiveEntries.length > 0) {
      return [...new Set(item.archiveEntries.map((entry) => entry.languageLabel))];
    }
    if (item.kind === 'subtitle') {
      return [PREFLIGHT_LANGUAGE_LABELS[detectLanguageByFilename(item.name)] || '语言待识别'];
    }
    return [];
  };

  // 文件夹导入的条目按顶层目录归组，队列渲染为「文件夹 → 子文件」树
  type RenderNode =
    | { type: 'item'; item: PreflightItem }
    | { type: 'folder'; folder: string; items: PreflightItem[] };

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

  /** 压缩包子文件树（顶层与文件夹内嵌套共用）。 */
  const renderArchiveSubtree = (item: PreflightItem) => {
    if (item.kind !== 'zip' && item.kind !== 'archive') return null;
    if (item.archivePeekStatus !== 'error' && !(item.archiveEntries && item.archiveEntries.length > 0)) return null;
    return (
      <div className="ingest-halo-tree mt-2.5">
        {item.archivePeekStatus === 'error' && (
          <p className="mb-1.5 text-xs font-normal text-[var(--v4-danger)]">{item.archivePeekError || item.note}</p>
        )}
        {item.archiveEntries?.map((entry, entryIndex) => (
          <motion.div
            key={`${item.key}:${entry.name}`}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.26,
              delay: shouldReduceMotion ? 0 : leafDelayMs(entryIndex) / 1000,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="ingest-halo-leaf grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5"
            style={{ '--leaf-delay': `${leafDelayMs(entryIndex)}ms` } as React.CSSProperties}
          >
            <FileFormatIcon name={entry.name} size="md" />
            <span className="min-w-0 truncate text-[13px] font-normal leading-snug text-[var(--v4-text-muted)]" title={entry.name}>
              {entry.name}
            </span>
            <LanguageMark label={entry.languageLabel} className="justify-self-end" />
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="ingest-drop-zone group/outer flex w-full flex-col items-center py-1 md:py-2"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`ingest-stage relative z-10 select-none px-3 py-6 md:px-4 md:py-8 ${
          queuedItems.length > 0 ? 'has-queue' : 'is-empty'
        } ${isDragging ? 'is-dragging' : ''} ${isAccepting ? 'is-accepting' : ''}`}
      >
        <AnimatePresence mode="wait">
          {queuedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              // 快出：空态元素迅速让位，让「文件落桌」成为主角
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.985, transition: { duration: 0.14 } }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full justify-center"
            >
              {/* 整卡即落点：点击任意处开文件选择，拖入高亮吸附 */}
              <div
                className="ingest-start-card"
                role="button"
                tabIndex={0}
                aria-label="选择或拖入字幕文件"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="ingest-start-card__glyphs" aria-hidden="true">
                  {(['srt', 'ass', 'zip', 'rar', '7z'] as const).map((format, index) => (
                    <motion.span
                      key={format}
                      className="ingest-start-card__glyph"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.32,
                        delay: shouldReduceMotion ? 0 : 0.08 + index * 0.05,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <FileFormatIcon format={format} size="lg" />
                    </motion.span>
                  ))}
                </div>
                <h3 className="ingest-start-card__title">
                  {isDragging ? '松开即可加入' : '把字幕放进来'}
                </h3>
                <p className="ingest-start-card__sub">
                  拖入文件、文件夹或字幕包，全程只在本机处理
                </p>
                <div
                  className={`ingest-start-card__cta transition-opacity duration-[var(--v4-dur)] ${
                    isDragging ? 'pointer-events-none opacity-40' : 'opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}
                    className="v4-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-[var(--v5-radius-panel)] bg-[var(--v4-accent)] px-9 text-sm font-bold text-[var(--v4-accent-ink)] shadow-[0_8px_24px_rgba(239,141,95,0.25)] transition-[filter,transform,background-color] duration-[var(--v4-dur-fast)] hover:brightness-105 hover:-translate-y-0.5"
                  >
                    <FilePlus className="h-[18px] w-[18px] shrink-0 stroke-[2.25]" aria-hidden="true" />
                    选择字幕
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); folderInputRef.current?.click(); }}
                    className="v4-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-[var(--v5-radius-panel)] border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)]/70 px-5 text-sm font-semibold text-[var(--v4-text-muted)] transition-colors duration-[var(--v4-dur-fast)] hover:bg-[var(--v4-panel-raised)] hover:text-[var(--v4-text)]"
                  >
                    <FolderPlus className="h-[18px] w-[18px] shrink-0 stroke-[2]" aria-hidden="true" />
                    文件夹
                  </button>
                </div>
                <p className="ingest-start-card__hint">
                  支持 SRT / ASS 字幕，以及 ZIP / RAR / 7Z 字幕包
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="queue"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col text-left"
            >
              {isDragging && (
                <p className="mb-4 px-1 text-sm font-medium text-[var(--v4-accent-strong)]">
                  松开以继续添加
                </p>
              )}
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-tight text-[var(--v4-text)]">已添加</h3>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-[var(--v4-text-muted)]">
                    {archivePeekPending && trackCount === 0
                      ? '正在读取…'
                      : `${queuedItems.length} 项 · ${trackCount} 条字幕 · ${formatBytes(totalBytes)}`}
                    {rejectedItems.length > 0 ? ` · ${rejectedItems.length} 项已忽略` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="relative" ref={addMenuRef}>
                    <button
                      type="button"
                      onClick={() => setAddMenuOpen((open) => !open)}
                      className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)]/80 px-3 text-sm font-semibold text-[var(--v4-text)] backdrop-blur-sm hover:bg-[var(--v4-accent-soft)]"
                      aria-expanded={addMenuOpen}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      添加
                      <ChevronDown className={`h-3.5 w-3.5 text-[var(--v4-text-faint)] transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {addMenuOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[11rem] overflow-hidden rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] shadow-[0_12px_28px_rgba(0,0,0,0.4)]">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                          onClick={() => { setAddMenuOpen(false); fileInputRef.current?.click(); }}
                        >
                          <FilePlus className="h-4 w-4 text-[var(--v4-accent-strong)]" />
                          文件 / 压缩包
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-t border-[var(--v4-line)] px-3 py-2.5 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-[var(--v4-accent-soft)]"
                          onClick={() => { setAddMenuOpen(false); folderInputRef.current?.click(); }}
                        >
                          <FolderPlus className="h-4 w-4 text-[var(--v4-accent-strong)]" />
                          文件夹
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setQueuedItems([]); setQueueIssue(null); }}
                    className="v4-focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-normal text-[var(--v4-text-muted)] transition-colors hover:text-[var(--v4-text)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空
                  </button>
                </div>
              </header>

              <div className="max-h-[min(420px,52vh)] space-y-4 overflow-y-auto px-1 pb-1">
                {renderNodes.map((node, nodeIndex) => {
                  // 文件「落桌」：从上方轻降 + 微缩回位，像放到桌面上
                  const landing = {
                    initial: shouldReduceMotion ? false : { opacity: 0, y: -14, scale: 1.03 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    transition: {
                      duration: shouldReduceMotion ? 0 : 0.34,
                      delay: shouldReduceMotion ? 0 : Math.min(nodeIndex * 0.05, 0.2),
                      ease: [0.16, 1, 0.3, 1] as const,
                    },
                  };

                  if (node.type === 'folder') {
                    const folderBytes = node.items.reduce((sum, row) => sum + row.file.size, 0);
                    const subtitleCount = node.items.filter((row) => row.kind === 'subtitle').length
                      + node.items.reduce((sum, row) => sum + (row.archiveEntries?.length || 0), 0);
                    return (
                      <motion.div key={`folder:${node.folder}`} {...landing} className="min-w-0">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                          <div className="ingest-halo-root">
                            <FileFormatIcon format="folder" size="lg" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold leading-snug tracking-tight text-[var(--v4-text)]" title={node.folder}>
                              {node.folder}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)]">
                              本地文件夹 · {node.items.length} 个文件
                              {subtitleCount > 0 ? ` · ${subtitleCount} 条字幕` : ''} · {formatBytes(folderBytes)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFolderGroup(node.folder)}
                            className="v4-focus-ring grid h-8 w-8 place-items-center rounded-md text-[var(--v4-text-muted)] transition-colors hover:bg-[color:rgba(201,138,134,0.1)] hover:text-[var(--v4-danger)]"
                            aria-label={`移除文件夹 ${node.folder}`}
                          >
                            <X className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                        </div>

                        <div className="ingest-halo-tree mt-2.5">
                          {node.items.map((item, leafIndex) => {
                            const langs = languagesForItem(item);
                            // 去掉顶层目录名，保留剩余相对路径（如 S01/xx.srt）
                            const subPath = item.relativePath
                              ? item.relativePath.split('/').slice(1).join('/')
                              : item.name;
                            return (
                              <motion.div
                                key={item.key}
                                initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: shouldReduceMotion ? 0 : 0.26,
                                  delay: shouldReduceMotion ? 0 : leafDelayMs(leafIndex) / 1000,
                                  ease: [0.16, 1, 0.3, 1],
                                }}
                                className="ingest-halo-leaf min-w-0 py-1.5"
                                style={{ '--leaf-delay': `${leafDelayMs(leafIndex)}ms` } as React.CSSProperties}
                              >
                                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5">
                                  <FileFormatIcon name={item.name} size="md" />
                                  <div className="min-w-0">
                                    <p
                                      className={`truncate text-[13px] leading-snug ${item.accepted ? 'text-[var(--v4-text)]' : 'text-[var(--v4-danger)]'}`}
                                      title={item.relativePath || item.name}
                                    >
                                      {subPath}
                                    </p>
                                    {!item.accepted && (
                                      <p className="mt-0.5 text-xs font-normal text-[var(--v4-danger)]">{item.note}</p>
                                    )}
                                  </div>
                                  {langs.length > 0 ? (
                                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                                      {langs.map((label) => (
                                        <LanguageMark key={`${item.key}:${label}`} label={label} />
                                      ))}
                                    </span>
                                  ) : (
                                    <span aria-hidden="true" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeQueuedFile(item.key)}
                                    className="v4-focus-ring grid h-7 w-7 place-items-center rounded-md text-[var(--v4-text-faint)] transition-colors hover:bg-[color:rgba(201,138,134,0.1)] hover:text-[var(--v4-danger)]"
                                    aria-label={`移除 ${item.name}`}
                                  >
                                    <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                                  </button>
                                </div>
                                {renderArchiveSubtree(item)}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  }

                  const item = node.item;
                  const langs = languagesForItem(item);
                  const isArchive = item.kind === 'zip' || item.kind === 'archive';
                  return (
                    <motion.div key={item.key} {...landing} className="min-w-0">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <div className="ingest-halo-root">
                          <FileFormatIcon format={resolveFileFormat(item.name)} size="lg" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-snug tracking-tight text-[var(--v4-text)]" title={item.name}>
                            {item.name}
                          </p>
                          {!isArchive && (
                            <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium ${item.accepted ? 'text-[var(--v4-text-muted)]' : 'text-[var(--v4-danger)]'}`}>
                              <span>{item.note} · {formatBytes(item.file.size)}</span>
                              {langs.length > 0 && (
                                <>
                                  <span aria-hidden="true" className="text-[var(--v4-text-faint)]">·</span>
                                  <span className="inline-flex flex-wrap items-center gap-1">
                                    {langs.map((label) => (
                                      <LanguageMark key={`${item.name}:${label}`} label={label} />
                                    ))}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {isArchive && item.archivePeekStatus === 'loading' && (
                            <p className="mt-1 text-xs font-normal text-[var(--v4-text-muted)]">
                              {item.note && item.note !== '正在查看包内字幕…'
                                ? item.note
                                : '正在读取包内字幕…'}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQueuedFile(item.key)}
                          className="v4-focus-ring grid h-8 w-8 place-items-center rounded-md text-[var(--v4-text-muted)] transition-colors hover:bg-[color:rgba(201,138,134,0.1)] hover:text-[var(--v4-danger)]"
                          aria-label={`移除 ${item.name}`}
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      </div>

                      {renderArchiveSubtree(item)}
                    </motion.div>
                  );
                })}
              </div>

              <footer className="mt-6 px-1">
                {(queueIssue || rejectedItems.length > 0) && (
                  <p className="mb-3 text-xs leading-5 text-[var(--v4-warning)]">
                    {queueIssue || `${rejectedItems.length} 项无法处理，可移除后继续。`}
                  </p>
                )}
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--v4-text-muted)]">
                  <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                  仅在本机读取，不会上传
                </span>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".srt,.ass,.zip,.rar,.7z"
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(Array.from(e.target.files || []).map((file) => ({ file })));
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(e) => {
          // webkitRelativePath 携带「文件夹/子目录/文件」的本地路径
          addFilesToQueue(
            Array.from(e.target.files || []).map((file) => ({
              file,
              relativePath: file.webkitRelativePath || undefined,
            })),
          );
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
};
