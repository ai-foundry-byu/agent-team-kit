#!/bin/sh
# install.sh, wire the agent-team-kit into a project (new OR existing).
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
# Git gates (pre-commit arch guard + pre-push test gate), only if ABSENT, so a
# project's existing hooks are never clobbered. If present, the user merges them.
for gh in pre-commit pre-push; do
  if [ -f "$TARGET/.githooks/$gh" ]; then
    echo "[!] .githooks/$gh exists, merge the kit's version ($KIT/hooks/githooks/$gh) by hand"
  else
    cp "$KIT/hooks/githooks/$gh" "$TARGET/.githooks/$gh"
    chmod +x "$TARGET/.githooks/$gh"
  fi
done
cp -R "$KIT"/skills/* "$TARGET/.claude/skills/" 2>/dev/null || true
cp "$KIT/bootstrap.sh" "$TARGET/bootstrap.sh"
chmod +x "$TARGET/bootstrap.sh"
cp "$KIT/worktree-commands.sh" "$TARGET/worktree-commands.sh"
mkdir -p "$TARGET/docs"
cp "$KIT/docs/FEEDBACK-LOOP-SPEC.md" "$TARGET/docs/FEEDBACK-LOOP-SPEC.md"
cp "$KIT/docs/SIDEBAR-SPEC.md" "$TARGET/docs/SIDEBAR-SPEC.md"
cp "$KIT/docs/DRIVING-THE-APP.md" "$TARGET/docs/DRIVING-THE-APP.md"
echo "[ok] hook scripts, skills, bootstrap.sh, and the build specs in place"

# 2. .claude/settings.json (the Claude Code hook wiring).
if [ ! -f "$TARGET/.claude/settings.json" ]; then
  cp "$KIT/hooks/settings.json" "$TARGET/.claude/settings.json"
  echo "[ok] .claude/settings.json installed"
else
  echo "[!] .claude/settings.json exists, merge the hooks blocks from"
  echo "    $KIT/hooks/settings.json into it by hand (additive)"
fi

# 3. .gitignore, make the wiring + skills shareable (append-only, safe).
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

# 3b. .gitignore, ignore the mockups scratch dir (out of code search + commits).
if ! grep -qxF '.mockups/' "$GI"; then
  printf '\n# agent-team-kit: high-fidelity design mockups (gitignored; out of code search + commits)\n.mockups/\n' >> "$GI"
  echo "[ok] added .mockups/ to .gitignore"
fi

# 4. CLAUDE.md, the concurrent-agents rules (append-only, guarded).
CM="$TARGET/CLAUDE.md"
if [ -f "$CM" ] && grep -qF 'Concurrent agents on' "$CM"; then
  echo "[ok] CLAUDE.md already has the concurrent-agents section"
else
  [ -f "$CM" ] && printf '\n' >> "$CM"
  awk 'f; /-->/{f=1}' "$KIT/snippets/CLAUDE-md-main.md" >> "$CM"
  echo "[ok] appended the concurrent-agents section to CLAUDE.md"
fi

# 4b. CLAUDE.md, the working-discipline / definition-of-done section.
if [ -f "$CM" ] && grep -qF 'Working discipline' "$CM"; then
  echo "[ok] CLAUDE.md already has the working-discipline section"
else
  printf '\n' >> "$CM"
  awk 'f; /-->/{f=1}' "$KIT/snippets/CLAUDE-md-working-discipline.md" >> "$CM"
  echo "[ok] appended the working-discipline section to CLAUDE.md"
fi

# 4c. CLAUDE.md, the mockups / design-iteration section.
if [ -f "$CM" ] && grep -qF 'Mockups and design iteration' "$CM"; then
  echo "[ok] CLAUDE.md already has the mockups section"
else
  printf '\n' >> "$CM"
  awk 'f; /-->/{f=1}' "$KIT/snippets/CLAUDE-md-mockups.md" >> "$CM"
  echo "[ok] appended the mockups section to CLAUDE.md"
fi

# 5. Enable the project's git hooks.
git -C "$TARGET" config core.hooksPath .githooks
echo "[ok] core.hooksPath = .githooks"

cat <<EOF

Installed into $TARGET. Next:
  1. Customize for your stack:
       scripts/hooks/file-size-budget.mjs    BUDGET / FROZEN / EXEMPT / isGoverned
       scripts/hooks/import-boundaries.mjs   RESTRICTED_RE / ALLOWLIST
       scripts/hooks/bash-guard.mjs          SCHEMA_RE / PSQL_DDL_RE (Supabase + pnpm default)
       scripts/hooks/dev-port.mjs            port pool + RESERVED_PORT + START_HINT
       .githooks/pre-push                    CHECK_CMD / TEST_CMD (+ your @critical E2E)
       .githooks/post-merge                  migrations dir
     Then seed the guards: run `node scripts/hooks/arch-check.mjs` once and paste
     any over-budget files into FROZEN and any restricted importers into ALLOWLIST.
  2. (optional) Build the feedback loop: hand docs/FEEDBACK-LOOP-SPEC.md to your
     coding agent: "build the feedback loop from this spec for our stack."
  3. Commit the new files.
  4. Start a FRESH Claude Code session so the hooks + skills load.
  5. Adding a teammate later? They clone and run ./bootstrap.sh.
  6. Prefer worktrees to stay-on-main? Source worktree-commands.sh for the
     wt / cockpit / wtmerge commands, see the kit's docs/WORKTREE-MODE.md.

Pick the full path for your case in docs/ADOPT.md.
EOF
