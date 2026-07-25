'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

export type FileFormat = 'srt' | 'ass' | 'zip' | 'rar' | '7z' | 'folder' | 'unknown';

type Size = 'sm' | 'md' | 'lg' | 'xl';

/** Adobe-like glyphs need a bit of size so the 3-letter code stays crisp. */
const SIZE_PX: Record<Size, number> = { sm: 24, md: 30, lg: 36, xl: 44 };

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

/**
 * Ridgeline 调和版：在原 Adobe 高饱和色上整体降饱和、偏暖，
 * 让徽章融进 奶油/墨绿/柑橘 三色体系而不是像贴纸浮在纸面上。
 */
const ADOBE: Record<FileFormat, AdobePalette> = {
  // Forest-teal — plain dialogue track（呼应墨绿主色）
  srt: { face: '#3D8B7A', fold: '#2F7060', ink: '#FFFFFF' },
  // Muted plum — styled / ASS track
  ass: { face: '#8A6FC0', fold: '#7157A6', ink: '#FFFFFF' },
  // Citrus-adjacent zip（呼应柑橘强调色）
  zip: { face: '#C07A42', fold: '#A46332', ink: '#FFFFFF' }, // 低于 accent #ef8d5f，避免抢 CTA
  // Soft brick archive
  rar: { face: '#C9646B', fold: '#AC4E56', ink: '#FFFFFF' },
  // Dusty indigo archive
  '7z': { face: '#7A80B8', fold: '#62689E', ink: '#FFFFFF' },
  folder: { face: '#B8934A', fold: '#9A7838', ink: '#FFFFFF' },
  unknown: { face: '#857D72', fold: '#6B655B', ink: '#FFFFFF' },
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

/** 三类剪影：文档（折角纸）· 压缩包（带盖箱体 + 卡扣）· 文件夹（标签页）。 */
const GLYPH_KIND: Record<FileFormat, 'document' | 'archive' | 'folder'> = {
  srt: 'document',
  ass: 'document',
  unknown: 'document',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  folder: 'folder',
};

const GLYPH_FONT = 'ui-sans-serif, system-ui, "Segoe UI", sans-serif';

const AdobeFileGlyph: React.FC<{ format: FileFormat }> = ({ format }) => {
  const { face, fold, ink } = ADOBE[format];
  const code = CODE[format];
  const kind = GLYPH_KIND[format];

  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-full w-full">
        {/* 后板 + 标签页 */}
        <path
          d="M5 14c0-2.2 1.8-4 4-4h9.4c1.1 0 2.1.4 2.8 1.2l1.8 2c.7.8 1.7 1.2 2.8 1.2H39c2.2 0 4 1.8 4 4v3H5v-7.4Z"
          fill={fold}
        />
        {/* 前板：微梯形，像真实吊挂文件夹的前袋 */}
        <path
          d="M6.6 20.5h34.8c1.6 0 2.8 1.5 2.5 3.1l-2.3 12.9c-.3 1.9-2 3.3-3.9 3.3H10.3c-1.9 0-3.6-1.4-3.9-3.3L4.1 23.6c-.3-1.6.9-3.1 2.5-3.1Z"
          fill={face}
        />
        <path
          d="M7.2 21.6h33.6c1 0 1.7.9 1.5 1.9l-2.2 12.5c-.2 1.3-1.4 2.3-2.7 2.3H10.6c-1.3 0-2.5-1-2.7-2.3L5.7 23.5c-.2-1 .5-1.9 1.5-1.9Z"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.75"
          fill="none"
        />
        <text
          x="24"
          y="33.5"
          textAnchor="middle"
          fill={ink}
          fontSize="10.5"
          fontWeight="800"
          fontFamily={GLYPH_FONT}
          letterSpacing="0.05em"
        >
          DIR
        </text>
      </svg>
    );
  }

  if (kind === 'archive') {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-full w-full">
        {/* 箱体 */}
        <path
          d="M7 15h34v25c0 2.2-1.8 4-4 4H11c-2.2 0-4-1.8-4-4V15Z"
          fill={face}
        />
        {/* 箱盖：比箱体略宽，压出「盖住」的层次 */}
        <rect x="4.5" y="6.5" width="39" height="10.5" rx="2.5" fill={fold} />
        {/* 卡扣搭在盖与箱的接缝上 */}
        <rect x="20" y="13" width="8" height="8.5" rx="1.75" fill={fold} />
        <rect x="22.4" y="15.4" width="3.2" height="3.7" rx="0.9" fill={ink} opacity="0.9" />
        {/* 内侧描边 */}
        <path
          d="M8.1 18.2h31.8v21.4c0 1.5-1.2 2.7-2.7 2.7H10.8c-1.5 0-2.7-1.2-2.7-2.7V18.2Z"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="0.75"
          fill="none"
        />
        <text
          x="24"
          y="36.5"
          textAnchor="middle"
          fill={ink}
          fontSize={code.length <= 2 ? 13.5 : 12}
          fontWeight="800"
          fontFamily={GLYPH_FONT}
          letterSpacing="0.06em"
        >
          {code}
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
        fontSize={code.length <= 2 ? 15 : code.length === 3 ? 13.5 : 11}
        fontWeight="800"
        fontFamily={GLYPH_FONT}
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
      <span style={{ width: px, height: px }} className="inline-block drop-shadow-[0_1px_1.5px_rgba(31,26,18,0.22)]">
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
  mark: string;
};

