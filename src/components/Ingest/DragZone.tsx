'use client';

import React, { useRef, useState } from 'react';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectSubtitleLanguage, parseMediaFilename, assessMediaIdentity } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { ArrowDown, CheckCircle2, FilePlus, FolderPlus } from 'lucide-react';
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

const INGEST_STEPS = ['本地读取', '识别字幕轨', '建立工作台'];

const FORMAT_MARKS = ['SRT', 'ASS', 'ZIP', 'RAR', '7Z'];

const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

const isSubtitleExtension = (ext: string) => ext === 'srt' || ext === 'ass';
const isMultipartArchiveName = (name: string) => /\.part\d+\.rar$|\.r\d{2}$|\.7z\.\d+$/i.test(name);

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
    return {
      file,
      name: file.name,
      extension,
      kind: 'subtitle',
      label: extension.toUpperCase(),
      accepted: true,
      note: extension === 'ass' ? '样式字幕轨' : '标准字幕轨',
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
  const [preflightItems, setPreflightItems] = useState<PreflightItem[]>([]);
  const [trackSummaries, setTrackSummaries] = useState<TrackSummary[]>([]);

  const setPhase = (phase: IngestPhase, message = PHASE_COPY[phase]) => {
    setIngestPhase(phase);
    setIngestMessage(message);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    setPreflightItems(preflight);
    setTrackSummaries([]);
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

    setTrackSummaries(summaries);

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
      await handleFilesProcess(filesArray);
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

  return (
    <div
      className="ingest-drop-zone w-full flex flex-col items-center group/outer py-2 md:py-4"
      onMouseEnter={() => setIsZoneActive(true)}
      onMouseLeave={() => setIsZoneActive(false)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <motion.button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        animate={isDragging
          ? { scale: 0.988, boxShadow: 'inset 0 0 90px rgba(0,0,0,0.82), 0 20px 80px rgba(168,183,163,0.08)' }
          : isZoneActive
            ? { scale: 1.002, boxShadow: 'inset 0 0 54px rgba(0,0,0,0.42), 0 24px 72px rgba(0,0,0,0.32)' }
            : { scale: 1, boxShadow: 'inset 0 0 42px rgba(0,0,0,0.46), 0 18px 60px rgba(0,0,0,0.22)' }
        }
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className={`ingest-drop-stage relative z-10 mx-auto flex min-h-[300px] md:min-h-[340px] lg:min-h-[clamp(320px,40vh,390px)] w-full max-w-[1120px] cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-[18px] bg-[#080807] px-5 md:px-8 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#b9ddd8]/35 ${isDragging ? 'border border-[#b9ddd8]/65' : 'border border-white/[0.12] focus-visible:border-[#b9ddd8]/60'}`}
        aria-label="选择字幕文件或压缩包，也可将文件拖放到此区域"
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-[url('/Background.jpg')] bg-cover bg-center grayscale transition-all duration-700 ${isDragging ? 'scale-[1.035] opacity-[0.82] brightness-[0.72] contrast-125' : isZoneActive ? 'scale-[1.015] opacity-[0.74] brightness-[0.66] contrast-125' : 'opacity-[0.68] brightness-[0.58] contrast-125'}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,3,4,0.86)_0%,rgba(3,3,4,0.76)_34%,rgba(3,3,4,0.28)_72%,rgba(3,3,4,0.12)_100%)]"
        />
        <div className="pointer-events-none absolute inset-4 rounded-[12px] border border-dashed border-white/[0.16] transition-colors duration-300 group-hover/outer:border-[#b9ddd8]/35" />
        <div className="pointer-events-none absolute inset-x-6 top-6 flex items-center justify-between font-mono text-[10px] uppercase text-white/38 md:inset-x-8">
          <span>Drop zone</span>
          <span className="hidden sm:inline">Files stay on this device</span>
        </div>

        {(isDragging || isZoneActive) && !shouldReduceMotion && (
          <motion.div
            aria-hidden="true"
            initial={{ top: '16%', opacity: 0 }}
            animate={{ top: ['16%', '84%'], opacity: [0, 0.7, 0] }}
            transition={{ duration: isDragging ? 1.15 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-x-8 z-10 h-px bg-gradient-to-r from-transparent via-[#b9ddd8]/80 to-transparent"
          />
        )}

        {isDragging ? (
          <div className="relative z-20 flex flex-col items-center gap-5 text-center">
            <motion.div
              animate={shouldReduceMotion ? undefined : { y: [0, 7, 0] }}
              transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#b9ddd8]/45 bg-[#07110f]/80 text-[#d7f2ed] shadow-[0_12px_36px_rgba(117,190,176,0.18)]"
            >
              <ArrowDown className="h-8 w-8 stroke-[2.25]" aria-hidden="true" />
            </motion.div>
            <div>
              <span className="block text-3xl font-semibold tracking-tight text-neutral-50">松手，开始整理</span>
              <span className="mt-2 block text-sm text-[#c7e7e1]/72">已准备接收字幕文件</span>
            </div>
          </div>
        ) : (
          <div className="ingest-drop-content relative z-20 flex max-w-[760px] flex-col items-center gap-6 text-center">
            <motion.div
              animate={isZoneActive && !shouldReduceMotion ? { y: [0, -3, 0] } : undefined}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/[0.16] bg-black/45 text-white shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-sm"
            >
              <FilePlus className="h-9 w-9 stroke-[2]" aria-hidden="true" />
              <span className="absolute -bottom-2 rounded-full border border-[#b9ddd8]/30 bg-[#0b1715] px-2 py-0.5 font-mono text-[9px] uppercase text-[#b9ddd8]">Drop</span>
            </motion.div>

            <div className="flex flex-col items-center gap-2.5">
              <h3 className="text-[2rem] font-semibold tracking-tight text-neutral-50 md:text-[2.55rem]">
                把字幕拖到这里
              </h3>
              <p className="max-w-[580px] text-base leading-relaxed text-neutral-300 md:text-lg">
                松手后自动读取字幕轨、压缩包与片源线索
              </p>
              <span className="text-sm text-neutral-500">也可以点击此区域选择文件</span>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center gap-4 font-mono text-sm text-neutral-400">
                {FORMAT_MARKS.map((mark, index) => (
                  <React.Fragment key={mark}>
                    {index > 0 && <span className="text-white/14">/</span>}
                    <span>{mark}</span>
                  </React.Fragment>
                ))}
              </div>
              <div className="h-px w-56 bg-gradient-to-r from-transparent via-[#b9ddd8]/45 to-transparent" />
            </div>
          </div>
        )}
      </motion.button>

      <div className="ingest-feature-strip z-20 mt-5 w-full max-w-[760px] px-4">
        <div className="flex items-center justify-center gap-3 text-sm text-neutral-500 md:gap-5">
          {INGEST_STEPS.map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 && <span className="h-px w-5 bg-white/12 md:w-10" aria-hidden="true" />}
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="font-mono text-[10px] text-[#b9ddd8]/65">0{index + 1}</span>
                {step}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

	      {(preflightItems.length > 0 || trackSummaries.length > 0) && (
	        <div className="mt-5 w-full max-w-[1120px] px-4 z-20">
	          <div className="rounded-2xl border border-white/[0.055] bg-black/30 overflow-hidden">
	            {preflightItems.length > 0 && (
	              <div className="p-3 border-b border-white/[0.045]">
	                <div className="text-xs font-semibold text-white/60 mb-2">导入概览</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {preflightItems.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.file.size}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <span className={`px-1.5 py-0.5 rounded font-semibold ${item.accepted ? 'bg-white/[0.08] text-white/85 border border-white/[0.08]' : 'bg-[#9f897b]/16 text-[#eadfd8] border border-[#c0a89a]/25'}`}>
	                        {item.label}
	                      </span>
	                      <span className="truncate text-white/70">{item.name}</span>
	                      <span className="text-white/50 truncate hidden sm:inline">{item.note}</span>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            )}
	            {trackSummaries.length > 0 && (
	              <div className="p-3">
	                <div className="text-xs font-semibold text-white/60 mb-2">轨道识别</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {trackSummaries.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.source}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <CheckCircle2 className="w-3.5 h-3.5 text-[#e5e7eb] shrink-0" />
	                      <span className="px-1.5 py-0.5 rounded bg-[#9ca3af]/10 text-[#e5e7eb] font-semibold">{item.format}</span>
	                      <span className="text-white/70 truncate">{item.lang}</span>
	                      <span className="text-white/55 truncate">{item.name}</span>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            )}
	          </div>
	        </div>
	      )}

	      <div className="ingest-actions z-20 mt-8 grid w-full max-w-[720px] grid-cols-1 gap-3 px-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full items-center gap-4 rounded-xl px-6 py-4 text-left cursor-pointer transition-all duration-200
            bg-neutral-100 hover:bg-white border border-white/[0.16]
            text-black shadow-[0_12px_30px_rgba(0,0,0,0.28)] active:scale-[0.985]"
	        >
	          <FilePlus className="h-6 w-6 shrink-0 stroke-[2.25] text-black/75" aria-hidden="true" />
          <span>
            <span className="block text-base font-semibold">选择字幕文件</span>
            <span className="mt-0.5 block text-xs font-normal text-black/55">SRT、ASS 或 ZIP / RAR / 7Z</span>
          </span>
	        </button>

        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="group flex w-full items-center gap-4 rounded-xl px-6 py-4 text-left cursor-pointer transition-all duration-200
            bg-white/[0.012] hover:bg-white/[0.04] border border-white/[0.055] hover:border-white/16
            text-neutral-400 hover:text-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.35)] active:scale-[0.985]"
	        >
	          <FolderPlus className="h-6 w-6 shrink-0 stroke-[2.25] text-neutral-300" aria-hidden="true" />
	          <span>
              <span className="block text-base font-semibold text-neutral-200">选择字幕文件夹</span>
              <span className="mt-0.5 block text-xs font-normal text-neutral-500">读取文件夹及其子目录</span>
            </span>
	        </button>
      </div>

      <input
        ref={fileInputRef}
	        type="file"
	        multiple
	        accept=".srt,.ass,.zip,.rar,.7z"
        className="hidden"
        onChange={(e) => handleFilesProcess(Array.from(e.target.files || []))}
      />
	      <input
	        ref={folderInputRef}
	        type="file"
	        {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
	        className="hidden"
	        onChange={(e) => handleFilesProcess(Array.from(e.target.files || []))}
	      />
    </div>
  );
};
