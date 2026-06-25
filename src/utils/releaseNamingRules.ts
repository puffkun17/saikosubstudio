export const RELEASE_NAMING_RULE_SOURCE =
  'Built-in scene and P2P release naming heuristics, curated for subtitle lookup.';

const PLATFORM_TAGS = [
  'AMZN', 'Amazon', 'NF', 'Netflix', 'ATVP', 'AppleTV', 'AppleTVPlus', 'Aptv',
  'DSNP', 'DisneyPlus', 'HULU', 'MAX', 'HMAX', 'HBO', 'HBOGO', 'HBOmax',
  'PMTP', 'Peacock', 'ParamountPlus', 'iT', 'iTunes', 'CR', 'CRAV', 'B-Global',
];

const SOURCE_TAGS = [
  'WEB', 'WEB-DL', 'WEBDL', 'WEBRip', 'WEB-Rip', 'BluRay', 'BDRip', 'BRRip',
  'BDREMUX', 'REMUX', 'UHD', 'UHDTV', 'HDTV', 'DVDRip', 'DVD', 'HDTVRip',
  'HDRip', 'CAM', 'TS', 'TC', 'DVDSCR', 'SCREENER', 'PDTV',
];

const QUALITY_TAGS = [
  '480p', '576p', '720p', '1080p', '1440p', '1600p', '2160p', '4320p',
  '2K', '4K', '8K', 'SD', 'HD', 'FHD', 'UHD',
];

const VIDEO_TAGS = [
  'AVC', 'HEVC', 'H264', 'H265', 'H.264', 'H.265', 'x264', 'x265', 'xvid',
  'DivX', 'AV1', 'VP9', 'Hi10P', '10bit', '10-bit', '8bit', '8-bit',
];

const HDR_TAGS = [
  'HDR', 'HDR10', 'HDR10Plus', 'HDR10+', 'HLG', 'DV', 'DolbyVision', 'DoVi',
  'DVHDR', 'SDR', 'PQ',
];

const AUDIO_TAGS = [
  'AAC', 'AAC2.0', 'AC3', 'EAC3', 'E-AC3', 'DD', 'DDP', 'DDP2.0', 'DDP5.1',
  'DDP7.1', 'DD5.1', 'DD7.1', 'TrueHD', 'Atmos', 'DTS', 'DTS-HD', 'DTSHD',
  'DTSX', 'FLAC', 'MP3', 'Opus', '2.0', '5.1', '7.1', '6ch', '8ch',
];

const EDITION_TAGS = [
  'PROPER', 'REPACK', 'RERIP', 'REAL', 'INTERNAL', 'LIMITED', 'EXTENDED',
  'UNCUT', 'UNRATED', 'THEATRICAL', 'REMASTERED', 'RESTORED', 'HYBRID',
  'CUSTOM', 'COMPLETE', 'READNFO', 'NFOFIX', 'SUBBED', 'DUBBED',
];

const REGION_TAGS = [
  'MULTi', 'MULTiSUBS', 'VFF', 'VFQ', 'VFI', 'VO', 'VOF', 'VOST', 'VOSTFR',
  'FR', 'FRENCH', 'GERMAN', 'SPANISH', 'ITALIAN', 'JAPANESE', 'KOREAN',
];

const SUBTITLE_TAGS = [
  'CHS', 'CHT', 'GBK', 'UTF8', 'UTF-8', 'BIG5', 'ENG', 'EN', 'ZH', 'CN', 'JP',
  'KR', 'zh-CN', 'zh_CN', 'zh-TW', 'zh-HK', '简体', '繁体', '中字', '英字',
  '英文', '双语', '双语种', '中英', '官译双语', '中英双语', '中文字幕',
  '英文字幕', '双语字幕', '中英字幕', '中英双语字幕', '中英特效字幕',
  '特效', '特效字幕', '字幕',
];

const RELEASE_GROUP_TAGS = [
  'RARBG', 'YTS', 'YIFY', 'TGX', 'PSA', 'FLUX', 'ETHEL', 'playWEB',
  'SuccessfulCrab', 'CAKES', 'NTb', 'NTG', 'TEPES', 'KOGi', 'ION10',
  'MeGusta', 'Pahe', 'QxR', 'Tigole',
];

