/**
 * Central identity: mint / parse / compare typed, versioned ids.
 *
 * Format: `{kind}.v{version}.{body}`
 *   kind     — what the thing is (task, file, work, …)
 *   version  — generation rule for that kind (bump when the body recipe changes)
 *   body     — opaque hex (or structured segments); never build ids elsewhere
 *
 * Identity ≠ storage key ≠ React key. Use storageKeyFor / reactKeyFor when
 * persisting or rendering; do not assume the raw id string is a DB key.
 *
 * Hierarchy (mint helpers exist; not all are wired into the UI yet):
 *   series → season → episode → work (merge unit) → task (user job)
 *   file / track sit under a work; future: subver, tmdb, export
 */
import { episodeKeyOf, type EpisodeRef } from './episode';
import { titleKeyOf } from './recognition';

/** Current scheme versions per kind. Bump a kind’s version when its body recipe changes. */
export const ID_SCHEME = {
  series: 1,
  season: 1,
  episode: 1,
  work: 1,
  task: 1,
  file: 1,
  track: 1,
  /** Merged/workbench cue — content/provenance fingerprint, not display index. */
  row: 1,
  subver: 1,
  tmdb: 1,
  export: 1,
} as const;

export type IdKind = keyof typeof ID_SCHEME;

export interface SaikoId {
  kind: IdKind;
  version: number;
  /** Opaque payload (hex). Treat as uninterpreted except via mint helpers. */
  body: string;
}

const KIND_SET = new Set<string>(Object.keys(ID_SCHEME));
const ID_RE = /^([a-z]+)\.v(\d+)\.([0-9a-f]+(?:#[0-9a-z]+)?)$/i;

/** FNV-1a 32×2 → hex. Sync; no Node/WebCrypto. */
export function hashHex(input: string, length = 16): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + ((i + 1) * 2654435761)), 0x01000193);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(0, length);
}

export function normalizeFileName(name: string): string {
  const base = (name || '').split(/[/\\]/).pop() || name || '';
  return base.normalize('NFC').trim().toLowerCase();
}

export function formatId(id: SaikoId): string {
  return `${id.kind}.v${id.version}.${id.body}`;
}

export function parseId(raw: string): SaikoId | null {
  const m = ID_RE.exec(String(raw || '').trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (!KIND_SET.has(kind)) return null;
  return { kind: kind as IdKind, version: Number(m[2]), body: m[3].toLowerCase() };
}

export function isId(raw: string, kind?: IdKind): boolean {
  const parsed = parseId(raw);
  if (!parsed) return false;
  return kind ? parsed.kind === kind : true;
}

export function sameId(a: string, b: string): boolean {
  const pa = parseId(a);
  const pb = parseId(b);
  if (!pa || !pb) return false;
  return pa.kind === pb.kind && pa.version === pb.version && pa.body === pb.body;
}

function mint(kind: IdKind, bodyInput: string): string {
  return formatId({ kind, version: ID_SCHEME[kind], body: hashHex(bodyInput) });
}

/* ---------- Work fingerprint (title + episode) ---------- */

export interface WorkIdentity {
  titleKey: string;
  /** SxxExx when known; omitted for films / unknown. */
  episodeKey?: string;
  /**
   * Disambiguator once TMDB (or year) is known — e.g. `tmdb:tv:136315` or `year:2022`.
   * Without this, two shows that strip to the same titleKey+episode collide (v1 limitation).
   */
  tmdbKey?: string;
}

export function workIdentityFromFileName(fileName: string, episodeKey?: string | null): WorkIdentity {
  const titleKey = titleKeyOf(fileName) || 'untitled';
  let ep: string | undefined;
  if (episodeKey) {
    const upper = episodeKey.toUpperCase();
    if (/^S\d+E\d+$/.test(upper)) ep = upper;
    else if (/^E\d+$/.test(upper)) ep = `S01${upper}`;
  }
  return { titleKey, episodeKey: ep };
}

export function workIdentityFromEpisode(fallbackTitle: string, episode: EpisodeRef): WorkIdentity {
  const titleKey = titleKeyOf(fallbackTitle) || titleKeyOf(`${fallbackTitle}.mkv`) || 'untitled';
  return { titleKey, episodeKey: episodeKeyOf(episode, 1) };
}

export function sameWorkIdentity(a: WorkIdentity, b: WorkIdentity): boolean {
  if ((a.titleKey || 'untitled').toLowerCase() !== (b.titleKey || 'untitled').toLowerCase()) return false;
  if ((a.episodeKey?.toUpperCase() || '') !== (b.episodeKey?.toUpperCase() || '')) return false;
  return (a.tmdbKey || '') === (b.tmdbKey || '');
}

/** Build a tmdbKey facet once a TMDB match (or year) is known. */
export function tmdbKeyFromRef(ref: { mediaType?: string; id?: number; year?: string } | null | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.mediaType && ref.id != null) return `tmdb:${ref.mediaType}:${ref.id}`;
  if (ref.year) return `year:${ref.year}`;
  return undefined;
}

function workBody(work: WorkIdentity): string {
  const title = (work.titleKey || 'untitled').toLowerCase();
  const ep = work.episodeKey ? work.episodeKey.toUpperCase() : 'film';
  const tmdb = work.tmdbKey ? `\0${work.tmdbKey}` : '';
  return `${title}\0${ep}${tmdb}`;
}

