#!/usr/bin/env python3
"""Check that the second-language fonts render every required Latin character (no tofu).

Reads SECOND_LANGUAGE_REQUIRED_CHARS from src/utils/exportPresets.ts and checks each font file's
cmap with fontTools. Font files are not in the repo (licensing / size): pass paths, or rely on the
defaults (Debian/Ubuntu `fonts-noto-cjk` + `fonts-liberation`).

    pip install fonttools
    python3 scripts/check-font-coverage.py [font.ttc|otf|ttf ...]
"""
import glob
import os
import re
import sys

from fontTools.ttLib import TTCollection, TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "src/utils/exportPresets.ts"), encoding="utf-8").read()
block = re.search(r"SECOND_LANGUAGE_REQUIRED_CHARS =([\s\S]*?);", src).group(1)
required = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), "".join(re.findall(r"'([^']*)'", block)))

gaps = set()
for a, b in re.findall(r"\[0x([0-9a-f]+), 0x([0-9a-f]+)\]", re.search(r"const SOURCE_HAN_LATIN_GAPS[^=]*=([\s\S]*?);", src).group(1)):
    gaps.update(range(int(a, 16), int(b, 16) + 1))
ext_b_src = re.search(r"SOURCE_HAN_LATIN_EXT_B = new Set\(\[([\s\S]*?)\]\);", src).group(1)
ext_b = {int(x, 16) for x in re.findall(r"0x([0-9a-f]+)(?![0-9a-f]* \+ i)", ext_b_src.split("...")[0])}
ext_b.update(range(0x1CD, 0x1DD))
ext_b.update({0x1F8, 0x1F9})
declared_missing = gaps | {cp for cp in range(0x180, 0x250) if cp not in ext_b} | {0x202F}

paths = sys.argv[1:] or (
    glob.glob("/usr/share/fonts/opentype/noto/NotoSansCJK-*.ttc")
    + glob.glob("/usr/share/fonts/truetype/liberation*/LiberationSans-*.ttf")
)
if not paths:
    sys.exit("no font files found; pass paths explicitly")

failed = False
for path in sorted(paths):
    fonts = TTCollection(path).fonts if path.lower().endswith(".ttc") else [TTFont(path)]
    for font in fonts:
        name = font["name"].getDebugName(4)
        if "Mono" in (name or ""):
            continue
        cmap = font.getBestCmap()
        missing = [f"U+{ord(c):04X} {c}" for c in required if ord(c) not in cmap]
        print(f"{'OK  ' if not missing else 'MISS'} {name}: {len(required) - len(missing)}/{len(required)}", *missing)
        failed = failed or bool(missing)
        if "CJK" in (name or ""):
            # The gap table in exportPresets.ts must match this font exactly (drives the Arial fallback).
            actual_missing = {cp for cp in list(range(0x100, 0x250)) + [0x202F] if cp not in cmap}
            if actual_missing != declared_missing:
                print("     gap table mismatch:", sorted(hex(c) for c in actual_missing ^ declared_missing))
                failed = True
sys.exit(1 if failed else 0)
