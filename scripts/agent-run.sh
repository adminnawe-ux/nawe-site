#!/usr/bin/env bash
set -euo pipefail

# Local-only AI issue-to-PR pipeline for nawe-connect. No cloud execution
# path — everything below runs on your machine via the Claude Code CLI and
# gh. Trigger manually, or automatically via the systemd --user service in
# scripts/systemd/.
#
# Two label-driven phases, run in order on every invocation:
#
#   Phase 1 — triage (`agent-to-review` -> `awaiting-fred-review`)
#     For issues you've labeled `agent-to-review` (which may be short or
#     vague), Claude reads the repo READ-ONLY and posts back a structured
#     analysis appended to the issue body: affected files, the proposed
#     change, tests needed, security/risk notes, and open questions. Claude
#     cannot edit files or touch GitHub in this phase — the script owns the
#     issue update. The issue is relabeled `awaiting-fred-review` so you
#     know it's ready for you to read.
#
#   Phase 2 — implement (`ready-for-agent` -> `in-progress`)
#     After you've read the analysis and are happy with the plan, remove
#     `awaiting-fred-review` and add `ready-for-agent` yourself (GitHub UI
#     or `gh issue edit`). This script then checks out a branch, has Claude
#     implement the change with a restricted tool allowlist (no git
#     remotes, no PR creation — that stays in this script), runs the
#     project's checks, and if commits were produced, pushes the branch and
#     opens a PR itself (`Closes #<n>`). The issue is relabeled
#     `in-progress`.
#
# Requires: gh (authenticated: `gh auth login`), claude (Claude Code CLI,
# authenticated), git, npm, deno.
#
# Two remotes are configured in this repo:
#   origin    -> github.com/Nawe-Wellness/nawe-site   (issues + PRs live here)
#   adminnawe -> github.com/adminnawe-ux/nawe-site     (deploy mirror, wired to Render)
# All gh (issue/PR) commands are pinned to Nawe-Wellness via GH_REPO below so
# they're unambiguous even though two remotes exist. After every sync from
# origin/main, this script also fast-forwards adminnawe/main to match, so the
# deploy mirror never falls behind what's merged on origin.

REPO_DIR="${NAWE_AGENT_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

export GH_REPO="Nawe-Wellness/nawe-site"

LABEL_TO_REVIEW="agent-to-review"
LABEL_AWAITING_REVIEW="awaiting-fred-review"
LABEL_READY="ready-for-agent"
LABEL_IN_PROGRESS="in-progress"

LOCK_FILE="/tmp/nawe-agent-run.lock"

log() { echo "[nawe-agent] $*"; }

# --- single-instance guard (systemd timer can overlap a slow run) ------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another run is already in progress, exiting"
  exit 0
fi

cd "$REPO_DIR"

for bin in gh claude git npm; do
  command -v "$bin" >/dev/null 2>&1 || { log "missing dependency: $bin"; exit 1; }
done

if ! command -v deno >/dev/null 2>&1; then
  log "WARNING: deno not found — edge function tests will be skipped/fail if an issue touches supabase/functions. Install: https://docs.deno.com/runtime/getting_started/installation/"
fi

if [ -n "$(git status --porcelain)" ]; then
  log "working tree is dirty, refusing to run — clean it up or stash first"
  exit 1
fi

log "syncing main with origin"
git fetch origin
git checkout main
git reset --hard origin/main

if git remote get-url adminnawe >/dev/null 2>&1; then
  log "mirroring main to adminnawe (Render deploy remote)"
  if ! git push adminnawe main; then
    log "WARNING: mirror push to adminnawe failed (non-fast-forward or auth issue) — continuing anyway, fix manually with 'git push adminnawe main'"
  fi
else
  log "no 'adminnawe' remote configured, skipping mirror push"
fi

log "ensuring pipeline labels exist"
gh label create "$LABEL_TO_REVIEW"     --color FBCA04 --description "Ask the agent to analyze and propose a plan before any code is written" --force >/dev/null
gh label create "$LABEL_AWAITING_REVIEW" --color D4C5F9 --description "Agent posted its analysis — waiting on a human decision" --force >/dev/null
gh label create "$LABEL_READY"         --color 0E8A16 --description "Plan approved — agent should implement and open a PR" --force >/dev/null
gh label create "$LABEL_IN_PROGRESS"   --color 1D76DB --description "Agent is implementing / has opened a PR for this issue" --force >/dev/null

# =========================================================================
# Phase 1: triage — agent-to-review -> awaiting-fred-review
# =========================================================================

log "== phase 1: triage (label '$LABEL_TO_REVIEW') =="

TRIAGE_ISSUES=$(gh issue list --label "$LABEL_TO_REVIEW" --state open --json number --jq '.[].number')

if [ -z "$TRIAGE_ISSUES" ]; then
  log "no issues labeled '$LABEL_TO_REVIEW'"
else
  while IFS= read -r NUM; do
    [ -z "$NUM" ] && continue
    log "-- triaging issue #$NUM --"

    ORIGINAL_BODY=$(gh issue view "$NUM" --json body --jq '.body // ""')

    TRIAGE_INSTRUCTIONS="You are triaging GitHub issue #$NUM in this repository BEFORE any code is written. The issue may be short, vague, or underspecified — your job is to turn it into a concrete, reviewable plan, not to implement anything.

