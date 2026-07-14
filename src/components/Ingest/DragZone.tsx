'use client';

import React, { useRef, useState } from 'react';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectLanguageByFilename, detectSubtitleLanguage, parseMediaFilename, assessMediaIdentity } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { Archive, ArrowRight, FilePlus, FileText, FolderPlus, HardDrive, Trash2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { CLIENT_IMPORT_LIMITS, getClientBatchIssue, getClientFileIssue } from '@/utils/importSafety';
import { extractLocalArchiveSubtitles, LocalArchiveError } from '@/utils/localArchive';

type ParseStatus = 'reading' | 'analyzing' | 'success' | 'warning' | 'skipped';

interface ParsingFileState {
  name: string;
  size: number;
  status: ParseStatus;
  note?: string;
}

type PreflightKind = 'subtitle' | 'zip' | 'archive' | 'archive-unsupported' | 'too-large' | 'unsupported';

interface PreflightItem {
  file: File;
  name: string;
  extension: string;
  kind: PreflightKind;
  label: string;
  accepted: boolean;
  note: string;
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
  { id: 'reading', label: '接收文件' },
  { id: 'parsing', label: '识别轨道' },
  { id: 'binding', label: '整理时间轴' },
  { id: 'metadata', label: '匹配片源' },
  { id: 'ready', label: '准备完成' },
];

const PHASE_COPY: Record<IngestPhase, string> = {
  idle: '拖入字幕包，建立字幕工作台',
  reading: '正在接收字幕包',
  parsing: '正在识别字幕轨',
  binding: '正在整理时间轴',
  metadata: '正在匹配片源信息',
  ready: '字幕工作台已准备完成',
  needs_review: '需要手动确认片源',
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
      note: '字幕包',
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
      note: '仅在本地提取 SRT / ASS',
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
  const { isDragging, setIsDragging, processFiles, addLog } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  // Parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parsingFiles, setParsingFiles] = useState<ParsingFileState[]>([]);
  const [isZoneActive, setIsZoneActive] = useState(false);
  const [ingestPhase, setIngestPhase] = useState<IngestPhase>('idle');
  const [ingestMessage, setIngestMessage] = useState(PHASE_COPY.idle);
  const [resultChips, setResultChips] = useState<string[]>([]);
  const [queuedItems, setQueuedItems] = useState<PreflightItem[]>([]);
  const [queueIssue, setQueueIssue] = useState<string | null>(null);

  const setPhase = (phase: IngestPhase, message = PHASE_COPY[phase]) => {
    setIngestPhase(phase);
    setIngestMessage(message);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            : '压缩包无法读取，请先在本地解压后导入'
        : '压缩包无法读取，请先在本地解压后导入';
      addLog(`${message}：${archiveFile.name}`, 'error');
      return 0;
    }
  };

  const handleFilesProcess = async (filesList: File[]) => {
    const batchIssue = getClientBatchIssue(filesList);
    if (batchIssue) {
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
      setPhase('error', '未检测到可用字幕');
      return;
    }

    // Show visual ingest scanning phase
    setIsParsing(true);
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

    setResultChips([`${filesList.length} 个文件`, `${validItems.length} 个可导入`]);
    await sleep(520);

    setPhase('parsing');
    await sleep(520);
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

    if (detectedFiles.length > 0) {
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'analyzing' : 'skipped',
        note: item.note,
      })));
      await sleep(650);

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

      setPhase('binding');
      await sleep(620);

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
          setIngestMessage(`已识别片源线索：${displayTitle}`);
        } else {
          setIngestMessage(identity.episodeKey ? '已识别集数，请补充片名以关联片源信息' : '文件名信息不足，先建立字幕工作台');
        }
      }
      await sleep(420);

      setPhase('ready');
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'success' : 'skipped',
        note: item.note,
      })));
      setIngestMessage('字幕工作台已准备完成');
      setResultChips(prev => [...prev.slice(0, 5), displayTitle === '影视数据' ? '片源待确认' : '片源线索已识别']);
      await sleep(420);

      processFiles(detectedFiles);

      setIsParsing(false);
      addLog("已建立字幕工作台", "success");
    } else {
      setIsParsing(false);
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

    if (filesArray.length > 0) {
      addFilesToQueue(filesArray);
    }
  };

  if (isParsing) {
    const activeStepIndex = Math.max(0, PHASE_STEPS.findIndex(step => step.id === ingestPhase));
    return (
      <div className="w-full max-w-6xl mx-auto relative flex min-h-[540px] flex-col items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-[980px] overflow-hidden rounded-[18px] border border-white/[0.075] bg-[#080806]/78 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.035)_46%,transparent_54%)] opacity-35 pointer-events-none" />
          <div className="relative flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <motion.div
              key={ingestMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <span className="mb-5 font-mono text-xs uppercase tracking-[0.32em] text-[#a8b7a3]/75">
                SUBTITLE WORKBENCH
              </span>
              <h3 className="max-w-[760px] text-2xl md:text-[2.125rem] font-semibold tracking-tight text-neutral-50">
                {ingestMessage}
              </h3>
              <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-neutral-400">
                正在整理字幕轨、文件结构与片源线索
              </p>
            </motion.div>

            <div className="mt-10 flex w-full max-w-[660px] flex-col gap-3">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/16 to-transparent" />
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-neutral-500">
                {PHASE_STEPS.map((step, index) => {
                  const active = step.id === ingestPhase;
                  const complete = activeStepIndex >= index || ingestPhase === 'ready';
                  return (
                    <motion.span
                      key={step.id}
                      animate={{ opacity: active ? 1 : complete ? 0.72 : 0.36 }}
                      className={`${active ? 'text-neutral-100' : complete ? 'text-neutral-300' : 'text-neutral-600'}`}
                    >
                      {step.label}
                    </motion.span>
                  );
                })}
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </div>

          <div className="relative border-t border-white/[0.055] px-5 py-4">
            <div className="grid grid-cols-5 gap-2" aria-hidden="true">
              {PHASE_STEPS.map((step, index) => {
                const complete = activeStepIndex >= index || ingestPhase === 'ready';
                return (
                  <div
                    key={step.id}
                    className={`h-1 rounded-full transition-all duration-500 ${complete ? 'bg-[#a8b7a3]/70' : 'bg-white/[0.07]'}`}
                  />
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {(resultChips.length > 0 ? resultChips : parsingFiles.slice(0, 4).map(file => file.note || file.name)).map((chip, index) => (
                <motion.span
                  key={`${chip}-${index}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1 text-xs text-neutral-300"
                >
                  {chip}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const acceptedItems = queuedItems.filter(item => item.accepted);
  const rejectedItems = queuedItems.filter(item => !item.accepted);
  const subtitleCount = queuedItems.filter(item => item.kind === 'subtitle').length;
  const archiveCount = queuedItems.filter(item => item.kind === 'zip' || item.kind === 'archive').length;
  const totalBytes = queuedItems.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <div
      className="ingest-drop-zone group/outer flex w-full flex-col items-center py-2 md:py-4"
      onMouseEnter={() => setIsZoneActive(true)}
      onMouseLeave={() => setIsZoneActive(false)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <motion.div
        animate={shouldReduceMotion
          ? { scale: 1, boxShadow: 'inset 0 0 42px rgba(0,0,0,0.46), 0 18px 60px rgba(0,0,0,0.22)' }
          : isDragging
            ? { scale: 0.988, boxShadow: 'inset 0 0 90px rgba(0,0,0,0.82), 0 20px 80px rgba(168,183,163,0.08)' }
            : isZoneActive
              ? { scale: 1.002, boxShadow: 'inset 0 0 54px rgba(0,0,0,0.42), 0 24px 72px rgba(0,0,0,0.32)' }
              : { scale: 1, boxShadow: 'inset 0 0 42px rgba(0,0,0,0.46), 0 18px 60px rgba(0,0,0,0.22)' }
        }
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 }}
        className={`ingest-drop-stage v4-panel relative z-10 mx-auto min-h-[360px] w-full max-w-[1180px] select-none overflow-hidden rounded-lg transition-colors duration-300 md:min-h-[400px] ${isDragging ? 'border-[var(--v4-accent)]' : ''}`}
      >
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[color:rgba(11,15,24,0.96)] text-center">
            <motion.div
              animate={shouldReduceMotion ? undefined : { y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.35, ease: 'easeInOut' }}
              className="text-[var(--v4-accent-strong)]"
            >
              <FilePlus className="h-12 w-12 stroke-[2]" aria-hidden="true" />
            </motion.div>
            <div>
              <span className="block text-3xl font-semibold tracking-tight text-neutral-50">松手，加入导入清单</span>
              <span className="mt-2 block text-sm text-[var(--v4-text-muted)]">确认清单后才会读取与整理</span>
            </div>
          </div>
        ) : queuedItems.length === 0 ? (
          <div className="grid min-h-[398px] md:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
            <div className="relative min-h-[260px] overflow-hidden border-b border-[var(--v4-line)] md:border-b-0 md:border-r">
              <div aria-hidden="true" className="absolute inset-0 bg-[url('/Background.jpg')] bg-cover bg-[center_58%] opacity-35 grayscale contrast-125" />
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,15,21,0.38),rgba(12,15,21,0.88))]" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-7 text-left md:p-9">
                <span className="v4-kicker">Import desk</span>
                <h3 className="mt-3 text-[2rem] font-semibold leading-none tracking-tight text-white sm:text-[2.5rem]">规划本次导入</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-[var(--v4-text-muted)]">字幕文件、字幕包与文件夹可先加入清单，确认组合后再开始读取。</p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-7 text-left md:p-9">
              <div>
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <FilePlus className="h-8 w-8 stroke-[2] text-[var(--v4-accent-strong)]" aria-hidden="true" />
                    <h4 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--v4-text)]">拖入字幕，建立清单</h4>
                    <p className="mt-2 text-sm leading-6 text-[var(--v4-text-muted)]">松手后仍可继续补充或移除，不会立即进入处理流程。</p>
                  </div>
                  <div className="hidden items-center gap-2 font-mono text-[11px] text-[var(--v4-text-faint)] sm:flex">
                    {FORMAT_MARKS.map(mark => <span key={mark}>{mark}</span>)}
                  </div>
                </div>
                <div className="mt-8 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="v4-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--v4-accent)] px-5 text-sm font-semibold text-[#0b0f18] transition-colors hover:bg-[var(--v4-accent-strong)] active:scale-[0.985]">
                    <FilePlus className="h-5 w-5 stroke-[2.2]" aria-hidden="true" />
                    选择文件或字幕包
                  </button>
                  <button type="button" onClick={() => folderInputRef.current?.click()} className="v4-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-muted)] px-5 text-sm font-medium text-[var(--v4-text)] transition-colors hover:bg-[var(--v4-panel-raised)] active:scale-[0.985]">
                    <FolderPlus className="h-5 w-5 stroke-[2.2]" aria-hidden="true" />
                    选择文件夹
                  </button>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-2 border-t border-[var(--v4-line)] pt-5 text-xs text-[var(--v4-text-faint)]">
                <HardDrive className="h-4 w-4" aria-hidden="true" />
                文件仅在当前设备读取，不会上传至本站服务器
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[398px] md:grid-cols-[minmax(250px,0.35fr)_minmax(0,0.65fr)]">
            <aside className="flex flex-col justify-between border-b border-[var(--v4-line)] bg-[var(--v4-panel-muted)] p-6 text-left md:border-b-0 md:border-r md:p-7">
              <div>
                <span className="v4-kicker">Import plan</span>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">本次导入</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--v4-text-muted)]">先确认文件组合，再统一识别轨道与片源线索。</p>
                <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--v4-line)] bg-[var(--v4-line)]">
                  <div className="bg-[var(--v4-panel)] p-3"><dt className="text-xs text-[var(--v4-text-faint)]">字幕文件</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{subtitleCount}</dd></div>
                  <div className="bg-[var(--v4-panel)] p-3"><dt className="text-xs text-[var(--v4-text-faint)]">字幕包</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{archiveCount}</dd></div>
                  <div className="bg-[var(--v4-panel)] p-3"><dt className="text-xs text-[var(--v4-text-faint)]">可处理</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--v4-accent-strong)]">{acceptedItems.length}</dd></div>
                  <div className="bg-[var(--v4-panel)] p-3"><dt className="text-xs text-[var(--v4-text-faint)]">总体积</dt><dd className="mt-1 text-base font-semibold tabular-nums">{formatBytes(totalBytes)}</dd></div>
                </dl>
              </div>
              <div className="mt-6 grid gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="v4-focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel)] px-3 text-sm font-medium hover:bg-[var(--v4-panel-raised)]"><FilePlus className="h-4 w-4" />继续添加文件</button>
                <button type="button" onClick={() => folderInputRef.current?.click()} className="v4-focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--v4-line)] px-3 text-sm text-[var(--v4-text-muted)] hover:text-white"><FolderPlus className="h-4 w-4" />添加文件夹</button>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col text-left">
              <header className="flex items-center justify-between gap-4 border-b border-[var(--v4-line)] px-5 py-4 md:px-6">
                <div><h4 className="text-lg font-semibold">导入清单</h4><p className="mt-0.5 text-xs text-[var(--v4-text-faint)]">{queuedItems.length} 个项目 · {formatBytes(totalBytes)}</p></div>
                <button type="button" onClick={() => { setQueuedItems([]); setQueueIssue(null); }} className="v4-focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs text-[var(--v4-text-muted)] hover:bg-white/[0.04] hover:text-white"><Trash2 className="h-4 w-4" />清空</button>
              </header>
              <div className="max-h-[310px] flex-1 overflow-y-auto divide-y divide-[var(--v4-line)]">
                {queuedItems.map(item => (
                  <div key={getQueueKey(item.file)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 md:px-6">
                    <span className={`grid h-9 w-9 place-items-center rounded-md border ${item.accepted ? 'border-[var(--v4-line-strong)] bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]' : 'border-[color:rgba(200,135,140,0.25)] bg-[color:rgba(200,135,140,0.08)] text-[var(--v4-danger)]'}`}>
                      {item.kind === 'zip' || item.kind === 'archive' ? <Archive className="h-4.5 w-4.5" /> : <FileText className="h-4.5 w-4.5" />}
                    </span>
                    <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-medium text-[var(--v4-text)]">{item.name}</span><span className="shrink-0 rounded border border-[var(--v4-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--v4-text-muted)]">{item.label}</span></div><div className={`mt-1 flex items-center gap-2 text-xs ${item.accepted ? 'text-[var(--v4-text-faint)]' : 'text-[var(--v4-danger)]'}`}><span>{item.note}</span><span aria-hidden="true">·</span><span>{formatBytes(item.file.size)}</span></div></div>
                    <button type="button" onClick={() => removeQueuedFile(item.file)} className="v4-focus-ring grid h-8 w-8 place-items-center rounded-md text-[var(--v4-text-faint)] hover:bg-white/[0.05] hover:text-white" aria-label={`从清单移除 ${item.name}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <footer className="mt-auto border-t border-[var(--v4-line)] p-4 md:px-6">
                {(queueIssue || rejectedItems.length > 0) && <p className="mb-3 text-xs leading-5 text-[var(--v4-warning)]">{queueIssue || `${rejectedItems.length} 个项目不会进入处理流程，可移除后继续。`}</p>}
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--v4-text-faint)]"><HardDrive className="h-4 w-4" />确认后在当前设备读取</span>
                  <button type="button" disabled={acceptedItems.length === 0 || Boolean(queueIssue)} onClick={() => handleFilesProcess(queuedItems.map(item => item.file))} className="v4-focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--v4-accent)] px-5 text-sm font-semibold text-[#0b0f18] transition-colors hover:bg-[var(--v4-accent-strong)] disabled:cursor-not-allowed disabled:opacity-35">开始整理 {acceptedItems.length} 个文件<ArrowRight className="h-4 w-4" /></button>
                </div>
              </footer>
            </section>
          </div>
        )}
      </motion.div>

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
