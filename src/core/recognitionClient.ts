/**
 * Main-thread client for the recognition Worker. Falls back to in-thread execution when
 * Workers are unavailable (Node tests, old browsers) or the worker fails to boot.
 */
import { executeRecognitionJob, type RecognitionFile, type RecognitionJobResult } from './recognitionJob';

let worker: Worker | null = null;
let nextId = 1;
let workerBroken = false;
let factory: (() => Worker) | null = null;

/** Registered by the browser bundle (src/workers/registerRecognitionWorker.ts). */
export function registerRecognitionWorkerFactory(create: () => Worker) { factory = create; }

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

export const recognitionWorkerAvailable = () => getWorker() !== null;

export function runRecognitionJobInThread(files: RecognitionFile[]): RecognitionJobResult & { ranIn: 'main' } {
  return { ...executeRecognitionJob(files), ranIn: 'main' };
}

export function runRecognitionJob(files: RecognitionFile[]): Promise<RecognitionJobResult & { ranIn: 'worker' | 'main' }> {
  const w = getWorker();
  if (!w) return Promise.resolve(runRecognitionJobInThread(files));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.id !== id) return;
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (data.kind === 'done') resolve({ ...data.result, ranIn: 'worker' });
      else reject(new Error(data.message));
    };
    const onError = (ev: ErrorEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      workerBroken = true;
      worker?.terminate();
      worker = null;
      ev.preventDefault?.();
      try { resolve({ ...executeRecognitionJob(files), ranIn: 'main' }); } catch (e) { reject(e); }
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ id, files });
  });
}
