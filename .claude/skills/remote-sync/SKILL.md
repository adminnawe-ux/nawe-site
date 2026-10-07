---
name: remote-sync
description: How nawe-connect's two git remotes (origin, adminnawe) relate, and the push/PR/merge/deploy flow between them. Use before pushing main, opening/merging a PR, or syncing between remotes in this repo.
---

# nawe-connect remote workflow

This repo has two git remotes with different jobs. Check which one a request actually means before running any push, merge, or force-push.

- **origin** (`github.com/Nawe-Wellness/nawe-site`): the collaborative repo. Issues and PRs live here, and `.github/workflows/ci.yml` runs here (lint, tsc, vitest, build, plus a Deno job for edge functions) on every push to `main`/`fix/**`/`feature/**`/`test/**` and every PR. This is the gate regardless of who opened the PR.
- **adminnawe** (`github.com/adminnawe-ux/nawe-site`): a deploy mirror only. `render.yaml` has Render build from its `main` branch (`branch: main`, static build). Not used for issues or PRs.

## Normal flow

1. Branch, open a PR against `origin` `main`, wait for CI, merge (squash) once green.
2. Push `origin/main` to `adminnawe main` as a fast-forward so Render's deploy source stays current. `.github/PIPELINE.md` says the automated pipeline does this after every sync from `origin/main`; if that push ever fails (e.g. `adminnawe/main` diverged), it logs a warning and continues — fix manually with `git push adminnawe main`.
3. **A push to `adminnawe main` is a production deploy trigger, not a routine mirror update.** Treat it like a deploy: confirm with the user before pushing there, and especially before force-pushing.

## Why the remotes diverge

`adminnawe/main` can fall behind `origin/main` and pick up its own commits with different hashes for the same changes (this has happened before: a Sept 2026 sync gap left 12 commits on `adminnawe/main` that matched `origin/main` commits in content but not hash). When that happens, a plain `git push adminnawe main` is rejected.

**Before force-pushing to fix it:**
1. `git fetch origin main -q && git fetch adminnawe main -q`
2. `git rev-list --left-right --count adminnawe/main...main` (or `...origin/main`) to see the ahead/behind counts.
3. `git diff --stat adminnawe/main origin/main` to confirm `origin/main`'s tree is a superset — i.e. nothing exists only on `adminnawe/main` that would be lost.
4. Only then `git push --force-with-lease=main:<adminnawe-main-sha> adminnawe main`, and only after the user has confirmed they want the resulting deploy to go live.

## Checklist before any push/merge touching these remotes

- [ ] Which remote does the request actually mean — `origin` (PRs/CI) or `adminnawe` (deploy)?
- [ ] If `adminnawe`: has the user confirmed they want this deployed to production right now?
- [ ] If histories diverged: confirmed via `git diff --stat` that nothing unique to the target remote would be lost before using `--force-with-lease`?
- [ ] Required checks run first regardless of remote: `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`, plus `deno test` for any changed edge function (see root `CLAUDE.md`).
