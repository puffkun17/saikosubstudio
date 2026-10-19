# Agent notes — SaikoSubStudio

## Design source of truth

- Product/visual rules: `DESIGN.md`
- Tokens: `app/globals.css` (`--v5-*`). Brand orange `#ef8d5f`, forest `#1a3d37`. **No new palettes.**
- Selected / active chrome: **orange fill + forest green text** (same pair as the workflow stepper fill).
- Avoid iconic big-tech chrome (generic purple gradients, Inter-only stacks, glassmorphism kits).
- **Mouse-first.** Do not add keyboard shortcuts; keep normal focusability and visible focus rings.

## Motion

- Use **`motion/react` only** (not `framer-motion`).
- Respect `prefers-reduced-motion` / `useReducedMotion()`.
- Returning to 导入 must not replay empty-shell fade-ins (`AnimatePresence initial={false}`).

## Notices (one message, one place)

Interaction logic follows Fluent 2 Toast vs MessageBar **usage** (not their visuals):

| Kind | Channel | Behavior |
| --- | --- | --- |
| Transient / non-critical (export done, gate tap, soft status) | **Toast** | Upsert by `id`, ≤3 visible, auto-dismiss, pause on hover, `aria-live="polite"`. Mobile: above bottom tab bar. Desktop: consistent corner/dock. |
| Persistent / actionable (import needs-attention, blocking errors) | **Inline MessageBar** in the step | Manual dismiss only; errors `assertive`. |
| Surface-owned (film match strip, continue-CTA hint) | **Contextual** | Rendered only by that owner; excluded from the toast dock. |

Gating (工作台 / 预览 with no workbench data): stay on Import, briefly highlight add-files, show **one** short toast (`id: gate-no-files`, ~3s). No persistent tray callout.

Never show the same copy in two places.

## Skills

| Skill | Path | Use for |
| --- | --- | --- |
| `impeccable` | `.agents/skills/impeccable` | Design craft, polish, anti-slop commands |
| `grilling` / `grill-me` | `.agents/skills/grilling`, `grill-me` | Stress-test plans |
| `web-design-guidelines` | `.agents/skills/web-design-guidelines` | Audit against Vercel Web Interface Guidelines |
| `ui-animation` | `.agents/skills/ui-animation` | Motion in tsx/css (`motion/react`, reduced-motion) |
| `a11y-lite` | `.agents/skills/a11y-lite` | Contrast, semantics, notice live regions (no shortcuts) |

Lockfile: `skills-lock.json` (source + commit/hash).

Note: `.github/skills/impeccable` is a **separate** copy wired by `.github/hooks/impeccable.json` for Copilot hooks — do not delete without retargeting that hook.
