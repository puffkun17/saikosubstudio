/**
 * Browser-local RAR/7z reading via libarchive.js (WASM worker).
 *
 * Common timeout causes we guard against:
 * - Cold-start: first worker + WASM compile can exceed short deadlines
 * - hasEncryptedData() often returns `null` ("unknown") for 7z — must NOT treat as encrypted
 * - Listing should use listFiles (skip payloads); never extract until needed
 */

export interface LocalArchiveLimits {
  maxEntries: number;
  maxSubtitleEntries: number;
  maxSubtitleBytes: number;
  maxUncompressedBytes: number;
}

export class LocalArchiveError extends Error {
  constructor(
    public readonly code: 'encrypted' | 'limits' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'LocalArchiveError';
  }
}

const subtitleExtension = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();
  return extension === 'srt' || extension === 'ass';
};

const basenameFromArchivePath = (name: string) => name.split('/').pop() || name;

/** Cold WASM + first 7z open often needs more than a few seconds on slower devices. */
const OPEN_TIMEOUT_MS = 45_000;
const LIST_TIMEOUT_MS = 30_000;
const EXTRACT_TIMEOUT_MS = 30_000;
const ENCRYPT_PROBE_TIMEOUT_MS = 8_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new LocalArchiveError('limits', `${label}超时（${Math.round(timeoutMs / 1000)} 秒），请稍后重试或先在本地解压`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

type ArchiveListEntry = {
  file?: { name: string; size: number; extract: () => Promise<File> };
  pathname?: string;
};

let archiveReady: Promise<typeof import('libarchive.js')> | null = null;

const getArchiveApi = async () => {
  if (!archiveReady) {
    archiveReady = (async () => {
      const mod = await import('libarchive.js');
      mod.Archive.init({ workerUrl: '/libarchive/worker-bundle.js' });
      return mod;
    })();
  }
  return archiveReady;
};

/**
 * Probe encryption. `null` = unknown (common for 7z) — caller should proceed.
 * Probe failures / timeouts also return null so listing can still run.
 */
const probeEncrypted = async (
  reader: { hasEncryptedData: () => Promise<boolean | null> },
): Promise<boolean | null> => {
  try {
    return await withTimeout(reader.hasEncryptedData(), ENCRYPT_PROBE_TIMEOUT_MS, '检查压缩包加密状态');
  } catch {
    return null;
  }
};

/**
 * Lists subtitle entry names inside a local RAR/7z without extracting payloads.
 */
export const listLocalArchiveSubtitles = async (
  archiveFile: File,
  limits: Pick<LocalArchiveLimits, 'maxEntries' | 'maxSubtitleEntries'>,
): Promise<{ names: string[]; ignoredEntries: number }> => {
  const { Archive } = await getArchiveApi();

  let reader: Awaited<ReturnType<typeof Archive.open>> | null = null;
  try {
    reader = await withTimeout(Archive.open(archiveFile), OPEN_TIMEOUT_MS, '打开压缩包');

    const encrypted = await probeEncrypted(reader);
    // Only hard-fail when the library is certain the archive is encrypted.
    if (encrypted === true) {
      throw new LocalArchiveError('encrypted', '压缩包已加密，请先在本地解压');
    }

    const entries = await withTimeout(reader.getFilesArray(), LIST_TIMEOUT_MS, '读取压缩包目录') as ArchiveListEntry[];
    if (entries.length > limits.maxEntries) {
      throw new LocalArchiveError('limits', `压缩包条目超过 ${limits.maxEntries} 项`);
    }

    const subtitleEntries = entries.filter((entry) => entry.file && subtitleExtension(entry.file.name));
    if (subtitleEntries.length > limits.maxSubtitleEntries) {
      throw new LocalArchiveError('limits', `字幕轨超过 ${limits.maxSubtitleEntries} 条`);
    }

    return {
      names: subtitleEntries
        .map((entry) => basenameFromArchivePath(entry.file?.name || entry.pathname || ''))
        .filter(Boolean),
      ignoredEntries: entries.length - subtitleEntries.length,
    };
  } catch (error) {
    if (error instanceof LocalArchiveError) throw error;
    const message = error instanceof Error ? error.message : '无法读取压缩包';
    throw new LocalArchiveError('invalid', message);
  } finally {
    await reader?.close().catch(() => undefined);
  }
};

/**
 * Reads only subtitle entries from one local RAR/7z file. The archive never leaves the browser.
 */
export const extractLocalArchiveSubtitles = async (
  archiveFile: File,
  limits: LocalArchiveLimits,
): Promise<{ files: File[]; ignoredEntries: number }> => {
  const { Archive } = await getArchiveApi();

  let reader: Awaited<ReturnType<typeof Archive.open>> | null = null;
  try {
    reader = await withTimeout(Archive.open(archiveFile), OPEN_TIMEOUT_MS, '打开压缩包');

    const encrypted = await probeEncrypted(reader);
    if (encrypted === true) {
      throw new LocalArchiveError('encrypted', '压缩包已加密，请先在本地解压');
    }

    const entries = await withTimeout(reader.getFilesArray(), LIST_TIMEOUT_MS, '读取压缩包目录') as ArchiveListEntry[];
    if (entries.length > limits.maxEntries) {
      throw new LocalArchiveError('limits', `压缩包条目超过 ${limits.maxEntries} 项`);
    }

    const subtitleEntries = entries.filter((entry) => entry.file && subtitleExtension(entry.file.name));
    if (subtitleEntries.length === 0) {
      return { files: [], ignoredEntries: entries.length };
    }
    if (subtitleEntries.length > limits.maxSubtitleEntries) {
      throw new LocalArchiveError('limits', `字幕轨超过 ${limits.maxSubtitleEntries} 条`);
    }

    const declaredBytes = subtitleEntries.reduce((total, entry) => total + (entry.file?.size || 0), 0);
    if (declaredBytes > limits.maxUncompressedBytes || subtitleEntries.some((entry) => (entry.file?.size || 0) > limits.maxSubtitleBytes)) {
      throw new LocalArchiveError('limits', '压缩包内字幕体积超出安全限制');
    }

    const files: File[] = [];
    let extractedBytes = 0;
    for (const entry of subtitleEntries) {
      const compressedFile = entry.file;
      if (!compressedFile) continue;
      const extracted = await withTimeout(compressedFile.extract(), EXTRACT_TIMEOUT_MS, `解压 ${compressedFile.name}`);
      extractedBytes += extracted.size;
      if (extracted.size > limits.maxSubtitleBytes || extractedBytes > limits.maxUncompressedBytes) {
        throw new LocalArchiveError('limits', '压缩包解压后体积超出安全限制');
      }
      files.push(extracted);
    }

    return { files, ignoredEntries: entries.length - subtitleEntries.length };
  } catch (error) {
    if (error instanceof LocalArchiveError) throw error;
    const message = error instanceof Error ? error.message : '无法读取压缩包';
    throw new LocalArchiveError('invalid', message);
  } finally {
    await reader?.close().catch(() => undefined);
  }
};
