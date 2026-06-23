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

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new LocalArchiveError('limits', '压缩包读取超时，已停止处理')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/**
 * Reads only subtitle entries from one local RAR/7z file. The archive never leaves the browser.
 */
export const extractLocalArchiveSubtitles = async (
  archiveFile: File,
  limits: LocalArchiveLimits,
): Promise<{ files: File[]; ignoredEntries: number }> => {
  const { Archive } = await import('libarchive.js');
  Archive.init({ workerUrl: '/libarchive/worker-bundle.js' });

  let reader: Awaited<ReturnType<typeof Archive.open>> | null = null;
  try {
    reader = await withTimeout(Archive.open(archiveFile), 15_000);
    const encrypted = await withTimeout(reader.hasEncryptedData(), 5_000);
    if (encrypted !== false) {
      throw new LocalArchiveError('encrypted', '压缩包已加密或无法确认加密状态');
    }

    const entries = await withTimeout(reader.getFilesArray(), 10_000) as Array<{
      file?: { name: string; size: number; extract: () => Promise<File> };
      pathname?: string;
    }>;
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
      const extracted = await withTimeout(compressedFile.extract(), 15_000);
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
