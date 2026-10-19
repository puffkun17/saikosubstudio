---
name: a11y-lite
description: >-
  Lightweight a11y for this product: contrast, semantics, labels, aria-live
  for notices, reduced-motion. Mouse-first — do not add keyboard shortcuts.
---

# a11y-lite

Use when reviewing or shipping UI in `src/components/**`, `app/**`.

## Product stance

- **Mouse-first.** Do not invent keyboard shortcuts or chord help.
- Normal focusability and visible focus rings (`v4-focus-ring`) are required.
- Notices: one message, one place (see AGENTS.md).

## Contrast

- Body text on cream / panels: meet **WCAG AA** (≥ 4.5:1 normal, ≥ 3:1 large).
- Brand pair for selected controls: orange fill `#ef8d5f` + forest text `#1a3d37` (already AA for UI chrome).
- Muted copy (`--v4-text-muted` / `--v5-text-muted`) must stay readable on its background; if unsure, darken ink rather than lighten the surface.
- Do not put orange text on cream for long paragraphs.

## Semantics & labels

- Prefer native elements: `button`, `a`, `label` + control, headings in order.
- Icon-only controls need `aria-label` (and usually `title`).
- `aria-disabled` for soft-gated tabs (still clickable for feedback); avoid hard `disabled` when a toast/MessageBar should explain why.
- Dialogs: `role="dialog"` / `alertdialog`, labelled by title id.

## Notices (live regions)

| Channel | `aria-live` | Dismiss |
| --- | --- | --- |
| Toast (transient) | `polite` | Auto + manual; pause timer on hover |
| Inline MessageBar (actionable) | `polite` for info/success; `assertive` for error/alert | Manual only — never auto-hide |
| Contextual (e.g. film match strip) | `polite` | Owned by that surface |

Never announce the same text from two regions at once.

## Motion

- Respect `prefers-reduced-motion` / `useReducedMotion()`.
- Do not rely on motion alone to convey state.

## Out of scope

- Full WCAG audits, screen-reader scripting suites, or shortcut maps — escalate only if the user asks.
