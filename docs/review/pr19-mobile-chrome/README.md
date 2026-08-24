# PR19 — mobile chrome review shots

Viewport captures for narrow-width workflow tab relocation.

| File | Viewport | Expect |
|------|----------|--------|
| `375x667.png` | iPhone SE-ish | Bottom 导入/工作台/预览 equal segments; top = menu + mark + essentials |
| `390x844.png` | iPhone 12-ish | Same IA |
| `844x390.png` | Landscape short | Top tabs remain; formats footnote reachable |
| `375x667-gated-toast.png` | 375 + tap 工作台 | Toast「请先添加字幕」 |

Measured (headless): at 375px, bottom segments ≈117×44px each.
