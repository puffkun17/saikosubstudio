/**
 * 一次拖入里「可能有几部作品」（暂存区，dragzone-proposal §7.1 步骤 8–14）。
 *
 * 只看文件名：片名 = 第一个集数 / 季 / 年份 / 分辨率标记之前的文字，归一后比较。
 * 认不出片名的条目不参与分组（不会因为它触发提示）。压缩包按包内轨的多数片名归属。
 * 这是**提示**而不是自动分拣：调用方必须让用户自己选，不能默认选中任何一部。
 */

const MARKERS = [
  /\bS\d{1,2}\s?E\d{1,3}\b/i,
  /\bS\d{1,2}\b/i,
  /\b\d{1,2}x\d{2,3}\b/i,
  /\bE[Pp]?\d{2,3}\b/,
  /第\s*[0-9一二三四五六七八九十百]+\s*[集季话話]/,
  /\b(19|20)\d{2}\b/,
  /\b\d{3,4}[pi]\b/i,
  /\b(web[-\s]?dl|webrip|bluray|bdrip|hdtv|remux)\b/i,
];

const stemOf = (name: string) => {
  const base = (name || '').split(/[\\/]/).pop() || '';
  return base.replace(/\.[A-Za-z0-9]{2,4}$/, '');
};

/** 文件名 → { key, title }；认不出返回 null。 */
export function workTitleOf(name: string): { key: string; title: string } | null {
  const spaced = stemOf(name).replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  let cut = -1;
  for (const marker of MARKERS) {
    const match = spaced.match(marker);
    if (match && match.index !== undefined && (cut < 0 || match.index < cut)) cut = match.index;
  }
  if (cut <= 0) return null;
  const title = spaced.slice(0, cut).replace(/[\s\-–—[(（【]+$/u, '').trim();
  const key = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (key.replace(/\s/g, '').length < 2) return null;
  return { key, title };
}

export interface WorkUnit {
  objectId: string;
  /** 用来判断片名的名字：普通文件 = [自己的名字]；压缩包 = 包内轨名（预览没好时用包名）。 */
  names: string[];
  /** 这一项里有几个字幕文件；缺省 = names.length（普通文件 1，压缩包 = 包内轨数）。 */
  fileCount?: number;
}

export interface WorkGroup {
  key: string;
  title: string;
  objectIds: string[];
  /** 这部作品一共几个文件（压缩包按包内文件算，不按包算）。 */
  fileCount: number;
}

export interface WorkGrouping {
  works: WorkGroup[];
  /** 认不出片名的条目（不属于任何一部）。 */
  unknown: string[];
  /** 认不出片名的文件数（同样按文件算）。 */
  unknownFileCount: number;
  isMultiWork: boolean;
}

const majorityTitle = (names: string[]) => {
  const counts = new Map<string, { title: string; count: number; first: number }>();
  names.forEach((name, index) => {
    const work = workTitleOf(name);
    if (!work) return;
    const current = counts.get(work.key);
    if (current) current.count += 1;
    else counts.set(work.key, { title: work.title, count: 1, first: index });
  });
  let best: { key: string; title: string; count: number; first: number } | null = null;
  for (const [key, value] of counts) {
    if (!best || value.count > best.count || (value.count === best.count && value.first < best.first)) {
      best = { key, ...value };
    }
  }
  return best ? { key: best.key, title: best.title } : null;
};

export function groupQueueByWork(units: WorkUnit[]): WorkGrouping {
  const works: WorkGroup[] = [];
  const byKey = new Map<string, WorkGroup>();
  const unknown: string[] = [];
  let unknownFileCount = 0;
  for (const unit of units) {
    const files = Math.max(1, unit.fileCount ?? unit.names.length);
    const work = majorityTitle(unit.names);
    if (!work) {
      unknown.push(unit.objectId);
      unknownFileCount += files;
      continue;
    }
    let group = byKey.get(work.key);
    if (!group) {
      group = { key: work.key, title: work.title, objectIds: [], fileCount: 0 };
      byKey.set(work.key, group);
      works.push(group);
    }
    group.objectIds.push(unit.objectId);
    group.fileCount += files;
  }
  return { works, unknown, unknownFileCount, isMultiWork: works.length >= 2 };
}

/** 提示是否针对同一组作品（用户点了「都留在这里」之后，组合不变就不再弹）。 */
export function workSignature(grouping: WorkGrouping): string {
  return grouping.works.map((work) => work.key).sort().join('|');
}

/**
 * 「整理文件」遇到还没处理的多作品提示时：第一次点只把提示带到眼前（滚过去 + 描一圈），
 * 第二次点照常整理全部（不拦截、不弹窗）。同一组合只提醒一次；组合变了重新算。
 */
export function shouldNudgeBeforeProcess(input: {
  noticeOpen: boolean;
  signature: string | null;
  nudgedSignature: string | null;
}): boolean {
  if (!input.noticeOpen || !input.signature) return false;
  return input.nudgedSignature !== input.signature;
}
