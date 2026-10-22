/** Subtitle analysis: language detection, classification, attributions, bilingual text helpers. */
import {
  type AuxiliaryCueAction,
  type AuxiliaryCueCategory,
  type AuxiliaryCueClassification,
  type CueClassification,
  type CueKind,
  type CueSuspicion,
  type LatinSecondaryLanguage,
  type MainPathSecondaryLanguage,
  type SubRow,
  type SubtitleAttribution,
  type SubtitleAttributionRole,
  type SubtitleLanguage,
  LATIN_SECONDARY_LANGUAGES,
  MAIN_PATH_SECONDARY_LANGUAGES,
  SPARSE_SECONDARY_CUE_RATIO,
  cleanSubtitleContent,
} from './model';

export function stripMarkupForDetection(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/<\/?(?:font|b|u)(?:\s[^>]*)?>/gi, '')
    .replace(/\\N/gi, '\n')
    .replace(/\\n/g, '\n');
}

/**
 * Determine language from text content.
 */
export function detectLanguageByContent(text: string): SubtitleLanguage {
  if (!text) return "unknown";
  // Detection view only — font tags / bold markup must not skew CJK vs Latin.
  text = stripMarkupForDetection(text);

  const kanaCount = (text.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || []).length;
  if (kanaCount >= 2) return 'ja';

  const hangulCount = (text.match(/[\uac00-\ud7af\u1100-\u11ff]/g) || []).length;
  if (hangulCount >= 2) return 'ko';
  
  const tcChars = text.match(/[門設計這說著會後個過嗎從來對]/g);
  const scChars = text.match(/[门设计这说着会后个过吗从来对]/g);
  const tcCount = tcChars ? tcChars.length : 0;
  const scCount = scChars ? scChars.length : 0;
  
  const hanMatch = text.match(/[一-龥]/g);
  const hanCount = hanMatch ? hanMatch.length : 0;
  
  if (hanCount > 5 || (text.length > 0 && hanCount / text.length > 0.05)) {
    if (tcCount > scCount) {
      return "zh-TW";
    }
    return "zh-CN";
  }
  const scores = latinLanguageScores(text);
  // 西欧语：停用词 + 重音合计须明显强于英语。禁止「一个 café/señor」或几句夹杂的西语压过整段英文对白。
  const best = LATIN_SECONDARY_LANGUAGES
    .map((language) => ({ language, score: scores[language] }))
    .reduce((a, b) => (b.score > a.score ? b : a)); // ties keep the earlier (es > fr > pt > de > it)
  if (best.score >= 2 && best.score > scores.en) return best.language;
  if (scores.en >= 1) return 'en';
  if (scores.latinLetters >= 2) return 'latin';
  return 'unknown';
}

const countMatches = (value: string, re: RegExp): number => (value.match(re) || []).length;

/**
 * Stop-word + diacritic scores per Latin-alphabet language (whole-word, case-insensitive).
 * Lexicons avoid words shared with English («no», «a», «me», «son», «come»…) so an English track that
 * quotes a few Spanish lines stays English: the score is cumulative over the whole text.
 */
export function latinLanguageScores(text: string): Record<'en' | LatinSecondaryLanguage | 'latinLetters', number> {
  const clean = text
    .replace(/<[^>]*>|\{[^}]*\}/g, ' ')
    .replace(/[^\p{L}\p{M}'’\s-]/gu, ' ')
    .toLowerCase();
  const words = (list: string) => new RegExp(`(?<![\\p{L}'’])(?:${list})(?![\\p{L}'’])`, 'gu');
  const es = countMatches(clean, words('el|la|los|las|un|una|unos|unas|de|del|con|por|para|pero|está|esta|que|qué|soy|eres|somos|usted|ustedes|gracias|hola|movimiento|detectado|supervisión|creativa|señor|señora|y|muy|también|ahora|aquí|bueno|vamos|nada|sí|cómo|dónde|cuándo|porque|tengo|tienes|quiero|puedo|estoy|estás|hay|mañana|hoy|mi|tu|su|nosotros|ellos|pues|entonces'))
    + countMatches(clean, /[áíóúñ¿¡]/g);
  const fr = countMatches(clean, words('le|la|les|des|une|dans|avec|pour|mais|est|pas|nous|vous|qui|que|je|tu|il|elle|ce|cette|c’est|c\'est|j’ai|j\'ai|oui|merci|bonjour|bien|très|aussi|ici|où|du|au|aux|ne|sur|mon|ton'))
    + countMatches(clean, /[àâçéèêëîïôùûÿœæ]/g);
  const pt = countMatches(clean, words('não|você|vocês|obrigado|obrigada|muito|também|então|isso|aqui|está|estou|tenho|vamos|uma|um|com|para|mas|eu|ele|ela|nós|meu|minha|do|da|dos|das|na|em|ao|é'))
    + countMatches(clean, /[ãõç]/g) * 2;
  const de = countMatches(clean, words('der|das|und|ist|nicht|ich|du|sie|wir|ihr|ein|eine|mit|auf|aber|danke|bitte|ja|nein|wie|wo|warum|hier|jetzt|auch|noch|schon|mein|dein|haben|habe|bin|sind'))
    + countMatches(clean, /[äöüß]/g);
  const it = countMatches(clean, words('il|lo|gli|che|non|sono|sei|per|una|della|questo|questa|perché|grazie|anche|ciao|molto|bene|io|lui|lei|noi|voi|loro|ma|mi|ti|ci|cosa|dove|qui|adesso|allora|è'))
    + countMatches(clean, /[àèéìòù]/g) * 0.5;
  const en = countMatches(clean, /\b(the|and|you|that|this|with|for|have|not|are|was|what|where|why|hello|yes|no)\b/g);
  const latinLetters = countMatches(clean, /[a-z\u00c0-\u024f]/g);
  return { en, es, fr, pt, de, it, latinLetters };
}

const hasFilenameToken = (name: string, tokens: string[]): boolean => {
  const normalized = name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[._()[\]{}+]+/g, ' ');
  return tokens.some(token => new RegExp(`(^|\\s|-)${token}(\\s|-|$)`, 'i').test(normalized));
};



