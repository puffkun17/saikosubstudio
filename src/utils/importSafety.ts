export const CLIENT_IMPORT_LIMITS = {
  maxFilesPerBatch: 40,
  maxTotalBytes: 80 * 1024 * 1024,
  maxSubtitleBytes: 12 * 1024 * 1024,
  maxZipBytes: 64 * 1024 * 1024,
  maxZipEntries: 320,
  maxZipSubtitleEntries: 120,
  maxZipUncompressedBytes: 96 * 1024 * 1024,
} as const;

const toMegabytes = (bytes: number) => Math.ceil(bytes / (1024 * 1024));

const getExtension = (name: string) => {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
};

export const getClientFileIssue = (file: File): string | null => {
  const extension = getExtension(file.name);

  if ((extension === 'srt' || extension === 'ass') && file.size > CLIENT_IMPORT_LIMITS.maxSubtitleBytes) {
    return `单个字幕文件不能超过 ${toMegabytes(CLIENT_IMPORT_LIMITS.maxSubtitleBytes)} MB`;
  }

  if (extension === 'zip' && file.size > CLIENT_IMPORT_LIMITS.maxZipBytes) {
    return `单个 ZIP 字幕包不能超过 ${toMegabytes(CLIENT_IMPORT_LIMITS.maxZipBytes)} MB`;
  }

  return null;
};

export const getClientBatchIssue = (files: File[]): string | null => {
  if (files.length > CLIENT_IMPORT_LIMITS.maxFilesPerBatch) {
    return `一次最多导入 ${CLIENT_IMPORT_LIMITS.maxFilesPerBatch} 个文件，请分批处理`;
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > CLIENT_IMPORT_LIMITS.maxTotalBytes) {
    return `本次导入总大小不能超过 ${toMegabytes(CLIENT_IMPORT_LIMITS.maxTotalBytes)} MB`;
  }

  return null;
};
