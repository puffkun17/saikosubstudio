# SaikoSubStudio v3 UI Archive

The v3 interface is preserved by Git tag `v3.0.0-ui-archive` at commit
`a9acbc97d2aba47d144d96a747b8af25caf8e15a`.

SaikoSubStudio 4.0 Beta changes presentation and interaction structure only.
The following Cloudflare Pages boundaries remain unchanged:

- Production branch: `cf-pages-hosted`
- Pages output: `.vercel/output/static`
- TMDB proxy route: `/api/tmdb/[...path]`
- Feedback route: `/api/feedback`
- Worker binding: `FEEDBACK_MAILER`

Do not duplicate the v3 component tree inside the v4 runtime. Use the archive
tag when the previous interface needs to be inspected or restored.
