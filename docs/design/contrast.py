#!/usr/bin/env python3
"""WCAG 2.x contrast check for paper-tokens. Run: python3 docs/design/contrast.py
Values mirror src/styles/paper-tokens.css; alpha fills are composited over their surface."""
import sys

def hx(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mix(fg, bg, a):  # fg at alpha a over bg (sRGB, same as color-mix in srgb)
    f, b = hx(fg), hx(bg); return '#%02x%02x%02x' % tuple(round(f[i]*a + b[i]*(1-a)) for i in range(3))
def lum(h):
    def c(v):
        v /= 255; return v/12.92 if v <= 0.03928 else ((v+0.055)/1.055)**2.4
    r, g, b = (c(v) for v in hx(h)); return 0.2126*r + 0.7152*g + 0.0722*b
def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la+0.05)/(lb+0.05)

L = dict(  # light / paper (default)
    desk='#F2ECE1', sheet='#FAF7F0', raised='#FFFDF8', sunken='#EAE3D6',
    ink_strong='#1C1A17', ink_body='#3A352E', ink_muted='#5F584E', ink_faint='#8A8276', ink_placeholder='#736B60',
    rule_hair='#DCD3C4', rule_strong='#B9AE9C', rule_control='#8C8375', rule_ledger='#1C1A17',
    accent='#7A2233', accent_hover='#8C2B3D', accent_press='#651A29', accent_ink='#FFF8F1',
    danger='#B0361C', warning='#8A5A0B', success='#2D6640', info='#2E5A84', focus='#2E5A84',
    chrome='#1F3A33',
)
D = dict(  # theater (lights-off) dark scope
    desk='#121110', sheet='#1A1917', raised='#23211E', sunken='#0D0C0B',
    ink_strong='#EEE8DC', ink_body='#D6CFC2', ink_muted='#A39B8E', ink_faint='#7A7368', ink_placeholder='#968E82',
    rule_hair='#33302B', rule_strong='#4A4640', rule_control='#7A7368',
    accent='#D06276', accent_hover='#DC7A8C', accent_press='#C85B6F', accent_ink='#170D0F', accent_text='#E59AAA',
    danger='#EE7B5E', warning='#E0B05C', success='#7DBE8F', info='#86AEDB', focus='#86AEDB',
)
C = dict(  # chrome (forest trays) scope
    bg='#1F3A33', bg_raised='#28463E', ink='#F2ECE1', ink_muted='#C4CCC2', ink_faint='#93A39A',
    rule='#3B5A51', rule_control='#7F998F', ink_body='#E3DDD1', placeholder='#A7B4AB', active_bg='#FAF7F0', active_ink='#1C1A17', accent_text='#F0B3BE', focus='#A9C8EA',
)
rows = []
def chk(name, fg, bg, need):
    r = ratio(fg, bg); rows.append((name, fg, bg, r, need, r >= need))

# --- light text on surfaces
for s in ('desk', 'sheet', 'raised', 'sunken'):
    chk(f'ink-strong on paper-{s}', L['ink_strong'], L[s], 4.5)
    chk(f'ink-body on paper-{s}', L['ink_body'], L[s], 4.5)
    chk(f'ink-muted on paper-{s}', L['ink_muted'], L[s], 4.5)
    chk(f'accent (as text) on paper-{s}', L['accent'], L[s], 4.5)
    chk(f'danger on paper-{s}', L['danger'], L[s], 4.5)
    chk(f'warning on paper-{s}', L['warning'], L[s], 4.5)
    chk(f'success on paper-{s}', L['success'], L[s], 4.5)
    chk(f'info on paper-{s}', L['info'], L[s], 4.5)
chk('ink-placeholder on paper-raised (input)', L['ink_placeholder'], L['raised'], 4.5)
chk('ink-faint on paper-sheet (non-text/disabled; 3:1 UI)', L['ink_faint'], L['sheet'], 3.0)
chk('ink-faint on paper-sunken (disabled label; exempt, info only)', L['ink_faint'], L['sunken'], 0)
# soft fills (alpha) carrying text
asoft = mix(L['accent'], L['sheet'], 0.10)
chk('ink-strong on accent-soft (selected row)', L['ink_strong'], asoft, 4.5)
chk('accent on accent-soft (selected chip)', L['accent'], asoft, 4.5)
for k in ('danger', 'warning', 'success', 'info'):
    soft = mix(L[k], L['sheet'], 0.10)
    chk(f'{k} on {k}-soft', L[k], soft, 4.5)
    chk(f'ink-strong on {k}-soft', L['ink_strong'], soft, 4.5)
