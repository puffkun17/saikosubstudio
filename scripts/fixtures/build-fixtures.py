#!/usr/bin/env python3
"""Build the SYNTHETIC subtitle fixtures used by `npm run test:core`.

Every line below is self-written everyday dialogue: no proper nouns, no plot, no real subtitles.
Re-run after editing:  python3 scripts/fixtures/build-fixtures.py
then re-record snapshots:  UPDATE_GOLDEN=1 npm run test:core
Legacy encodings (GBK / Big5 / Shift-JIS / EUC-KR) are produced here with Python codecs, so the
committed bytes are reproducible from this file.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def ass_ts(sec):
    cs = int(round(sec * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def srt(cues, crlf=False):
    out = []
    for i, (start, end, text) in enumerate(cues, 1):
        out.append(f"{i}\n{ts(start)} --> {ts(end)}\n{text}\n")
    body = "\n".join(out)
    return body.replace("\n", "\r\n") if crlf else body


def write(rel, text, encoding="utf-8"):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(text.encode(encoding))


# ---------------------------------------------------------------------------------------------
# A. Everyday SRT pair (zh-Hans + en): offsets (+0.1–0.2 s), a split English cue, overlaps,
#    orphans on both sides, credit, sound caption, sign with {\an8}, dash lines, lyrics,
#    long lines, mixed CJK/Latin, numbers, URL.
ZH_A = [
    (1.0, 3.0, "字幕制作：测试样本组"),
    (4.0, 6.2, "你今天怎么这么早就起来了"),
    (6.5, 9.0, "我睡不着 干脆起来煮点咖啡"),
    (9.2, 12.8, "你要不要也来一杯 我煮了一大壶 够我们两个人喝一整个上午"),
    (13.0, 15.0, "- 好啊 - 加不加糖"),
    (15.2, 17.5, "（水壶鸣响）"),
    (18.0, 21.5, "楼下那家店的新iPhone壳打八折 我昨天顺手买了一个"),
    (22.0, 25.0, "一共是128.50元 比网上便宜了差不多30块"),
    (25.5, 29.0, "说明书上写着去 https://example.com/help/setup?step=2 下载App"),
    (29.5, 31.0, "{\\an8}营业时间 9:00-21:00"),
    (31.5, 35.0, "其实我一直想跟你说 下个月我可能要搬到离公司近一点的地方去住"),
    (35.5, 37.0, "真的吗"),
    (37.2, 40.0, "嗯 每天通勤两个小时 实在是太累了"),
    (40.5, 43.5, "♪ 窗外的雨一直下 ♪"),
    (44.0, 47.8, "那周末我帮你一起看房子吧 顺便去吃那家我们一直说要去的面馆"),
    (48.0, 50.0, "好 就这么说定了！"),
    (52.0, 54.0, "她走了以后，房间突然安静了下来。"),
    (54.5, 57.0, "喂？我在家 你到楼下了吗"),
    (57.1, 58.5, "我马上下来"),
]
EN_A = [
    (4.1, 6.3, "Why are you up so early today?"),
    (6.6, 9.1, "I couldn't sleep,\nso I figured I'd make some coffee."),
    (9.3, 12.9, "Do you want a cup too? I made a big pot,\nenough for both of us to drink all morning."),
    (13.1, 15.1, "- Sure.\n- Sugar?"),
    (15.3, 17.6, "[kettle whistling]"),
    (18.1, 21.6, "The shop downstairs has phone cases at 20% off,\nso I grabbed one yesterday."),
    (22.1, 25.1, "It came to 128.50 in total,\nabout 30 cheaper than online."),
    (25.6, 29.1, "The manual says to go to\nhttps://example.com/help/setup?step=2 and get the app."),
    (29.6, 31.1, "{\\an8}OPEN 9 AM - 9 PM"),
    (31.6, 33.2, "There's something I've been meaning to tell you."),
    (33.3, 35.1, "I might move closer to work next month."),
    (35.6, 37.1, "Really?"),
    (37.3, 40.1, "Yeah. Two hours of commuting every day\nis just too much."),
    (40.6, 43.6, "♪ The rain keeps falling outside ♪"),
    (44.1, 47.9, "Then let me help you look at places this weekend, and we can finally try that noodle place we keep talking about."),
    (48.1, 50.1, "Deal!"),
    (50.5, 51.5, "[door closes]"),
    (54.3, 56.0, "Hello? I'm home. Are you downstairs?"),
    (56.1, 57.4, "I'll come down."),
]
write("golden/everyday-srt/zh.srt", srt(ZH_A))
write("golden/everyday-srt/en.srt", srt(EN_A))

# B. zh-Hant track stored as Big5 bytes (CRLF, like old Windows tools) + English.
HANT_B = [
    (1.0, 3.0, "字幕製作：測試樣本組"),
    (4.0, 6.2, "你今天怎麼這麼早就起來了"),
    (6.5, 9.0, "我睡不著 乾脆起來煮點咖啡"),
    (9.2, 12.8, "你要不要也來一杯 我煮了一大壺 夠我們兩個人喝一整個上午"),
    (13.0, 15.0, "- 好啊 - 加不加糖"),
    (18.0, 21.5, "樓下那家店的手機殼打八折 我昨天順手買了一個"),
    (22.0, 25.0, "一共是128.50元 比網上便宜了差不多30塊"),
    (31.5, 35.0, "其實我一直想跟你說 下個月我可能要搬到離公司近一點的地方去住"),
    (35.5, 37.0, "真的嗎"),
    (37.2, 40.0, "嗯 每天通勤兩個小時 實在是太累了"),
]
EN_B = [c for c in EN_A if c[0] < 41 and c[0] not in (15.3, 25.6, 29.6)]
write("golden/everyday-hant-big5/zh.srt", srt(HANT_B, crlf=True), "big5")
write("golden/everyday-hant-big5/en.srt", srt(EN_B, crlf=True))

# C. Styled ASS (zh) + English SRT: styles, \pos, \an8/\an7, \fad, \N source breaks, a 3-line
#    sign, italic override, a vector drawing, a Comment line, a long unpunctuated line.
ASS_HEAD = """[Script Info]
; Synthetic test script
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK SC,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,40,40,50,1
Style: Sign,Noto Sans CJK SC,52,&H00FFFFFF,&H000000FF,&H00202020,&H00000000,1,0,0,0,100,100,0,0,1,2,0,8,40,40,40,1
Style: Note,Noto Sans CJK SC,44,&H00E0E0E0,&H000000FF,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,2,0,7,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ASS_C = [
    ("Comment", 0.0, 1.0, "Default", "这一行是注释 不应该被导入"),
    ("Dialogue", 1.0, 3.5, "Default", "早上好\\N今天天气还不错"),
    ("Dialogue", 2.0, 5.0, "Sign", "{\\an8\\pos(960,80)\\fad(200,200)}便利店\\N二十四小时营业\\N欢迎光临"),
    ("Dialogue", 4.0, 6.5, "Default", "{\\i1}我就随便说说{\\i0} 你别当真"),
    ("Dialogue", 5.0, 6.0, "Sign", "{\\an7\\pos(40,40)\\p1}m 0 0 l 300 0 300 120 0 120{\\p0}"),
    ("Dialogue", 7.0, 11.0, "Default", "这个周末如果不下雨的话我们就去河边骑车然后在草地上野餐好不好"),
    ("Dialogue", 11.5, 15.5, "Default", "我刚刚看了一下\\N明天早上七点半出发应该来得及\\N不过今晚要早点睡"),
    ("Dialogue", 16.0, 18.0, "Note", "{\\an7\\pos(40,40)}第二天早上"),
    ("Dialogue", 18.5, 21.0, "Default", "{\\fad(150,150)}闹钟响了三次 我才终于爬起来"),
]
EN_C = [
    (1.1, 3.6, "Good morning.\nNice weather today."),
    (4.1, 6.6, "I'm just saying, don't take it seriously."),
    (7.1, 11.1, "If it doesn't rain this weekend, let's ride along the river and have a picnic on the grass."),
    (11.6, 15.6, "I just checked. If we leave at 7:30 tomorrow morning we'll make it, but we should sleep early tonight."),
    (18.6, 21.1, "The alarm went off three times before I finally got up."),
]
write("golden/everyday-ass-styled/zh.ass", ASS_HEAD + "\n".join(f"{kind}: 0,{ass_ts(a)},{ass_ts(b)},{style},,0,0,0,,{text}" for kind, a, b, style, text in ASS_C) + "\n")
write("golden/everyday-ass-styled/en.srt", srt(EN_C))

