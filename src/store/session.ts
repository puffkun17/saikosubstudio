import type { StateCreator } from 'zustand';
import type { StudioState } from './types';
import { resetCredit } from './slices/credit';
import { resetFeedback } from './slices/feedback';
import { resetIngest } from './slices/ingest';
import { invalidateTmdbRequests, resetMediaTmdb } from './slices/mediaTmdb';
import { resetStyle } from './slices/style';
import { resetTheater } from './slices/theater';
import { resetWorkbench } from './slices/workbench';

/** Compose per-slice reset() partials into one set() payload (S3). */
function composeReset(kind: 'cancel' | 'restart'): Partial<StudioState> {
  return {
    ...resetIngest(kind),
    ...resetMediaTmdb(kind),
    ...resetWorkbench(kind),
    ...resetTheater(kind),
    ...resetFeedback(kind),
    ...resetCredit(kind),
    ...resetStyle(kind),
  };
}

export type SessionSlice = Pick<StudioState, 'cancelCurrentUpload' | 'restartSystem'>;

export const createSessionSlice: StateCreator<StudioState, [], [], SessionSlice> = (set, get) => ({
  cancelCurrentUpload: () => {
    invalidateTmdbRequests();
    set({ ...composeReset('cancel') });
    get().addLog('已取消导入', 'info');
  },
  restartSystem: () => {
    invalidateTmdbRequests();
    set({ ...composeReset('restart') });
    get().addLog('已重启工作流，准备新导入', 'info');
  },
});
