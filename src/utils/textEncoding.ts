/**
 * Subtitle text decoding with a scoring detector (local only, no dependencies).
 *
 * Legacy CJK encodings overlap heavily: almost every Big5 / EUC-KR / Shift-JIS byte pair is also
 * a *valid* GBK pair, so "first decoder that does not throw" silently returns mojibake.
 * Instead we decode with every candidate that succeeds and score how natural the result looks.
 */

export interface DecodeResult {
  text: string;
  encoding: string;
}

/** Candidate legacy encodings, in tie-break order (WHATWG labels; supported by browsers and Node). */
const LEGACY_CANDIDATES = [
  { label: 'gb18030', name: 'gbk' },
  { label: 'big5', name: 'big5' },
  { label: 'shift_jis', name: 'shift_jis' },
  { label: 'euc-kr', name: 'euc-kr' },
] as const;

// ~300 most frequent characters in Simplified and Traditional Chinese subtitles / prose.
const COMMON_HANS = '的一是不了人我在有他这中大来上个国到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务制解各任至清物台象记边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连远资队跟带花快条院变联言权往展该领传近留红治决周保达办运武半候七必城父强步完深区即求品士转量空甚众技轻程告江语英基派满式李息写呢识极令黄德收脸钱倒未持取设始双历越史商千片容像找友孩站广改议形早房音火际则首单据导影失拿网香似专石若兵弟谁校读志飞观争究包组造落视喜离虽坏兴吗吧啊呀哦嗯谢别';
const COMMON_HANT = '的一是不了人我在有他這中大來上個國到說們為子和你地出道也時年得就那要下以生會自著去之過家學對可她裡後小麼心多天而能好都然沒日於起還發成事只作當想看文無開手十用主行方又如前所本見經頭面公同三已老從動兩長知民樣現分將外但身些與高意進把法此實回二理美點月明其種聲全工己話兒者向情部正名定女問力機給等幾很業最間新什打便位因重被走電四第門相次東政海口使教西再平真聽世氣信北少關並內加化由卻代軍產入先山五太水萬市眼體別處總才場師書比住員九笑性通目華報立馬命張活難神數件安表原車白應路期叫死常提感金何更反合放做系計或司利受光王果親界及今京務制解各任至清物台象記邊共風戰乾接它許八特覺望直服毛林題建南度統色字請交愛讓認算論百吃義科怎元社術結六功指思非流每青管夫連遠資隊跟帶花快條院變聯言權往展該領傳近留紅治決周保達辦運武半候七必城父強步完深區即求品士轉量空甚眾技輕程告江語英基派滿式李息寫呢識極令黃德收臉錢倒未持取設始雙歷越史商千片容像找友孩站廣改議形早房音火際則首單據導影失拿網香似專石若兵弟誰校讀志飛觀爭究包組造落視喜離雖壞興嗎吧啊呀哦嗯謝妳';
// Frequent Hangul syllables (particles, endings, common stems).
const COMMON_HANGUL = '이의가는을를에서하고다요지한나그도로게아어있수것들니기리사자해대보내주우마말면만라네없했시였거까세습니까안녕저우리너뭐왜잘좀정말같여기제데던일알할돼서죠';

const COMMON_HAN_SET = new Set([...COMMON_HANS, ...COMMON_HANT]);
const COMMON_HANGUL_SET = new Set([...COMMON_HANGUL]);

/** Average per-character plausibility of decoded text (higher = more natural). */
export function scoreDecodedText(text: string): number {
  let total = 0;
  let score = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) {
      // C0 controls other than tab / CR / LF never appear in real subtitles.
      if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) { total += 1; score -= 2; }
      continue;
    }
    total += 1;
    if (COMMON_HAN_SET.has(ch)) score += 1;
    else if (cp >= 0x3041 && cp <= 0x309f) score += 1; // hiragana
    else if (cp >= 0x30a0 && cp <= 0x30ff) score += 0.8; // full-width katakana
    else if (COMMON_HANGUL_SET.has(ch)) score += 1;
    else if (cp >= 0xac00 && cp <= 0xd7a3) score += 0.3; // other Hangul syllables
    else if ((cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff01 && cp <= 0xff5e) || cp === 0x2026 || cp === 0x2014 || (cp >= 0x2018 && cp <= 0x201d)) score += 0.5; // CJK punctuation
    else if (cp >= 0x4e00 && cp <= 0x9fff) score += 0; // valid but uncommon ideograph
    else if (
      (cp >= 0xe000 && cp <= 0xf8ff) // private use (unmapped GBK/Big5 slots)
      || (cp >= 0xff61 && cp <= 0xff9f) // half-width katakana (classic Shift-JIS mis-decode)
      || (cp >= 0x3400 && cp <= 0x4dbf) // CJK Ext-A
      || cp >= 0x20000 // supplementary ideographs
      || (cp >= 0xf900 && cp <= 0xfaff) // compatibility ideographs
      || cp === 0xfffd
      || (cp >= 0x80 && cp < 0xa0) // C1 controls
    ) score -= 1;
  }
  return total === 0 ? 0 : score / total;
}

const tryDecode = (buffer: ArrayBuffer | Uint8Array, label: string): string | null => {
  try {
    return new TextDecoder(label, { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
};

/** UTF-16 without BOM: many zero bytes on one side of each code unit. */
const guessBomlessUtf16 = (arr: Uint8Array): 'utf-16le' | 'utf-16be' | null => {
  const sample = Math.min(arr.length - (arr.length % 2), 4096);
  if (sample < 4) return null;
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < sample; i += 2) {
    if (arr[i] === 0) evenZero += 1;
    if (arr[i + 1] === 0) oddZero += 1;
  }
  const pairs = sample / 2;
  if (oddZero / pairs > 0.3 && evenZero / pairs < 0.05) return 'utf-16le';
  if (evenZero / pairs > 0.3 && oddZero / pairs < 0.05) return 'utf-16be';
  return null;
};

/**
 * Decode subtitle bytes: BOM → UTF-16 (BOM-less) → strict UTF-8 → best-scoring legacy encoding
 * among GBK/GB18030, Big5, Shift-JIS and EUC-KR.
 */
export function decodeBuffer(buffer: ArrayBuffer | Uint8Array): DecodeResult {
  const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (arr.length >= 2) {
    if (arr[0] === 0xFF && arr[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(arr), encoding: 'utf-16le (BOM)' };
    if (arr[0] === 0xFE && arr[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(arr), encoding: 'utf-16be (BOM)' };
  }
  if (arr.length >= 3 && arr[0] === 0xEF && arr[1] === 0xBB && arr[2] === 0xBF) {
    return { text: new TextDecoder('utf-8').decode(arr), encoding: 'utf-8 (BOM)' };
  }

  const utf16 = guessBomlessUtf16(arr);
  if (utf16) {
    const text = tryDecode(arr, utf16);
    if (text !== null) return { text, encoding: utf16 };
  }

  // Valid multi-byte UTF-8 is practically never produced by legacy CJK encodings.
  const utf8 = tryDecode(arr, 'utf-8');
  if (utf8 !== null) return { text: utf8, encoding: 'utf-8' };

  let best: DecodeResult | null = null;
  let bestScore = -Infinity;
  for (const candidate of LEGACY_CANDIDATES) {
    const text = tryDecode(arr, candidate.label);
    if (text === null) continue;
    const score = scoreDecodedText(text);
    if (score > bestScore + 1e-9) {
      best = { text, encoding: candidate.name };
      bestScore = score;
    }
  }
  if (best) return best;

  return { text: new TextDecoder('utf-8').decode(arr), encoding: 'utf-8 (fallback)' };
}
