'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Act 1 文件图标与语言牌（A1，2026-10-30）。
 *
 * 只用纸 / 墨 / 酒红三类 token（DESIGN.md §3）；`--fmt-*`、`--lang-*` 身份色 token 保留不动，但图标不再引用。
 * 为 B（常驻舞台）准备：
 * - 纸片本体是**不透明**的 `--paper-raised`，叠放时下层不透出；描边按像素固定（non-scaling-stroke）。
 * - 尺寸档位按用途命名：账本行 20 / 列表 28 / 32 / 舞台 token 40。
 * - `tone` 只表达选中（酒红）与弱化（faint），不表达格式或语言。
 * - 纯 SVG 的 `FileFormatGlyph` 和 `LanguageTile` 单独导出，B 可以直接放进自己的 motion 层。
 */

export type FileFormat = 'srt' | 'ass' | 'zip' | 'rar' | '7z' | 'folder' | 'unknown';
export type FileGlyphKind = 'document' | 'archive' | 'folder';
export type IconTone = 'default' | 'accent' | 'faint';
export type FileIconSize = 'sm' | 'md' | 'lg' | 'xl';

/** sm = 账本行，md = 列表 / 选择器，lg = 面板，xl = 舞台 token。 */
export const FILE_ICON_PX: Record<FileIconSize, number> = { sm: 20, md: 28, lg: 32, xl: 40 };

/** 屏幕像素描边：小尺寸略细，舞台略粗，保证在 1x / 2x 屏上都落在整像素附近。 */
const STROKE_PX: Record<FileIconSize, number> = { sm: 1.25, md: 1.5, lg: 1.5, xl: 1.75 };

const TIPS: Record<FileFormat, string> = {
  srt: 'SRT 字幕',
  ass: 'ASS 字幕',
  zip: 'ZIP 压缩包',
  rar: 'RAR 压缩包',
  '7z': '7z 压缩包',
  folder: '文件夹',
  unknown: '文件',
};

/** 印在纸片上的格式字。`7z` 是 7-Zip 的正式写法，保持小写完整两字。 */
const CODE: Record<FileFormat, string> = {
  srt: 'SRT',
  ass: 'ASS',
  zip: 'ZIP',
  rar: 'RAR',
  '7z': '7z',
  folder: '',
  unknown: '',
};

const KIND: Record<FileFormat, FileGlyphKind> = {
  srt: 'document',
  ass: 'document',
  unknown: 'document',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  folder: 'folder',
};

export const fileFormatCode = (format: FileFormat): string => CODE[format];
export const fileFormatLabel = (format: FileFormat): string => TIPS[format];
export const fileGlyphKind = (format: FileFormat): FileGlyphKind => KIND[format];

/** Resolve format from filename or explicit extension. */
export const resolveFileFormat = (nameOrExt?: string | null): FileFormat => {
  if (!nameOrExt) return 'unknown';
  const raw = nameOrExt.trim().toLowerCase();
  const ext = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw.replace(/^\./, '');
  if (/\.part\d+\.rar$/i.test(nameOrExt) || /\.r\d{2}$/i.test(nameOrExt)) return 'rar';
  if (/\.7z\.\d+$/i.test(nameOrExt)) return '7z';
  if (ext === 'srt') return 'srt';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  if (ext === 'zip') return 'zip';
  if (ext === 'rar') return 'rar';
  if (ext === '7z') return '7z';
  return 'unknown';
};

type ToneColors = { line: string; ink: string; body: string; detail: string };

const TONE: Record<IconTone, ToneColors> = {
  default: {
    line: 'var(--ink-muted)',
    ink: 'var(--ink-strong)',
    body: 'var(--paper-raised)',
    detail: 'var(--ink-faint)',
  },
  accent: {
    line: 'var(--accent)',
    ink: 'var(--accent-text)',
    // 不透明的酒红淡底：叠放时不透出下层纸片
    body: 'color-mix(in srgb, var(--accent) 8%, var(--paper-raised))',
    detail: 'var(--accent-line)',
  },
  faint: {
    line: 'var(--ink-faint)',
    ink: 'var(--ink-muted)',
    body: 'var(--paper-raised)',
    detail: 'var(--rule-strong)',
  },
};

const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--pt-font-mono)',
  fontWeight: 600,
  fontVariantLigatures: 'none',
};

interface FileFormatGlyphProps {
  format: FileFormat;
  size?: FileIconSize;
  tone?: IconTone;
  /** 是否把格式字印在纸片上。sm（20 px）默认不印，字放到图标旁边。 */
  withCode?: boolean;
}

