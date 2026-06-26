#!/bin/sh
# install.sh — wire the agent-team-kit into a project (new OR existing).
#
#   ./install.sh /path/to/project
#
# Idempotent and safe to re-run. On a built-out repo it only ADDS: hook scripts,
# the git hook, skills, bootstrap, and the .claude wiring; it appends to
# .gitignore and CLAUDE.md (guarded, never duplicating) and never edits your
# source. See docs/ADOPT.md for the path that fits your situation.
set -e

TARGET="${1:?usage: ./install.sh /path/to/project}"
KIT="$(cd "$(dirname "$0")" && pwd)"
[ -d "$TARGET/.git" ] || { echo "error: $TARGET is not a git repo (run 'git init' there first)"; exit 1; }

mkdir -p "$TARGET/scripts/hooks" "$TARGET/.githooks" "$TARGET/.claude/skills"

# 1. Hook scripts, git hook, skills, bootstrap (overwrite = always latest).
cp "$KIT"/hooks/scripts/* "$TARGET/scripts/hooks/"
cp "$KIT/hooks/githooks/post-merge" "$TARGET/.githooks/post-merge"
chmod +x "$TARGET/.githooks/post-merge"
cp -R "$KIT"/skills/* "$TARGET/.claude/skills/" 2>/dev/null || true
cp "$KIT/bootstrap.sh" "$TARGET/bootstrap.sh"
chmod +x "$TARGET/bootstrap.sh"
mkdir -p "$TARGET/docs"
cp "$KIT/docs/FEEDBACK-LOOP-SPEC.md" "$TARGET/docs/FEEDBACK-LOOP-SPEC.md"
echo "[ok] hook scripts, skills, bootstrap.sh, and the feedback spec in place"

# 2. .claude/settings.json (the Claude Code hook wiring).
if [ ! -f "$TARGET/.claude/settings.json" ]; then
  cp "$KIT/hooks/settings.json" "$TARGET/.claude/settings.json"
  echo "[ok] .claude/settings.json installed"
else
  echo "[!] .claude/settings.json exists — merge the hooks blocks from"
  echo "    $KIT/hooks/settings.json into it by hand (additive)"
fi

# 3. .gitignore — make the wiring + skills shareable (append-only, safe).
GI="$TARGET/.gitignore"; touch "$GI"
if grep -qF '!.claude/skills/' "$GI"; then
  echo "[ok] .gitignore already shares the .claude wiring"
elif grep -qxF '.claude/' "$GI"; then
  echo "[!] .gitignore has a blanket '.claude/' ignore. Change that one line to"
  echo "    '.claude/*' and add '!.claude/settings.json' + '!.claude/skills/'"
  echo "    (see snippets/gitignore-additions.txt). Left untouched to avoid clobbering."
else
  printf '\n# agent-team-kit: share hook wiring + skills; personal config in settings.local.json\n.claude/*\n!.claude/settings.json\n!.claude/skills/\n' >> "$GI"
  echo "[ok] appended .claude share rules to .gitignore"
fi

# 4. CLAUDE.md — the concurrent-agents rules (append-only, guarded).
CM="$TARGET/CLAUDE.md"
if [ -f "$CM" ] && grep -qF 'Concurrent agents on' "$CM"; then
  echo "[ok] CLAUDE.md already has the concurrent-agents section"
else
  [ -f "$CM" ] && printf '\n' >> "$CM"
  awk 'f; /-->/{f=1}' "$KIT/snippets/CLAUDE-md-section.md" >> "$CM"
  echo "[ok] appended the concurrent-agents section to CLAUDE.md"
fi

# 5. Enable the project's git hooks.
git -C "$TARGET" config core.hooksPath .githooks
echo "[ok] core.hooksPath = .githooks"

cat <<EOF

Installed into $TARGET. Next:
  1. Customize for your stack (skip if Supabase + pnpm):
       scripts/hooks/bash-guard.mjs   SCHEMA_RE / PSQL_DDL_RE
       scripts/hooks/dev-port.mjs     port range
       .githooks/post-merge           migrations dir
  2. (optional) Build the feedback loop: hand docs/FEEDBACK-LOOP-SPEC.md to your
     coding agent: "build the feedback loop from this spec for our stack."
  3. Commit the new files.
  4. Start a FRESH Claude Code session so the hooks + skills load.
  5. Adding a teammate later? They clone and run ./bootstrap.sh.

Pick the full path for your case in docs/ADOPT.md.
EOF
