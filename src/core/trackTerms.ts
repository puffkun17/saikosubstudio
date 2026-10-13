/** 统一的轨道术语：主字幕 / 副字幕 · <语言>（不再使用「原文」「次轨」「次语言」）。 */
export const LANG_LABEL: Record<string, string> = {
  'zh-CN': '简中', 'zh-TW': '繁中', en: '英语', ja: '日语', ko: '韩语', es: '西语', fr: '法语',
  pt: '葡语', de: '德语', it: '意语', latin: '拉丁文字',
};
export const PRIMARY_TERM = '主字幕';
export const SECONDARY_TERM = '副字幕';
export const secondaryTermFor = (lang?: string | null): string => {
  const name = lang ? LANG_LABEL[lang] : undefined;
  return name ? `${SECONDARY_TERM} · ${name}` : SECONDARY_TERM;
};
