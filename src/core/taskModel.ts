/**
 * Task-centred data model (PR「后台算法」). One task per episode (or film), created right after
 * Act-1 recognition. Files are replaceable slots; the task id, name and export name survive
 * re-uploads. Subtitle text never leaves the device (IndexedDB only, see taskStore.ts).
 */
import type { EpisodeRef } from './episode';
import { mintTaskId, workIdentityFromEpisode } from './identity';
import type { ReviewReason } from './reviewReasons';

export type SlotRole = 'primary' | 'secondary' | 'commentary';
export type TrackLanguage = string; // SubtitleLanguage codes from subtitleCore (zh-CN, en, ja, es, …)

export interface SubtitleSlot {
  role: SlotRole;
  /** Key into the IndexedDB `sources` store. */
  sourceId: string;
  fileName: string;
  language: TrackLanguage;
  isSdh: boolean;
  /** Virtual tracks split out of one bilingual file (e.g. Dial_CH / Dial_JP styles). */
  derivedFrom?: { sourceId: string; styles: string[] };
  boundAt: number;
}

/** Only the video filename is kept: no audio decoding, no video bytes, not counted in the 80 MB cap. */
export interface VideoSlot { fileName: string; sizeBytes?: number; attachedAt: number }

export interface TmdbRef {
  id: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;          // TMDB localized (zh-CN) title, e.g. 熊家餐馆
  originalTitle: string;  // e.g. The Bear
  year?: string;
  /** Match confidence at link time (strong = auto, partial = user confirmed / candidates shown). */
  confidence: 'strong' | 'partial' | 'weak' | 'manual';
}

export type NamingMode = 'original' | 'zh+original';

export interface TaskName {
  value: string;
  /** auto = regenerated when identity changes; locked = user edited, never overwritten. */
  state: 'auto' | 'locked';
}

export type TaskStage = 'recognized' | 'paired' | 'merging' | 'merged' | 'reviewed' | 'exported';

export interface Task {
  id: string;
  createdAt: number;
  updatedAt: number;
  stage: TaskStage;
  episode: EpisodeRef;
  tmdb?: TmdbRef;
  name: TaskName;
  exportBaseName: TaskName;
  slots: SubtitleSlot[];
  video?: VideoSlot;
  /** Unresolved same-episode suggestion: another task this one may duplicate. */
  mergeSuggestion?: { otherTaskId: string; score: number; reason: string };
  /** Single-language fast path: only a primary track, no secondary (UI copy later). */
  singleLanguage: boolean;
  review: ReviewReason[];
  credits?: import('./credits').CreditPlan;
}

/** Deterministic id from title + episode (see core/identity). `now` kept for call-site compat. */
export const newTaskId = (fallbackTitle: string, episode: EpisodeRef, _now = Date.now()) =>
  mintTaskId(workIdentityFromEpisode(fallbackTitle, episode));

export function createTask(input: { episode: EpisodeRef; fallbackTitle: string; slots?: SubtitleSlot[]; now?: number }): Task {
  const now = input.now ?? Date.now();
  const task: Task = {
    id: newTaskId(input.fallbackTitle, input.episode, now),
    createdAt: now,
    updatedAt: now,
    stage: 'recognized',
    episode: input.episode,
    name: { value: '', state: 'auto' },
    exportBaseName: { value: '', state: 'auto' },
    slots: input.slots ?? [],
    singleLanguage: false,
    review: [],
  };
  return refreshAutoNames(task, { fallbackTitle: input.fallbackTitle });
}

