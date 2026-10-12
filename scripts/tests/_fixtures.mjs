// Synthetic, everyday dialogue only (no real subtitle text in the repo).
export const LINES_EN = [
  'Morning. Did you sleep okay?', 'Not really, the neighbours were loud.', 'Want some coffee?', 'Yes, please. Two sugars.',
  'Where did I leave my keys?', 'They are on the kitchen table.', 'Thanks. I am running late again.', 'Take an umbrella, it might rain.',
  'Can you pick up some bread later?', 'Sure, anything else?', 'Maybe some eggs and milk.', 'Got it. See you tonight.',
  'How was work today?', 'Busy, but fine.', 'Let us order pizza.', 'Good idea, I am too tired to cook.',
  'Did you call your mother?', 'I will call her tomorrow.', 'The bus was late again.', 'You should try cycling.',
  'Is the shop still open?', 'Until nine, I think.', 'I need a new phone charger.', 'Use mine for now.',
  'Shall we walk the dog?', 'Give me five minutes.', 'It is colder than yesterday.', 'Wear the blue jacket.',
  'What time is the dentist?', 'Half past three.', 'Do not forget the tickets.', 'They are in my bag.',
  'Can I borrow your pen?', 'Here you go.', 'The printer is jammed again.', 'Turn it off and on.',
  'Lunch at noon?', 'Make it one o\'clock.', 'Fine by me.', 'See you there.',
];
export const LINES_ZH = [
  '早上好，睡得好吗？', '不太好，邻居太吵了。', '要喝咖啡吗？', '好的，加两块糖。', '我的钥匙放哪了？', '在厨房桌子上。', '谢谢，我又要迟到了。', '带把伞，可能会下雨。',
  '晚点能买点面包吗？', '好啊，还要别的吗？', '再买点鸡蛋和牛奶。', '知道了，晚上见。', '今天工作怎么样？', '挺忙的，还行。', '我们点披萨吧。', '好主意，我累得不想做饭。',
  '你给你妈打电话了吗？', '我明天打。', '公交车又晚点了。', '你该试试骑车。', '商店还开着吗？', '我想开到九点。', '我需要一个新的充电器。', '先用我的吧。',
  '去遛狗吗？', '给我五分钟。', '比昨天冷。', '穿那件蓝外套。', '牙医是几点？', '三点半。', '别忘了带票。', '在我包里。',
  '能借你的笔吗？', '给你。', '打印机又卡纸了。', '关掉再开一下。', '中午吃饭？', '改成一点吧。', '我没问题。', '到时见。',
];
export const LINES_JA = LINES_EN.map((_, i) => `おはよう、今日は${i + 1}番目の話だね。`);

const pad = (n, w = 2) => String(n).padStart(w, '0');
export const srtTs = (ms) => `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
export const assTs = (ms) => `${Math.floor(ms / 3600000)}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor((ms % 1000) / 10))}`;

/** Deterministic timeline: seed changes gaps/durations (different episode ≈ different seed). */
export function timeline(n, seed = 1, offsetMs = 0, jitterMs = 0) {
  let x = seed * 9301 + 49297;
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  let y = 7;
  const jit = () => { y = (y * 9301 + 49297) % 233280; return (y / 233280 - 0.5) * 2 * jitterMs; };
  const out = [];
  let t = 2000 + Math.floor(rnd() * 3000);
  for (let i = 0; i < n; i++) {
    const dur = 1200 + Math.floor(rnd() * 2200);
    const j = jitterMs ? Math.floor(jit()) : 0;
    out.push({ start: t + offsetMs + j, end: t + dur + offsetMs + j });
    t += dur + 300 + Math.floor(rnd() * 4000);
  }
  return out;
}

export const toSrt = (lines, times) => lines.slice(0, times.length).map((l, i) => `${i + 1}\n${srtTs(times[i].start)} --> ${srtTs(times[i].end)}\n${l}\n`).join('\n');

export function toAss(events) {
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,40,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
    events.map((e) => `Dialogue: 0,${assTs(e.start)},${assTs(e.end)},${e.style},,0,0,0,,${e.text}`).join('\n') + '\n';
}
