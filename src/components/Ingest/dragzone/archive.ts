import { mintFileId } from '@/core/identity';
import { archiveEntryObjectId } from '@/core/stageObjects';
import type { Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectSubtitleLanguage } from '@/utils/subtitleCore';
import { CLIENT_IMPORT_LIMITS } from '@/utils/importSafety';
import { partitionIngestPaths, type IgnoredIngestEntry } from '@/utils/ingestJunk';
import {
  extractLocalArchiveSubtitles,
  listLocalArchiveSubtitles,
  LocalArchiveError,
} from '@/utils/localArchive';
import {
  describeTrack,
  languageSpecForName,
  getExtension,
  isSubtitleExtension,
  type ArchiveEntryPreview,
  type PreflightItem,
  type TrackSummary,
} from '@/components/Ingest/dragzone/preflight';

/**
 * DragZone 压缩包处理：ZIP（jszip）与 RAR / 7Z（本地 libarchive）的预览与解包。
 * jszip 只在真正碰到 .zip 时按需加载（独立 chunk），不进入导入页首屏包。
 */

export type IngestLogger = (msg: string, type?: 'info' | 'success' | 'error') => void;

/** 预览压缩包内字幕轨（不解码正文）；非压缩包返回 null。 */
export const peekArchiveEntries = async (item: PreflightItem): Promise<ArchiveEntryPreview[] | null> => {
  let names: string[] = [];
  if (item.kind === 'zip') {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(item.file);
    const paths = Object.values(zip.files).filter((entry) => !entry.dir).map((entry) => entry.name);
    const { subtitles } = partitionIngestPaths(paths, (path) => isSubtitleExtension(getExtension(path)));
    names = subtitles.map((path) => path.split('/').pop() || path);
  } else if (item.kind === 'archive') {
    const listed = await listLocalArchiveSubtitles(item.file, {
      maxEntries: CLIENT_IMPORT_LIMITS.maxArchiveEntries,
      maxSubtitleEntries: CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries,
    });
    names = listed.names;
  } else {
    return null;
  }

  const archiveEntries: ArchiveEntryPreview[] = names.map((name) => {
    const spec = languageSpecForName(name);
    return {
      name,
      languageLabel: spec.label,
      languagePair: spec.pair,
      objectId: archiveEntryObjectId(item.objectId, name),
    };
  });
  return archiveEntries;
};

/** 预览失败的文案：加密包拒收，其余仍可在整理时重读。 */
export const describeArchivePeekError = (error: unknown): { encrypted: boolean; message: string } => {
  const encrypted = error instanceof LocalArchiveError && error.code === 'encrypted';
  const message = encrypted
    ? '压缩包已加密，请先在本地解压'
    : error instanceof LocalArchiveError
      ? error.message
      : '预览失败；包内字幕将在开始整理时读取';
  return { encrypted, message };
};

export const readAndDecodeFile = (file: File): Promise<ReturnType<typeof decodeBuffer>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(decodeBuffer(reader.result as ArrayBuffer));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

export const processZipFile = async (
  zipFile: File,
  detectedFiles: Subfile[],
  summaries: TrackSummary[],
  addLog: IngestLogger,
  /** 父条目的舞台 objectId；有则给每条轨写 sourceObjectId。 */
  parentObjectId?: string,
): Promise<IgnoredIngestEntry[]> => {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (entries.length > CLIENT_IMPORT_LIMITS.maxArchiveEntries) {
      addLog(`字幕包条目过多，最多允许 ${CLIENT_IMPORT_LIMITS.maxArchiveEntries} 项：${zipFile.name}`, 'error');
      return [];
    }

    const { subtitles: subtitlePaths, ignored } = partitionIngestPaths(
      entries.map((entry) => entry.name),
      (path) => isSubtitleExtension(getExtension(path)),
    );
    if (subtitlePaths.length > CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries) {
      addLog(`字幕包内字幕轨过多，最多允许 ${CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries} 条：${zipFile.name}`, 'error');
      return ignored;
    }

    const subtitleSet = new Set(subtitlePaths);
    const subtitleEntries = entries.filter((entry) => subtitleSet.has(entry.name));
    const zipDetectedFiles: Subfile[] = [];
    const zipSummaries: TrackSummary[] = [];
    let decodedBytes = 0;

    for (const zipEntry of subtitleEntries) {
      const buffer = await zipEntry.async('arraybuffer');
      decodedBytes += buffer.byteLength;
      if (buffer.byteLength > CLIENT_IMPORT_LIMITS.maxSubtitleBytes || decodedBytes > CLIENT_IMPORT_LIMITS.maxArchiveUncompressedBytes) {
        addLog(`字幕包解压后体积超出安全限制，已拒绝导入：${zipFile.name}`, 'error');
        return ignored;
      }

      const decoded = decodeBuffer(buffer);
      const detected = detectSubtitleLanguage(zipEntry.name, decoded.text);
      const ext = getExtension(zipEntry.name);
      const entryName = zipEntry.name.split('/').pop() || zipEntry.name;
      const subfile: Subfile = {
        id: mintFileId(entryName, decoded.text),
        name: entryName,
        text: decoded.text,
        lang: detected.lang,
        languagePair: detected.languagePair,
        isBilingual: detected.isBilingual,
        isCommentary: /(commentary|comment|director|解说|导轨)/i.test(zipEntry.name),
        size: decoded.text.length,
        importSource: 'zip',
        sourceObjectId: parentObjectId ? archiveEntryObjectId(parentObjectId, entryName) : undefined,
        encoding: decoded.encoding,
        encodingConfidence: decoded.confidence,
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
    return ignored;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    addLog(`字幕包读取失败：${message}`, "error");
    return [];
  }
};

export const processLocalArchiveFile = async (
  archiveFile: File,
  detectedFiles: Subfile[],
  summaries: TrackSummary[],
  addLog: IngestLogger,
  /** 父条目的舞台 objectId；有则给每条轨写 sourceObjectId。 */
  parentObjectId?: string,
): Promise<IgnoredIngestEntry[]> => {
  try {
    const { files, ignored } = await extractLocalArchiveSubtitles(archiveFile, {
      maxEntries: CLIENT_IMPORT_LIMITS.maxArchiveEntries,
      maxSubtitleEntries: CLIENT_IMPORT_LIMITS.maxArchiveSubtitleEntries,
      maxSubtitleBytes: CLIENT_IMPORT_LIMITS.maxSubtitleBytes,
      maxUncompressedBytes: CLIENT_IMPORT_LIMITS.maxArchiveUncompressedBytes,
    });

    for (const extractedFile of files) {
      const decoded = await readAndDecodeFile(extractedFile);
      const detected = detectSubtitleLanguage(extractedFile.name, decoded.text);
      const ext = getExtension(extractedFile.name);
      const subfile: Subfile = {
        id: mintFileId(extractedFile.name, decoded.text),
        name: extractedFile.name,
        text: decoded.text,
        lang: detected.lang,
        languagePair: detected.languagePair,
        isBilingual: detected.isBilingual,
        isCommentary: /(commentary|comment|director|解说|导轨)/i.test(extractedFile.name),
        size: extractedFile.size,
        importSource: 'archive',
        sourceObjectId: parentObjectId ? archiveEntryObjectId(parentObjectId, extractedFile.name) : undefined,
        encoding: decoded.encoding,
        encodingConfidence: decoded.confidence,
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
    return ignored;
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
    return [];
  }
};
