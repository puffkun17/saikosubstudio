// Browser-only: wires the native merge Worker into mergeClient (kept out of Node test builds,
// which compile to CommonJS where import.meta is unavailable).
import { registerMergeWorkerFactory } from '../core/mergeClient';

if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  registerMergeWorkerFactory(() => new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' }));
}
