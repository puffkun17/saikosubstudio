# Decision Log

## 2026-06-26

- Added conservative auxiliary subtitle classification for SDH-like bracket cues.
- Default export behavior remains `keep`; style settings can choose `smart` or `clean`.
- Verification passed: `npm run test:core`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## 2026-06-28

- Added explicit TMDB confirmation decisions for automatic metadata application.
- Movie year mismatch, movie/TV type mismatch, and ancillary documentary/making-of candidates now require manual confirmation.
- Regression samples cover Battle of Algiers positive matches, same-year contains-only candidates, Chinese/cross-language ancillary candidates, and weak-candidate negative matches.
- Verification passed: `npm run test:core`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
