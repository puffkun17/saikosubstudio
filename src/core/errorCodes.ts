/**
 * User-facing error codes (E-xx). Shown in error messages and offered (opt-in) on the feedback
 * page, so a report can say "E-03" without sending any subtitle text. Never renumber.
 */
export const ERROR_CODES = {
  'E-01': '导入超出本机安全限制',
  'E-02': '压缩包无法在浏览器里解开',
  'E-03': '合并失败',
  'E-04': '导出失败',
  'E-05': '影片资料获取失败',
  'E-06': '本机历史保存失败',
  'E-07': '文件编码或格式无法识别',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const withErrorCode = (code: ErrorCode, message: string) => `[${code}] ${message}`;

const CODE_RE = /\[(E-\d{2})\]/;
export const errorCodeOf = (message: string): ErrorCode | null => {
  const m = CODE_RE.exec(message);
  return m && m[1] in ERROR_CODES ? (m[1] as ErrorCode) : null;
};

export const LAST_ERROR_KEY = 'saiko_last_error_code';

export function rememberErrorCode(message: string, storage: Pick<Storage, 'setItem'> | null = typeof sessionStorage === 'undefined' ? null : sessionStorage): ErrorCode | null {
  const code = errorCodeOf(message);
  if (code && storage) {
    try { storage.setItem(LAST_ERROR_KEY, code); } catch { /* ignore */ }
  }
  return code;
}

const RULES: [ErrorCode, RegExp][] = [
  ['E-03', /合并失败/],
  ['E-04', /导出失败/],
  ['E-06', /历史|存档/],
  ['E-02', /字幕包|压缩包|分卷|解压/],
  ['E-01', /安全限制|超出|过多/],
  ['E-05', /影片|匹配|搜索|未找到/],
  ['E-07', /编码|格式/],
];

/** Attach an E-xx code to an error message that has none (keyword rules above). */
export function codeErrorMessage(message: string): string {
  if (errorCodeOf(message)) return message;
  const hit = RULES.find(([, re]) => re.test(message));
  return hit ? withErrorCode(hit[0], message) : message;
}