export function isMainPathSecondaryLanguage(language: string): language is MainPathSecondaryLanguage {
  return (MAIN_PATH_SECONDARY_LANGUAGES as readonly string[]).includes(language);
}

/** True English dialogue candidate for auto-bind (not merely “eligible secondary”). */
export function isEnglishSecondaryLanguage(language: string): language is 'en' {
  return language === 'en';
}

/**
 * SDH / CC（听障字幕、封闭字幕）文件名标记。
 * 仍可作为 English 候选，但在有普通 en 轨时应降权，避免因体积更大被默认绑成原文轨。
 */
export function isSdhOrCcSubtitleFilename(name: string): boolean {
  if (!name) return false;
  const normalized = name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[._()[\]{}+]+/g, ' ');
  if (hasFilenameToken(normalized, ['sdh', 'cc'])) return true;
  return /\b(closed\s*captions?|subtitles?\s+for\s+the\s+deaf|听障|聽障)\b/i.test(normalized);
}

/** Prefer Simplified Chinese over Traditional when both are candidates. */
export function mainPathPrimaryRank(language: string): number {
  if (language === 'zh-CN' || language === 'zh') return 2;
  if (language === 'zh-TW') return 1;
  return 0;
}

/**
 * Prefer plain English dialogue over SDH/CC.
 * Non-English source-language fallbacks (ja/ko) rank below any English candidate.
 */
export function mainPathSecondaryRank(name: string, language = ''): number {
  if (language === 'en' || (!language && !/(^|[._\s-])(ja|jpn|ko|kor)([._\s-]|$)/i.test(name))) {
    return isSdhOrCcSubtitleFilename(name) ? 10 : 20;
  }
  // Latin-alphabet second languages: Spanish first, French second (Derek), then pt / de / it.
  if (language === 'es') return 9;
  if (language === 'fr') return 8;
  if (language === 'pt' || language === 'de' || language === 'it') return 7;
  if (language === 'ja') return 4;
  if (language === 'ko') return 3;
  return 0;
}

/**
 * English (or other secondary) is “sparse / not dialogue” when cue count is tiny vs primary
 * (e.g. 24 on-screen English lines vs ~467 Chinese dialogue cues).
 */
export function isSparseSecondaryTrack(primaryCueCount: number, secondaryCueCount: number): boolean {
  if (primaryCueCount <= 0 || secondaryCueCount <= 0) return false;
  if (secondaryCueCount >= 80 && secondaryCueCount / primaryCueCount >= SPARSE_SECONDARY_CUE_RATIO) {
    return false;
  }
  return secondaryCueCount / primaryCueCount < SPARSE_SECONDARY_CUE_RATIO;
}

