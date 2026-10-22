/**
 * Local persistence for tasks and source subtitles (IndexedDB, device only).
 * - `sources`: raw subtitle text per slot, expires after RETENTION_DAYS (default 30).
 * - `tasks`: task records (no subtitle text), history for the later 历史任务 UI.
 * - `clearAllLocalData()`: the one-click clear API.
 *
 * Schema upgrades are a clean break (planned downtime): on version mismatch all
 * object stores are dropped and recreated empty — no row migration.
 * Nothing here talks to the network.
 */
import type { Task } from './taskModel';

export const DB_NAME = 'saiko-tasks';
/**
 * v3: stable typed identity (core/identity). Prior versions (v1–v2) are discarded
 * wholesale on upgrade — empty history, no errors.
 */
export const DB_VERSION = 3;
export const RETENTION_DAYS_DEFAULT = 30;
const DAY = 86_400_000;

export interface SourceRecord {
  id: string;
  taskId: string;
  fileName: string;
  text: string;
  bytes: number;
  storedAt: number;
  expiresAt: number;
}

export interface MergedRecord { taskId: string; rows: unknown[]; savedAt: number; extra?: Record<string, unknown> }

export const isExpired = (r: { expiresAt: number }, now = Date.now()) => r.expiresAt <= now;
export const expiryFor = (storedAt: number, retentionDays = RETENTION_DAYS_DEFAULT) => storedAt + Math.max(1, retentionDays) * DAY;

type IDBF = IDBFactory;
const factory = (): IDBF | null => (typeof indexedDB === 'undefined' ? null : indexedDB);

/** Pure: true when opening a newer schema should wipe prior stores. */
export function shouldDiscardStoresOnUpgrade(oldVersion: number, newVersion: number): boolean {
  return oldVersion > 0 && oldVersion < newVersion;
}

/** Create the current object-store layout on an empty database. */
export function createTaskStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('tasks')) {
    db.createObjectStore('tasks', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains('sources')) {
    const s = db.createObjectStore('sources', { keyPath: 'id' });
    s.createIndex('taskId', 'taskId');
    s.createIndex('expiresAt', 'expiresAt');
  }
  if (!db.objectStoreNames.contains('merged')) db.createObjectStore('merged', { keyPath: 'taskId' });
  if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
}

/**
 * Upgrade handler: discard all stores when oldVersion &lt; newVersion, then recreate.
 * Returns whether prior data was discarded. Safe on a fresh DB (oldVersion === 0).
 */
export function applySchemaUpgrade(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number = DB_VERSION,
): { discarded: boolean } {
  const discarded = shouldDiscardStoresOnUpgrade(oldVersion, newVersion);
  if (discarded) {
    for (const name of Array.from(db.objectStoreNames)) {
      db.deleteObjectStore(name);
    }
  }
  createTaskStores(db);
  return { discarded };
}

function open(idb: IDBF | null = factory()): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idb) return reject(new Error('IndexedDB unavailable'));
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      applySchemaUpgrade(req.result, event.oldVersion, DB_VERSION);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
const result = <T>(req: IDBRequest<T>) => new Promise<T>((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function putTask(task: Task): Promise<void> {
  const db = await open();
  const tx = db.transaction('tasks', 'readwrite');
  tx.objectStore('tasks').put(task);
  await done(tx);
}

export async function listTasks(): Promise<Task[]> {
  const db = await open();
  const all = await result(db.transaction('tasks').objectStore('tasks').getAll() as IDBRequest<Task[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(['tasks', 'sources', 'merged'], 'readwrite');
  tx.objectStore('tasks').delete(taskId);
  tx.objectStore('merged').delete(taskId);
  const idx = tx.objectStore('sources').index('taskId');
  const keys = await result(idx.getAllKeys(IDBKeyRange.only(taskId)));
  keys.forEach((k) => tx.objectStore('sources').delete(k));
  await done(tx);
}

export async function putSource(input: { id: string; taskId: string; fileName: string; text: string }, retentionDays = RETENTION_DAYS_DEFAULT, now = Date.now()): Promise<SourceRecord> {
  const rec: SourceRecord = { ...input, bytes: input.text.length * 2, storedAt: now, expiresAt: expiryFor(now, retentionDays) };
  const db = await open();
  const tx = db.transaction('sources', 'readwrite');
  tx.objectStore('sources').put(rec);
  await done(tx);
  return rec;
}

export async function getSource(id: string, now = Date.now()): Promise<SourceRecord | null> {
  const db = await open();
  const rec = await result(db.transaction('sources').objectStore('sources').get(id) as IDBRequest<SourceRecord | undefined>);
  return rec && !isExpired(rec, now) ? rec : null;
}

export async function putMerged(taskId: string, rows: unknown[], extra?: Record<string, unknown>): Promise<void> {
  const db = await open();
  const tx = db.transaction('merged', 'readwrite');
  tx.objectStore('merged').put({ taskId, rows, savedAt: Date.now(), extra } satisfies MergedRecord);
  await done(tx);
}

/** Task + merged result in one transaction (history entry). */
export async function putHistoryEntry(task: Task, rows: unknown[], extra?: Record<string, unknown>): Promise<void> {
  const db = await open();
  const tx = db.transaction(['tasks', 'merged'], 'readwrite');
  tx.objectStore('tasks').put(task);
  tx.objectStore('merged').put({ taskId: task.id, rows, savedAt: task.updatedAt, extra } satisfies MergedRecord);
  await done(tx);
}

export async function listMerged(): Promise<MergedRecord[]> {
  const db = await open();
  return result(db.transaction('merged').objectStore('merged').getAll() as IDBRequest<MergedRecord[]>);
}

/** Pure: which history tasks fall outside the retention window. */
export const expiredTaskIds = (tasks: Pick<Task, 'id' | 'updatedAt'>[], now = Date.now(), retentionDays = RETENTION_DAYS_DEFAULT): string[] =>
  tasks.filter((t) => isExpired({ expiresAt: expiryFor(t.updatedAt, retentionDays) }, now)).map((t) => t.id);

/** History retention: tasks (and their merged rows / sources) older than N days are removed. */
export async function purgeExpiredTasks(now = Date.now(), retentionDays = RETENTION_DAYS_DEFAULT): Promise<number> {
  const ids = expiredTaskIds(await listTasks(), now, retentionDays);
  for (const id of ids) await deleteTask(id);
  return ids.length;
}

/** Delete expired source texts. Task records stay (history keeps names / TMDB / settings). */
export async function purgeExpiredSources(now = Date.now()): Promise<number> {
  const db = await open();
  const tx = db.transaction('sources', 'readwrite');
  const keys = await result(tx.objectStore('sources').index('expiresAt').getAllKeys(IDBKeyRange.upperBound(now)));
  keys.forEach((k) => tx.objectStore('sources').delete(k));
  await done(tx);
  return keys.length;
}

/** One-click clear: drops every task, source text and merged result on this device. */
export async function clearAllLocalData(idb: IDBF | null = factory()): Promise<void> {
  if (!idb) return;
  await new Promise<void>((res, rej) => {
    const req = idb.deleteDatabase(DB_NAME);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
    req.onblocked = () => res();
  });
}

export async function storageEstimate(): Promise<{ usage?: number; quota?: number }> {
  try { return (await navigator.storage?.estimate?.()) || {}; } catch { return {}; }
}
