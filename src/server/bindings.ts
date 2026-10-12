/**
 * Runtime bindings access (Cloudflare service bindings / secrets).
 * Single seam so the deploy adapter can change without touching route handlers.
 * Under vinext on Workers, bindings come from `cloudflare:workers`.
 */
export type ServiceBinding = { fetch: (input: string, init?: RequestInit) => Promise<Response> };
export type AppBindings = { FEEDBACK_MAILER?: ServiceBinding; TMDB_API_KEY?: string };

export async function getBindings(): Promise<AppBindings> {
  try {
    const mod = (await import('cloudflare:workers')) as { env?: AppBindings };
    const env = mod.env ?? {};
    return { FEEDBACK_MAILER: env.FEEDBACK_MAILER, TMDB_API_KEY: env.TMDB_API_KEY ?? process.env.TMDB_API_KEY };
  } catch {
    // Non-Workers runtime (e.g. plain Node dev): no service bindings.
    return { TMDB_API_KEY: process.env.TMDB_API_KEY };
  }
}
