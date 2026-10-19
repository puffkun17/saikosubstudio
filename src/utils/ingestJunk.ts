/**
 * Paths / basenames that must never become subtitle tracks during archive or folder ingest.
 * AppleDouble `._*.srt` under `__MACOSX/` is a common false zh-CN empty track.
 */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|tiff?|svg)$/i;
const JUNK_META_EXT = /\.(nfo|sfv|url)$/i;
const JUNK_BASENAME = /^(Thumbs\.db|desktop\.ini|\.DS_Store)$/i;
const README_TXT = /^(readme|read\s*me|info)(\b|[_.\-\s]).*\.txt$/i;

/** Normalize archive / folder relative paths to forward slashes. */
export function normalizeIngestPath(path: string): string {
  return String(path || '').replace(/\\/g, '/');
}

/**
 * True when this entry should be silently ignored during ingest.
 * Works on full archive paths (`__MACOSX/._foo.srt`) and bare basenames.
 */
export function isJunkIngestPath(path: string): boolean {
  const normalized = normalizeIngestPath(path);
  if (!normalized) return false;
  const parts = normalized.split('/').filter(Boolean);
  const base = parts[parts.length - 1] || '';

  if (parts.some((part) => part === '__MACOSX' || part.startsWith('__MACOSX'))) return true;
  if (base.startsWith('._')) return true;
  if (JUNK_BASENAME.test(base)) return true;
  if (JUNK_META_EXT.test(base)) return true;
  if (IMAGE_EXT.test(base)) return true;
  if (README_TXT.test(base) || (/^readme\.txt$/i.test(base) || /^info\.txt$/i.test(base))) return true;
  return false;
}

export interface IgnoredIngestEntry {
  name: string;
  reason: 'macosx' | 'appledouble' | 'system' | 'meta' | 'image' | 'readme' | 'non_subtitle';
}

export function classifyJunkIngestPath(path: string): IgnoredIngestEntry | null {
  const normalized = normalizeIngestPath(path);
  if (!normalized) return null;
  const parts = normalized.split('/').filter(Boolean);
  const base = parts[parts.length - 1] || '';
  const name = base || normalized;

  if (parts.some((part) => part === '__MACOSX' || part.startsWith('__MACOSX'))) {
    return { name: normalized, reason: 'macosx' };
  }
  if (base.startsWith('._')) return { name: normalized, reason: 'appledouble' };
  if (JUNK_BASENAME.test(base)) return { name: normalized, reason: 'system' };
  if (JUNK_META_EXT.test(base)) return { name: normalized, reason: 'meta' };
  if (IMAGE_EXT.test(base)) return { name: normalized, reason: 'image' };
  if (README_TXT.test(base) || /^readme\.txt$/i.test(base) || /^info\.txt$/i.test(base)) {
    return { name: normalized, reason: 'readme' };
  }
  return null;
}

/** Partition archive entries into subtitle candidates vs ignored junk (with reasons). */
export function partitionIngestPaths(
  paths: string[],
  isSubtitle: (path: string) => boolean,
): { subtitles: string[]; ignored: IgnoredIngestEntry[] } {
  const subtitles: string[] = [];
  const ignored: IgnoredIngestEntry[] = [];
  for (const path of paths) {
    const junk = classifyJunkIngestPath(path);
    if (junk) {
      ignored.push(junk);
      continue;
    }
    if (isSubtitle(path)) {
      subtitles.push(path);
    } else {
      ignored.push({ name: normalizeIngestPath(path), reason: 'non_subtitle' });
    }
  }
  return { subtitles, ignored };
}