/* ---------- Mint helpers (only place ids are born) ---------- */

export function mintSeriesId(titleKey: string): string {
  return mint('series', (titleKey || 'untitled').toLowerCase());
}

export function mintSeasonId(titleKey: string, season: number): string {
  return mint('season', `${(titleKey || 'untitled').toLowerCase()}\0S${String(season).padStart(2, '0')}`);
}

export function mintEpisodeId(titleKey: string, episodeKey: string): string {
  const ep = episodeKey.toUpperCase();
  return mint('episode', `${(titleKey || 'untitled').toLowerCase()}\0${ep}`);
}

/** Merge unit: one film or one episode. */
export function mintWorkId(work: WorkIdentity): string {
  return mint('work', workBody(work));
}

/**
 * User-facing task for a work. v1 body matches work so re-import of the same
 * title+episode yields the same task id (room later for variant facets in body).
 */
export function mintTaskId(work: WorkIdentity): string {
  return mint('task', workBody(work));
}

/** Content-addressed imported file. */
export function mintFileId(fileName: string, text: string): string {
  return mint('file', `${normalizeFileName(fileName)}\0${text || ''}`);
}

/**
 * Virtual track split from a bilingual file (e.g. Dial_CH / Dial_JP).
 * Kind `track`; body ties to parent file body + role.
 */
export function mintTrackId(parentFileId: string, role: string): string {
  const parent = parseId(parentFileId);
  const parentBody = parent?.kind === 'file' ? parent.body.split('#')[0] : hashHex(parentFileId);
  const clean = String(role || 'x').toLowerCase().replace(/[^\w]+/g, '').slice(0, 12) || 'x';
  return formatId({ kind: 'track', version: ID_SCHEME.track, body: `${parentBody}#${clean}` });
}

/** @deprecated Prefer mintTrackId — kept as a clear name at ASS-split call sites. */
export function derivedFileId(parentFileId: string, role: string): string {
  return mintTrackId(parentFileId, role);
}

/**
 * Stable id for a merged / workbench row. Fingerprint must NOT include the display
 * `index` (that is renumbered after sort / insert / delete). Prefer provenance
 * source cues when present; otherwise ts+text+type.
 */
export function rowFingerprint(row: {
  ts: string;
  text: string;
  type?: string;
  cueKind?: string;
  /** Preprocess source cue index (1-based) when provenance is absent (notes / bilingual). */
  sourceIndex?: number;
  provenance?: {
    method: string;
    timingSource?: string;
    groupId?: string;
    primary?: { cueIndex: number; ts: string };
    secondary?: { cueIndex: number; ts: string };
  };
}): string {
  const p = row.provenance;
  if (p?.primary || p?.secondary || p?.method) {
    const ref = (r?: { cueIndex: number; ts: string }) =>
      r ? `${r.cueIndex}|${r.ts}` : '';
    return [
      'prov',
      p.method || '',
      p.timingSource || '',
      p.groupId || '',
      ref(p.primary),
      ref(p.secondary),
      // Expanded turns can share the packed primary; text distinguishes them.
      row.text || '',
    ].join('\0');
  }
  return [
    'bare',
    row.type || '',
    row.cueKind || '',
    row.ts || '',
    row.text || '',
    row.sourceIndex != null ? String(row.sourceIndex) : '',
  ].join('\0');
}

export function mintRowId(row: Parameters<typeof rowFingerprint>[0]): string {
  return mint('row', rowFingerprint(row));
}

/**
 * When several rows share one fingerprint in a single result, append #2, #3…
 * (1st keeps the plain mint). Deterministic; parseId still accepts the body.
 */
export function mintRowIdDisambiguated(
  row: Parameters<typeof rowFingerprint>[0],
  occurrence: number,
): string {
  const base = mintRowId(row);
  if (occurrence <= 1) return base;
  const parsed = parseId(base);
  if (!parsed) return `${base}#${occurrence}`;
  return formatId({ ...parsed, body: `${parsed.body.split('#')[0]}#${occurrence}` });
}

/** Prefer rowId for React/review keys; fall back to display index for stale rows. */
export function rowStableKey(row: { rowId?: string; index: number }): string {
  return row.rowId || String(row.index);
}

/* ---------- Storage / React keys (not identity) ---------- */

export type StorageNamespace = 'history' | 'source' | 'merged' | 'meta';

/** Persist under a namespace; identity string alone is not a storage key. */
export function storageKeyFor(id: string, namespace: StorageNamespace): string {
  return `${namespace}:${id}`;
}

/** List / animation keys; optional scope avoids collisions across lists. */
export function reactKeyFor(id: string, scope = 'row'): string {
  return `${scope}:${id}`;
}

/** History lookup helper — storage key for a task’s history row. */
export function historyIdFor(taskId: string): string {
  return storageKeyFor(taskId, 'history');
}

/** Inverse of storageKeyFor; null if the key is not in that namespace. */
export function identityFromStorageKey(key: string, namespace: StorageNamespace): string | null {
  const prefix = `${namespace}:`;
  if (!String(key || '').startsWith(prefix)) return null;
  return key.slice(prefix.length) || null;
}
