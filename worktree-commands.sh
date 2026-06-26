#!/usr/bin/env bash
# agent-team-kit — worktree-mode convenience commands.
#
# Source this from your shell rc so the functions are always available:
#   echo 'source /path/to/agent-team-kit/worktree-commands.sh' >> ~/.zshrc
# (or just paste the functions in). Works in bash and zsh. They wrap Claude
# Code's native worktree support so spinning up a worker is one short command.
#
# The model: keep ONE pinned terminal running `cockpit` (your dashboard on
# main). Every other terminal is a `wt <name>` worker in its own worktree.

# wt <name> — spin up a NEW worker: a fresh git worktree on branch <name> with a
# Claude Code session in it, permissions skipped. Your per-task terminal.
#   wt grading-fix
# Extra args pass through to claude (e.g. `wt grading-fix --model opus`).
wt() {
  if [ -z "${1:-}" ]; then echo "usage: wt <name> [claude args...]"; return 1; fi
  local name="$1"; shift
  claude --worktree "$name" --dangerously-skip-permissions "$@"
  # Tip: add --tmux to put each worker in its own tmux session.
}

# cockpit — your DASHBOARD: a plain Claude Code session in the MAIN checkout
# (on main). This seat does the integration (merging worker branches) and the
# push. Permissions stay ON here on purpose: those are the high-stakes acts you
# want to see. Run it from the repo root.
cockpit() {
  claude "$@"
}

# wtls — list the active worktrees and their branches.
wtls() {
  git worktree list
}

# wtmerge <branch> — from the COCKPIT (on main, clean tree), merge a finished
# worker's branch into main and clean up. Run after that worker's session ends.
# Assumes the branch name == the name you passed to `wt` (check with `wtls`).
#   wtmerge grading-fix
wtmerge() {
  if [ -z "${1:-}" ]; then echo "usage: wtmerge <branch>  (from the cockpit, on main)"; return 1; fi
  local branch="$1"
  git merge --no-edit "$branch" || {
    echo "merge conflict in $branch — resolve it, 'git commit', then continue. Nothing auto-pushed."
    return 1
  }
  git worktree prune
  git branch -d "$branch" 2>/dev/null || echo "  (branch $branch not deleted; remove manually if intended)"
  echo "merged $branch into main. Review the diff, then /push when ready."
}
