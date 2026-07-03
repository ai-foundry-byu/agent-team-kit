#!/bin/sh
# Fast pre-filter for the PreToolUse Bash guard.
#
# The guard only acts on a few command shapes (dangerous git + schema/DB/dep
# commands). Spawning node for EVERY Bash call to discover that most don't
# match wastes ~35ms each. So gate it with shell BUILTINS only, `read` + a
# `case` glob, which spawn ZERO extra processes. The common path (ls, cat,
# pnpm test, git status/diff) costs only shell startup; node runs solely for
# commands that could actually be blocked. A false match just pays node and
# gets allowed, so correctness never depends on the glob being exact.
#
# Claude Code hook payloads are single-line compact JSON, so one `read` gets
# the whole thing (embedded newlines arrive escaped as \n, not real breaks).
DIR=$(dirname "$0")
IFS= read -r input || true
case "$input" in
  *'git add'* | *'git commit'* | *'git reset'* | *'git clean'* | *'git stash'* | *'git checkout'* | *'git push'* | *supabase* | *db:types* | *seed:dev* | *seed:comments* | *'pnpm add'* | *'pnpm remove'* | *'pnpm up'* | *psql*)
    printf '%s' "$input" | node "$DIR/bash-guard.mjs"
    exit $?
    ;;
esac
exit 0
