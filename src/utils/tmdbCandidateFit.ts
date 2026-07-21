/**
 * 剧集年份 / 季跨度拟合：用文件名或用户手填年份区分同名剧，不增加 TMDB 详情请求。
 *
 * - 精确首播年 → match
 * - 候选首播晚于用户年 → 不可能（veto:year-after）
 * - 按「约一年一季」估：userYear - firstAir + 1 < season → 跨度不够（veto:season-span）
 * - 其余（如填了发行年 2025、首播 2020）→ soft，需用户确认
 *
 * 无用户年时：用参考年（默认今天）对季跨度不足的候选本地降权（demote），
 * 便于同名剧一次搜索后上屏高分项，并用「不是这个？」切换另一缓存候选。
 */

export type TvYearFit = {
  match: boolean;
  soft: boolean;
  veto: 'veto:year-after' | 'veto:season-span' | null;
};

export function parseYearToken(value: string | undefined | null): string {
  const trimmed = (value || '').trim();
  return /^(19|20)\d{2}$/.test(trimmed) ? trimmed : '';
}

export function parseSeasonNumber(value: string | number | undefined | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** 以参考年（默认当前年）判断：开播至今是否撑得起 Sxx（约一年一季）。 */
export function shouldDemoteBySeasonSpan(opts: {
  itemYear: string;
  season?: number;
  referenceYear?: number;
}): boolean {
  const itemYear = parseYearToken(opts.itemYear);
  const season = opts.season && opts.season > 1 ? opts.season : undefined;
  if (!itemYear || !season) return false;
  const ref = opts.referenceYear ?? new Date().getFullYear();
  return ref - Number(itemYear) + 1 < season;
}

export function assessTvYearFit(opts: {
  userYear: string;
  itemYear: string;
  season?: number;
}): TvYearFit {
  const userYear = parseYearToken(opts.userYear);
  const itemYear = parseYearToken(opts.itemYear);
  if (!userYear || !itemYear) {
    return { match: false, soft: false, veto: null };
  }

  const Y = Number(userYear);
  const I = Number(itemYear);

  if (I === Y) {
    return { match: true, soft: false, veto: null };
  }

  // 用户认定的年份早于该剧首播 → 不可能是目标
  if (I > Y) {
    return { match: false, soft: false, veto: 'veto:year-after' };
  }

  const season = opts.season && opts.season > 0 ? opts.season : undefined;
  // 粗估：一年一季；到用户年为止开播年数不足以覆盖 Sxx
  if (season && season > 1 && Y - I + 1 < season) {
    return { match: false, soft: false, veto: 'veto:season-span' };
  }

  // 年份偏晚（发行年/观影印象）但跨度说得通 → 保留并请确认
  return { match: false, soft: true, veto: null };
}
