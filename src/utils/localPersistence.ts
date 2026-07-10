export type StorageWriteResult = { ok: true; bytes: number } | { ok: false; error: string };

export const readJsonStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

export const writeJsonStorage = (key: string, value: unknown): StorageWriteResult => {
  if (typeof window === 'undefined') return { ok: false, error: '浏览器存储不可用' };
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return { ok: true, bytes: new Blob([serialized]).size };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '浏览器存储空间不足',
    };
  }
};

export const estimateJsonBytes = (value: unknown): number => {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};
