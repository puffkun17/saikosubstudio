/**
 * Pure pattern-skeleton grouping for mounted homepage items (no React/DOM I/O).
 *
 * Recognizes same-folder / same-batch regular naming patterns including:
 * - Explicit season/episode tokens (`S01E01`, `1x01`)
 * - Pure numeric stems (`01.ass`..`07.ass`, `07v2.ass`)
 * - Numbered release/template names (`Show - 01 [1080p].ass`, `01_CHS.srt`)
 *
 * Groups items sharing the same folder/batch skeleton, sorts each stack ascending
 * by sequence number, and detects sequence continuity or missing gaps.
 */

export type DeskExt = 'srt' | 'ass' | 'zip' | 'rar' | '7z' | 'other';

export interface DeskPatternMeta {
  ext: DeskExt;
  skeleton: string;
  title: string;
  seqNum: number | null;
}

export interface DeskGroupInput {
  key: string;
  name: string;
  folderName?: string;
  sizeBytes: number;
}

export interface DeskGroup<T extends DeskGroupInput = DeskGroupInput> {
  id: string;
  ext: DeskExt;
  title: string;
  folderName?: string;
  items: Array<T & { seqNum: number | null }>;
  totalBytes: number;
  isStack: boolean;
  displayTitle: string;
  continuityNote: string | null;
}

const ARCHIVE_EXTS = new Set<DeskExt>(['zip', 'rar', '7z']);

export const normalizeDeskExt = (filename: string): DeskExt => {
  const dot = filename.lastIndexOf('.');
  const raw = dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
  if (raw === 'srt') return 'srt';
  if (raw === 'ass' || raw === 'ssa') return 'ass';
  if (raw === 'zip') return 'zip';
  if (raw === 'rar') return 'rar';
  if (raw === '7z') return '7z';
  return 'other';
};

