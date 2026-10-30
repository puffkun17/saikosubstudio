/**
 * 文件名里的双语标记（list v3）：EN&CHS、CHS&EN、chs_eng、chs.eng、简英、繁體&英文 …
 *
 * 只认「一个中文标记 + 一个拉丁语标记」并且两者**相邻**（中间只隔 & + _ . - 空格），
 * 中文永远放在前面（简+En），与单文件双语的 SubtitleLanguagePair 一致。
 * 不认：简繁（同为中文）、中日 / 中韩（zh + ja/ko 是两文件任务，SubtitleLanguagePair 也不表示）、
 * 不相邻的两个标记（如 `Show.CHS.S01E01.eng` 更像是目录里的两条轨），裸 de / it / es（会撞片名）。
 */

export type FilenamePairPrimary = 'zh-CN' | 'zh-TW';
export type FilenamePairSecondary = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'it';
export interface FilenameLanguagePair {
  primary: FilenamePairPrimary;
  secondary: FilenamePairSecondary;
}

const ZH_CN_TOKENS = new Set(['chs', 'sc', 'gb', 'zhcn', 'zhhans', 'zhsg', 'chi', 'zho', 'zh', 'chn']);
const ZH_TW_TOKENS = new Set(['cht', 'tc', 'big5', 'zhtw', 'zhhant', 'zhhk']);
const SECONDARY_TOKENS: Record<string, FilenamePairSecondary> = {
  en: 'en', eng: 'en', english: 'en',
  spa: 'es', esp: 'es',
  fre: 'fr', fra: 'fr',
  por: 'pt',
  ger: 'de', deu: 'de',
  ita: 'it',
};

const CJK_PRIMARY = '(简体中文|簡體中文|简体|簡體|简中|簡中|简|簡|繁體中文|繁体中文|繁體|繁体|繁中|繁|中文|中)';
const CJK_SECONDARY = '(英文|英语|英語|英)';
const CJK_SEP = '[&＆+＋_.\\-\\s·・]*';
const CJK_ZH_FIRST = new RegExp(`${CJK_PRIMARY}${CJK_SEP}${CJK_SECONDARY}`);
const CJK_EN_FIRST = new RegExp(`${CJK_SECONDARY}${CJK_SEP}${CJK_PRIMARY}`);

const cjkPrimaryOf = (mark: string): FilenamePairPrimary => (/[繁]/.test(mark) ? 'zh-TW' : 'zh-CN');

type Tok = { lang: FilenamePairPrimary | FilenamePairSecondary | null };

const classify = (raw: string): Tok['lang'] => {
  const t = raw.toLowerCase();
  if (ZH_CN_TOKENS.has(t)) return 'zh-CN';
  if (ZH_TW_TOKENS.has(t)) return 'zh-TW';
  return SECONDARY_TOKENS[t] ?? null;
};

const isZh = (lang: Tok['lang']): lang is FilenamePairPrimary => lang === 'zh-CN' || lang === 'zh-TW';

/** 文件名 → 双语对；不是双语标记返回 null。只看文件名，不读正文。 */
export function detectLanguagePairByFilename(name: string): FilenameLanguagePair | null {
  const base = (name || '').split(/[\\/]/).pop() || '';
  const stem = base.replace(/\.[A-Za-z0-9]{2,4}$/, '');

  // 1) CJK 标记：简英 / 繁體&英文 / 英简（中英 = 简 + En，与既有「中英 → 双语」一致）
  const zhFirst = stem.match(CJK_ZH_FIRST);
  if (zhFirst) return { primary: cjkPrimaryOf(zhFirst[1]), secondary: 'en' };
  const enFirst = stem.match(CJK_EN_FIRST);
  if (enFirst) return { primary: cjkPrimaryOf(enFirst[2]), secondary: 'en' };

  // 2) 拉丁标记：把 zh-Hans / zh_CN 这类带连字符的代码先并成一个 token，再按分隔符切。
  const normalized = stem
    .replace(/zh[-_](hans|hant|cn|tw|hk|sg)\b/gi, (_m, region: string) => `zh${region.toLowerCase()}`);
  const parts = normalized.split(/[&＆+＋_.\-\s[\]()（）【】]+/).filter(Boolean);
  const langs = parts.map(classify);
  for (let i = 0; i < langs.length - 1; i += 1) {
    const a = langs[i];
    const b = langs[i + 1];
    if (!a || !b) continue;
    if (isZh(a) && !isZh(b)) return { primary: a, secondary: b };
    if (!isZh(a) && isZh(b)) return { primary: b, secondary: a };
  }
  return null;
}
