'use client';

import React from 'react';

export type FileFormat = 'srt' | 'ass' | 'zip' | 'rar' | '7z' | 'folder' | 'unknown';

type Size = 'sm' | 'md' | 'lg';

/** Adobe-like glyphs need a bit of size so the 3-letter code stays crisp. */
const SIZE_PX: Record<Size, number> = { sm: 24, md: 30, lg: 36 };

const TIPS: Record<FileFormat, string> = {
  srt: 'SRT 字幕',
  ass: 'ASS 字幕',
  zip: 'ZIP 压缩包',
  rar: 'RAR 压缩包',
  '7z': '7Z 压缩包',
  folder: '文件夹',
  unknown: '文件',
};

/**
 * Adobe Creative Cloud file-badge language:
 * one flat sheet · darker dog-ear · huge uppercase code · no decoration.
 */
type AdobePalette = {
  face: string;
  fold: string;
  ink: string;
};

const ADOBE: Record<FileFormat, AdobePalette> = {
  // Teal — plain dialogue track
  srt: { face: '#0D9488', fold: '#0F766E', ink: '#FFFFFF' },
  // Violet — styled / ASS track (Adobe-adjacent purple)
  ass: { face: '#7C3AED', fold: '#6D28D9', ink: '#FFFFFF' },
  // Warm tungsten zip
  zip: { face: '#D97706', fold: '#B45309', ink: '#FFFFFF' },
  // Rose archive
  rar: { face: '#E11D48', fold: '#BE123C', ink: '#FFFFFF' },
  // Cool slate archive
  '7z': { face: '#6366F1', fold: '#4F46E5', ink: '#FFFFFF' },
  folder: { face: '#CA8A04', fold: '#A16207', ink: '#FFFFFF' },
  unknown: { face: '#78716C', fold: '#57534E', ink: '#FFFFFF' },
};

const CODE: Record<FileFormat, string> = {
  srt: 'SRT',
  ass: 'ASS',
  zip: 'ZIP',
  rar: 'RAR',
  '7z': '7Z',
  folder: 'DIR',
  unknown: 'FILE',
};

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

/** Classic Adobe document silhouette: rounded rect + top-right dog-ear. */
const AdobeFileGlyph: React.FC<{ format: FileFormat }> = ({ format }) => {
  const { face, fold, ink } = ADOBE[format];
  const code = CODE[format];
  const isFolder = format === 'folder';
  // 3-letter codes sit larger; 7Z / DIR slightly adjusted
  const fontSize = code.length <= 2 ? 15 : code.length === 3 ? 13.5 : 11;

  if (isFolder) {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-full w-full">
        <path
          d="M6 16c0-2.2 1.8-4 4-4h8.2c1.1 0 2.1.4 2.8 1.2l1.6 1.8c.7.8 1.7 1.2 2.8 1.2H38c2.2 0 4 1.8 4 4v18c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V16Z"
          fill={face}
        />
        <path d="M6 20h36v2.5H6V20Z" fill={fold} opacity="0.55" />
        <text
          x="24"
          y="34"
          textAnchor="middle"
          fill={ink}
          fontSize="11"
          fontWeight="800"
          fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
          letterSpacing="0.04em"
        >
          DIR
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-full w-full">
      {/* Face */}
      <path
        d="M8 4h22l10 10v26c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4Z"
        fill={face}
      />
      {/* Dog-ear */}
      <path d="M30 4v8c0 1.1.9 2 2 2h8L30 4Z" fill={fold} />
      {/* Soft inner highlight — Adobe sheets often have a hairline edge */}
      <path
        d="M8.6 5.2h20.6L38.8 15v24.4c0 1.4-1.1 2.6-2.5 2.6H8.6c-1.4 0-2.5-1.2-2.5-2.6V7.7c0-1.4 1.1-2.5 2.5-2.5Z"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.75"
        fill="none"
      />
      {/* Extension code — the whole point of the glyph */}
      <text
        x="22"
        y="30"
        textAnchor="middle"
        fill={ink}
        fontSize={fontSize}
        fontWeight="800"
        fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
        letterSpacing="0.06em"
      >
        {code}
      </text>
    </svg>
  );
};

