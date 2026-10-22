// Browser-only: wires the recognition Worker (kept out of Node test builds).
import { registerRecognitionWorkerFactory } from '../core/recognitionClient';

if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  registerRecognitionWorkerFactory(() => new Worker(new URL('./recognition.worker.ts', import.meta.url), { type: 'module' }));
}
