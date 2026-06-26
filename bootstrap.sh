#!/bin/sh
# bootstrap.sh, one-time local setup for a teammate who just cloned a project
# that ships this kit. Run it from the project root. Safe to re-run.
#
# install.sh copies this into the project root, so collaborators just:
#   git clone <project> && cd <project> && ./bootstrap.sh
set -e

[ -d .git ] || { echo "[!] run this from the project root (no .git here)"; exit 1; }

# 1. Enable the project's git hooks. Git does NOT do this on clone (by design:
#    pulling code shouldn't silently run scripts), so it's the key manual step.
git config core.hooksPath .githooks
echo "[ok] core.hooksPath = .githooks  (post-merge migration flag + any pre-commit/pre-push gates)"

# 2. Restore exec bits (some clone/zip paths drop them).
chmod +x .githooks/* scripts/hooks/*.sh 2>/dev/null || true
echo "[ok] hook scripts marked executable"

# 3. Sanity checks (warn, don't fail).
command -v node >/dev/null 2>&1 && echo "[ok] node on PATH" || echo "[!] node not found, the Claude Code hooks need it"
[ -f .claude/settings.json ] && echo "[ok] .claude/settings.json present (hooks wired)" || echo "[!] .claude/settings.json missing, hooks won't load"

cat <<'EOF'

Two things this script cannot do for you:
  1. Personal config: put any personal Claude settings (permissions, machine
     paths) in .claude/settings.local.json, it is gitignored and merges OVER
     the shared settings.json, local winning, so it never collides with the team's.
  2. Start a FRESH Claude Code session in this project. Skills and hooks are read
     at session start, so a session open during the clone won't see them yet.

That's it, you're set up to work on shared main with the rest of the team.
EOF