/**
 * 纯 SVG 图标，24 单位网格。list v2：每种格式靠**轮廓**区分（20–28 px 不认字也能分）：
 * - SRT / 未知：竖向纸片 + 右上**镂空折角**。
 * - ASS：竖向纸片，右上角是**实心墨色样式角**（“带样式的字幕”），没有折角。
 * - 压缩包（zip/rar/7z）：**横向盒子**，盒盖比盒身宽一圈 + 中间提签；B 里可以做“开盖”。
 * - 文件夹：横向标签夹，无字。
 */
export const FileFormatGlyph: React.FC<FileFormatGlyphProps> = ({
  format,
  size = 'md',
  tone = 'default',
  withCode = size !== 'sm',
}) => {
  const c = TONE[tone];
  const kind = KIND[format];
  const code = CODE[format];
  const sw = STROKE_PX[size];
  const stroke = {
    stroke: c.line,
    strokeWidth: sw,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-full w-full">
        <path
          d="M2.75 6.5c0-.83.67-1.5 1.5-1.5h4.6c.4 0 .78.16 1.06.44L11.5 7h8.25c.83 0 1.5.67 1.5 1.5v9.75c0 .83-.67 1.5-1.5 1.5H4.25c-.83 0-1.5-.67-1.5-1.5V6.5Z"
          fill={c.body}
          {...stroke}
        />
        <path d="M2.75 9.75h18.5" {...stroke} stroke={c.detail} />
      </svg>
    );
  }

  const codeSize = code.length <= 2 ? 7.4 : 6.4;

  if (kind === 'archive') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-full w-full" data-glyph="archive">
        {/* 盒身（横向） */}
        <rect x="3.25" y="8" width="17.5" height="12.75" rx="1.25" fill={c.body} {...stroke} />
        {/* 盒盖：比盒身宽，轮廓上多出两个肩 */}
        <rect x="1.75" y="4.5" width="20.5" height="4" rx="1" fill={c.body} {...stroke} />
        {/* 提签 */}
        <path d="M10 8.5v2.25c0 .41.34.75.75.75h2.5c.41 0 .75-.34.75-.75V8.5" {...stroke} stroke={c.detail} />
        {withCode && code && (
          <text x="12" y="18.4" textAnchor="middle" fontSize={code.length <= 2 ? 6.6 : 5.8} fill={c.ink} style={MONO_STYLE}>
            {code}
          </text>
        )}
      </svg>
    );
  }

  if (format === 'ass') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-full w-full" data-glyph="document-styled">
        <rect x="4.25" y="2.75" width="14.5" height="18.5" rx="1.5" fill={c.body} {...stroke} />
        {/* 实心样式角：与 SRT 的镂空折角在同一位置，明暗相反 */}
        <path d="M11.25 2.75h6c.83 0 1.5.67 1.5 1.5v6Z" fill={c.line} stroke={c.line} strokeWidth={sw} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {withCode && code && (
          <text x="11.5" y="17.6" textAnchor="middle" fontSize={codeSize} fill={c.ink} style={MONO_STYLE}>
            {code}
          </text>
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-full w-full" data-glyph="document">
      <path
        d="M5.75 2.75h8.5l4.5 4.5v12.5c0 .83-.67 1.5-1.5 1.5h-11.5c-.83 0-1.5-.67-1.5-1.5V4.25c0-.83.67-1.5 1.5-1.5Z"
        fill={c.body}
        {...stroke}
      />
      <path d="M14.25 2.75v3c0 .83.67 1.5 1.5 1.5h3" {...stroke} />
      {withCode && code ? (
        <text x="11.5" y="17.6" textAnchor="middle" fontSize={codeSize} fill={c.ink} style={MONO_STYLE}>
          {code}
        </text>
      ) : (
        // 未知格式：两道发丝线代表“有内容的纸”，不编造格式字
        <path d="M7.75 13h7.5M7.75 16.25h5" {...stroke} stroke={c.detail} />
      )}
    </svg>
  );
};

interface FileFormatIconProps {
  format?: FileFormat;
  /** Filename or extension used when `format` is omitted. */
  name?: string;
  size?: FileIconSize;
  tone?: IconTone;
  className?: string;
  /** 在图标旁边显示格式字。sm 档默认显示（因为 20 px 纸片上不印字）。 */
  showLabel?: boolean;
}

