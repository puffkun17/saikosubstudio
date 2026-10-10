# Test fixtures (synthetic)

Everything in this folder is **self-written synthetic text** — everyday colloquial dialogue, no proper
nouns, no plot, no excerpts from any real subtitle release. Regenerate the inputs with:

```bash
python3 scripts/fixtures/build-fixtures.py      # writes golden/*/ inputs and encoding/*
UPDATE_GOLDEN=1 npm run test:core               # re-records golden/*/expected/* — review the diff
npm run test:core                               # snapshot compare
```

Legacy encodings (GBK / Big5 / Shift-JIS / EUC-KR) are produced by the script from UTF-8 source, so the
byte files and their `.utf8.srt` siblings always match.

| Sample | Inputs | Covers |
| --- | --- | --- |
| `golden/everyday-srt` | `zh.srt` + `en.srt` | separate zh-Hans / en tracks with ~0.1 s offsets, overlaps, a split English cue, orphans on both sides, credit line, sound captions, `{\an8}` signs, two-speaker dash lines, ♪ lyrics, long lines, mixed CJK/Latin (iPhone), numbers (128.50 / 30 / 9:00-21:00), a URL, English source line breaks |
| `golden/everyday-hant-big5` | `zh.srt` (Big5, CRLF) + `en.srt` | zh-Hant track, Big5 decode, CRLF, `.zh-Hant` naming |
| `golden/everyday-ass-styled` | `zh.ass` + `en.srt` | ASS with styles (Default/Sign/Note), `Comment:` events, `\N`, 3-line `\an8\pos\fad` sign, italics override, `\p1` drawing, `\an7\pos` note, long unpunctuated line, 3-line dialogue |
| `golden/everyday-bilingual-ass` | `bilingual.ass` | single bilingual file (`zh\N{\rEN}en`) path |
| `golden/everyday-ja-sjis` | `zh.srt` (GBK) + `ja.srt` (Shift-JIS) | zh + ja pair (both CJK, kept as separate blocks), kana kinsoku |
| `golden/everyday-ko-euckr` | `zh.srt` + `ko.srt` (EUC-KR) | zh + ko pair, Hangul eojeol never split |
| `golden/everyday-fr` | `zh.srt` + `fr.srt` | French NBSP before `?`/`!`, « guillemets », accents |
| `detection/zh-inline-latin.{zh,en}.srt` | separate zh / en tracks | Chinese dialogue with inline Latin tokens (iPhone, OK, Wi-Fi, PDF, App and brand/tech words) and bare `OK` / `iPhone` cues must stay a Chinese track (not bilingual) so the English track binds as 原文 |
| `encoding/*` | `zh-hans.gbk`, `zh-hant.big5`, `zh-hant-in-gbk.gbk`, `ja.shift-jis`, `ko.euc-kr` (+ `.utf8.srt`) | encoding detection, incl. Traditional characters stored as GBK |

Spanish / Portuguese wrapping is covered by unit strings in `scripts/regression-subtitle-core.mjs`.
