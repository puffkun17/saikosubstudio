/**
 * Browser-local RAR/7z reading via libarchive.js (WASM worker).
 *
 * Production note: CF Pages CSP must allow `script-src 'wasm-unsafe-eval'`
 * and `worker-src 'self'`, or the worker never becomes ready and open() hangs.
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

const OPEN_TIMEOUT_MS = 20_000;
const LIST_TIMEOUT_MS = 15_000;
const EXTRACT_TIMEOUT_MS = 30_000;
const INIT_TIMEOUT_MS = 15_000;

type ArchiveListEntry = {
  file?: { name: string; size: number; extract: () => Promise<File> } | string;
  path?: string;
  pathname?: string;
};

type ArchiveReader = {
  getFilesArray: () => Promise<ArchiveListEntry[]>;
  hasEncryptedData: () => Promise<boolean | null>;
  close: () => Promise<void>;
};

let archiveReady: Promise<typeof import('libarchive.js')> | null = null;
let archiveQueue: Promise<unknown> = Promise.resolve();

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

const resetArchiveApi = () => {
  archiveReady = null;
};

/** Versioned path so browsers drop cached worker responses that still carry the old CSP. */
const ARCHIVE_WORKER_PATH = '/libarchive/worker-bundle.v3.js';

const resolveWorkerUrl = (): URL => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(ARCHIVE_WORKER_PATH, window.location.origin);
  }
  return new URL(ARCHIVE_WORKER_PATH, 'http://127.0.0.1');
};

const getArchiveApi = async () => {
  if (!archiveReady) {
    archiveReady = (async () => {
      const mod = await import('libarchive.js');
      mod.Archive.init({
        workerUrl: resolveWorkerUrl(),
        getWorker: () => new Worker(resolveWorkerUrl(), { type: 'module' }),
      });
      return mod;
    })().catch((error) => {
      resetArchiveApi();
      throw error;
    });
  }
  return withTimeout(archiveReady, INIT_TIMEOUT_MS, '初始化压缩包引擎');
};

/** Prefetch the WASM worker so the first 7z/RAR peek does not hit soft-defer. */
export const warmLocalArchiveEngine = (): void => {
  if (typeof window === 'undefined') return;
  void getArchiveApi().catch(() => {
    // Warm is best-effort; real open() will surface errors.
  });
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
    // ignore
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
  try {
    return await withTimeout(Archive.open(archiveFile) as Promise<ArchiveReader>, OPEN_TIMEOUT_MS, '打开压缩包');
  } catch (error) {
    // A stalled worker leaves the singleton unusable — force a fresh init next time.
    resetArchiveApi();
    throw error;
  }
};

/**
 * Lists subtitle entry names inside a local RAR/7z without extracting payloads.
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

    // Skip encryption probe by default — it can stall the worker on some 7z files.
    // Encrypted archives typically fail at extract() with a clearer error path.
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
      try {
        const extracted = await withTimeout(compressedFile.extract(), EXTRACT_TIMEOUT_MS, `解压 ${compressedFile.name}`);
        extractedBytes += extracted.size;
        if (extracted.size > limits.maxSubtitleBytes || extractedBytes > limits.maxUncompressedBytes) {
          throw new LocalArchiveError('limits', '压缩包解压后体积超出安全限制');
        }
        files.push(extracted);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/password|encrypt|passphrase/i.test(message)) {
          throw new LocalArchiveError('encrypted', '压缩包已加密，请先在本地解压');
        }
        throw error;
      }
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
