/**
 * Minimal import-summary: auto-handled vs needs-attention items from one ingest pass.
 * UI may render this; data is also useful for logs / future toast copy.
 */

import type { IgnoredIngestEntry } from './ingestJunk';
import type { EncodingConfidence } from './textEncoding';

export type ImportAutoKind = 'ignored_file' | 'encoding_converted';
export type ImportAttentionKind = 'low_confidence_encoding' | 'zh_only_package' | 'other';

export interface ImportSummaryItem {
  kind: ImportAutoKind | ImportAttentionKind;
  name: string;
  detail?: string;
}

export interface ImportSummary {
  autoHandled: ImportSummaryItem[];
  needsAttention: ImportSummaryItem[];
}

export interface ImportSummaryTrackInput {
  name: string;
  lang?: string;
  encoding?: string;
  encodingConfidence?: EncodingConfidence;
  isBilingual?: boolean;
}

export function createEmptyImportSummary(): ImportSummary {
  return { autoHandled: [], needsAttention: [] };
}

export function buildImportSummary(args: {
  ignored?: IgnoredIngestEntry[];
  tracks?: ImportSummaryTrackInput[];
}): ImportSummary {
  const summary = createEmptyImportSummary();

  for (const entry of args.ignored || []) {
    summary.autoHandled.push({
      kind: 'ignored_file',
      name: entry.name,
      detail: entry.reason,
    });
  }

  for (const track of args.tracks || []) {
    if (!track.encoding) continue;
    const isUtf8 = /^utf-8/i.test(track.encoding);
    if (track.encodingConfidence === 'low') {
      summary.needsAttention.push({
        kind: 'low_confidence_encoding',
        name: track.name,
        detail: track.encoding,
      });
    } else if (!isUtf8) {
      // Silent conversion away from UTF-8 (GBK/Big5/UTF-16…) — auto-handled.
      summary.autoHandled.push({
        kind: 'encoding_converted',
        name: track.name,
        detail: track.encoding,
      });
    }
  }

  const tracks = args.tracks || [];
  // Only flag multi-track packages that are all Chinese (chs+cht) with no source/secondary.
  if (tracks.length >= 2) {
    const hasSecondary = tracks.some((track) => {
      if (track.isBilingual) return true;
      const lang = track.lang || '';
      return lang === 'en' || lang === 'ja' || lang === 'ko' || lang === 'latin'
        || lang === 'fr' || lang === 'es' || lang === 'pt' || lang === 'de' || lang === 'it'
        || lang === 'bilingual';
    });
    const chineseOnly = tracks.every((track) => {
      const lang = track.lang || '';
      return lang === 'zh-CN' || lang === 'zh-TW' || lang === 'zh';
    });
    if (chineseOnly && !hasSecondary) {
      summary.needsAttention.push({
        kind: 'zh_only_package',
        name: tracks.map((t) => t.name).slice(0, 3).join(', '),
        detail: 'only_chinese',
      });
    }
  }

  return summary;
}

export function summarizeImportForChip(summary: ImportSummary): string | null {
  const autoN = summary.autoHandled.length;
  const attentionN = summary.needsAttention.length;
  if (autoN === 0 && attentionN === 0) return null;
  if (attentionN > 0 && autoN > 0) return `自动处理 ${autoN} · 待确认 ${attentionN}`;
  if (attentionN > 0) return `待确认 ${attentionN} 项`;
  return `已自动处理 ${autoN} 项`;
}
