'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectLanguageByFilename, detectSubtitleLanguage, parseMediaFilename, assessMediaIdentity } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { ArrowRight, ChevronDown, FilePlus, FolderPlus, HardDrive, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CLIENT_IMPORT_LIMITS, getClientBatchIssue, getClientFileIssue } from '@/utils/importSafety';
import {
  extractLocalArchiveSubtitles,
  listLocalArchiveSubtitles,
  LocalArchiveError,
  warmLocalArchiveEngine,
} from '@/utils/localArchive';
import { FileFormatIcon, LanguageMark, resolveFileFormat } from '@/components/ui/FileFormatIcon';

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
  name: string;
  extension: string;
  kind: PreflightKind;
  label: string;
  accepted: boolean;
  note: string;
  archiveEntries?: ArchiveEntryPreview[];
  archivePeekStatus?: 'idle' | 'loading' | 'ready' | 'error';
  archivePeekError?: string;
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

const FORMAT_MARKS = ['SRT', 'ASS', 'ZIP', 'RAR', '7Z'];

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

const getQueueKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

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

const createPreflightItem = (file: File): PreflightItem => {
  const extension = getExtension(file.name);
  const sizeIssue = getClientFileIssue(file);
  if (sizeIssue) {
    return {
      file,
      name: file.name,
      extension: extension || 'unknown',
      kind: 'too-large',
      label: extension ? extension.toUpperCase() : '未知',
      accepted: false,
      note: sizeIssue,
    };
  }
  if (isSubtitleExtension(extension)) {
    const language = detectLanguageByFilename(file.name);
    return {
      file,
      name: file.name,
      extension,
      kind: 'subtitle',
      label: extension.toUpperCase(),
      accepted: true,
      note: `${PREFLIGHT_LANGUAGE_LABELS[language]} · ${extension === 'ass' ? '样式字幕轨' : '标准字幕轨'}`,
    };
  }
  if (extension === 'zip') {
    return {
      file,
      name: file.name,
      extension,
      kind: 'zip',
      label: 'ZIP',
      accepted: true,
      note: '正在查看包内字幕…',
      archivePeekStatus: 'loading',
      archiveEntries: [],
    };
  }
  if (isMultipartArchiveName(file.name)) {
    return {
      file,
      name: file.name,
      extension,
      kind: 'archive-unsupported',
      label: extension.toUpperCase(),
      accepted: false,
      note: '分卷压缩包请先在本地完整解压',
    };
  }
  if (extension === '7z' || extension === 'rar') {
    return {
      file,
      name: file.name,
      extension,
      kind: 'archive',
      label: extension.toUpperCase(),
      accepted: true,
      note: '正在查看包内字幕…',
      archivePeekStatus: 'loading',
      archiveEntries: [],
    };
  }
  return {
    file,
    name: file.name,
    extension: extension || 'unknown',
    kind: 'unsupported',
    label: extension ? extension.toUpperCase() : '未知',
    accepted: false,
    note: '已忽略非字幕资源',
  };
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
  const { isDragging, setIsDragging, processFiles, addLog, setIngestClearing } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  // Parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parsingFiles, setParsingFiles] = useState<ParsingFileState[]>([]);
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
    const key = getQueueKey(item.file);

    // Hint only — never flip to ready/empty (that used to show「0 条字幕」as a fake success).
    const softWatchdog = window.setTimeout(() => {
      setQueuedItems((current) => current.map((row) => {
        if (getQueueKey(row.file) !== key) return row;
        if (row.archivePeekStatus !== 'loading') return row;
        return {
          ...row,
          note: '读取较慢，可直接点开始整理',
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
        if (getQueueKey(row.file) !== key) return row;
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
        if (getQueueKey(row.file) !== key) return row;
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

  const addFilesToQueue = (filesList: File[]) => {
    if (filesList.length === 0) return;
    const existingKeys = new Set(queuedItems.map(item => getQueueKey(item.file)));
    const seenKeys = new Set(existingKeys);
    const additions = filesList
      .filter(file => {
        const key = getQueueKey(file);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .map(createPreflightItem);
    const nextItems = [...queuedItems, ...additions];
    const batchIssue = getClientBatchIssue(nextItems.map(item => item.file));

    if (batchIssue) {
      setQueueIssue(batchIssue);
      addLog(batchIssue, 'error');
      return;
    }

    setQueueIssue(null);
    setQueuedItems(nextItems);
    if (additions.length < filesList.length) {
      addLog(`已忽略 ${filesList.length - additions.length} 个重复文件`, 'info');
    }
    additions
      .filter(item => item.kind === 'zip' || item.kind === 'archive')
      .forEach(item => {
        void peekArchiveContents(item);
      });
  };

  const removeQueuedFile = (file: File) => {
    const key = getQueueKey(file);
    setQueuedItems(items => items.filter(item => getQueueKey(item.file) !== key));
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

    const preflight = filesList.map(createPreflightItem);
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

    const filesArray: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) filesArray.push(file);
        }
      }
    } else {
      const filesList = e.dataTransfer.files;
      for (let i = 0; i < filesList.length; i++) {
        filesArray.push(filesList[i]);
      }
    }

    if (filesArray.length === 0) return;

    // Empty → queue: short accept flash (CSS only), then reveal tree.
    if (queuedItems.length === 0 && !shouldReduceMotion) {
      setIsAccepting(true);
      await sleep(180);
      addFilesToQueue(filesArray);
      setIsAccepting(false);
      return;
    }
    addFilesToQueue(filesArray);
  };

  if (isParsing) {
    const activeStepIndex = Math.max(0, PHASE_STEPS.findIndex(step => step.id === ingestPhase));
    return (
      <div className="relative mx-auto flex w-full max-w-3xl min-h-[420px] flex-col items-center justify-center px-2">
        <div className="ingest-receive-surface relative z-10 w-full overflow-hidden rounded-lg px-6 py-10 md:px-10 md:py-12">
          <motion.div
            key={ingestMessage}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-xl text-center"
          >
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--v4-text)] md:text-[1.85rem]">
              {ingestMessage}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--v4-text-muted)]">
              请保持页面开启；文件不会离开这台设备。
            </p>
          </motion.div>

          <ol
            className="mx-auto mt-9 flex w-full max-w-md items-center justify-between gap-1"
            aria-label={`整理进度 ${activeStepIndex + 1} / ${PHASE_STEPS.length}`}
          >
            {PHASE_STEPS.map((step, index) => {
              const complete = activeStepIndex >= index || ingestPhase === 'ready';
              const current = activeStepIndex === index && ingestPhase !== 'ready';
              return (
                <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span
                    className={`h-1 w-full rounded-full transition-colors duration-500 ${
                      complete || current ? 'bg-[var(--v4-accent)]' : 'bg-[var(--v4-line-strong)]'
                    }`}
                  />
                  <span className={`text-[11px] font-medium ${complete || current ? 'text-[var(--v4-text)]' : 'text-[var(--v4-text-faint)]'}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-2">
            {(resultChips.length > 0 ? resultChips : parsingFiles.slice(0, 4).map(file => file.note || file.name)).map((chip, index) => (
              <motion.span
                key={`${chip}-${index}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldReduceMotion ? 0 : index * 0.04, duration: 0.22 }}
                className="rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-2.5 py-1 text-xs text-[var(--v4-text-muted)]"
              >
                {chip}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const acceptedItems = queuedItems.filter(item => item.accepted);
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
        {queuedItems.length === 0 && (
          <div className="ingest-focus" aria-hidden="true">
            <div className="ingest-film">
              <div className="ingest-film__rail ingest-film__rail--left" />
              <div className="ingest-film__frame" />
              <div className="ingest-film__rail ingest-film__rail--right" />
            </div>
            <span className="ingest-focus__mark ingest-focus__mark--tl" />
            <span className="ingest-focus__mark ingest-focus__mark--tr" />
            <span className="ingest-focus__mark ingest-focus__mark--bl" />
            <span className="ingest-focus__mark ingest-focus__mark--br" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {queuedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="ingest-empty-copy mx-auto text-center"
            >
              <h3 className="text-balance text-[1.75rem] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[2rem]">
                {isDragging ? '松手加入清单' : '把字幕拖到这里'}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-7 text-[var(--v4-text-muted)]">
                {isDragging
                  ? '不会立刻整理，之后仍可增删。'
                  : '单轨、压缩包或整夹都行。先入清单，确认后再整理。'}
              </p>
              <p
                className={`mt-5 text-[12px] tracking-[0.16em] text-[var(--v4-text-muted)] transition-opacity duration-200 ${
                  isDragging ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
                aria-label="支持的格式"
              >
                {FORMAT_MARKS.join(' · ')}
              </p>

              <div
                className={`mx-auto mt-8 inline-flex max-w-full overflow-hidden rounded-md border border-[var(--v4-line-strong)] shadow-[0_1px_0_rgba(255,244,226,0.04)] transition-opacity duration-200 ${
                  isDragging ? 'pointer-events-none opacity-30' : 'opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="v4-focus-ring inline-flex h-11 items-center justify-center gap-2 bg-[var(--v4-accent)] px-5 text-sm font-semibold text-[var(--v4-accent-ink)] transition-colors hover:bg-[var(--v4-accent-strong)] sm:px-6"
                >
                  <FilePlus className="h-[18px] w-[18px] shrink-0 stroke-[2.25]" aria-hidden="true" />
                  选择文件
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="v4-focus-ring inline-flex h-11 items-center justify-center gap-2 border-l border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] px-5 text-sm font-semibold text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-accent-soft)] sm:px-6"
                >
                  <FolderPlus className="h-[18px] w-[18px] shrink-0 stroke-[2.25]" aria-hidden="true" />
                  选择文件夹
                </button>
              </div>

              <p
                className={`mt-7 inline-flex items-center justify-center gap-2 text-sm text-[var(--v4-text-muted)] transition-opacity duration-200 ${
                  isDragging ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                仅在当前设备读取，不上传
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="queue"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col text-left"
            >
              {isDragging && (
                <p className="mb-4 px-1 text-sm font-medium text-[var(--v4-accent-strong)]">
                  松手继续加入 · 不会立刻整理
                </p>
              )}
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-tight text-[var(--v4-text)]">已添加</h3>
                  <p className="mt-0.5 text-xs font-normal tabular-nums text-[var(--v4-text-muted)]">
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
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-white/[0.04]"
                          onClick={() => { setAddMenuOpen(false); fileInputRef.current?.click(); }}
                        >
                          <FilePlus className="h-4 w-4 text-[var(--v4-accent-strong)]" />
                          文件 / 压缩包
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-t border-[var(--v4-line)] px-3 py-2.5 text-left text-sm font-normal text-[var(--v4-text)] hover:bg-white/[0.04]"
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
                {queuedItems.map((item, itemIndex) => {
                  const langs = languagesForItem(item);
                  const isArchive = item.kind === 'zip' || item.kind === 'archive';
                  return (
                    <motion.div
                      key={getQueueKey(item.file)}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.28,
                        delay: shouldReduceMotion ? 0 : Math.min(itemIndex * 0.04, 0.16),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="min-w-0"
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <div className="ingest-halo-root">
                          <FileFormatIcon format={resolveFileFormat(item.name)} size="lg" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-snug tracking-tight text-[var(--v4-text)]" title={item.name}>
                            {item.name}
                          </p>
                          {!isArchive && (
                            <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal ${item.accepted ? 'text-[var(--v4-text-muted)]' : 'text-[var(--v4-danger)]'}`}>
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
                          onClick={() => removeQueuedFile(item.file)}
                          className="v4-focus-ring grid h-8 w-8 place-items-center rounded-md text-[var(--v4-text-muted)] transition-colors hover:bg-[color:rgba(201,138,134,0.1)] hover:text-[var(--v4-danger)]"
                          aria-label={`移除 ${item.name}`}
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      </div>

                      {isArchive && (item.archivePeekStatus === 'error' || (item.archiveEntries && item.archiveEntries.length > 0)) && (
                        <div className="ingest-halo-tree mt-2.5">
                          {item.archivePeekStatus === 'error' && (
                            <p className="mb-1.5 text-xs font-normal text-[var(--v4-danger)]">{item.archivePeekError || item.note}</p>
                          )}
                          {item.archiveEntries?.map((entry, entryIndex) => (
                            <motion.div
                              key={`${item.name}:${entry.name}`}
                              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: shouldReduceMotion ? 0 : 0.24,
                                delay: shouldReduceMotion ? 0 : 0.06 + Math.min(entryIndex * 0.05, 0.2),
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="ingest-halo-leaf grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5"
                            >
                              <FileFormatIcon name={entry.name} size="md" />
                              <span className="min-w-0 truncate text-[13px] font-normal leading-snug text-[var(--v4-text-muted)]" title={entry.name}>
                                {entry.name}
                              </span>
                              <LanguageMark label={entry.languageLabel} className="justify-self-end" />
                            </motion.div>
                          ))}
                        </div>
                      )}
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
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--v4-text-muted)]">
                    <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                    仅在本机读取，不会上传
                  </span>
                  <button
                    type="button"
                    disabled={acceptedItems.length === 0 || Boolean(queueIssue)}
                    onClick={() => handleFilesProcess(queuedItems.map(item => item.file))}
                    className="v4-focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--v4-accent)] px-5 text-sm font-semibold text-[var(--v4-accent-ink)] transition-colors hover:bg-[var(--v4-accent-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    开始整理
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
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
          addFilesToQueue(Array.from(e.target.files || []));
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(Array.from(e.target.files || []));
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
};
