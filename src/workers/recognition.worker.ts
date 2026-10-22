/// <reference lib="webworker" />
// Native Web Worker: ASS style-split + SDH detection off the main thread during import.
import { executeRecognitionJob, type RecognitionFile } from '../core/recognitionJob';

self.onmessage = (event: MessageEvent<{ id: number; files: RecognitionFile[] }>) => {
  const { id, files } = event.data;
  try {
    const result = executeRecognitionJob(files);
    self.postMessage({ id, kind: 'done', result });
  } catch (err) {
    self.postMessage({ id, kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