/**
 * Language colors avoid file-icon hues
 * (SRT teal / ASS plum / ZIP citrus / RAR brick / 7Z indigo).
 * 芯片描边 / 底色 / 文字色不再写死浅色 hex，而是用 color-mix 掺入当前表面的
 * --v4-text / --v4-line-strong：奶油面上自动变深、墨绿面上自动变浅，两边都可读。
 */
const LANG_VISUAL: Record<string, LangVisual> = {
  'zh-CN': { label: '简中', face: '#C9A430', ink: '#241C06', mark: '简' },
  'zh-TW': { label: '繁中', face: '#3D9E5F', ink: '#F2FFF6', mark: '繁' },
  zh: { label: '中文', face: '#B8952A', ink: '#241C06', mark: '中' },
  en: { label: '英语', face: '#6D6A63', ink: '#F3EBE2', mark: 'En' },
  ja: { label: '日语', face: '#C45A8A', ink: '#FFF7FA', mark: 'あ' },
  ko: { label: '韩语', face: '#8B6B4A', ink: '#FFF8F2', mark: '한' },
  fr: { label: '法语', face: '#5F7A6A', ink: '#F5FAF7', mark: 'Fr' },
  es: { label: '西语', face: '#9B5A6F', ink: '#FFF5F8', mark: 'Ñ' },
  latin: { label: '拉丁', face: '#7A756C', ink: '#F3EBE2', mark: 'L' },
  bilingual: { label: '双语', face: '#3A342E', ink: '#E8C547', mark: '双' },
  commentary: { label: '导评', face: '#5C5650', ink: '#F3EBE2', mark: '评' },
  unknown: { label: '待识别', face: '#847C70', ink: '#F5F1EA', mark: '?' },
};

/** 表面自适应的芯片配色：随 data-surface（cream/forest）自动取得可读对比。 */
const chipSurfaceStyle = (face: string): React.CSSProperties => ({
  borderColor: `color-mix(in srgb, ${face} 48%, var(--v4-line-strong))`,
  background: `color-mix(in srgb, ${face} 12%, transparent)`,
  // 文字侧更靠近主色，避免浅奶油上「有色但发灰」
  color: `color-mix(in srgb, ${face} 28%, var(--v4-text))`,
  fontWeight: 600,
});

type MarkSize = 'md' | 'lg';

/** Fixed tile — larger glyph, tighter padding. */
const LangTile: React.FC<{ visual: LangVisual; flipKey?: string; size?: MarkSize }> = ({
  visual,
  flipKey,
  size = 'md',
}) => {
  const { face, ink, mark } = visual;
  const isWide = mark.length > 1;
  const isLg = size === 'lg';

  return (
    <motion.span
      key={flipKey ?? mark}
      initial={{ rotateY: 75, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={springSnappy}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${
        isLg ? 'h-9 w-9' : 'h-8 w-8'
      }`}
      aria-hidden="true"
      style={{ background: face }}
    >
      <span
        className={`font-mono font-bold leading-none tracking-normal ${
          isLg
            ? isWide ? 'text-[15px]' : 'text-[17px]'
            : isWide ? 'text-[14px]' : 'text-[16px]'
        }`}
        style={{ color: ink }}
      >
        {mark}
      </span>
    </motion.span>
  );
};

/** Language mark: unique color + glyph per language. */
export const LanguageMark: React.FC<{
  lang?: string;
  label?: string;
  languagePair?: { primary: string; secondary: string };
  size?: MarkSize;
  className?: string;
}> = ({ lang, label, languagePair, size = 'md', className = '' }) => {
  const isLg = size === 'lg';
  const shellClass = `inline-flex shrink-0 items-center gap-1 rounded-md border pl-0.5 pr-2 ${
    isLg ? 'h-9' : 'h-8'
  } ${className}`;
  const labelClass = `font-mono font-semibold leading-none tracking-normal ${
    isLg ? 'text-[14px]' : 'text-[13px]'
  }`;

  if (languagePair) {
    const primaryKey = resolveLangKey(languagePair.primary);
    const secondaryKey = resolveLangKey(languagePair.secondary);
    const primary = LANG_VISUAL[primaryKey] || LANG_VISUAL.unknown;
    const secondary = LANG_VISUAL[secondaryKey] || LANG_VISUAL.unknown;
    return (
      <span
        className={shellClass}
        style={chipSurfaceStyle(LANG_VISUAL.bilingual.face)}
        title={`${primary.label} / ${secondary.label}`}
      >
        <span className="relative inline-flex items-center">
          {/* 两块语言牌相向吸合，暗示「配对成功」 */}
          <motion.span
            initial={{ x: -5 }}
            animate={{ x: 0 }}
            transition={springSnappy}
            className="inline-flex"
          >
            <LangTile visual={primary} flipKey={`p-${primaryKey}`} size={size} />
          </motion.span>
          <motion.span
            initial={{ x: 5 }}
            animate={{ x: 0 }}
            transition={springSnappy}
            className="-ml-1.5 inline-flex"
          >
            <LangTile visual={secondary} flipKey={`s-${secondaryKey}`} size={size} />
          </motion.span>
        </span>
        <span className={labelClass}>双语</span>
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
      className={shellClass}
      style={chipSurfaceStyle(visual.face)}
      title={visual.label}
    >
      {/* key 变化（如 待识别 → 简中）时翻牌，提示「语言已识别」 */}
      <LangTile visual={visual} flipKey={key} size={size} />
      <span className={labelClass}>{visual.label}</span>
    </span>
  );
};
