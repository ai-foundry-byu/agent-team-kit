# Setting the kit up in a project

For the person introducing the kit to a repo (you, usually). A collaborator who is just *joining* a repo that already has it wants `SETUP-COLLABORATOR.md` instead.

## 1. Run the installer

```bash
./install.sh /path/to/your/project
```

It copies the hook scripts to `scripts/hooks/`, the git hook to `.githooks/post-merge`, drops in `.claude/settings.json` (or flags it for a manual merge if one exists), and sets `core.hooksPath=.githooks`.

## 2. Finish the manual steps it prints

1. **`.gitignore`** — append `snippets/gitignore-additions.txt`. If `.claude/` is currently blanket-ignored, switch it to the `.claude/*` + negations form from the snippet so the shared wiring and skills travel while `settings.local.json` stays local.
2. **`CLAUDE.md`** — paste `snippets/CLAUDE-md-section.md`.
3. **Customize for your stack** (see below).
4. **Restart** your Claude Code session so the hooks load (they are read at session start).

## 3. Customize for your stack

The defaults assume Supabase + pnpm. Edit:

- **`scripts/hooks/bash-guard.mjs`**
  - `SCHEMA_RE` — the commands that serialize behind the schema lock. Replace `supabase ... / db:types / seed:dev / pnpm add|remove|up` with your migration, codegen, seed, and dependency commands.
  - `PSQL_DDL_RE` — only relevant if you use `psql` against a SQL database. Remove the check if you don't.
- **`scripts/hooks/dev-port.mjs`** — `LOW`/`HIGH` port range and the reserved human port (default reserves `5173`, Vite's default).
- **`.githooks/post-merge`** — the migrations directory it watches (`supabase/migrations/`).

## 4. Verify

Start a fresh session and try a blocked command, e.g. ask the agent to run `git add -A` or an inline `psql ... ALTER TABLE ...`. The guard should refuse with an explanation. A normal `ls` or `git status` should be untouched and fast.

## What gets committed vs stays local

- **Committed (shared):** `scripts/hooks/*`, `.githooks/*`, `.claude/settings.json`, `.claude/skills/*`, the CLAUDE.md section, the gitignore lines.
- **Local per machine:** `.claude/settings.local.json` (personal config), and `core.hooksPath` (a git config each clone sets once — see collaborator setup).
- **Never tracked:** `.git/.wg-agent/` coordination state (lives inside `.git`).
