# Decision Log

## 2026-09-03

- Closed stale PRs #6–#13 (EP-0 / REL tip chain from 2026-07). Bases pointed at each other and were not based on `cf-pages-hosted`.
- Recorded branch policy in `docs/BRANCH_POLICY.md`:
  - `cf-pages-hosted` = public-beta / hosted source of truth for features, effects, and merge algorithms.
  - `main` = open-source self-host line; algorithms must be derived from hosted, then strip private/commercial APIs — do not maintain a second merge implementation.
- Product boundary confirmed: no translation / NMT / LLM remapping work. Scope is high-quality intelligent dual-track merge plus human-in-the-loop assist UX only.

## 2026-06-26

- Added conservative auxiliary subtitle classification for SDH-like bracket cues.
- Default export behavior remains `keep`; style settings can choose `smart` or `clean`.
- Verification passed: `npm run test:core`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## 2026-06-28

- Added explicit TMDB confirmation decisions for automatic metadata application.
- Movie year mismatch, movie/TV type mismatch, and ancillary documentary/making-of candidates now require manual confirmation.
- Regression samples cover Battle of Algiers positive matches, same-year contains-only candidates, Chinese/cross-language ancillary candidates, and weak-candidate negative matches.
- Verification passed: `npm run test:core`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## 2026-07-10

- TMDB search and metadata selection now reject stale async responses, reuse confirmed metadata across sibling episode tasks, and avoid the pre-task duplicate search path.
- Source analysis is explicitly limited to subtitle distribution and video-duration coverage; it no longer presents a synthetic media curve or claims audio synchronization evidence.
- SRT export no longer emits ASS positioning overrides. ASS import/export now preserves independent Chinese and secondary-language fonts, colors, outlines, CRLF styles, canvas aspect ratio, and sanitized titles.
- Automatic product signatures were removed. Creator credit remains an explicit export option.
- Industrial alignment uses rolling score rows plus a compact direction matrix, so a long one-sided track does not degrade solely because it exceeds 2,000 cues.
- Browser history is capped at 12 entries and approximately 4 MB, with corrupt-data fallback and quota failure feedback.
- Global typography overrides and browser-specific font patches were removed; navigation height, narrow-screen title wrapping, timeline columns, reduced motion, and offscreen row rendering were corrected.
- Verification passed: `npx tsc --noEmit`, `npm run test:core`, `npm run lint`, `npm run build`.
- Dependency audit remains blocked by the deployment adapter: `next@15.5.2` has one critical and one moderate advisory, while `@cloudflare/next-on-pages@1.13.16` declares support only through Next 15.5.2. Migrate the Cloudflare adapter before upgrading to patched Next 15.5.20; do not use `npm audit fix --force` on the current production branch.
