/// <reference lib="webworker" />
// Native Web Worker (no library): keeps parse + merge/alignment off the main thread.
import { executeMergeJob, type MergeJobInput } from '../core/mergeJob';

self.onmessage = (event: MessageEvent<{ id: number; input: MergeJobInput }>) => {
  const { id, input } = event.data;
  try {
    const result = executeMergeJob(input, (e) => self.postMessage({ id, kind: 'event', event: e }));
    self.postMessage({ id, kind: 'done', result });
  } catch (err) {
    self.postMessage({ id, kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
