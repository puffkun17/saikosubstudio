import type { StateCreator } from 'zustand';
import type { StudioState } from '../types';

let tempShowTimeoutId: ReturnType<typeof setTimeout> | null = null;

export type TheaterSlice = Pick<
  StudioState,
  | 'previewClockMs'
  | 'isPreviewPlaying'
  | 'sceneBackground'
  | 'theaterAspect'
  | 'showGuides'
  | 'tempShowGuides'
  | 'isLightsOff'
  | 'lang'
  | 'setPreviewClockMs'
  | 'setIsPreviewPlaying'
  | 'setSceneBackground'
  | 'setTheaterAspect'
  | 'setShowGuides'
  | 'setTempShowGuides'
  | 'setLightsOff'
  | 'setLang'
  | 'triggerTempGuides'
>;

/** Per-slice reset partial for cancelCurrentUpload / restartSystem (S3). */
export function resetTheater(_kind: 'cancel' | 'restart'): Partial<StudioState> {
  // previewClockMs / isPreviewPlaying stay (S10 owns the clock).
  return { isLightsOff: false };
}

export const createTheaterSlice: StateCreator<StudioState, [], [], TheaterSlice> = (set) => ({
  previewClockMs: 0,
  isPreviewPlaying: false,
  sceneBackground: 'cinema',
  theaterAspect: '16:9',
  showGuides: false,
  tempShowGuides: false,
  isLightsOff: false,
  lang: 'zh',
  setPreviewClockMs: (previewClockMs) => set({ previewClockMs }),
  setIsPreviewPlaying: (isPreviewPlaying) => set({ isPreviewPlaying }),
  setSceneBackground: (sceneBackground) => set({ sceneBackground }),
  // 画幅只影响预览取景，不写入导出样式（导出画面规格由样式决定）。
  setTheaterAspect: (theaterAspect) => set({ theaterAspect }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setTempShowGuides: (tempShowGuides) => set({ tempShowGuides }),
  setLightsOff: (isLightsOff) => set({ isLightsOff }),
  setLang: (lang) => set({ lang }),
  triggerTempGuides: () => {
    set({ tempShowGuides: true });
    if (tempShowTimeoutId) {
      clearTimeout(tempShowTimeoutId);
    }
    tempShowTimeoutId = setTimeout(() => {
      set({ tempShowGuides: false });
    }, 2000);
  },
});
