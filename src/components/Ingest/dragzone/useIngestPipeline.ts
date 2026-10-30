import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { mintFileId } from '@/core/identity';
import { runRecognitionJob } from '@/core/recognitionClient';
import {
  createIngestCeremony,
  type CeremonySnapshot,
  type IngestCeremony,
  type MatchOutcome,
} from '@/core/ingestCeremony';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import type { TmdbSearchOutcome } from '@/store/types';
import { detectSubtitleLanguage, parseMediaFilename, assessMediaIdentity } from '@/utils/subtitleCore';
import { getClientBatchIssue } from '@/utils/importSafety';
import type { IgnoredIngestEntry } from '@/utils/ingestJunk';
import {
  buildImportSummary,
  createEmptyImportSummary,
  summarizeImportForChip,
  type ImportSummary,
} from '@/utils/importSummary';
import { warmLocalArchiveEngine } from '@/utils/localArchive';
import { useWorkflowChrome } from '@/components/Global/WorkflowChrome';
import {
  PHASE_COPY,
  PHASE_STEPS,
  createPreflightItem,
  describeTrack,
  getExtension,
  isVideoFile,
  sleep,
  type IncomingFile,
  type IngestPhase,
  type ParsingFileState,
  type PreflightItem,
  type TrackSummary,
} from '@/components/Ingest/dragzone/preflight';
import {
  describeArchivePeekError,
  peekArchiveEntries,
  processLocalArchiveFile,
  processZipFile,
  readAndDecodeFile,
} from '@/components/Ingest/dragzone/archive';

/** Per-phase perceptual floor; the ceremony release gate lives in core/ingestCeremony. */
const PHASE_FLOOR_MS = 160;

const toMatchOutcome = (outcome: TmdbSearchOutcome): MatchOutcome => {
  switch (outcome.kind) {
    case 'answered':
    case 'stale':
      return { kind: 'arrived' };
    case 'skipped':
      return { kind: 'skipped' };
    case 'rate_limited':
      return { kind: 'rate_limited', retryAfterMs: outcome.retryAfterMs };
    case 'failed':
    default:
      if (outcome.kind !== 'failed') return { kind: 'failed' };
      return {
        kind: 'failed',
        message: outcome.message,
        retryable: typeof outcome.status === 'number' && outcome.status >= 500,
      };
  }
};

/** Deck title while 匹配影片 is waiting on TMDB; null keeps the phase message. */
const matchWaitTitle = (snapshot: CeremonySnapshot | null): string | null => {
  if (!snapshot || snapshot.phase !== 'running') return null;
  if (snapshot.needsChoice) return snapshot.choiceReason === 'failed' ? '影片资料请求失败' : '影片资料暂未返回';
  if (snapshot.match === 'rate_limited') return '影片资料请求排队中…';
  return null;
};

/**
 * DragZone 导入流水线：预检队列、压缩包预览、整理仪式（阶段 / 底栏进度 / 前进按钮）。
 * 与 UI 解耦，DragZone 只负责拖放、菜单与渲染。
 */
