/**
 * Main-thread client for the merge Worker. Falls back to in-thread execution when Workers are
 * unavailable (old browsers, tests) or the worker fails to boot.
 */
import { executeMergeJob, type MergeJobEvent, type MergeJobInput, type MergeJobResult } from './mergeJob';

let worker: Worker | null = null;
let nextId = 1;
let workerBroken = false;
let factory: (() => Worker) | null = null;

/** Registered by the browser bundle (src/workers/registerMergeWorker.ts); absent in Node tests. */
export function registerMergeWorkerFactory(create: () => Worker) { factory = create; }

function getWorker(): Worker | null {
  if (workerBroken || !factory || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = factory();
    } catch {
      workerBroken = true;
      return null;
    }
  }
  return worker;
}

export const mergeWorkerAvailable = () => getWorker() !== null;

export function runMergeJobInThread(input: MergeJobInput, onEvent: (e: MergeJobEvent) => void): MergeJobResult & { ranIn: 'main' } {
  return { ...executeMergeJob(input, onEvent), ranIn: 'main' };
}

export function runMergeJob(input: MergeJobInput, onEvent: (e: MergeJobEvent) => void): Promise<MergeJobResult & { ranIn: 'worker' | 'main' }> {
  const w = getWorker();
  if (!w) return Promise.resolve(runMergeJobInThread(input, onEvent));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.id !== id) return;
      if (data.kind === 'event') { onEvent(data.event); return; }
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (data.kind === 'done') resolve({ ...data.result, ranIn: 'worker' });
      else reject(new Error(data.message));
    };
    const onError = (ev: ErrorEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      // Boot/compile failure → degrade once to main thread rather than failing the merge.
      workerBroken = true;
      worker?.terminate();
      worker = null;
      ev.preventDefault?.();
      try { resolve({ ...executeMergeJob(input, onEvent), ranIn: 'main' }); } catch (e) { reject(e); }
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ id, input });
  });
}
