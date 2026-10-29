import { useSyncExternalStore } from 'react';

/**
 * Touch-primary / narrow-coarse：不教拖放（手机不是多任务桌面）。
 * 与 globals.css TAP-FIRST 媒体条件对齐：
 * `(hover: none) and (pointer: coarse)`，或 `(max-width: 768px) and (pointer: coarse)`。
 * 细指针平板（部分 iPad）仍走桌面拖放示意。
 */
export const TAP_FIRST_MQ =
  '(hover: none) and (pointer: coarse), (max-width: 768px) and (pointer: coarse)';

const subscribeTapFirst = (onStoreChange: () => void) => {
  const mq = window.matchMedia(TAP_FIRST_MQ);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
};

const getTapFirstSnapshot = () => window.matchMedia(TAP_FIRST_MQ).matches;
const getTapFirstServerSnapshot = () => false;

export const useTapFirstIngest = () =>
  useSyncExternalStore(subscribeTapFirst, getTapFirstSnapshot, getTapFirstServerSnapshot);

/**
 * Directory pick: File System Access API, or legacy webkitdirectory.
 * Tap-first / coarse mobile often exposes the attribute but cannot usefully
 * pick folders — treat those as unsupported and steer users to「选择文件」.
 */
const getFolderPickSupported = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  if ('showDirectoryPicker' in window) return true;
  try {
    const input = document.createElement('input');
    const hasLegacy = 'webkitdirectory' in input || 'directory' in input;
    if (!hasLegacy) return false;
    // Attribute present but coarse/narrow tap-first: unreliable — disable.
    if (window.matchMedia(TAP_FIRST_MQ).matches) return false;
    return true;
  } catch {
    return false;
  }
};

const subscribeFolderPick = (onStoreChange: () => void) => {
  const mq = window.matchMedia(TAP_FIRST_MQ);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
};

export const useFolderPickSupported = () =>
  useSyncExternalStore(subscribeFolderPick, getFolderPickSupported, () => true);

export const FOLDER_UNSUPPORTED_HINT = '当前环境不支持选择文件夹，请改用「选择文件」';
