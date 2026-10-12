/**
 * Credit (署名) generation rules — data/logic only; the credit-block UI is PR #2.
 *
 * 1. Formal credits (「翻译：某某」「字幕：某某字幕组」) stay at their original timeline position by
 *    default. ~90% forced: `keepFormalInPlace` exists but the UI will hide it deep, with a warning.
 * 2. If the user appends their own「双语合并：」credit, the original translator credit must precede it
 *    and cannot be disabled (enforced here, not in UI).
 * 3. Scattered secondary statements (「…字幕组翻译，仅供学习交流」, 「本字幕由网友校订」, uploader
 *    watermarks) are removed from the timeline and summarised as an anonymous thanks appended after
 *    the formal credit: 「翻译：某某；另有网友校订」.
 * 4. Both are recorded in the ASS [Script Info] using proper fields: Original Translation /
 *    Original Editing / Original Timing / Script Updated By (the merging user). The user's name is
 *    never written into Original Script.
 */
export type CreditRole = 'translator' | 'editor' | 'timing' | 'proofreader' | 'publisher' | 'encoder' | 'other';

export interface FormalCredit { role: CreditRole; name: string; cueIndex: number; text: string; track: 'primary' | 'secondary' }
export interface SecondaryStatement { cueIndex: number; text: string; kind: 'disclaimer' | 'watermark' | 'proofread' | 'promo'; track: 'primary' | 'secondary' }

export interface CreditPlan {
  formal: FormalCredit[];
  secondary: SecondaryStatement[];
  anonymousThanks: string | null;
  /** Cue indexes to drop from the timeline (secondary statements only). */
  dropCueIndexes: number[];
  keepFormalInPlace: boolean;
  user?: { label: string; name: string; placement: 'after-last' | 'before-end' };
  scriptInfo: Record<string, string>;
}

const ROLE_PATTERNS: [CreditRole, RegExp][] = [
  ['translator', /^(?:字幕)?(?:翻译|翻譯|译者|譯者|听译|聽譯|translat(?:ion|ed by|or))\s*[:：]\s*(.+)$/i],
  ['proofreader', /^(?:校对|校對|校订|校訂|proofread(?:ing|er)?)\s*[:：]\s*(.+)$/i],
  ['editor', /^(?:后期|後期|特效|编辑|編輯|edit(?:ing|or)?)\s*[:：]\s*(.+)$/i],
  ['timing', /^(?:时间轴|時間軸|调轴|調軸|timing)\s*[:：]\s*(.+)$/i],
  ['encoder', /^(?:压制|壓制|encod(?:e|ing|er))\s*[:：]\s*(.+)$/i],
  ['publisher', /^(?:字幕(?:组|組)?|出品|制作|製作|subtitles? by)\s*[:：]\s*(.+)$/i],
];

const SECONDARY_PATTERNS: [SecondaryStatement['kind'], RegExp][] = [
  ['disclaimer', /(仅供|僅供|学习交流|學習交流|禁止(?:商用|用于商业)|请于下载后|請於下載後|24\s*小时内删除|for (?:study|learning) (?:purposes )?only)/i],
  ['proofread', /^(?:本字幕)?(?:由)?(?:网友|網友|热心观众|熱心觀眾).{0,8}(?:校订|校訂|校对|校對|修正)/],
  ['watermark', /(?:www\.|https?:\/\/|\.(?:com|net|tv|org|cn)\b|字幕(?:下载|下載)站|subhd|射手网|伪射手|assrt|opensubtitles|yts|rarbg)/i],
  ['promo', /(?:关注|關注|公众号|公眾號|微博|微信|telegram|discord|qq\s*群|招募|欢迎加入|歡迎加入)/i],
];

const clean = (t: string) => t.replace(/\{[^}]*\}/g, '').replace(/\\N|\n/g, ' ').replace(/\s+/g, ' ').trim();

export function classifyCreditCue(text: string): { kind: 'formal'; role: CreditRole; name: string } | { kind: 'secondary'; sub: SecondaryStatement['kind'] } | null {
  const c = clean(text);
  if (!c || c.length > 90) return null;
  // Scattered statements first: 「XX字幕组翻译，仅供学习交流」 is a disclaimer, not a formal credit.
  for (const [sub, re] of SECONDARY_PATTERNS) if (re.test(c)) return { kind: 'secondary', sub };
  for (const [role, re] of ROLE_PATTERNS) {
    const m = c.match(re);
    if (m) return { kind: 'formal', role, name: m[1].replace(/[。.]$/, '').trim().slice(0, 60) };
  }
  return null;
}

/** Credits live at the head/tail of a file; dialogue in the middle is never scanned. */
export function scanCredits(rows: { text: string }[], track: 'primary' | 'secondary', window = 12): { formal: FormalCredit[]; secondary: SecondaryStatement[] } {
  const formal: FormalCredit[] = [];
  const secondary: SecondaryStatement[] = [];
  const idx = new Set<number>();
  for (let i = 0; i < Math.min(window, rows.length); i++) idx.add(i);
  for (let i = Math.max(0, rows.length - window); i < rows.length; i++) idx.add(i);
  for (const i of [...idx].sort((a, b) => a - b)) {
    const r = classifyCreditCue(rows[i].text);
    if (!r) continue;
    if (r.kind === 'formal') formal.push({ role: r.role, name: r.name, cueIndex: i, text: clean(rows[i].text), track });
    else secondary.push({ cueIndex: i, text: clean(rows[i].text), kind: r.sub, track });
  }
  return { formal, secondary };
}