export function detectLanguageByFilename(name: string): SubtitleLanguage {
  const normalized = name.toLowerCase();
  if (/(commentary|comment|director|解说|導評|导轨)/i.test(name)) return 'commentary';
  if (/(双语|雙語|中英|中日|中韩|中韓|中法|中西|中葡|中德|中意|bilingual|dual[-_.\s]?sub)/i.test(name)) return 'bilingual';
  if (
    /(chinese[._\s-]*traditional|traditional[._\s-]*chinese|zh[-_.\s]?tw|zh[-_.\s]?hant|繁體|繁体|繁中|big5)/i.test(name)
    || hasFilenameToken(normalized, ['cht', 'tc', 'zh-hant'])
  ) return 'zh-TW';
  if (
    /(chinese[._\s-]*simplified|simplified[._\s-]*chinese|zh[-_.\s]?cn|zh[-_.\s]?hans|简体|簡體|简中|簡中|gbk|gb2312|gb18030)/i.test(name)
    || hasFilenameToken(normalized, ['chs', 'sc', 'zh-hans', 'zh', 'chi', 'zho'])
  ) return 'zh-CN';
  // Bare SDH/CC (no eng token) → English caption track so preflight is not「待识别」; demoted vs plain eng at bind.
  if (
    isSdhOrCcSubtitleFilename(name)
    && !hasFilenameToken(normalized, ['jpn', 'ja', 'kor', 'ko', 'fre', 'fra', 'fr', 'spa', 'esp', 'es', 'es-419', 'por', 'pt', 'pt-br', 'ger', 'deu', 'ita'])
    && !/(japanese|日本語|日语|日語|korean|한국어|韩语|韓語|french|français|spanish|español|portuguese|português|german|deutsch|italian|italiano|日文|韩文|韓文|法语|法語|西语|西語|葡萄牙语|德语|德語|意大利语)/i.test(name)
  ) {
    return 'en';
  }
  if (/(english|英语|英語|英文)/i.test(name) || hasFilenameToken(normalized, ['eng', 'en'])) return 'en';
  if (/(japanese|日本語|日语|日語|日文)/i.test(name) || hasFilenameToken(normalized, ['jpn', 'ja'])) return 'ja';
  if (/(korean|한국어|韩语|韓語|韩文|韓文)/i.test(name) || hasFilenameToken(normalized, ['kor', 'ko'])) return 'ko';
  if (/(french|français|francais|法语|法語|法文)/i.test(name) || hasFilenameToken(normalized, ['fre', 'fra', 'fr', 'vff', 'vfq'])) return 'fr';
  if (/(spanish|español|espanol|castellano|latino|西班牙语|西班牙語|西语|西語)/i.test(name) || hasFilenameToken(normalized, ['spa', 'esp', 'es', 'es-419', 'es-es', 'es-mx'])) return 'es';
  if (/(portuguese|português|portugues|葡萄牙语|葡萄牙語|葡语|葡語)/i.test(name) || hasFilenameToken(normalized, ['por', 'pt', 'pt-br', 'pt-pt', 'ptbr'])) return 'pt';
  // No bare 'de' / 'it' tokens: they collide with titles (「…de…」, 「It」).
  if (/(german|deutsch|德语|德語)/i.test(name) || hasFilenameToken(normalized, ['ger', 'deu', 'de-de'])) return 'de';
  if (/(italian|italiano|意大利语|意大利語|意语)/i.test(name) || hasFilenameToken(normalized, ['ita', 'it-it'])) return 'it';
  return 'unknown';
}


const stripSubtitleInlineTags = (text: string): string => text
  .replace(/\{\\[^}]*\}/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/\\N/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stripWrappingBrackets = (text: string): string => text
  .trim()
  .replace(/^\s*[\[(（【]\s*/, '')
  .replace(/\s*[\])）】]\s*$/, '')
  .trim();



export function isLyricText(text: string): boolean {
  if (!text) return false;
  return /[♪♫♬♩🎵🎶]/.test(text);
}