export const FileFormatIcon: React.FC<FileFormatIconProps> = ({
  format,
  name,
  size = 'md',
  tone = 'default',
  className = '',
  showLabel,
}) => {
  const resolved = format || resolveFileFormat(name);
  const tip = TIPS[resolved];
  const px = FILE_ICON_PX[size];
  const code = CODE[resolved];
  const labelVisible = (showLabel ?? size === 'sm') && code !== '';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 ${className}`}
      title={tip}
      data-file-format={resolved}
    >
      <span style={{ width: px, height: px }} className="inline-block">
        <FileFormatGlyph format={resolved} size={size} tone={tone} />
      </span>
      {labelVisible && (
        <span
          aria-hidden="true"
          className="text-[11px] leading-none"
          style={{ ...MONO_STYLE, color: tone === 'accent' ? 'var(--accent-text)' : 'var(--ink-muted)' }}
        >
          {code}
        </span>
      )}
      <span className="sr-only">{tip}</span>
    </span>
  );
};

/** Map free-form labels / codes to a stable language key. */
export const resolveLangKey = (lang?: string, label?: string): string => {
  const raw = (lang || label || '').trim();
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  const byLabel: Record<string, string> = {
    简中: 'zh-CN',
    简体: 'zh-CN',
    繁中: 'zh-TW',
    繁体: 'zh-TW',
    中文: 'zh',
    英语: 'en',
    英文: 'en',
    日语: 'ja',
    日文: 'ja',
    韩语: 'ko',
    韩文: 'ko',
    法语: 'fr',
    西语: 'es',
    西班牙语: 'es',
    葡语: 'pt',
    葡萄牙语: 'pt',
    德语: 'de',
    意语: 'it',
    意大利语: 'it',
    拉丁: 'latin',
    拉丁文字: 'latin',
    双语: 'bilingual',
    导评: 'commentary',
    旁白: 'commentary',
    语言待识别: 'unknown',
  };
  if (byLabel[raw]) return byLabel[raw];
  if (lower === 'zh-cn' || lower === 'zh_cn' || lower === 'chs' || lower === 'sc') return 'zh-CN';
  if (lower === 'zh-tw' || lower === 'zh_tw' || lower === 'cht' || lower === 'tc') return 'zh-TW';
  if (lower === 'zh' || lower === 'chinese') return 'zh';
  if (lower === 'en' || lower === 'eng' || lower === 'english') return 'en';
  if (lower === 'ja' || lower === 'jp' || lower === 'jpn' || lower === 'japanese') return 'ja';
  if (lower === 'ko' || lower === 'kr' || lower === 'kor' || lower === 'korean') return 'ko';
  if (lower === 'fr' || lower === 'fra' || lower === 'french') return 'fr';
  if (lower === 'es' || lower === 'spa' || lower === 'spanish') return 'es';
  if (lower === 'pt' || lower === 'por' || lower === 'portuguese') return 'pt';
  if (lower === 'de' || lower === 'ger' || lower === 'deu' || lower === 'german') return 'de';
  if (lower === 'it' || lower === 'ita' || lower === 'italian') return 'it';
  if (lower === 'latin') return 'latin';
  if (lower === 'bilingual') return 'bilingual';
  if (lower === 'commentary') return 'commentary';
  return raw;
};

export type LangVisual = { key: string; label: string; mark: string };

const LANG_VISUAL: Record<string, Omit<LangVisual, 'key'>> = {
  'zh-CN': { label: '简中', mark: '简' },
  'zh-TW': { label: '繁中', mark: '繁' },
  zh: { label: '中文', mark: '中' },
  en: { label: '英语', mark: 'En' },
  ja: { label: '日语', mark: 'あ' },
  ko: { label: '韩语', mark: '한' },
  fr: { label: '法语', mark: 'Fr' },
  es: { label: '西语', mark: 'Es' },
  pt: { label: '葡语', mark: 'Pt' },
  de: { label: '德语', mark: 'De' },
  it: { label: '意语', mark: 'It' },
  latin: { label: '拉丁', mark: 'La' },
  bilingual: { label: '双语', mark: '双' },
  commentary: { label: '导评', mark: '评' },
  unknown: { label: '待识别', mark: '?' },
};

/** 语言 → 牌面字与中文名。未知值回落到首字，不编造语言。 */
export const languageVisual = (lang?: string, label?: string): LangVisual => {
  const key = resolveLangKey(lang, label);
  const known = LANG_VISUAL[key];
  if (known) return { key, ...known };
  const fallback = label || lang || '未知';
  return { key, label: fallback, mark: fallback.slice(0, 1) || '?' };
};

export type LangMarkSize = 'sm' | 'md' | 'lg';
/** sm = 账本行 / 舞台 token 角标，md = 列表，lg = 面板。 */
export const LANG_TILE_PX: Record<LangMarkSize, number> = { sm: 18, md: 22, lg: 26 };
const LANG_FONT_PX: Record<LangMarkSize, { cjk: number; latin: number }> = {
  sm: { cjk: 11, latin: 10 },
  md: { cjk: 13, latin: 11.5 },
  lg: { cjk: 15, latin: 13 },
};

const isLatinMark = (mark: string) => /^[\x20-\x7e]+$/.test(mark);

/**
 * 纯文字语言牌：圆角 4、1 px 控件边、不透明纸底、墨字，不填色块。
 * 待识别（list v2）：实心淡墨底、无控件边、淡墨问号 —— 比已确认的语言更安静（以前的虚线边反而更抢眼）。
 */
export const LanguageTile: React.FC<{
  visual: LangVisual;
  size?: LangMarkSize;
  tone?: IconTone;
  className?: string;
}> = ({ visual, size = 'md', tone = 'default', className = '' }) => {
  const reduce = useReducedMotion();
  const px = LANG_TILE_PX[size];
  const latin = isLatinMark(visual.mark);
  const pending = visual.key === 'unknown';
  const fontPx = latin ? LANG_FONT_PX[size].latin : LANG_FONT_PX[size].cjk;
  const pendingFill = 'color-mix(in srgb, var(--ink-faint) 16%, var(--paper-raised))';
  const borderColor = pending
    ? pendingFill
    : tone === 'accent' ? 'var(--accent)' : tone === 'faint' ? 'var(--rule-strong)' : 'var(--rule-control)';
  const color = pending
    ? 'var(--ink-faint)'
    : tone === 'accent' ? 'var(--accent-text)' : tone === 'faint' ? 'var(--ink-muted)' : 'var(--ink-strong)';
  const background = pending
    ? pendingFill
    : tone === 'accent' ? 'color-mix(in srgb, var(--accent) 8%, var(--paper-raised))' : 'var(--paper-raised)';

  return (
    <span
      aria-hidden="true"
      data-lang-key={visual.key}
      data-lang-pending={pending || undefined}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--pt-radius-sm)] border leading-none ${className}`}
      style={{
        height: px,
        minWidth: px,
        paddingInline: latin && visual.mark.length > 1 ? 3 : 0,
        borderColor,
        borderStyle: 'solid',
        background,
        color,
      }}
    >
      {/* 牌面变化（如 待识别 → 简中）时只做 150 ms 透明度交替，不翻转、不位移 */}
      <motion.span
        key={visual.mark}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        style={{
          fontSize: fontPx,
          fontWeight: 600,
          fontFamily: latin ? 'var(--pt-font-mono)' : 'var(--pt-font-ui)',
        }}
      >
        {visual.mark}
      </motion.span>
    </span>
  );
};

