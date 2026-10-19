---
name: ui-animation
description: >-
  Slim motion guidance for this repo's UI. Use when adding or reviewing
  animation in tsx/css. Prefer motion/react; respect prefers-reduced-motion.
license: MIT
metadata:
  adaptedFrom: mblode/agent-skills (skills/ui-animation)
  adaptedCommit: 81d0af2f6d4b32d791fb26caa82b17603ef4d807
---

# UI Animation (slim)

**Scope:** `**/*.{tsx,css}`, especially `src/components/**` and `app/**/*.css`.
**IS:** feedback, orientation, continuity for controls and step shells.
**IS NOT:** brand/palette work (see DESIGN.md / impeccable), marketing hero loops.

Attribution: adapted from [mblode/agent-skills `ui-animation`](https://github.com/mblode/agent-skills) (MIT). Keep this file small; do not vendor the full reference tree.

## Hard rules (this repo)

1. Import from `motion/react` only — never `framer-motion`.
2. Honor `prefers-reduced-motion` / `useReducedMotion()`: skip enter opacity/y, keep instant state.
3. Remounted shells (e.g. return to 导入) use `AnimatePresence initial={false}` and empty-state `initial={false}` so navigation does not flash.
4. Animate `transform` / `opacity` (and color) — not layout (`width`/`height`/`top`/`left`) unless a deliberate morph.
5. No `transition: all`. List properties.
6. Routine UI ≤ ~300ms; springs only for small snappy controls.

## Defaults

| Moment | Duration | Notes |
| --- | --- | --- |
| Press / hover color | 100–160ms | Instant press (`:active` 0ms) |
| Toast / callout | 150–220ms | Enter slightly slower than exit |
| Panel / drawer | 200–350ms | Exit faster than enter |
| Step shell crossfade | ≤240ms | Prefer `initial={false}` on return |

Shared presets live in `src/lib/motion.ts` (`transitionFast` / `transitionBase` / springs). Reuse them.

## When to animate

- Confirm in place when the control can show the result.
- Corner toasts only for background / no-origin results (see notice rules in AGENTS.md).
- Do not replay entry fades on every tab return.

## Review checklist

- [ ] `motion/react` import
- [ ] reduced-motion path tested
- [ ] no remount flash on 导入 ↔ 工作台
- [ ] no layout-property animation
