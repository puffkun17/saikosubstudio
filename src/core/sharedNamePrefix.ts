/**
 * 同组文件名的共同前缀折叠（DragZone list v2，B 可复用）。
 *
 * 规则：
 * - 至少 2 个名字，前缀至少 `minPrefix` 个字符才折叠。
 * - 前缀只在分隔符（. - _ 空格 / 括号）之后切，不切断一个词。
 * - 每个尾巴都必须保留「区分段 + 扩展名」：尾巴只剩扩展名（如 `srt`）时继续往回退。
 */

const DELIMS = new Set(['.', '-', '_', ' ', '/', '[', ']', '(', ')']);

export type SharedPrefixSplit = { prefix: string; tails: string[] };

export const DEFAULT_MIN_SHARED_PREFIX = 12;

const rawCommonPrefix = (names: string[]): string => {
  let prefix = names[0] ?? '';
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
};

/** 尾巴是否还带着可区分的主干（不是只剩扩展名、也不是空）。 */
const tailHasStem = (tail: string, name: string): boolean => {
  if (!tail) return false;
  const nameHasExt = name.lastIndexOf('.') > 0;
  if (!nameHasExt) return true; // 无扩展名：整段都是区分段
  return tail.lastIndexOf('.') > 0;
};

export const splitSharedPrefix = (
  names: string[],
  minPrefix: number = DEFAULT_MIN_SHARED_PREFIX,
): SharedPrefixSplit | null => {
  if (names.length < 2) return null;
  let end = rawCommonPrefix(names).length;
  while (end > 0) {
    // 退到最近的分隔符之后
    let cut = end;
    while (cut > 0 && !DELIMS.has(names[0][cut - 1])) cut -= 1;
    if (cut === 0) return null;
    const prefix = names[0].slice(0, cut);
    const tails = names.map((name) => name.slice(cut));
    if (tails.every((tail, i) => tailHasStem(tail, names[i]))) {
      return prefix.length >= minPrefix ? { prefix, tails } : null;
    }
    end = cut - 1;
  }
  return null;
};

/**
 * 中间截断时必须保留的尾部字符数：至少保住扩展名和它前面的一段区分字。
 * 例如 `…FLUX.EN&CHS.srt` 保留 `EN&CHS.srt`。
 */
export const distinguishingTailLength = (name: string, minChars = 10): number => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return Math.min(name.length, minChars);
  // 扩展名前一段（到上一个分隔符为止）
  let start = dot - 1;
  while (start > 0 && !DELIMS.has(name[start - 1])) start -= 1;
  return Math.min(name.length, Math.max(minChars, name.length - start));
};