Read the issue with \`gh issue view $NUM\`. Read CLAUDE.md for architecture, conventions, and the security-sensitive areas (payment/STK push flow, NCBA webhook, Supabase RLS, edge functions, auth).

Explore the repo READ-ONLY (Read/Grep/Glob only — you have no Edit, Write, or git-mutating tools in this session, so don't attempt to change anything) and produce a concise Markdown analysis with exactly these sections:

## Clarified problem
Restate what's actually being asked, resolving ambiguity using what you found in the codebase.

## Affected files
Specific file paths that will need to change, each with a one-line reason.

## Proposed change
What will actually change, precisely enough that a reviewer can approve or reject without reading code.

## Tests
What tests will be added or updated.

## Risks / security notes
Explicitly say if this touches payments, RLS, edge functions, or auth. Say 'None' if it doesn't.

## Open questions
Anything genuinely ambiguous that needs a human decision before implementation. Write 'None' if there aren't any.

Output ONLY that Markdown analysis — no preamble, no closing remarks."

    set +e
    ANALYSIS=$(claude -p "$TRIAGE_INSTRUCTIONS" \
      --allowedTools "Read,Grep,Glob,Bash(gh issue view *),Bash(git log *),Bash(git grep *)" \
      --max-turns 15)
    CLAUDE_EXIT=$?
    set -e

    if [ "$CLAUDE_EXIT" -ne 0 ] || [ -z "$(echo "$ANALYSIS" | tr -d '[:space:]')" ]; then
      log "triage failed for issue #$NUM (exit $CLAUDE_EXIT or empty output) — leaving label as-is for retry"
      continue
    fi

    BODY_FILE=$(mktemp)
    {
      printf '%s\n\n' "$ORIGINAL_BODY"
      printf -- '---\n\n'
      printf '## 🤖 Agent analysis (%s)\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf '%s\n' "$ANALYSIS"
    } > "$BODY_FILE"

    gh issue edit "$NUM" --body-file "$BODY_FILE"
    rm -f "$BODY_FILE"

    gh issue comment "$NUM" --body "Analysis added above. Review it and label this \`$LABEL_READY\` if you want it implemented, or edit/comment to redirect the agent."

    log "relabeling issue #$NUM: $LABEL_TO_REVIEW -> $LABEL_AWAITING_REVIEW"
    gh issue edit "$NUM" --remove-label "$LABEL_TO_REVIEW" --add-label "$LABEL_AWAITING_REVIEW"
  done <<< "$TRIAGE_ISSUES"
fi

# =========================================================================
# Phase 2: implement — ready-for-agent -> in-progress
# =========================================================================

log "== phase 2: implement (label '$LABEL_READY') =="

IMPLEMENT_ISSUES=$(gh issue list --label "$LABEL_READY" --state open --json number,title --jq '.[] | "\(.number)\t\(.title)"')

if [ -z "$IMPLEMENT_ISSUES" ]; then
  log "no issues labeled '$LABEL_READY'"
  log "done"
  exit 0
fi

while IFS=$'\t' read -r NUM TITLE; do
  [ -z "$NUM" ] && continue
  BRANCH="agent/issue-$NUM"
  log "-- implementing issue #$NUM: $TITLE --"

  if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    log "branch $BRANCH already exists on origin — skipping (already claimed)"
    continue
  fi

  git checkout -b "$BRANCH" main

  IMPLEMENT_INSTRUCTIONS="Implement a fix for GitHub issue #$NUM in this repository.
Read the issue with \`gh issue view $NUM\` for the full description — it likely already contains an '## 🤖 Agent analysis' section from an earlier triage pass with the affected files and proposed change. Follow that plan unless you find it's wrong, in which case implement the correct fix instead.

Read CLAUDE.md first and follow its conventions exactly. Payments (the STK
push flow, NCBA webhook), Supabase RLS policies, and edge functions under
supabase/functions are security-sensitive — make the smallest correct
change there.

Make the smallest correct change for the issue. Add or update tests where
relevant. Never edit .env, secrets, or files under .github/workflows.

Before you stop: run npm run lint, npx tsc --noEmit, npm run test, and npm
run build — all must pass. If you touched an edge function, also run its
deno test. Commit your work with git as you go. Do not push, do not open a
PR, and do not touch git remotes — that is handled outside this session."

  set +e
  claude -p "$IMPLEMENT_INSTRUCTIONS" \
    --allowedTools "Read,Edit,Write,Bash(gh issue view *),Bash(npm ci),Bash(npm run lint),Bash(npx tsc --noEmit),Bash(npm run test),Bash(npm run build),Bash(deno test --allow-env supabase/functions/*/index.test.ts),Bash(git add *),Bash(git commit *),Bash(git status),Bash(git diff *),Bash(git log *)" \
    --max-turns 30
  CLAUDE_EXIT=$?
  set -e

  if [ "$CLAUDE_EXIT" -ne 0 ]; then
    log "claude run failed for issue #$NUM (exit $CLAUDE_EXIT) — discarding branch"
    git checkout main
    git branch -D "$BRANCH"
    continue
  fi

  if [ -z "$(git log main.."$BRANCH" --oneline)" ]; then
    log "no commits produced for issue #$NUM — discarding branch"
    git checkout main
    git branch -D "$BRANCH"
    continue
  fi

  log "pushing $BRANCH and opening PR"
  git push -u origin "$BRANCH"

  PR_BODY_FILE=$(mktemp)
  printf 'Closes #%s\n\nImplemented locally by the Nawe agent pipeline (`scripts/agent-run.sh`). CI (`ci.yml`) is the quality gate — review its result before merging.\n' "$NUM" > "$PR_BODY_FILE"

  gh pr create \
    --title "Fix #$NUM: $TITLE" \
    --body-file "$PR_BODY_FILE" \
    --base main \
    --head "$BRANCH"
  rm -f "$PR_BODY_FILE"

  log "relabeling issue #$NUM: $LABEL_READY -> $LABEL_IN_PROGRESS"
  gh issue edit "$NUM" --remove-label "$LABEL_READY" --add-label "$LABEL_IN_PROGRESS"

  git checkout main
done <<< "$IMPLEMENT_ISSUES"

log "done"
