export type SubtitleCueTerm =
  | 'dialogue'
  | 'forced_narrative'
  | 'screen_text'
  | 'sound_caption'
  | 'speaker_label'
  | 'narration'
  | 'lyrics'
  | 'commentary'
  | 'credit'
  | 'metadata_note';

export const SUBTITLE_CUE_TYPE_DICTIONARY: Record<SubtitleCueTerm, {
  zh: string;
  en: string;
  description: string;
  exportDefault: boolean;
}> = {
  dialogue: {
    zh: '对白',
    en: 'Dialogue',
    description: '角色说出的台词，是字幕的主体内容。',
    exportDefault: true,
  },
  forced_narrative: {
    zh: '强制字幕',
    en: 'Forced Narrative',
    description: '用于翻译非主要语言对白、重要外语片段或必须理解的画面文字，通常应保留。',
    exportDefault: true,
  },
  screen_text: {
    zh: '画面文字',
    en: 'On-screen Text',
    description: '片名、地点、招牌、短信、文件、屏幕内容等画面中出现的文字。',
    exportDefault: true,
  },
  sound_caption: {
    zh: '声音描述',
    en: 'Sound Caption / SDH Cue',
    description: '风声、门响、音乐、笑声等非对白声音提示，常见于 SDH/CC 字幕。',
    exportDefault: true,
  },
  speaker_label: {
    zh: '台词来源角色',
    en: 'Speaker Label',
    description: '标注说话人身份或声音来源，例如“电台：”“旁白：”“观众：”。',
    exportDefault: true,
  },
  narration: {
    zh: '旁白',
    en: 'Narration / Voice-over',
    description: '画外音、内心独白、旁白解说等非现场对白。',
    exportDefault: true,
  },
  lyrics: {
    zh: '歌词',
    en: 'Lyrics',
    description: '歌曲、哼唱、音乐段落中的歌词内容。',
    exportDefault: true,
  },
  commentary: {
    zh: '导评',
    en: 'Commentary',
    description: '导演、演员或制作人员的评论音轨字幕。',
    exportDefault: false,
  },
  credit: {
    zh: '署名信息',
    en: 'Credits / Subtitle Credits',
    description: '字幕组、翻译、校对、时间轴等制作署名，不属于影片画面或对白内容。',
    exportDefault: false,
  },
  metadata_note: {
    zh: '技术备注',
    en: 'Technical Note',
    description: '编码、版本、来源、合并说明等非影片内容信息。',
    exportDefault: false,
  },
};

export const getSubtitleTermHint = (term: SubtitleCueTerm): string => {
  const item = SUBTITLE_CUE_TYPE_DICTIONARY[term];
  return `${item.zh} / ${item.en}。${item.description}`;
};
