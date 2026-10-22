/**
 * Import recognition job: pure, runs in the Web Worker (src/workers/recognition.worker.ts)
 * and as an in-thread fallback. Input/output are structured-clone safe (plain objects / strings).
 *
 * Covers the heavy Act-1 pass: ASS style-pair split + SDH-by-content flagging.
 * Does not touch the DragZone import ceremony timing.
 */
import { derivedFileId } from './identity';
import { detectSdhByContent, splitAssByLanguageStyles } from './recognition';
import {
  detectLanguageByContent,
  isEnglishSecondaryLanguage,
  isSdhOrCcSubtitleFilename,
} from '../utils/subtitle/analysis';
import { parseSubtitle } from '../utils/subtitle/io';
import type { SubtitleLanguagePair } from '../utils/subtitle/model';

/** Clone-safe file shape (mirrors store Subfile; kept here to avoid a store ↔ worker cycle). */
export interface RecognitionFile {
  id: string;
  name: string;
  text: string;
  lang: string;
  languagePair?: SubtitleLanguagePair;
  isBilingual: boolean;
  isCommentary: boolean;
  size: number;
  importSource?: 'file' | 'zip' | 'archive' | 'folder';
  encoding?: string;
  encodingConfidence?: 'high' | 'low';
  isSdh?: boolean;
  derivedFrom?: { name: string; styles: string[] };
}

export interface RecognitionJobResult {
  files: RecognitionFile[];
}

/**
 * Expand imported files: split zh+ja/ko style-paired ASS into virtual tracks;
 * flag English SDH by content when the filename is not already SDH/CC.
 */
export function executeRecognitionJob(files: RecognitionFile[]): RecognitionJobResult {
  const out: RecognitionFile[] = [];
  for (const file of files) {
    const base = { ...file };
    if (/\.(ass|ssa)$/i.test(file.name) && !file.derivedFrom) {
      const split = splitAssByLanguageStyles(file.text);
      if (split && split.secondary.lang !== 'en') {
        const stem = file.name.replace(/\.(ass|ssa)$/i, '');
        const secondaryLang = split.secondary.lang;
        const zhLang = detectLanguageByContent(
          parseSubtitle(split.primary.text).slice(0, 80).map((r) => r.text).join('\n'),
        );
        out.push({
          ...base,
          id: derivedFileId(file.id, 'zh'),
          name: `${stem}.简中.ass`,
          text: split.primary.text,
          lang: zhLang === 'zh-TW' ? 'zh-TW' : 'zh-CN',
          isBilingual: false,
          languagePair: undefined,
          derivedFrom: { name: file.name, styles: split.primary.styles },
        });
        out.push({
          ...base,
          id: derivedFileId(file.id, secondaryLang),
          name: `${stem}.${secondaryLang === 'ja' ? '日文' : 'kor'}.ass`,
          text: split.secondary.text,
          lang: secondaryLang,
          isBilingual: false,
          languagePair: undefined,
          derivedFrom: { name: file.name, styles: split.secondary.styles },
        });
        continue;
      }
    }
    if (
      isEnglishSecondaryLanguage(file.lang)
      && !isSdhOrCcSubtitleFilename(file.name)
      && detectSdhByContent(parseSubtitle(file.text)).isSdh
    ) {
      out.push({ ...base, isSdh: true });
      continue;
    }
    out.push(base);
  }
  return { files: out };
}