const ATTRIBUTION_PATTERNS: Array<{ role: SubtitleAttributionRole; label: string; pattern: RegExp }> = [
  { role: 'publisher', label: '发布 / 字幕组', pattern: /^(?:发行(?:方)?|发布(?:者)?|字幕组|字幕(?:制作)?组|Publisher|Release(?:d)?\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'translator', label: '翻译', pattern: /^(?:字幕翻译|翻译|译者|听译|Translator|Translation|Translated\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'editor', label: '编校', pattern: /^(?:编辑|编者|后期|润色|Editor|Editing)\s*[:：]\s*(.+)$/i },
  { role: 'timing', label: '时间轴', pattern: /^(?:时间轴|校轴|轴(?:制)?|Timing|Sync(?:hronization)?)\s*[:：]\s*(.+)$/i },
  { role: 'proofreader', label: '校对', pattern: /^(?:校对|校订|Proofread(?:er)?)\s*[:：]\s*(.+)$/i },
  { role: 'encoder', label: '压制 / 合并', pattern: /^(?:压制|编码|合并|Encoder|Encode(?:d)?\s*By|Mux(?:ed)?\s*By)\s*[:：]\s*(.+)$/i },
  { role: 'website', label: '来源', pattern: /^(?:网站|来源|主页|Website|Web|URL)\s*[:：]\s*(.+)$/i },
  { role: 'producer', label: '制作', pattern: /^(?:制作(?:者)?|字幕制作|Produced\s*By|Author|Subtitles?\s*By)\s*[:：]\s*(.+)$/i },
];

/** True for standalone subtitle-credit cues such as「字幕翻译：凌武翎」. */
export function isSubtitleCreditText(text: string): boolean {
  const clean = stripSubtitleInlineTags(text || '')
    .replace(/\\N/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || clean.length > 80) return false;
  if (ATTRIBUTION_PATTERNS.some((definition) => definition.pattern.test(clean))) return true;
  return /^(?:字幕(?:翻译|制作|组|校对|时间轴|听译)|翻译|译者|校对|时间轴|压制|制作)\s*[:：]/.test(clean);
}

export const cleanAttributionValue = (value: string) => value
  .replace(/\{\\[^}]+\}/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\\N/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120);

/**
 * Extract production credits from ASS header fields and credit-like subtitle cues.
 * It deliberately reads only the beginning and end of subtitle files to avoid
 * interpreting ordinary dialogue that happens to mention a translator or publisher.
 */
export function extractSubtitleAttributions(text: string): SubtitleAttribution[] {
  if (!text) return [];

  const normalized = text.replace(/\r\n?/g, '\n');
  const scriptInfo = normalized.match(/\[Script Info\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/i)?.[1] || '';
  const cueLines = normalized.split('\n');
  const samples: Array<{ line: string; source: SubtitleAttribution['source'] }> = [
    ...scriptInfo.split('\n').map(line => ({ line, source: 'ass-header' as const })),
    ...cueLines.slice(0, 72).map(line => ({ line, source: 'subtitle-cue' as const })),
    ...cueLines.slice(-72).map(line => ({ line, source: 'subtitle-cue' as const })),
  ];
  const collected: SubtitleAttribution[] = [];

  for (const sample of samples) {
    const line = cleanAttributionValue(sample.line.replace(/^Dialogue:[^,]*,(?:[^,]*,){8}/i, ''));
    if (!line || /^\d+$/.test(line) || /^\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}/.test(line)) continue;
    for (const definition of ATTRIBUTION_PATTERNS) {
      const match = line.match(definition.pattern);
      if (!match) continue;
      const value = cleanAttributionValue(match[1]);
      if (!value) continue;
      collected.push({ role: definition.role, label: definition.label, value, source: sample.source });
      break;
    }
  }

  return collected.filter((item, index) =>
    collected.findIndex(candidate => candidate.role === item.role && candidate.value.toLowerCase() === item.value.toLowerCase()) === index
  );
}


export const AUXILIARY_CLASSIFY_SCORES = {
  unknownBase: 38,
  music: 78,
  screenText: 86,
  speechContext: 82,
  ambient: 76,
  bracket: 58,
} as const;

const isFullyWrappedAuxiliaryCue = (cleanText: string): boolean => (
  /^[\[(（【][\s\S]*[\])）】]$/.test(cleanText) || /^<[^>]+>$/.test(cleanText)
);

/** High-confidence sound EVENTS only. Bare nouns like "phone" /「电话」stay screen text (keep). */
// EN seeds: Netflix/CC reaction + impact (Lucky / Prada). No bare nouns (phone/TEXT stay screen).
const CONFIRMED_AMBIENT_EN_RE = /\b(?:(?:phone|telephone|cell(?:phone)?|doorbell)\s+(?:rings?|ringing|buzzes?|buzzing|vibrat(?:e|es|ing)|chimes?)|(?:door|gate)\s+(?:opens?|closes?|slams?|creaks?|knocking)|(?:soft |faint |distant |loud |strained )?(?:beeps?|beeping|knocking|creaking)|footsteps?|wind(?:\s+howling)?|thunder|sirens?|engines?\s+revving|applause|applauding|laughter|no\s+audible\s+dialogue|(?:sighs?|groans?|grunts?|gasps?|gasping|panting|pants|whimpers?|gulps?|moans?|crying|sniffling|chuckles?|chuckling|laughs?|laughing|scoffs?|tuts?|coughs?|exhales?|inhales?|screams?|exclaims?|stammers?|vocaliz(?:es|ing)|muttering|mumbling|shuffling|clears\s+throat|breathes?(?:\s+deeply)?)\b|(?:cheering|clamoring|chattering|whistling)\b|(?:honks?|honking|clatter|clatters?|dings?|chimes?|thuds?|bangs?|crashes?|clanks?|kisses?|clicks?|clicking)\b|(?:horns?\s+honks?|horns?\s+honking|keys?\s+clatter|elevator\s+bell\s+dings?|bell\s+tolling|keyboard\s+clicking|pen\s+clicks?|pages?\s+shuffling)\b|(?:rings?|ringing)\b)/i;
const CONFIRMED_AMBIENT_ZH_RE = /(脚步声|腳步聲|风声|風聲|雨声|雨聲|雷声|雷聲|电话铃声|電話鈴聲|铃声|鈴聲|敲门声|敲門聲|开门声|開門聲|关门声|關門聲|笑声|笑聲|掌声|掌聲|哭声|哭聲|引擎声|引擎聲|警笛(?:声|聲)?|叹息声|嘆息聲|呼吸声|呼吸聲|嗡嗡声|滴滴声|咔嚓声)|(?:声|聲|响|響)$/;
const SPEECH_CONTEXT_EN_RE = /\b(?:speaking|speaks|language|alien|robot|machine|computer|ai|voice|radio|intercom|announcer|broadcast|chatter|chirps?|responds?|whispers?|murmurs?)\b/i;
const SPEECH_CONTEXT_ZH_RE = /(外星|语言|語言|机器|機器|人工智能|广播|廣播|电台|電台|对讲机|對講機|播报|播報|说话|說話|低语|低語)/;
const MUSIC_KEYWORD_RE = /\b(?:song|singing|lyrics?|playing)\b/i;
const MUSIC_ZH_RE = /(歌词|歌声|唱歌|哼唱|音乐|音樂|歌声|歌聲)/;
const TITLE_CARD_INNER_RE = /^(?:\d{4}年|\d{1,2}月|\d{1,2}日|[一二三四五六七八九十\d]+个月后|[一二三四五六七八九十\d]+年后|第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+幕)/;

const SCREEN_TEXT_MARKER_EN_RE = /\b(?:ON[\s-]?SCREEN|SCREEN[\s-]?TEXT|TITLE[\s-]?CARD|CAPTION|SUBTITLE|TEXT|SIGN)\b|sign reads|text reads/i;
const SCREEN_TEXT_MARKER_EN_UPPER_RE = /\b(?:ON[\s-]?SCREEN|SCREEN[\s-]?TEXT|TITLE[\s-]?CARD|CAPTION|SUBTITLE|TEXT|SIGN)\b/;
const SCREEN_TEXT_READS_RE = /\b(?:sign|text) reads\b/i;
const SCREEN_TEXT_MARKER_ZH_RE = /牌匾|招牌|标识|路牌|屏幕|短信|邮件|标题|告示|字幕显示/;
const DIALOGUE_FUNCTION_WORD_RE = /(是|有|在|去|来|说|做|看|听|想|要|会|能|的|了|着|过|吗|呢|吧)/;

/**
 * A full spoken sentence (ends with sentence punctuation and carries a function word),
 * with no bracket / lyric / emphasis wrapping. Keyword hits alone (「字幕」「回忆」「短信」…)
 * must not turn such a line into a note or screen text — that blocked bilingual pairing.
 */
function isSentenceLikeDialogue(text: string): boolean {
  const t = (text || '').trim();
  if (!t || /[()（）\[\]【】♪♫♬♩🎵🎶*《》]/.test(t)) return false;
  if (/^(?:旁白|画外音|畫外音|独白|獨白|解说|解說|心想)\s*[:：]/.test(t)) return false;
  if (!/[。！？!?…]["”』」']?$/.test(t)) return false;
  return DIALOGUE_FUNCTION_WORD_RE.test(t) || /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t);
}

const isConfirmedAmbientSound = (innerText: string): boolean => (
  CONFIRMED_AMBIENT_EN_RE.test(innerText) || CONFIRMED_AMBIENT_ZH_RE.test(innerText)
);

/** Peel CC/Netflix speaker or group prefix inside [] so "Amari gasps" → "gasps". */
const stripEnglishSdhSpeakerPrefix = (innerText: string): string => {
  const text = innerText.trim();
  if (!text) return text;
  let next = text
    .replace(/^person\s+\d+\s+/i, '')
    .replace(/^[A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+)?\s*:\s*/, '')
    .replace(/^(?:both|all|crowd|guests?|staff|mourners?|patrons?|people|singer)\s+/i, '')
    // Capitalized character name(s) before a lowercase sound phrase
    .replace(/^[A-Z][\w.'’\-]{0,20}(?:\s+[A-Z][\w.'’\-]{0,20})?\s+(?=[a-z])/u, '');
  next = next.trim();
  return next || text;
};

const isAsciiSquareWrappedCue = (cleanText: string): boolean => /^\[[\s\S]*\]$/.test(cleanText);

/** Human-readable trace for why an auxiliary cue was classified. */
export function describeAuxiliaryReason(reason: string): string {
  switch (reason) {
    case 'ambient-sound':
      return '括号内为明确音效事件，智能精简可剥离';
    case 'music-or-lyric':
      return '歌词/音乐标记';
    case 'screen-text':
      return '屏幕文字关键词';
    case 'title-card-pattern':
      return '标题卡/时间卡形态';
    case 'sign-like-uppercase':
      return '全大写标牌形态';
    case 'bracket-screen-text':
      return '括号内容默认按标题告示保留（非明确音效）';
    case 'semantic-speech-context':
      return '括号内为发言语境说明';
    case 'lyric-symbol':
      return '音符歌词标记';
    case 'subtitle-credit':
      return '字幕制作署名';
    default:
      return reason;
  }
}

export function classifyAuxiliaryCue(text: string): AuxiliaryCueClassification {
  const rawText = text || '';
  const cleanText = stripSubtitleInlineTags(rawText);
  const innerText = stripWrappingBrackets(cleanText);
  const fullyWrapped = isFullyWrappedAuxiliaryCue(cleanText);
  // EN [] only: peel speaker/group prefix before ambient match (中文括号不走此剥皮).
  const ambientInner = fullyWrapped && isAsciiSquareWrappedCue(cleanText)
    ? stripEnglishSdhSpeakerPrefix(innerText)
    : innerText;
  const reasons: string[] = [];
  let category: AuxiliaryCueCategory = 'unknown';
  let confidence: number = AUXILIARY_CLASSIFY_SCORES.unknownBase;
  let action: AuxiliaryCueAction = 'keep_auxiliary';

  // High confidence only: lyric symbols, or music keywords inside structural brackets.
  if (isLyricText(rawText) || (fullyWrapped && (MUSIC_KEYWORD_RE.test(innerText) || MUSIC_ZH_RE.test(innerText)))) {
    category = 'music';
    confidence = AUXILIARY_CLASSIFY_SCORES.music;
    action = 'keep_auxiliary';
    reasons.push('music-or-lyric');
  }

  // Short English tokens need word boundaries — otherwise SIGN matches "signed"/"designed",
  // and TEXT matches "treatment"/"context", which wrongly blocks dialogue pairing.
  // Outside brackets, only UPPERCASE markers count: plain sentences such as
  // "This is a test subtitle." / "Did you get my text?" /「你收到短信了吗？」are dialogue.
  const screenTextMarker = fullyWrapped
    ? SCREEN_TEXT_MARKER_EN_RE.test(innerText) || SCREEN_TEXT_MARKER_ZH_RE.test(innerText)
    : SCREEN_TEXT_MARKER_EN_UPPER_RE.test(innerText)
      || SCREEN_TEXT_READS_RE.test(innerText)
      || (!isSentenceLikeDialogue(innerText) && SCREEN_TEXT_MARKER_ZH_RE.test(innerText));
  if (screenTextMarker) {
    category = 'screen_text';
    confidence = AUXILIARY_CLASSIFY_SCORES.screenText;
    action = 'keep_visible';
    reasons.push('screen-text');
  }

  // Speech-context keywords are structural only when bracket-gated.
  if (
    category === 'unknown'
    && fullyWrapped
    && (SPEECH_CONTEXT_EN_RE.test(innerText) || SPEECH_CONTEXT_ZH_RE.test(innerText))
  ) {
    category = 'speech_context';
    confidence = Math.max(confidence, AUXILIARY_CLASSIFY_SCORES.speechContext);
    action = 'keep_auxiliary';
    reasons.push('semantic-speech-context');
  }

  // Only 100%-confirmed sound events may become strippable ambient SDH.
  // 「电话」keep as screen text; 「电话铃声响」/ [phone ringing] may strip.
  // EN [] uses ambientInner (prefix-stripped); 中文 （） still uses raw innerText.
  if (
    (category === 'unknown' || category === 'music')
    && fullyWrapped
    && isConfirmedAmbientSound(ambientInner)
  ) {
    const isMusicAmbient = /\b(?:music|song|singing|playing)\b/i.test(innerText) || /(音乐|音樂|歌声|歌聲)/.test(innerText);
    category = isMusicAmbient ? 'music' : 'ambient_sdh';
    confidence = Math.max(confidence, isMusicAmbient ? AUXILIARY_CLASSIFY_SCORES.music : AUXILIARY_CLASSIFY_SCORES.ambient);
    action = isMusicAmbient ? 'keep_auxiliary' : 'hide_by_default';
    reasons.push('ambient-sound');
  }

  // All other bracketed content defaults to keep-visible screen text.
  // 中文 （） 与未命中的 EN [] 仍走此保守回落（本轮不改默认分叉）。
  if (category === 'unknown' && fullyWrapped) {
    if (TITLE_CARD_INNER_RE.test(innerText)) {
      reasons.push('title-card-pattern');
    } else if (/^[A-Z0-9][A-Z0-9\s.'’:&-]{0,28}$/.test(innerText) && /[A-Z]/.test(innerText)) {
      reasons.push('sign-like-uppercase');
    } else {
      reasons.push('bracket-screen-text');
    }
    category = 'screen_text';
    confidence = AUXILIARY_CLASSIFY_SCORES.screenText;
    action = 'keep_visible';
  }

  return { category, confidence, action, reasons };
}

export function classifySubtitleCue(
  text: string,
  context: { timingLine?: string; assStyle?: string } = {}
): CueClassification {
  const rawText = text || '';
  const cleanText = stripSubtitleInlineTags(rawText);
  const timingLine = context.timingLine || '';
  const style = context.assStyle || '';
  const reasons: string[] = [];
  let screenScore = 0;
  let narrationScore = 0;
  let placement: CueClassification['placement'];

  if (isLyricText(rawText)) {
    return { kind: 'lyrics', confidence: 92, reasons: ['lyric-symbol'] };
  }

  if (isSubtitleCreditText(rawText)) {
    return { kind: 'credit', confidence: 94, reasons: ['subtitle-credit'] };
  }

  const auxiliary = classifyAuxiliaryCue(rawText);
  if (auxiliary.category === 'screen_text') {
    return {
      kind: 'screen_text',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      placement: auxiliary.action === 'keep_visible' ? 'top' : undefined,
      auxiliary,
    };
  }
  if (auxiliary.category === 'ambient_sdh' || auxiliary.category === 'music') {
    return {
      kind: 'sound_caption',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      auxiliary,
    };
  }
  if (auxiliary.category === 'semantic_sdh' || auxiliary.category === 'speech_context') {
    return {
      kind: 'narration',
      confidence: auxiliary.confidence,
      reasons: auxiliary.reasons,
      auxiliary,
    };
  }

  if (/\\an[789]\b/i.test(rawText) || /\balign\s*:\s*top\b/i.test(timingLine) || /\bline\s*:\s*(?:[0-2]?\d%?|top)\b/i.test(timingLine)) {
    screenScore += 28;
    placement = 'top';
    reasons.push('top-position');
  }
  if (/\\pos\s*\(|\\move\s*\(/i.test(rawText) || /\bX1\s*:\s*\d+|\bY1\s*:\s*\d+|\bposition\s*:/i.test(timingLine)) {
    screenScore += 34;
    placement = placement || 'positioned';
    reasons.push('explicit-position');
  }
  if (/\b(signs?|screen|title|top|text|onscreen|caption|location)\b/i.test(style)) {
    screenScore += 42;
    placement = placement || 'top';
    reasons.push('ass-style');
  }

  if (/^[A-Z0-9][A-Z0-9\s.'’:&-]{1,28}$/.test(cleanText) && /[A-Z]/.test(cleanText)) {
    screenScore += 22;
    reasons.push('sign-like-uppercase');
  }
  if (/(牌匾|招牌|标识|路牌|字幕|屏幕|短信|邮件|标题|文件|海报|报纸|新闻标题|告示|警告|禁止|入口|出口|EXIT|WARNING|POLICE|NOTICE)/i.test(cleanText)) {
    screenScore += 24;
    reasons.push('screen-text-keyword');
  }
  if (/^(?:\d{4}年|\d{1,2}月|\d{1,2}日|[一二三四五六七八九十\d]+个月后|[一二三四五六七八九十\d]+年后|第[一二三四五六七八九十\d]+章|第[一二三四五六七八九十\d]+幕)/.test(cleanText)) {
    screenScore += 20;
    reasons.push('title-card-pattern');
  }

  const hasDialoguePunctuation = /[。！？!?]$/.test(cleanText);
  const hasCommonDialogueWords = /(我|你|他|她|我们|你们|他们|是|有|在|去|来|说|做|看|听|想|要|会|能|了|吗|呢|吧|yeah|yes|no|you|i|we|they|he|she|what|why|how)/i.test(cleanText);
  if (cleanText.length > 0 && cleanText.length <= 14 && !hasDialoguePunctuation && !hasCommonDialogueWords) {
    screenScore += 12;
    reasons.push('short-label-like');
  }

  if (/^\([^)]+\)$|^（[^）]+）$|^\[[^\]]+\]$|^【[^】]+】$/.test(cleanText)) {
    narrationScore += 34;
    reasons.push('bracket-note');
  }
  if (/(旁白|画外音|广播|播报|通知|音效|声音|脚步声|笑声|掌声|音乐)/.test(cleanText)) {
    narrationScore += 38;
    reasons.push('narration-or-sound-keyword');
  }

  if (screenScore >= 38 && screenScore >= narrationScore) {
    return {
      kind: 'screen_text',
      confidence: Math.min(96, 52 + screenScore),
      reasons,
      placement,
      auxiliary: auxiliary.category !== 'unknown' ? auxiliary : undefined,
    };
  }

  if (narrationScore >= 38) {
    return {
      kind: 'narration',
      confidence: Math.min(92, 48 + narrationScore),
      reasons,
      placement,
      auxiliary,
    };
  }

  // Keep soft suspicions on ordinary dialogue so UI can flag them without blocking merge.
  const dialogueAuxiliary = auxiliary.suspicion
    || (auxiliary.category !== 'unknown' && auxiliary.reasons.length > 0)
    ? auxiliary
    : undefined;

  return { kind: 'dialogue', confidence: 55, reasons: auxiliary.suspicion?.reasons ?? [], placement, auxiliary: dialogueAuxiliary };
}

export type LineKind = 'credit' | 'lyrics' | 'sound' | 'screen' | 'narration' | 'dialogue';
export type LineKindRow = Pick<SubRow, 'text'> & Partial<Pick<SubRow, 'type' | 'cueKind' | 'auxiliary'>>;

export function classifyLineKind(row: LineKindRow): LineKind {
  const category = row.auxiliary?.category;
  if (row.type === 'credit' || row.cueKind === 'credit' || isSubtitleCreditText(row.text)) return 'credit';
  if (row.type === 'lyrics' || row.cueKind === 'lyrics' || isLyricText(row.text)) return 'lyrics';
  if (row.cueKind === 'sound_caption' || category === 'ambient_sdh' || category === 'music' || category === 'semantic_sdh') return 'sound';
  if (row.cueKind === 'screen_text' || category === 'screen_text') return 'screen';
  if (row.cueKind === 'narration' || row.cueKind === 'commentary' || category === 'speech_context' || category === 'unknown') return 'narration';
  return 'dialogue';
}


export { isSentenceLikeDialogue };

export function splitSingleBilingualText(text: string): string {
  if (!text) return "";
  // Split on a detection view (tags stripped) so `{\fn微软雅黑\fs14}English` cannot fake zh.
  // Original cue text in Subfile / export paths is untouched.
  const view = stripMarkupForDetection(text);

  if (view.includes('\n')) {
    return view;
  }

  const hasZh = /[一-龥]/.test(view);
  const hasEn = /[a-zA-Z]/.test(view);
  if (!hasZh || !hasEn) {
    return view;
  }

  const latinWords = (value: string): string[] => value.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const latinChars = (value: string): number => (value.match(/[A-Za-z]/g) || []).length;
  const hanChars = (value: string): number => (value.match(/[一-龥]/g) || []).length;
  const isSubtitleLikeEnglish = (value: string): boolean => {
    const words = latinWords(value);
    if (words.length >= 2) return true;
    return words.length === 1 && latinChars(value) >= 10 && hanChars(value) === 0;
  };
  const isSubtitleLikeChinese = (value: string): boolean => hanChars(value) >= 2;

  const zhFirstMatch = view.match(/^([\s\S]*?[一-龥][，。！？）】」；：”’"'.,!?\s-]*)([A-Za-z][\s\S]*)$/);
  if (zhFirstMatch) {
    const zhPart = zhFirstMatch[1].trim();
    const enPart = zhFirstMatch[2].trim();
    // The trailing part must be Latin-only: 「家里的Wi-Fi密码是多少？」 is one Chinese sentence with an
    // inline token, not 「家里的」 + an English line.
    if (isSubtitleLikeChinese(zhPart) && hanChars(enPart) === 0 && isSubtitleLikeEnglish(enPart)) {
      return `${zhPart}\n${enPart}`;
    }
  }

  const enFirstMatch = view.match(/^([A-Za-z][\s\S]*?[A-Za-z][，。！？）】」；：”"'.,!?\s-]*)([一-龥][\s\S]*)$/);
  if (enFirstMatch) {
    const enPart = enFirstMatch[1].trim();
    const zhPart = enFirstMatch[2].trim();
    if (isSubtitleLikeEnglish(enPart) && isSubtitleLikeChinese(zhPart)) {
      return `${zhPart}\n${enPart}`;
    }
  }

  return view;
}



type CueLanguage = 'zh' | 'foreign' | 'mixed' | 'unknown';

export const detectCueLanguage = (text: string): CueLanguage => {
  const clean = cleanSubtitleContent(text).replace(/[♪♫♬]/g, '').trim();
  const hasKana = /[\u3040-\u30ff\u31f0-\u31ff]/.test(clean);
  const hasHangul = /[\uac00-\ud7af\u1100-\u11ff]/.test(clean);
  const hasZh = /[一-龥]/.test(clean) && !hasKana;
  const hasLatin = /[A-Za-z]/.test(clean);
  if (hasZh && (hasLatin || hasKana || hasHangul)) return 'mixed';
  if (hasZh) return 'zh';
  if (hasLatin || hasKana || hasHangul) return 'foreign';
  return 'unknown';
};

export const BILINGUAL_SECONDARY_SHARE = 0.4;
/** Lower bar when the filename itself says bilingual (中英 / bilingual / dual-sub). */
export const BILINGUAL_SECONDARY_SHARE_WITH_HINT = 0.2;

const latinWordCount = (value: string): number =>
  (value.match(/[A-Za-z\u00c0-\u024f]+(?:['’][A-Za-z]+)?/g) || []).length;

/**
 * A Latin-script line that reads as a subtitle sentence, not an inline token: no Han/kana/Hangul
 * and at least two words (「Welcome back.」 yes; 「OK」「iPhone」「Wi-Fi」 no).
 */
export function isSentenceLevelLatinLine(line: string): boolean {
  const clean = cleanSubtitleContent(line).replace(/[♪♫♬]/g, '').trim();
  if (!clean || /[一-龥\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(clean)) return false;
  return latinWordCount(clean.replace(/-/g, '')) >= 2;
}