interface FileFormatIconProps {
  format?: FileFormat;
  /** Filename or extension used when `format` is omitted. */
  name?: string;
  size?: Size;
  className?: string;
  showLabel?: boolean;
}

/**
 * Adobe-style format badges: flat color sheet, dog-ear, bold uppercase code.
 */
export const FileFormatIcon: React.FC<FileFormatIconProps> = ({
  format,
  name,
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  const resolved = format || resolveFileFormat(name);
  const tip = TIPS[resolved];
  const px = SIZE_PX[size];
  const label = CODE[resolved];

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${className}`} title={tip}>
      <span style={{ width: px, height: px }} className="inline-block drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
        <AdobeFileGlyph format={resolved} />
      </span>
      {showLabel && (
        <span className="font-mono text-xs font-semibold tracking-wide text-[var(--v4-text-muted)]">
          {label}
        </span>
      )}
      <span className="sr-only">{tip}</span>
    </span>
  );
};

/** Map free-form labels / codes to a stable language key. */
const resolveLangKey = (lang?: string, label?: string): string => {
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
  if (lower === 'latin') return 'latin';
  if (lower === 'bilingual') return 'bilingual';
  if (lower === 'commentary') return 'commentary';
  return raw;
};

type LangVisual = {
  label: string;
  face: string;
  ink: string;
  chipBorder: string;
  chipBg: string;
  chipText: string;
  mark: string;
};

/**
 * Language colors avoid file-icon hues
 * (SRT teal / ASS violet / ZIP amber / RAR rose / 7Z indigo).
 */
const LANG_VISUAL: Record<string, LangVisual> = {
  'zh-CN': {
    label: '简中',
    face: '#E8C547',
    ink: '#1A1608',
    chipBorder: 'rgba(232,197,71,0.4)',
    chipBg: 'rgba(232,197,71,0.12)',
    chipText: '#E8D080',
    mark: '简',
  },
  'zh-TW': {
    label: '繁中',
    face: '#3D9E5F',
    ink: '#F2FFF6',
    chipBorder: 'rgba(61,158,95,0.42)',
    chipBg: 'rgba(61,158,95,0.12)',
    chipText: '#A8D8B8',
    mark: '繁',
  },
  zh: {
    label: '中文',
    face: '#C9A227',
    ink: '#1A1608',
    chipBorder: 'rgba(201,162,39,0.4)',
    chipBg: 'rgba(201,162,39,0.12)',
    chipText: '#D8C070',
    mark: '中',
  },
  en: {
    label: '英语',
    face: '#6D6A63',
    ink: '#F3EBE2',
    chipBorder: 'rgba(109,106,99,0.45)',
    chipBg: 'rgba(109,106,99,0.14)',
    chipText: '#C8C0B4',
    mark: 'En',
  },
  ja: {
    label: '日语',
    face: '#C45A8A',
    ink: '#FFF7FA',
    chipBorder: 'rgba(196,90,138,0.42)',
    chipBg: 'rgba(196,90,138,0.12)',
    chipText: '#E8B0C8',
    mark: 'あ',
  },
  ko: {
    label: '韩语',
    face: '#8B6B4A',
    ink: '#FFF8F2',
    chipBorder: 'rgba(139,107,74,0.42)',
    chipBg: 'rgba(139,107,74,0.12)',
    chipText: '#D0B898',
    mark: '한',
  },
  fr: {
    label: '法语',
    face: '#5F7A6A',
    ink: '#F5FAF7',
    chipBorder: 'rgba(95,122,106,0.42)',
    chipBg: 'rgba(95,122,106,0.12)',
    chipText: '#B0C8B8',
    mark: 'Fr',
  },
  es: {
    label: '西语',
    face: '#9B5A6F',
    ink: '#FFF5F8',
    chipBorder: 'rgba(155,90,111,0.42)',
    chipBg: 'rgba(155,90,111,0.12)',
    chipText: '#D8B0C0',
    mark: 'Ñ',
  },
  latin: {
    label: '拉丁',
    face: '#7A756C',
    ink: '#F3EBE2',
    chipBorder: 'rgba(122,117,108,0.42)',
    chipBg: 'rgba(122,117,108,0.12)',
    chipText: '#C0B8AC',
    mark: 'L',
  },
  bilingual: {
    label: '双语',
    face: '#3A342E',
    ink: '#E8C547',
    chipBorder: 'rgba(232,197,71,0.35)',
    chipBg: 'rgba(232,197,71,0.1)',
    chipText: '#E8D080',
    mark: '双',
  },
  commentary: {
    label: '导评',
    face: '#5C5650',
    ink: '#F3EBE2',
    chipBorder: 'rgba(92,86,80,0.42)',
    chipBg: 'rgba(92,86,80,0.12)',
    chipText: '#B8B0A4',
    mark: '评',
  },
  unknown: {
    label: '待识别',
    face: '#4A4540',
    ink: '#E8DED4',
    chipBorder: 'rgba(74,69,64,0.42)',
    chipBg: 'rgba(74,69,64,0.12)',
    chipText: '#A89B8C',
    mark: '?',
  },
};

/** Fixed 32×32 tile — larger glyph, tighter padding, footprint unchanged. */
const LangTile: React.FC<{ visual: LangVisual }> = ({ visual }) => {
  const { face, ink, mark } = visual;
  const isWide = mark.length > 1;

  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md"
      aria-hidden="true"
      style={{ background: face }}
    >
      <span
        className={`font-mono font-bold leading-none tracking-normal ${isWide ? 'text-[14px]' : 'text-[16px]'}`}
        style={{ color: ink }}
      >
        {mark}
      </span>
    </span>
  );
};

/** Language mark: unique color + glyph per language. */
export const LanguageMark: React.FC<{
  lang?: string;
  label?: string;
  languagePair?: { primary: string; secondary: string };
  className?: string;
}> = ({ lang, label, languagePair, className = '' }) => {
  if (languagePair) {
    const primaryKey = resolveLangKey(languagePair.primary);
    const secondaryKey = resolveLangKey(languagePair.secondary);
    const primary = LANG_VISUAL[primaryKey] || LANG_VISUAL.unknown;
    const secondary = LANG_VISUAL[secondaryKey] || LANG_VISUAL.unknown;
    return (
      <span
        className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[color:rgba(232,197,71,0.32)] bg-[rgba(232,197,71,0.1)] pl-0.5 pr-2 ${className}`}
        title={`${primary.label} / ${secondary.label}`}
      >
        <span className="relative inline-flex items-center">
          <LangTile visual={primary} />
          <span className="-ml-1.5">
            <LangTile visual={secondary} />
          </span>
        </span>
        <span className="font-mono text-[13px] font-semibold leading-none tracking-normal text-[#E8D080]">
          双语
        </span>
      </span>
    );
  }

  if (!lang && !label) return null;

  const key = resolveLangKey(lang, label);
  const visual = LANG_VISUAL[key] || {
    ...LANG_VISUAL.unknown,
    label: label || lang || '未知',
    mark: (label || lang || '?').slice(0, 1),
  };

  return (
    <span
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border pl-0.5 pr-2 ${className}`}
      style={{
        borderColor: visual.chipBorder,
        background: visual.chipBg,
        color: visual.chipText,
      }}
      title={visual.label}
    >
      <LangTile visual={visual} />
      <span className="font-mono text-[13px] font-semibold leading-none tracking-normal">
        {visual.label}
      </span>
    </span>
  );
};