# D. Single bilingual ASS file (zh on top, en below via \N{\rEN}).
BI_HEAD = ASS_HEAD.replace(
    "Style: Note,", "Style: EN,Arial,40,&H00D0D0D0,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,50,1\nStyle: Note,"
)
BI_D = [
    (1.0, 3.0, "Default", "你吃饭了吗\\N{\\rEN}Have you eaten yet?"),
    (3.2, 5.5, "Default", "还没 我在等外卖\\N{\\rEN}Not yet, I'm waiting for a delivery."),
    (5.8, 9.5, "Default", "外卖都等了快一个小时了 我觉得他们可能把我的订单给忘了\\N{\\rEN}It's been almost an hour. I think they might have forgotten my order."),
    (10.0, 12.0, "Sign", "{\\an8}订单已送达\\N{\\rEN}{\\an8}ORDER DELIVERED"),
    (12.5, 14.5, "Default", "- 终于来了 - 快开门\\N{\\rEN}- Finally!\\N- Get the door!"),
    (15.0, 18.0, "Default", "下次我们还是自己做饭吧\\N{\\rEN}Next time, let's just cook ourselves."),
]
write("golden/everyday-bilingual-ass/bilingual.ass", BI_HEAD + "\n".join(f"Dialogue: 0,{ass_ts(a)},{ass_ts(b)},{style},,0,0,0,,{text}" for a, b, style, text in BI_D) + "\n")

