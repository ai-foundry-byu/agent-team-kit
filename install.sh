#!/bin/sh
# install.sh — wire the agent-team-kit into a project.
#
#   ./install.sh /path/to/project
#
# Copies the hook scripts + git hook into the project, drops in (or flags for
# merge) the .claude/settings.json wiring, and sets core.hooksPath. Prints the
# remaining manual steps (gitignore, CLAUDE.md, stack customization).
set -e

TARGET="${1:?usage: ./install.sh /path/to/project}"
KIT="$(cd "$(dirname "$0")" && pwd)"
[ -d "$TARGET/.git" ] || { echo "error: $TARGET is not a git repo"; exit 1; }

mkdir -p "$TARGET/scripts/hooks" "$TARGET/.githooks" "$TARGET/.claude"

cp "$KIT"/hooks/scripts/* "$TARGET/scripts/hooks/"
cp "$KIT/hooks/githooks/post-merge" "$TARGET/.githooks/post-merge"
chmod +x "$TARGET/.githooks/post-merge"
echo "copied hook scripts -> scripts/hooks/ and .githooks/post-merge"

# Project skills (worked examples — adapt or replace for your project).
if [ -d "$KIT/skills" ]; then
  mkdir -p "$TARGET/.claude/skills"
  cp -R "$KIT"/skills/* "$TARGET/.claude/skills/" 2>/dev/null || true
  echo "copied example skills -> .claude/skills/ (adapt these to your project)"
fi

# Plug-and-play onboarding for collaborators.
cp "$KIT/bootstrap.sh" "$TARGET/bootstrap.sh"
chmod +x "$TARGET/bootstrap.sh"
echo "copied bootstrap.sh -> project root (collaborators run this after cloning)"

if [ ! -f "$TARGET/.claude/settings.json" ]; then
  cp "$KIT/hooks/settings.json" "$TARGET/.claude/settings.json"
  echo "installed .claude/settings.json"
else
  echo "NOTE: $TARGET/.claude/settings.json already exists."
  echo "      Merge the hooks blocks from $KIT/hooks/settings.json into it by hand."
fi

git -C "$TARGET" config core.hooksPath .githooks
echo "set core.hooksPath=.githooks"

cat <<EOF

Done. Remaining manual steps:
  1. Append snippets/gitignore-additions.txt to $TARGET/.gitignore.
     If .claude/ is fully ignored there, switch it to '.claude/*' plus the
     '!.claude/settings.json' and '!.claude/skills/' negations from the snippet,
     so the shared wiring and skills travel while settings.local.json stays local.
  2. Paste snippets/CLAUDE-md-section.md into $TARGET/CLAUDE.md.
  3. Customize for your stack:
       scripts/hooks/bash-guard.mjs   (SCHEMA_RE, PSQL_DDL_RE)
       scripts/hooks/dev-port.mjs     (port range)
       .githooks/post-merge           (migrations dir)
  4. Start a fresh Claude Code session in the project so the hooks load.
  5. Commit the new files, and tell teammates to run ./bootstrap.sh after they
     clone (it does their one-time local setup).
EOF