const ROLE_LABEL: Record<CreditRole, string> = { translator: '翻译', proofreader: '校对', editor: '后期', timing: '时间轴', encoder: '压制', publisher: '字幕', other: '署名' };
const SCRIPT_INFO_FIELD: Partial<Record<CreditRole, string>> = { translator: 'Original Translation', editor: 'Original Editing', proofreader: 'Original Editing', timing: 'Original Timing', publisher: 'Original Translation' };

export function summarizeAnonymousThanks(secondary: SecondaryStatement[]): string | null {
  if (secondary.some((s) => s.kind === 'proofread')) return '另有网友校订';
  if (secondary.some((s) => s.kind === 'disclaimer')) return '另有网友参与制作';
  return null;
}

export function planCredits(input: {
  primaryRows: { text: string }[];
  secondaryRows?: { text: string }[];
  user?: { name: string; label?: string; placement?: 'after-last' | 'before-end' };
  keepFormalInPlace?: boolean;
}): CreditPlan {
  const p = scanCredits(input.primaryRows, 'primary');
  const s = input.secondaryRows ? scanCredits(input.secondaryRows, 'secondary') : { formal: [], secondary: [] };
  const formal = [...p.formal, ...s.formal];
  const secondary = [...p.secondary, ...s.secondary];
  const anonymousThanks = summarizeAnonymousThanks(secondary);
  const scriptInfo: Record<string, string> = {};
  for (const f of formal) {
    const field = SCRIPT_INFO_FIELD[f.role];
    if (!field) continue;
    scriptInfo[field] = scriptInfo[field] ? `${scriptInfo[field]}; ${f.name}` : f.name;
  }
  if (anonymousThanks) scriptInfo['Original Translation'] = [scriptInfo['Original Translation'], anonymousThanks].filter(Boolean).join('；');
  const user = input.user?.name?.trim()
    ? { label: input.user.label?.trim() || '双语合并', name: input.user.name.trim(), placement: input.user.placement || 'after-last' as const }
    : undefined;
  if (user) scriptInfo['Script Updated By'] = user.name;
  return {
    formal,
    secondary,
    anonymousThanks,
    dropCueIndexes: secondary.filter((x) => x.track === 'primary').map((x) => x.cueIndex),
    keepFormalInPlace: input.keepFormalInPlace ?? true,
    user,
    scriptInfo,
  };
}

/**
 * Closing credit line(s). Rule 2: when the user adds their own credit, the original translator
 * credit is emitted first and this cannot be turned off.
 *   「翻译：某某；另有网友校订」 then 「双语合并：Derek」
 */
export function buildClosingCreditLines(plan: CreditPlan): string[] {
  const translators = plan.formal.filter((f) => f.role === 'translator' || f.role === 'publisher');
  const head = translators.length ? `${ROLE_LABEL.translator}：${[...new Set(translators.map((t) => t.name))].join('、')}` : '';
  const original = [head, plan.anonymousThanks].filter(Boolean).join('；');
  // In place, the formal credit (with the thanks appended) already precedes anything at the end.
  const originalAlreadyOnTimeline = plan.keepFormalInPlace && translators.length > 0;
  const lines: string[] = [];
  if (original && !originalAlreadyOnTimeline) lines.push(original);
  if (plan.user) lines.push(`${plan.user.label}：${plan.user.name}`);
  return lines;
}

/**
 * Apply the plan to merged rows: drop secondary statements, append the anonymous thanks to the
 * first in-place translator credit. Rows are {text} objects; indexes refer to the primary track.
 */
export function applyCreditPlan<T extends { text: string }>(rows: T[], plan: CreditPlan): T[] {
  const drop = new Set(plan.dropCueIndexes);
  const firstTranslator = plan.formal.find((f) => f.track === 'primary' && (f.role === 'translator' || f.role === 'publisher'));
  return rows.flatMap((row, i) => {
    if (drop.has(i)) return [];
    if (!plan.keepFormalInPlace && plan.formal.some((f) => f.track === 'primary' && f.cueIndex === i)) return [];
    if (plan.keepFormalInPlace && plan.anonymousThanks && firstTranslator?.cueIndex === i && !row.text.includes(plan.anonymousThanks)) {
      return [{ ...row, text: `${row.text}；${plan.anonymousThanks}` }];
    }
    return [row];
  });
}

/** [Script Info] lines in canonical order. Never contains the user's name in Original Script. */
export function scriptInfoLines(plan: CreditPlan): string[] {
  const order = ['Original Script', 'Original Translation', 'Original Editing', 'Original Timing', 'Script Updated By'];
  return order.filter((k) => plan.scriptInfo[k]).map((k) => `${k}: ${plan.scriptInfo[k].replace(/[\r\n]+/g, ' ')}`);
}