const SUBTITLE_SITE_TAGS = [
  'zmk', 'zimuku', 'subhd', 'assrt', 'shooter', 'opensubtitles',
  '字幕库', '收藏级', '精修', '人人影视', 'FIX字幕侠',
];

const CONTEXTUAL_TAIL_TAGS = [
  'Criterion', 'CriterionCollection', 'Collection', 'Arrow', 'Kino', 'StudioCanal',
  'MastersOfCinema', 'ShoutFactory',
];

export const RELEASE_NAMING_TAGS = [
  ...PLATFORM_TAGS,
  ...SOURCE_TAGS,
  ...QUALITY_TAGS,
  ...VIDEO_TAGS,
  ...HDR_TAGS,
  ...AUDIO_TAGS,
  ...EDITION_TAGS,
  ...REGION_TAGS,
  ...SUBTITLE_TAGS,
  ...RELEASE_GROUP_TAGS,
  ...SUBTITLE_SITE_TAGS,
] as const;

export const RELEASE_NAMING_CONTEXTUAL_TAIL_TAGS = CONTEXTUAL_TAIL_TAGS as readonly string[];

export interface ReleaseNamingProfile {
  platform: string[];
  source: string[];
  quality: string[];
  video: string[];
  hdr: string[];
  audio: string[];
  edition: string[];
  region: string[];
  subtitles: string[];
  publisher: string[];
  group?: string;
}

export const normalizeReleaseToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');

export const RELEASE_NOISE_TOKEN_SET = new Set(RELEASE_NAMING_TAGS.map(normalizeReleaseToken));

export const RELEASE_CONTEXTUAL_TAIL_TOKEN_SET = new Set(
  RELEASE_NAMING_CONTEXTUAL_TAIL_TAGS.map(normalizeReleaseToken),
);

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createReleaseTagPattern = (tags: readonly string[]): string =>
  tags
    .map(tag => tag.split(/[.\-_ ]+/).map(escapeRegex).join('[\\s._-]*'))
    .sort((a, b) => b.length - a.length)
    .join('|');

const hasReleaseTag = (source: string, tag: string): boolean => {
  const pattern = tag.split(/[.\-_ ]+/).map(escapeRegex).join('[\\s._-]*');
  return new RegExp(`(^|[\\s._\\-_/\\\\:+&()[\\]【】（）])${pattern}(?=$|[\\s._\\-_/\\\\:+&()[\\]【】（）])`, 'i').test(source);
};

const collectTags = (source: string, tags: readonly string[]): string[] => {
  const collected: string[] = [];
  for (const tag of tags) {
    if (hasReleaseTag(source, tag) && !collected.includes(tag)) collected.push(tag);
  }
  return collected;
};

export const extractReleaseNamingProfile = (source: string): ReleaseNamingProfile => {
  const groupMatch = source.match(/-([A-Za-z0-9]{2,24})$/);
  return {
    platform: collectTags(source, PLATFORM_TAGS),
    source: collectTags(source, SOURCE_TAGS),
    quality: collectTags(source, QUALITY_TAGS),
    video: collectTags(source, VIDEO_TAGS),
    hdr: collectTags(source, HDR_TAGS),
    audio: collectTags(source, AUDIO_TAGS),
    edition: collectTags(source, EDITION_TAGS),
    region: collectTags(source, REGION_TAGS),
    subtitles: collectTags(source, SUBTITLE_TAGS),
    publisher: collectTags(source, CONTEXTUAL_TAIL_TAGS),
    group: groupMatch?.[1],
  };
};

export const isReleaseNoiseToken = (token: string): boolean => {
  const normalized = normalizeReleaseToken(token);
  if (!normalized) return true;
  if (RELEASE_NOISE_TOKEN_SET.has(normalized)) return true;
  if (/^\d{3,4}p$/.test(normalized)) return true;
  if (/^\d+(?:bit|ch)$/.test(normalized)) return true;
  if (/^(?:ddp?|dts|aac|eac3)?\d(?:0|1)$/.test(normalized)) return true;
  return false;
};

export const stripContextualReleaseTail = (value: string): string => {
  const tokens = value.split(/[\s._\-_/\\:+&]+/).filter(Boolean);
  while (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    const normalized = normalizeReleaseToken(last);
    if (isReleaseNoiseToken(last) || RELEASE_CONTEXTUAL_TAIL_TOKEN_SET.has(normalized)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(' ');
};