# E. zh-Hans in GBK + Japanese in Shift-JIS.
ZH_E = [
    (1.0, 3.0, "这家店的咖啡真好喝"),
    (3.5, 6.0, "下次我们再来吧"),
    (6.5, 10.0, "我们坐在靠窗的位置吧 那边阳光比较好 也比较安静"),
    (10.5, 12.0, "好的"),
    (12.5, 15.0, "你要点什么 我请客"),
]
JA_E = [
    (1.1, 3.1, "この店のコーヒー、本当においしいね。"),
    (3.6, 6.1, "また今度来よう。"),
    (6.6, 10.1, "窓際の席に座ろうよ。あっちのほうが日当たりがよくて、静かだから。"),
    (10.6, 12.1, "いいよ。"),
    (12.6, 15.1, "何にする？おごるよ。"),
]
write("golden/everyday-ja-sjis/zh.srt", srt(ZH_E), "gbk")
write("golden/everyday-ja-sjis/ja.srt", srt(JA_E), "shift_jis")

# F. zh-Hans (UTF-8) + Korean in EUC-KR.
ZH_F = [
    (1.0, 3.0, "今天下班以后要不要一起去散步"),
    (3.5, 6.0, "好啊 我也想出去走走"),
    (6.5, 10.5, "公园旁边新开了一家小面包店 听说他们的牛角包每天下午就卖完了"),
    (11.0, 13.0, "那我们早点出发"),
]
KO_F = [
    (1.2, 3.2, "오늘 퇴근하고 같이 산책할래?"),
    (3.7, 6.2, "좋아, 나도 바람 좀 쐬고 싶었어."),
    (6.7, 10.7, "공원 옆에 작은 빵집이 새로 생겼는데 크루아상이 매일 오후면 다 팔린대."),
    (11.2, 13.2, "그럼 우리 일찍 출발하자."),
]
write("golden/everyday-ko-euckr/zh.srt", srt(ZH_F))
write("golden/everyday-ko-euckr/ko.srt", srt(KO_F), "euc-kr")

# G. zh-Hans + French (accents, « », non-breaking spaces before ? and !).
ZH_G = [
    (1.0, 3.0, "你能帮我拿一下那个盒子吗"),
    (3.5, 6.0, "当然可以 放在哪里"),
    (6.5, 10.5, "放在门口的桌子上就好 等一下我下楼的时候顺便带走"),
    (11.0, 13.0, "没问题！"),
]
FR_G = [
    (1.1, 3.1, "Tu peux me passer cette boîte\u00a0?"),
    (3.6, 6.1, "Bien sûr. Je la mets où\u00a0?"),
    (6.6, 10.6, "Pose-la sur la table près de l'entrée, je la prendrai en descendant tout à l'heure, d'accord\u00a0?"),
    (11.1, 13.1, "« Pas de problème\u00a0! »"),
]
write("golden/everyday-fr/zh.srt", srt(ZH_G))
write("golden/everyday-fr/fr.srt", srt(FR_G))

# Encoding fixtures: identical text in a legacy encoding + its UTF-8 reference.
ENC = {
    "zh-hans": (ZH_A[1:9] + ZH_A[10:13], "gbk"),
    "zh-hant": (HANT_B, "big5"),
    "zh-hant-in-gbk": (HANT_B, "gbk"),  # Traditional characters stored as GBK must stay GBK
    "ja": (JA_E, "shift_jis"),
    "ko": (KO_F, "euc-kr"),
}
for name, (cues, enc) in ENC.items():
    text = srt([c for c in cues if "♪" not in c[2]], crlf=True)
    write(f"encoding/{name}.{enc.replace('_', '-')}.srt", text, enc)
    write(f"encoding/{name}.utf8.srt", text)

print("fixtures written to", ROOT)
