#!/usr/bin/env bash
# agent-team-kit — convenience commands for launching NAMED Claude Code sessions.
#
# Source this from your shell rc so the functions are always available:
#   echo 'source /path/to/agent-team-kit/worktree-commands.sh' >> ~/.zshrc
# (or paste the functions in). Works in bash and zsh.
#
# Every launcher does two things that matter when juggling many agents:
#   - skips permissions (--dangerously-skip-permissions), and
#   - sets a session NAME (--name), which shows in the /resume picker AND the
#     terminal title. Names follow the branch convention: lowercase-with-dashes,
#     i.e. the name you pass, as-is. Naming is how you tell a dozen windows apart
#     and find a past conversation later — do it for every session.
#
# Worktree mode: keep ONE pinned terminal on `cockpit` (dashboard on main);
# every other terminal is `wt <name>` (a worker in its own worktree).
# Stay-on-main mode: use `sesh <name>` for each named agent in the shared tree.

# wt <name> — WORKER: a fresh git worktree on branch <name> + a session named the
# same, permissions skipped. Your per-task terminal (worktree mode).
#   wt grading-fix     # branch AND session both "grading-fix"
wt() {
  if [ -z "${1:-}" ]; then echo "usage: wt <name> [claude args...]"; return 1; fi
  local name="$1"; shift
  claude --worktree "$name" --name "$name" --dangerously-skip-permissions "$@"
  # Tip: add --tmux to put each worker in its own tmux session.
}

# cockpit — DASHBOARD: a named Claude session in the MAIN checkout (on main),
# permissions skipped. Does the integration (merging worker branches) and the
# push. Run from the repo root. Names itself "<repo>-cockpit".
cockpit() {
  local repo; repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
  claude --name "${repo:+$repo-}cockpit" --dangerously-skip-permissions "$@"
}

# sesh <name> — a named Claude session in the CURRENT directory (no worktree),
# permissions skipped. Use this for stay-on-main multi-agent work so /resume and
# your terminal titles show a real name instead of a path.
#   sesh rubric-copy   # session "rubric-copy"
sesh() {
  if [ -z "${1:-}" ]; then echo "usage: sesh <name> [claude args...]"; return 1; fi
  local name="$1"; shift
  claude --name "$name" --dangerously-skip-permissions "$@"
}

# wtls — list active worktrees + branches (a read-only glance).
wtls() { git worktree list; }

# Integration (merging a finished worker's branch into main) is NOT a shell
# command — you do it from inside the cockpit session by asking Claude, which
# runs the `merge-worktree` skill (clean-tree check, conflict surfacing, prune,
# and it stops short of pushing). Just say: "integrate grading-fix".