/** Extract deterministic grouping skeleton + numeric sequence from a filename. */
export const extractPatternSkeleton = (filename: string, folderName?: string): DeskPatternMeta => {
  const scope = folderName ? folderName.toLowerCase() : '__batch__';
  const ext = normalizeDeskExt(filename);
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;

  if (ARCHIVE_EXTS.has(ext)) {
    return {
      ext,
      skeleton: `${scope}::archive::${ext}::${filename.toLowerCase()}`,
      title: folderName ? `${folderName} / ${filename}` : filename,
      seqNum: null,
    };
  }

  // 1. Explicit S01E05 / S01_E05 / S01EP05
  let match = stem.match(/^(.*?\bS\d{1,3}[\s._-]*E[Pp]?)(\d{1,4})(?![0-9])(.*)$/i);
  if (match) {
    return {
      ext,
      skeleton: `${scope}::${(match[1] + '{#}' + match[3]).toLowerCase()}::${ext}`,
      title: (match[1].replace(/[._-]+$/, '') || stem).replace(/[._]+/g, ' ').trim(),
      seqNum: parseInt(match[2], 10),
    };
  }

  // 2. Explicit 1x05
  match = stem.match(/^(.*?\b\d{1,2}x)(\d{2,3})(?![0-9])(.*)$/i);
  if (match) {
    return {
      ext,
      skeleton: `${scope}::${(match[1] + '{#}' + match[3]).toLowerCase()}::${ext}`,
      title: (match[1].replace(/\d{1,2}x$/, '').replace(/[._-]+$/, '') || stem).replace(/[._]+/g, ' ').trim(),
      seqNum: parseInt(match[2], 10),
    };
  }

  // 3. Pure numeric stem (`01`, `06`, `07`, `07v2`)
  match = stem.match(/^(\d{1,4})(v\d)?$/i);
  if (match) {
    return {
      ext,
      skeleton: `${scope}::{PURE_NUM}::${ext}`,
      title: folderName || '编号序列',
      seqNum: parseInt(match[1], 10),
    };
  }

  // 4. General numbered templates (masking resolution / year / CRC32 hashes first)
  const masked = stem
    .replace(/\b(?:480|576|720|1080|2160)[pi]\b/gi, (segment) => '_'.repeat(segment.length))
    .replace(/\b(?:19|20)\d{2}\b/g, (segment) => '_'.repeat(segment.length))
    .replace(/\[[0-9A-F]{8}\]/gi, (segment) => '_'.repeat(segment.length));

  const numMatches = [...masked.matchAll(/(?:^|[^A-Za-z0-9])(\d{1,3})(?=[^0-9]|$)/g)];
  if (numMatches.length > 0) {
    const last = numMatches[numMatches.length - 1];
    const numStr = last[1];
    const numIdx = (last.index ?? 0) + last[0].lastIndexOf(numStr);
    const before = stem.slice(0, numIdx);
    const after = stem.slice(numIdx + numStr.length);
    const cleanTitle = (before.replace(/[\s._\-\[\(E]+$/i, '') || folderName || '同格式组')
      .replace(/[._]+/g, ' ')
      .trim();
    return {
      ext,
      skeleton: `${scope}::${(before + '{#}' + after).toLowerCase()}::${ext}`,
      title: cleanTitle,
      seqNum: parseInt(numStr, 10),
    };
  }

  return {
    ext,
    skeleton: `${scope}::single::${filename.toLowerCase()}`,
    title: filename,
    seqNum: null,
  };
};

const padEp = (num: number) => String(num).padStart(2, '0');

export const detectGroupContinuity = (seqNums: Array<number | null>): string | null => {
  const nums = seqNums.filter((n): n is number => n != null);
  if (nums.length < 2) return null;
  const min = nums[0];
  const max = nums[nums.length - 1];
  const present = new Set(nums);
  const missing: string[] = [];
  for (let k = min; k <= max; k += 1) {
    if (!present.has(k)) missing.push(padEp(k));
  }
  return missing.length === 0
    ? `编号 ${padEp(min)}–${padEp(max)} 连续齐备`
    : `缺第 ${missing.slice(0, 3).join('、')}${missing.length > 3 ? '…' : ''} 集`;
};

/** Group mounted items by structural skeleton and sort each stack ascending. */
export const groupDeskItems = <T extends DeskGroupInput>(items: T[]): DeskGroup<T>[] => {
  const buckets = new Map<string, Omit<DeskGroup<T>, 'isStack' | 'displayTitle' | 'continuityNote'>>();

  for (const item of items) {
    const meta = extractPatternSkeleton(item.name, item.folderName);
    let bucket = buckets.get(meta.skeleton);
    if (!bucket) {
      bucket = {
        id: meta.skeleton,
        ext: meta.ext,
        title: meta.title,
        folderName: item.folderName,
        items: [],
        totalBytes: 0,
      };
      buckets.set(meta.skeleton, bucket);
    }
    bucket.items.push({ ...item, seqNum: meta.seqNum });
    bucket.totalBytes += item.sizeBytes;
  }

  const groups: DeskGroup<T>[] = [];
  for (const bucket of buckets.values()) {
    bucket.items.sort((a, b) => {
      if (a.seqNum != null && b.seqNum != null && a.seqNum !== b.seqNum) {
        return a.seqNum - b.seqNum;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const isStack = bucket.items.length > 1;
    const prefix = bucket.folderName ? `${bucket.folderName} / ` : '';
    const first = bucket.items[0];
    const last = bucket.items[bucket.items.length - 1];
    const displayTitle = !isStack
      ? (bucket.folderName ? `${prefix}${first.name}` : first.name)
      : (first.seqNum != null && last.seqNum != null)
        ? `${prefix}${first.name} – ${last.name}`
        : `${prefix}${bucket.title}（×${bucket.items.length}）`;

    const continuityNote = isStack
      ? detectGroupContinuity(bucket.items.map((entry) => entry.seqNum))
      : null;

    groups.push({
      ...bucket,
      isStack,
      displayTitle,
      continuityNote,
    });
  }

  return groups;
};
