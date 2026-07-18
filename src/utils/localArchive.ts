/**
 * Browser-local RAR/7z reading via libarchive.js (WASM worker).
 *
 * Common hang causes we guard against:
 * - Cold-start: first worker + WASM compile can exceed short deadlines
 * - hasEncryptedData() often returns `null` for 7z; probing can also stall the
 *   single worker — never probe before listing, and never leave a timed-out
 *   call on a still-busy worker (close/terminate and reopen instead)
 * - Listing uses getFilesArray (header-only via listFiles); extract only as needed
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
const OPEN_TIMEOUT_MS = 25_000;
const LIST_TIMEOUT_MS = 20_000;
const EXTRACT_TIMEOUT_MS = 30_000;

type ArchiveListEntry = {
  file?: { name: string; size: number; extract: () => Promise<File> } | string;
  path?: string;
  pathname?: string;
};

type ArchiveReader = {
  getFilesArray: () => Promise<ArchiveListEntry[]>;
  extractSingleFile?: (path: string) => Promise<File>;
  hasEncryptedData: () => Promise<boolean | null>;
  close: () => Promise<void>;
};

let archiveReady: Promise<typeof import('libarchive.js')> | null = null;
/** Serialize all archive ops — one WASM worker call at a time. */
let archiveQueue: Promise<unknown> = Promise.resolve();

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

const runExclusive = async <T>(task: () => Promise<T>): Promise<T> => {
  const previous = archiveQueue;
  let release!: () => void;
  archiveQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
  }
};

const safeClose = async (reader: ArchiveReader | null) => {
  if (!reader) return;
  try {
    await reader.close();
  } catch {
    // Worker may already be terminated after a timed-out call.
  }
};

const entryName = (entry: ArchiveListEntry): string => {
  if (entry.file && typeof entry.file !== 'string') return entry.file.name || '';
  if (typeof entry.file === 'string') return entry.file;
  return entry.pathname || entry.path || '';
};

const entrySize = (entry: ArchiveListEntry): number => {
  if (entry.file && typeof entry.file !== 'string') return entry.file.size || 0;
  return 0;
};

const openArchive = async (archiveFile: File): Promise<ArchiveReader> => {
  const { Archive } = await getArchiveApi();
  return withTimeout(Archive.open(archiveFile) as Promise<ArchiveReader>, OPEN_TIMEOUT_MS, '打开压缩包');
};

/**
 * Lists subtitle entry names inside a local RAR/7z without extracting payloads.
 * Skips encryption probe — that call can stall the worker and block listing.
 */
export const listLocalArchiveSubtitles = async (
  archiveFile: File,
  limits: Pick<LocalArchiveLimits, 'maxEntries' | 'maxSubtitleEntries'>,
): Promise<{ names: string[]; ignoredEntries: number }> => runExclusive(async () => {
  let reader: ArchiveReader | null = null;
  try {
    reader = await openArchive(archiveFile);
    const entries = await withTimeout(reader.getFilesArray(), LIST_TIMEOUT_MS, '读取压缩包目录');
    if (entries.length > limits.maxEntries) {
      throw new LocalArchiveError('limits', `压缩包条目超过 ${limits.maxEntries} 项`);
    }

    const subtitleEntries = entries.filter((entry) => {
      const name = entryName(entry);
      return Boolean(name) && subtitleExtension(name);
    });
    if (subtitleEntries.length > limits.maxSubtitleEntries) {
      throw new LocalArchiveError('limits', `字幕轨超过 ${limits.maxSubtitleEntries} 条`);
    }

    return {
      names: subtitleEntries.map((entry) => basenameFromArchivePath(entryName(entry))).filter(Boolean),
      ignoredEntries: entries.length - subtitleEntries.length,
    };
  } catch (error) {
    if (error instanceof LocalArchiveError) throw error;
    const message = error instanceof Error ? error.message : '无法读取压缩包';
    throw new LocalArchiveError('invalid', message);
  } finally {
    await safeClose(reader);
  }
});

/**
 * Reads only subtitle entries from one local RAR/7z file. The archive never leaves the browser.
 */
export const extractLocalArchiveSubtitles = async (
  archiveFile: File,
  limits: LocalArchiveLimits,
): Promise<{ files: File[]; ignoredEntries: number }> => runExclusive(async () => {
  let reader: ArchiveReader | null = null;
  try {
    reader = await openArchive(archiveFile);

    // Encryption probe only at extract time, with a hard close+reopen if it stalls.
    let encrypted: boolean | null = null;
    try {
      encrypted = await withTimeout(reader.hasEncryptedData(), 5_000, '检查压缩包加密状态');
    } catch {
      await safeClose(reader);
      reader = await openArchive(archiveFile);
      encrypted = null;
    }
    if (encrypted === true) {
      throw new LocalArchiveError('encrypted', '压缩包已加密，请先在本地解压');
    }

    const entries = await withTimeout(reader.getFilesArray(), LIST_TIMEOUT_MS, '读取压缩包目录');
    if (entries.length > limits.maxEntries) {
      throw new LocalArchiveError('limits', `压缩包条目超过 ${limits.maxEntries} 项`);
    }

    const subtitleEntries = entries.filter((entry) => {
      const name = entryName(entry);
      return Boolean(name) && subtitleExtension(name);
    });
    if (subtitleEntries.length === 0) {
      return { files: [], ignoredEntries: entries.length };
    }
    if (subtitleEntries.length > limits.maxSubtitleEntries) {
      throw new LocalArchiveError('limits', `字幕轨超过 ${limits.maxSubtitleEntries} 条`);
    }

    const declaredBytes = subtitleEntries.reduce((total, entry) => total + entrySize(entry), 0);
    if (
      declaredBytes > limits.maxUncompressedBytes
      || subtitleEntries.some((entry) => entrySize(entry) > limits.maxSubtitleBytes)
    ) {
      throw new LocalArchiveError('limits', '压缩包内字幕体积超出安全限制');
    }

    const files: File[] = [];
    let extractedBytes = 0;
    for (const entry of subtitleEntries) {
      const compressedFile = entry.file;
      if (!compressedFile || typeof compressedFile === 'string') continue;
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
    await safeClose(reader);
  }
});