export const useIngestPipeline = () => {
  const {
    processFiles,
    addLog,
    setIngestClearing,
    setStatusNotice,
    dismissStatusNotice,
    cancelTmdbSearch,
    setTmdbManualOpen,
  } = useStudioStore(useShallow((state) => ({
    processFiles: state.processFiles,
    cancelTmdbSearch: state.cancelTmdbSearch,
    setTmdbManualOpen: state.setTmdbManualOpen,
    addLog: state.addLog,
    setIngestClearing: state.setIngestClearing,
    setStatusNotice: state.setStatusNotice,
    dismissStatusNotice: state.dismissStatusNotice,
  })));
  const { setForwardAction, setBottomStatus } = useWorkflowChrome();

  // Parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [, setParsingFiles] = useState<ParsingFileState[]>([]);
  const [ingestPhase, setIngestPhase] = useState<IngestPhase>('idle');
  const [ingestMessage, setIngestMessage] = useState(PHASE_COPY.idle);
  const [resultChips, setResultChips] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary>(createEmptyImportSummary);
  const [queuedItems, setQueuedItems] = useState<PreflightItem[]>([]);
  const [queueIssue, setQueueIssue] = useState<string | null>(null);
  const ceremonyRef = useRef<IngestCeremony | null>(null);
  const [ceremony, setCeremony] = useState<CeremonySnapshot | null>(null);

  useEffect(() => () => ceremonyRef.current?.dispose(), []);

  const retryMatch = useCallback(() => {
    ceremonyRef.current?.retry();
  }, []);
  const chooseManualSearch = useCallback(() => {
    cancelTmdbSearch();
    ceremonyRef.current?.chooseManual();
  }, [cancelTmdbSearch]);

  const setPhase = (phase: IngestPhase, message = PHASE_COPY[phase]) => {
    setIngestPhase(phase);
    setIngestMessage(message);
  };

  useEffect(() => {
    warmLocalArchiveEngine();
  }, []);

  // 工序进度进底栏；顶栏留给 T0（身份 / 关键操作）
  useEffect(() => {
    if (!isParsing) {
      setBottomStatus(null);
      return;
    }
    const activeStepIndex = PHASE_STEPS.findIndex((step) => step.id === ingestPhase);
    const resolvedIndex = activeStepIndex >= 0
      ? activeStepIndex
      : ingestPhase === 'needs_review'
        ? PHASE_STEPS.length - 2
        : 0;
    const steps = PHASE_STEPS.map((step, index) => ({
      label: step.label,
      // 已走过的实心；当前步交给 UI 呼吸；「完成」仅在 ready 时点亮
      done: ingestPhase === 'ready' || index < resolvedIndex,
    }));
    const chipSummary = resultChips.length > 0 ? resultChips.slice(0, 3).join(' · ') : undefined;
    const waitTitle = ingestPhase === 'metadata' ? matchWaitTitle(ceremony) : null;
    setBottomStatus({
      title: waitTitle ?? ingestMessage,
      subtitle: chipSummary,
      steps,
    });
    return () => setBottomStatus(null);
  }, [isParsing, ingestPhase, ingestMessage, resultChips, ceremony, setBottomStatus]);

  const holdPhaseFloor = async (startedAt: number, phaseStartedAt: number) => {
    const phaseElapsed = Date.now() - phaseStartedAt;
    if (phaseElapsed < PHASE_FLOOR_MS) {
      await sleep(PHASE_FLOOR_MS - phaseElapsed);
    }
    void startedAt;
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
      const archiveEntries = await peekArchiveEntries(item);
      if (!archiveEntries) return;

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
      const { encrypted, message } = describeArchivePeekError(error);
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

  const addFilesToQueue = (rawIncoming: IncomingFile[]) => {
    const videoRecord = rawIncoming.find((record) => isVideoFile(record.file));
    if (videoRecord) {
      useStudioStore.getState().setBorrowedVideoName(videoRecord.file.name);
      addLog(`已借用视频文件名「${videoRecord.file.name}」作为导出名（视频本身不读取）`, 'success');
    }
    const incoming = rawIncoming.filter((record) => !isVideoFile(record.file));
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

  const handleFilesProcess = async (incomingList?: File[]) => {
    // Video files: only the filename is borrowed for export naming; never read, never counted in the size limit.
    const videoFiles = (incomingList || []).filter(isVideoFile);
    if (videoFiles.length > 0) {
      useStudioStore.getState().setBorrowedVideoName(videoFiles[0].name);
      addLog(`已借用视频文件名「${videoFiles[0].name}」作为导出名（视频本身不读取）`, 'success');
    }
    const filesList = incomingList?.filter((file) => !isVideoFile(file));
    if (incomingList && incomingList.length > 0 && filesList && filesList.length === 0 && queuedItems.length === 0) return;
    const preflight = (filesList && filesList.length > 0 && queuedItems.length === 0)
      ? filesList.map((file) => createPreflightItem(file))
      : queuedItems.length > 0
        ? queuedItems
        : (filesList || []).map((file) => createPreflightItem(file));

    const batchIssue = getClientBatchIssue(preflight.map((item) => item.file));
    if (batchIssue) {
      setIngestClearing(false);
      setPhase('error', '本次导入超出安全限制');
      addLog(batchIssue, 'error');
      return;
    }

    setResultChips([]);
    setImportSummary(createEmptyImportSummary());

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
    ceremonyRef.current?.dispose();
    const ceremonyGate = createIngestCeremony();
    ceremonyRef.current = ceremonyGate;
    setCeremony(ceremonyGate.getSnapshot());
    ceremonyGate.subscribe(setCeremony);
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
    const ignoredInArchive: IgnoredIngestEntry[] = [];

    setResultChips([`${preflight.length} 个文件`, `${validItems.length} 个可整理`]);
    await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);

    phaseStartedAt = Date.now();
    setPhase('parsing');
    for (const item of validItems) {
      const file = item.file;
      if (item.kind === 'zip') {
        ignoredInArchive.push(...await processZipFile(file, detectedFiles, summaries, addLog));
      } else if (item.kind === 'archive') {
        ignoredInArchive.push(...await processLocalArchiveFile(file, detectedFiles, summaries, addLog));
      } else {
        try {
          const decoded = await readAndDecodeFile(file);
          const detected = detectSubtitleLanguage(file.name, decoded.text);
          const ext = getExtension(file.name);
          const subfile: Subfile = {
            id: mintFileId(file.name, decoded.text),
            name: file.name,
            text: decoded.text,
            lang: detected.lang,
            languagePair: detected.languagePair,
            isBilingual: detected.isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: decoded.text.length,
            importSource: item.folderName ? 'folder' : 'file',
            encoding: decoded.encoding,
            encodingConfidence: decoded.confidence,
          };
          detectedFiles.push(subfile);
          summaries.push({
            name: file.name,
            format: ext === 'ass' ? 'ASS' : 'SRT',
            lang: describeTrack(subfile),
            isBilingual: detected.isBilingual,
            isCommentary: subfile.isCommentary,
            source: item.folderName ? 'folder' : 'file',
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
        ignoredInArchive.length > 0 ? `已忽略 ${ignoredInArchive.length} 个杂项` : '',
      ].filter(Boolean);
      const summary = buildImportSummary({
        ignored: ignoredInArchive,
        tracks: detectedFiles.map((file) => ({
          name: file.name,
          lang: file.lang,
          encoding: file.encoding,
          encodingConfidence: file.encodingConfidence,
          isBilingual: file.isBilingual,
        })),
      });
      setImportSummary(summary);
      const summaryChip = summarizeImportForChip(summary);
      setResultChips(summaryChip ? [...chips, summaryChip] : chips);
      if (ignoredInArchive.length > 0) {
        const sample = ignoredInArchive.slice(0, 3).map((entry) => entry.name.split('/').pop() || entry.name).join('、');
        addLog(
          `已忽略 ${ignoredInArchive.length} 个杂项文件${sample ? `（如 ${sample}${ignoredInArchive.length > 3 ? '…' : ''}）` : ''}`,
          'info',
        );
      }
      if (summary.needsAttention.length > 0) {
        const lines = summary.needsAttention.map((item) => item.detail || item.name).slice(0, 3);
        setStatusNotice({
          id: 'import-attention',
          tone: 'warning',
          title: '导入需要确认',
          message: lines.join(' · '),
          channel: 'inline',
        });
      } else {
        dismissStatusNotice('import-attention');
      }
      for (const item of summary.needsAttention) {
        if (item.kind === 'low_confidence_encoding') {
          addLog(`编码不确定（${item.detail}）：${item.name}`, 'info');
        } else if (item.kind === 'zh_only_package') {
          addLog('仅检测到中文轨，缺少原文轨，无法自动双语合并', 'info');
        }
      }

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

      // Recognition (ASS split / SDH) off the main thread when Workers exist; ceremony floor stays.
      const recognized = await runRecognitionJob(detectedFiles);
      const matchTaskId = await processFiles(recognized.files as Subfile[], { recognized: true, deferAutoMatch: true });
      if (matchTaskId) {
        // Release = max(2.4 s, TMDB answer applied locally); slow / failed → 重试 · 手动搜索.
        ceremonyGate.runMatch(async () =>
          toMatchOutcome(await useStudioStore.getState().autoMatchTask(matchTaskId, { ceremony: true })));
      } else {
        ceremonyGate.skipMatch();
      }
      await holdPhaseFloor(ceremonyStartedAt, phaseStartedAt);
      const release = await ceremonyGate.released;
      if (ceremonyRef.current !== ceremonyGate) return;

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
      ceremonyGate.dispose();
      ceremonyRef.current = null;
      setCeremony(null);
      addLog('整理完成', 'success');
      if (release.reason === 'manual') setTmdbManualOpen(true);
    } else {
      setIsParsing(false);
      setIngestClearing(false);
      setPhase('error');
      addLog("未检测到可用字幕", "error");
    }
  };

  useEffect(() => {
    if (isParsing || queuedItems.length === 0) {
      setForwardAction(null);
      return;
    }
    const acceptedCount = queuedItems.filter((item) => item.accepted).length;
    const disabled = acceptedCount === 0 || Boolean(queueIssue);
    setForwardAction({
      label: '整理文件',
      disabled,
      ready: !disabled,
      disabledReason: queueIssue || '清单中暂无可整理的字幕文件，移除无效项或补充文件后继续。',
      onClick: () => {
        if (disabled) return;
        void handleFilesProcess();
      },
    });
    return () => setForwardAction(null);
    // handleFilesProcess closes over current ingest helpers; rebind when queue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on queue snapshot
  }, [isParsing, queuedItems, queueIssue, setForwardAction]);

  return {
    isParsing,
    /** 匹配影片等待态：needsChoice 时显示「重试 / 手动搜索」。 */
    ceremony,
    retryMatch,
    chooseManualSearch,
    importSummary,
    queuedItems,
    setQueuedItems,
    queueIssue,
    setQueueIssue,
    addFilesToQueue,
    removeQueuedFile,
    removeFolderGroup,
  };
};