const sanitizeSegment = (v: string) => v
  .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
  .replace(/['’]/g, '')
  .replace(/&/g, 'and')
  .replace(/\s+/g, '.')
  .replace(/\.{2,}/g, '.')
  .replace(/^\.|\.$/g, '');

const epKey = (ep: EpisodeRef, tmdb?: TmdbRef): string => {
  const season = tmdb?.season ?? ep.season ?? (tmdb?.mediaType === 'tv' || ep.episode != null ? 1 : null);
  const episode = tmdb?.episode ?? ep.episode;
  if (episode == null) return '';
  return `S${String(season ?? 1).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
};

/**
 * Export base name (without language suffix / extension).
 * original:     The.Bear.2022.S01E01
 * zh+original:  熊家餐馆.The.Bear.2022.S01E01
 * When a video slot exists its filename wins (Derek: names should match the local video).
 */
export function buildExportBaseName(task: Pick<Task, 'episode' | 'tmdb' | 'video'>, mode: NamingMode, fallbackTitle = ''): string {
  if (task.video?.fileName) return task.video.fileName.replace(/\.[A-Za-z0-9]{2,4}$/, '');
  const t = task.tmdb;
  const original = sanitizeSegment(t?.originalTitle || fallbackTitle);
  const zh = t && t.title && t.title !== t.originalTitle ? sanitizeSegment(t.title) : '';
  const parts = [mode === 'zh+original' ? zh : '', original, t?.year || '', t?.mediaType === 'movie' ? '' : epKey(task.episode, t)];
  return parts.filter(Boolean).join('.') || 'subtitle';
}

/** Same naming rule for the legacy (pre-task) store: TMDB meta + SxxEyy, or a borrowed video filename. */
export function buildExportBaseFromMeta(
  meta: { title: string; originalTitle: string; year: string } | null,
  epKey: string,
  mode: NamingMode,
  opts: { videoName?: string | null; fallback?: string } = {},
): string {
  if (opts.videoName) return opts.videoName.replace(/\.[A-Za-z0-9]{2,4}$/, '');
  if (!meta) return opts.fallback || 'subtitles';
  const original = sanitizeSegment(meta.originalTitle || meta.title);
  const zh = meta.title && meta.title !== meta.originalTitle ? sanitizeSegment(meta.title) : '';
  const parts = [mode === 'zh+original' ? zh : '', original, meta.year || '', (epKey || '').toUpperCase()];
  return parts.filter(Boolean).join('.') || opts.fallback || 'subtitles';
}

/** Human task name for chrome/tabs: 熊家餐馆 S01E02 (zh title preferred). */
export function buildTaskDisplayName(task: Pick<Task, 'episode' | 'tmdb'>, fallbackTitle = ''): string {
  const title = task.tmdb?.title || task.tmdb?.originalTitle || fallbackTitle || '待补充片名';
  const ep = task.tmdb?.mediaType === 'movie' ? '' : epKey(task.episode, task.tmdb);
  return ep ? `${title} ${ep}` : title;
}

export function refreshAutoNames(task: Task, opts: { fallbackTitle?: string; namingMode?: NamingMode } = {}): Task {
  const next = { ...task };
  if (task.name.state === 'auto') next.name = { value: buildTaskDisplayName(task, opts.fallbackTitle), state: 'auto' };
  if (task.exportBaseName.state === 'auto') {
    next.exportBaseName = { value: buildExportBaseName(task, opts.namingMode ?? 'original', opts.fallbackTitle), state: 'auto' };
  }
  return next;
}

export const renameTask = (task: Task, value: string, now = Date.now()): Task =>
  ({ ...task, name: { value: value.trim(), state: 'locked' }, updatedAt: now });

export const setExportBaseName = (task: Task, value: string, now = Date.now()): Task =>
  ({ ...task, exportBaseName: { value: sanitizeSegment(value) || task.exportBaseName.value, state: 'locked' }, updatedAt: now });

export const unlockNames = (task: Task, opts: { fallbackTitle?: string; namingMode?: NamingMode } = {}): Task =>
  refreshAutoNames({ ...task, name: { ...task.name, state: 'auto' }, exportBaseName: { ...task.exportBaseName, state: 'auto' } }, opts);

export function linkTmdb(task: Task, tmdb: TmdbRef, opts: { fallbackTitle?: string; namingMode?: NamingMode } = {}): Task {
  return refreshAutoNames({ ...task, tmdb, updatedAt: Date.now() }, opts);
}

/** Replace or fill a slot. Task identity, names and review state of other slots are untouched. */
export function setSlot(task: Task, slot: SubtitleSlot): Task {
  const slots = task.slots.filter((s) => s.role !== slot.role);
  slots.push(slot);
  const singleLanguage = !slots.some((s) => s.role === 'secondary');
  // Changing a source invalidates merge output, so the task drops back to 'paired'.
  const stage: TaskStage = slots.some((s) => s.role === 'primary') ? 'paired' : 'recognized';
  return { ...task, slots, singleLanguage, stage, updatedAt: Date.now() };
}

export const clearSlot = (task: Task, role: SlotRole): Task => {
  const slots = task.slots.filter((s) => s.role !== role);
  return { ...task, slots, singleLanguage: !slots.some((s) => s.role === 'secondary'), stage: slots.some((s) => s.role === 'primary') ? 'paired' : 'recognized', updatedAt: Date.now() };
};

export const attachVideo = (task: Task, fileName: string, sizeBytes?: number, opts: { fallbackTitle?: string; namingMode?: NamingMode } = {}): Task =>
  refreshAutoNames({ ...task, video: { fileName, sizeBytes, attachedAt: Date.now() }, updatedAt: Date.now() }, opts);

export const detachVideo = (task: Task, opts: { fallbackTitle?: string; namingMode?: NamingMode } = {}): Task =>
  refreshAutoNames({ ...task, video: undefined, updatedAt: Date.now() }, opts);

export const VIDEO_EXTENSIONS = /\.(mkv|mp4|m4v|mov|avi|ts|m2ts|webm|wmv|flv)$/i;
export const isVideoFileName = (name: string) => VIDEO_EXTENSIONS.test(name || '');

/** Allowed transitions; anything else is a programming error. */
export const STAGE_TRANSITIONS: Record<TaskStage, TaskStage[]> = {
  recognized: ['paired'],
  paired: ['merging', 'recognized'],
  merging: ['merged', 'paired'],
  merged: ['reviewed', 'paired', 'merging'],
  reviewed: ['exported', 'merged', 'paired'],
  exported: ['reviewed', 'merged', 'paired'],
};

export function advanceStage(task: Task, to: TaskStage): Task {
  if (!STAGE_TRANSITIONS[task.stage].includes(to)) throw new Error(`illegal task stage ${task.stage} -> ${to}`);
  return { ...task, stage: to, updatedAt: Date.now() };
}

/** Export filename with language suffix (Infuse/Plex: .zh-Hans). */
export const exportFileName = (task: Task, ext: 'ass' | 'srt', langSuffix = 'zh-Hans') =>
  `${task.exportBaseName.value}.${langSuffix}.${ext}`;