/** Language mark: 文字牌 + 可选中文名。双语 = 两块牌并成一块（共用中缝）。 */
export const LanguageMark: React.FC<{
  lang?: string;
  label?: string;
  languagePair?: { primary: string; secondary: string };
  size?: LangMarkSize;
  tone?: IconTone;
  /** 是否在牌后显示中文名（默认显示，保持现有列表的可读性）。 */
  showLabel?: boolean;
  className?: string;
}> = ({ lang, label, languagePair, size = 'md', tone = 'default', showLabel = true, className = '' }) => {
  const labelClass = `leading-none ${size === 'lg' ? 'text-[13px]' : 'text-xs'}`;
  const labelColor = tone === 'accent' ? 'var(--accent-text)' : 'var(--ink-muted)';

  if (languagePair) {
    const primary = languageVisual(languagePair.primary);
    const secondary = languageVisual(languagePair.secondary);
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 ${className}`}
        title={`${primary.label} / ${secondary.label}`}
        data-lang-pair={`${primary.key}+${secondary.key}`}
      >
        <span className="inline-flex items-center">
          <LanguageTile visual={primary} size={size} tone={tone} className="rounded-r-none" />
          <LanguageTile visual={secondary} size={size} tone={tone} className="-ml-px rounded-l-none" />
        </span>
        {showLabel && (
          <span className={labelClass} style={{ color: labelColor }}>
            双语
          </span>
        )}
        <span className="sr-only">{`双语：${primary.label} / ${secondary.label}`}</span>
      </span>
    );
  }

  if (!lang && !label) return null;
  const visual = languageVisual(lang, label);

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${className}`} title={visual.label}>
      <LanguageTile visual={visual} size={size} tone={tone} />
      {showLabel ? (
        <span className={labelClass} style={{ color: labelColor }}>
          {visual.label}
        </span>
      ) : (
        <span className="sr-only">{visual.label}</span>
      )}
    </span>
  );
};
