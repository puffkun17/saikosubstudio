# Stable identity scheme

Central module: `src/core/identity.ts` (mint / parse / compare only — no ad-hoc id strings elsewhere).

**Format:** `{kind}.v{version}.{body}`

- **kind** — what the thing is
- **version** — generation rule for that kind (`ID_SCHEME` in code); bump when the body recipe changes so old ids fail `parseId` / kind checks cleanly
- **body** — opaque hex (or `hex_role` for tracks); treat as uninterpreted outside mint helpers

Identity is **not** a storage key and **not** a React key. Use `storageKeyFor(id, namespace)` and `reactKeyFor(id, scope)`. History rows use `historyIdFor(taskId)` → `history:{taskId}`.

## Id kinds

| Kind | Meaning | Body composition (v1) | Mint helper |
| --- | --- | --- | --- |
| `series` | A show / film title (no episode) | `hash(titleKey)` | `mintSeriesId` |
| `season` | One season of a series | `hash(titleKey + Sxx)` | `mintSeasonId` |
| `episode` | One episode (or film-as-episode later) | `hash(titleKey + SxxExx)` | `mintEpisodeId` |
| `work` | Merge unit: one film or one episode | `hash(titleKey + episodeKey\|film)` | `mintWorkId` |
| `task` | User job for a work (live TaskPair / history) | same body recipe as `work` in v1 | `mintTaskId` |
| `file` | Imported subtitle bytes + normalized basename | `hash(normName + NUL + text)` | `mintFileId` |
| `track` | Virtual track split from one file (e.g. Dial_CH) | `{parentFileBody}#{role}` | `mintTrackId` |
| `row` | Merged / workbench cue | `hash(provenance\|ts+text+type[+sourceIndex])` — **not** display `index` | `mintRowId` / `rowFingerprint` |
| `subver` | Reserved: alternate subtitle version of a work | — (not minted yet) | — |
| `tmdb` | Reserved: TMDB title/ref cache key | — | — |
| `export` | Reserved: export artifact / preset binding | — | — |

**Same task (v1):** same `titleKey` (`recognition.titleKeyOf`) and same `episodeKey` (`SxxExx`, or both absent → film), and same optional `tmdbKey`. In-session timeline “same episode” merges attach to the existing task id.

**Same file (v1):** same normalized basename + same text → same `file` id.

### Collision / TMDB disambiguation

Today two different shows that strip to the same `titleKey` + episode (e.g. unrelated “The Office” remakes, or same Chinese title in different years) **collide** on one `task` / `work` id. Once a TMDB match is known, pass `tmdbKey` into `WorkIdentity` (via `tmdbKeyFromRef`: `tmdb:tv:136315` or `year:2022`) so `mintTaskId` / `mintWorkId` include it in the body. Import-time minting still uses title+episode only until TMDB is linked — reminting after link is a later step; the facet is already in the scheme.

## Future cases (scheme only — not built)

- **Multiple languages / tracks per episode** — mint one `file` (or `track`) per stream under the same `work` / `task`; slots already hold multiple roles.
- **Several subtitle versions of the same episode** — introduce `subver` (or a facet in `task` body v2) so two Chinese tracks for S01E01 do not collide; `work` stays the episode.
- **Multi-episode archives** — one import batch yields many `episode` / `work` / `task` ids; grouping stays per work, not per archive file.
- **Show spanning seasons** — `series` → `season` → `episode` → `work`; UI can aggregate by series without changing task ids.
- **Sync between devices** — content-derived bodies are portable; scheme version lets peers reject unknown generations without silent mis-merge.

## Schema / downtime

IndexedDB `saiko-tasks` **v3** discards prior stores on upgrade (`applySchemaUpgrade`). Opening the new build with stale v1/v2 data yields empty history — no migration, no crash.