hover = L['sunken']
chk('ink-strong on row hover (paper-sunken)', L['ink_strong'], hover, 4.5)
# buttons
chk('accent-ink on accent (primary btn)', L['accent_ink'], L['accent'], 4.5)
chk('accent-ink on accent-hover', L['accent_ink'], L['accent_hover'], 4.5)
chk('accent-ink on accent-press', L['accent_ink'], L['accent_press'], 4.5)
chk('accent-ink on danger (confirm danger btn)', L['accent_ink'], L['danger'], 4.5)
chk('ink-faint on paper-sunken (disabled btn label)', L['ink_faint'], L['sunken'], 0)
# non-text UI (3:1)
chk('rule-control vs paper-raised (input/btn border, 1.4.11)', L['rule_control'], L['raised'], 3.0)
chk('rule-control vs paper-sheet', L['rule_control'], L['sheet'], 3.0)
chk('rule-strong vs paper-sheet (group divider, decorative)', L['rule_strong'], L['sheet'], 0)
chk('focus ring vs paper-sheet', L['focus'], L['sheet'], 3.0)
chk('focus ring vs accent fill (adjacent, 1.4.11)', L['focus'], L['accent'], 1.0)
chk('rule-hair vs paper-sheet (decorative divider, no req)', L['rule_hair'], L['sheet'], 0)
chk('accent vs paper-sheet (primary btn boundary)', L['accent'], L['sheet'], 3.0)
# --- chrome (forest trays)
chk('chrome ink on chrome-bg', C['ink'], C['bg'], 4.5)
chk('chrome ink-muted on chrome-bg', C['ink_muted'], C['bg'], 4.5)
chk('chrome ink-faint on chrome-bg (3:1 icons)', C['ink_faint'], C['bg'], 3.0)
chk('chrome ink on chrome-bg-raised', C['ink'], C['bg_raised'], 4.5)
chk('chrome ink-muted on chrome-bg-raised', C['ink_muted'], C['bg_raised'], 4.5)
chk('chrome active-ink on active-bg (current step)', C['active_ink'], C['active_bg'], 4.5)
chk('chrome accent-text on chrome-bg', C['accent_text'], C['bg'], 4.5)
chk('chrome ink-body on chrome-bg', C['ink_body'], C['bg'], 4.5)
chk('chrome placeholder on chrome-bg-raised', C['placeholder'], C['bg_raised'], 4.5)
chk('chrome rule-control vs chrome-bg-raised', C['rule_control'], C['bg_raised'], 3.0)
chk('chrome accent-text on chrome-bg-raised', C['accent_text'], C['bg_raised'], 4.5)
chk('chrome focus vs chrome-bg', C['focus'], C['bg'], 3.0)
chk('chrome rule vs chrome-bg (decorative)', C['rule'], C['bg'], 0)
# --- theater dark
for s in ('desk', 'sheet', 'raised'):
    for k in ('ink_strong', 'ink_body', 'ink_muted', 'accent_text', 'danger', 'warning', 'success', 'info'):
        chk(f'[theater] {k.replace("_","-")} on paper-{s}', D[k], D[s], 4.5)
chk('[theater] ink-placeholder on raised', D['ink_placeholder'], D['raised'], 4.5)
chk('[theater] accent-ink on accent (btn)', D['accent_ink'], D['accent'], 4.5)
chk('[theater] accent-ink on accent-hover', D['accent_ink'], D['accent_hover'], 4.5)
chk('[theater] rule-strong vs raised (decorative)', D['rule_strong'], D['raised'], 0)
chk('[theater] rule-control vs raised', D['rule_control'], D['raised'], 3.0)
chk('[theater] accent-ink on accent-press', D['accent_ink'], D['accent_press'], 4.5)
chk('[theater] focus vs sheet', D['focus'], D['sheet'], 3.0)
dsoft = mix(D['accent'], D['sheet'], 0.18)
chk('[theater] ink-strong on accent-soft', D['ink_strong'], dsoft, 4.5)

bad = [r for r in rows if not r[5]]
w = max(len(r[0]) for r in rows)
print(f"{'pair'.ljust(w)}  fg       bg       ratio  need  ok")
for n, f, b, r, need, ok in rows:
    print(f"{n.ljust(w)}  {f}  {b}  {r:5.2f}  {need:>4}  {'PASS' if ok else 'FAIL'}")
print(f"\n{len(rows)} pairs, {len(bad)} fail")
sys.exit(1 if bad else 0)
