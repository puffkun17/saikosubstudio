/**
 * Runtime bindings access — legacy seam for non-Worker callers.
 * Switch B Worker routes receive `env` directly; this helper remains for
 * any residual Node/dev paths that still need TMDB_API_KEY from process.env.
 */
export type ServiceBinding = { fetch: (input: string, init?: RequestInit) => Promise<Response> };
export type AppBindings = { FEEDBACK_MAILER?: ServiceBinding; TMDB_API_KEY?: string };

export async function getBindings(): Promise<AppBindings> {
  try {
    const mod = (await import("cloudflare:workers")) as { env?: AppBindings };
    const env = mod.env ?? {};
    return { FEEDBACK_MAILER: env.FEEDBACK_MAILER, TMDB_API_KEY: env.TMDB_API_KEY ?? process.env.TMDB_API_KEY };
  } catch {
    return { TMDB_API_KEY: process.env.TMDB_API_KEY };
  }
}
