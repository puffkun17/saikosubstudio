/**
 * Runtime bindings access (Cloudflare service bindings / secrets).
 * Single seam so the deploy adapter can change without touching route handlers.
 */
export type ServiceBinding = { fetch: (input: string, init?: RequestInit) => Promise<Response> };
export type AppBindings = { FEEDBACK_MAILER?: ServiceBinding; TMDB_API_KEY?: string };

export async function getBindings(): Promise<AppBindings> {
  // Filled in by the deploy adapter commit (vinext → cloudflare:workers).
  return { TMDB_API_KEY: process.env.TMDB_API_KEY };
}
