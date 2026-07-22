# AI issue-to-PR pipeline

A local-only automated pipeline for nawe-connect. No cloud execution path —
everything runs on your machine through `scripts/agent-run.sh`, driven by
the Claude Code CLI and `gh`. CI (`ci.yml`) still runs on GitHub Actions as
the test gate on the resulting PR, same as any other PR.

## Files

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Existing CI gate: `npm run lint`, `tsc --noEmit`, `npm run test`, `npm run build`, plus a separate Deno job for edge function tests. Runs on every push to `main`/`fix/**`/`feature/**`/`test/**` and every PR — this is the gate regardless of who opened the PR. |
| `CLAUDE.md` | Project context and conventions, including the "AI issue-to-PR pipeline" section every agent-driven step reads first (security-sensitive areas, required checks). |
| `scripts/agent-run.sh` | The pipeline itself — triage phase, then implement phase (see below). |
| `scripts/systemd/nawe-agent.service` | systemd `--user` unit that runs `agent-run.sh` once at login. |
| `scripts/systemd/nawe-agent.timer` | Optional: re-runs the script every 2 hours while logged in, not just at login. |

## Two remotes

This repo has two git remotes:

| Remote | URL | Role |
|---|---|---|
| `origin` | `github.com/Nawe-Wellness/nawe-site` | The collaborative repo — issues and PRs live here. The pipeline reads/writes issues and opens PRs against this repo. |
| `adminnawe` | `github.com/adminnawe-ux/nawe-site` | A deploy mirror wired to Render (`render.yaml` builds from `main`). Not used for issues or PRs. |

`agent-run.sh` sets `GH_REPO=Nawe-Wellness/nawe-site` so every `gh` call is
unambiguous, and after each sync from `origin/main` it also pushes `main` to
`adminnawe` so the deploy mirror never falls behind what's merged on origin.
If that push ever fails (e.g. `adminnawe/main` diverged), the script logs a
warning and continues — fix it manually with `git push adminnawe main`.

## Labels

| Label | Meaning |
|---|---|
| `agent-to-review` | You add this to a new issue (even a rough one-liner) to ask the agent to turn it into a concrete plan before anyone writes code. |
| `awaiting-fred-review` | The agent has posted its analysis to the issue and is waiting on you. |
| `ready-for-agent` | You've read the analysis and approved it — the agent should implement it. |
| `in-progress` | The agent has opened a PR for this issue. |

All four are created automatically (idempotently) the first time `agent-run.sh` runs.

## End-to-end flow

1. **Open an issue, label it `agent-to-review`.** It doesn't need to be
   detailed — a short description of the problem is enough.
2. **Triage (automatic).** Next time `agent-run.sh` runs, it picks up every
   `agent-to-review` issue and has Claude read the repo **read-only**
   (no Edit/Write, no git) to work out:
   - the clarified problem
   - the specific files that will need to change, and why
   - the proposed change, described precisely enough to approve or reject
     without reading code
   - what tests will be added/updated
   - security/risk notes (payments, RLS, edge functions, auth)
   - any open questions that need a human call

   The script appends this analysis to the issue body (your original text
   is preserved above it) and relabels the issue `agent-to-review` →
   `awaiting-fred-review`.
3. **You review.** Read the analysis on the issue. If you agree with the
   plan (or after editing the issue to redirect it), remove
   `awaiting-fred-review` and add `ready-for-agent`:
   ```bash
   gh issue edit <N> --remove-label awaiting-fred-review --add-label ready-for-agent
   ```
   or just do it from the GitHub UI.
4. **Implement (automatic).** Next run, `agent-run.sh` picks up every
   `ready-for-agent` issue and for each one:
   1. Checks out a fresh branch `agent/issue-<n>` off `main`.
   2. Runs `claude -p "<instructions>"` with a **restricted tool
      allowlist** — Claude can read/edit files, read the issue via `gh
      issue view` (which now includes the analysis from step 2), and run
      the project's own build/test/lint commands. It cannot touch git
      remotes or open PRs — that stays in the script, not the model.
   3. If Claude produced commits, the script pushes the branch and runs
      `gh pr create` itself, linking `Closes #<n>`.
   4. Swaps the issue's label from `ready-for-agent` to `in-progress`.
5. **Test.** `ci.yml` runs on the resulting PR: lint, type check, unit
   tests, build, plus the Deno edge-function tests. This is the actual
   quality gate.
6. **Merge.** Review the diff and CI result, then merge like any other PR.

## One-time setup

1. Install and authenticate the [Claude Code CLI](https://code.claude.com)
   (`claude`) and the [GitHub CLI](https://cli.github.com) (`gh auth login`)
   on your machine.
2. Edit `scripts/systemd/nawe-agent.service` — replace
   `%h/path/to/nawe-connect` (both the `Environment=` and `ExecStart=`
   lines) with the actual path to your local clone.
3. Install the units and enable the service:
   ```bash
   mkdir -p ~/.config/systemd/user
   cp scripts/systemd/nawe-agent.service scripts/systemd/nawe-agent.timer ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now nawe-agent.service   # runs once now, and again at every login
   systemctl --user enable --now nawe-agent.timer     # optional: also every 2h while logged in
   ```
4. Run it on demand anytime: `systemctl --user start nawe-agent.service`, or
   just `./scripts/agent-run.sh` directly.
5. Check logs: `journalctl --user -u nawe-agent.service -f`.

## Worth knowing

- Triage is read-only by construction — the `claude -p` call in phase 1 is
  given no Edit/Write/git tools, so a vague or even adversarial issue body
  can't cause it to change anything. It can only produce text, which the
  script then posts to the issue.
- The script refuses to run on a dirty working tree, and locks itself
  (`/tmp/nawe-agent-run.lock`) so an overlapping timer run doesn't stack on
  top of a slow one.
- Triage and implement both run on every invocation, in that order, so a
  single `agent-run.sh` call (or timer tick) can move an issue from
  `agent-to-review` to `awaiting-fred-review`, and separately pick up
  anything already sitting at `ready-for-agent` from a prior review.
- The `adminnawe` mirror push happens on every run regardless of whether
  there's anything to triage or implement — it's a side effect of the
  initial sync step, so Render's deploy source stays current even on runs
  with no agent work to do.
- If a run goes wrong mid-issue, stop the service
  (`systemctl --user stop nawe-agent.service`), delete the half-finished
  local branch if one was created, and leave the issue's label where it is
  — the next run will retry, or you can close the issue as superseded if
  the plan turned out to be wrong.
