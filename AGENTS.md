<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository and authentication workflow

- The canonical repository is `https://github.com/vancedotson/BadCredittoCash.git`.
- Work directly on `main`. Make commits on `main` and push to `origin/main` unless
  the user explicitly asks for a different workflow. Never force-push shared history.
- This workspace uses GitHub account `funnelsgeniusgit`. Keep Git credential
  configuration repository-local; do not switch or replace global GitHub logins.
- For GitHub CLI commands, set `GH_CONFIG_DIR` for that process to
  `<absolute git directory>/gh-funnelsgeniusgit` (resolve with
  `git rev-parse --absolute-git-dir`). Do not use the default GitHub CLI profile for
  this repository. Git's workspace credential helper uses this isolated profile.
- Keep local submissions, uploaded reports, credentials, caches, and server logs
  out of commits. The `.local/` directory is development-only private storage.
