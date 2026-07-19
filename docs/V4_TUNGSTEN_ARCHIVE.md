# SaikoSubStudio v4 Tungsten UI Archive

Dark **tungsten gold** presentation (`v4.x`, warm ink + `#d0a46f`) is sealed as of
the Ridgeline / 5.0 Beta cutover. Do not continue iterating this palette in the
live app; use this document (and the CSS snapshot) when inspecting or restoring.

## Freeze point

- Branch at freeze: `cf-pages-hosted`
- Last tungsten-facing release: `v4.1.0` (`acea832c` and prior on that line)
- Snapshot file: [`docs/archives/v4-tungsten-tokens.css`](./archives/v4-tungsten-tokens.css)

## Sealed tokens (runtime names were `--v4-*`)

| Token | Value |
| --- | --- |
| canvas | `#0c0b0a` |
| canvas-raised | `#131110` |
| panel | `#171412` |
| panel-raised | `#1e1a17` |
| panel-muted | `#12100e` |
| line | `rgba(232, 214, 190, 0.1)` |
| line-strong | `rgba(232, 214, 190, 0.18)` |
| text | `#f3ebe2` |
| text-muted | `#a89b8c` |
| text-faint | `#6f655a` |
| accent | `#d0a46f` |
| accent-strong | `#e0b984` |
| accent-soft | `rgba(208, 164, 111, 0.14)` |
| accent-ink | `#17120d` |
| danger | `#c98a86` |
| warning | `#c5a472` |
| desk-glow | `rgba(208, 164, 111, 0.08)` |

## Structural notes kept into 5.0

Interaction shell from late v4.1 stays the product frame (do not discard with the palette):

- Twin system trays (top / bottom)
- Workflow info bar + right-edge next
- Checklist left media rail + narrowed task card
- Soft-log marquee in bottom tray; errors stay in FeedbackCenter

## Restore

1. Replace live `:root` token block with `docs/archives/v4-tungsten-tokens.css`.
2. Revert tray / shell hard-coded light adaptations if present.
3. Optionally `git checkout` the freeze commit for a full UI tree comparison.

Production boundaries (Pages branch, TMDB proxy, feedback mailer) are unchanged.
