# Joining a project that already has the kit

You cloned or pulled a repo that ships these hooks. Most of it activates automatically, but two things need a one-time touch on *your* machine, because git and Claude Code deliberately don't auto-apply them.

## What works automatically

- **Skills** (`.claude/skills/*`), Claude Code auto-discovers project skills from `.claude/skills/`. They are already in the right place; nothing to do.
- **Hook wiring** (`.claude/settings.json`), Claude Code auto-reads this file, so the SessionStart / PreToolUse / SessionEnd hooks activate on their own.

## Fastest path: `./bootstrap.sh`

If the project ships the kit's `bootstrap.sh` (it should), that is the whole job. After cloning, from the project root:

```bash
./bootstrap.sh
```

It sets the git hooks path, restores exec bits, and sanity-checks Node + settings, then prints the only two things it can't automate (steps 2 and 3 below). Safe to re-run. If for some reason it isn't present, do the steps by hand:

## The one-time steps (what bootstrap does for you)

1. **Enable the project's git hooks.** Git does not honor a repo's hooks path automatically (it would be a security hole). Run once, in the repo:

   ```bash
   git config core.hooksPath .githooks
   ```

   Without this, the `post-merge` migration-awareness hook (and any pre-commit/pre-push gates) won't fire.

2. **Reconcile your local settings.** If you already had a `.claude/settings.json`, git may refuse to overwrite it on pull ("untracked working tree file would be overwritten"). Move your personal bits into `.claude/settings.local.json` (which stays gitignored and merges *over* the shared file, local winning), then let the shared `settings.json` land. From then on the two coexist.

3. **Start a fresh Claude Code session.** Skills and settings are read at session start, so open a new session in the repo after pulling for the new ones to load.

## Day-to-day rules

Read the "Concurrent agents on `main`" section in the project's `CLAUDE.md`. The short version:

- Stage explicit paths, never `git add -A` / `commit -am` (the guard enforces this).
- Never run tree-wide `git reset --hard` / `clean -f` / `stash`, they wipe other agents' uncommitted work.
- Schema changes go through migration files applied with your migration tool, never ad-hoc `psql` DDL.
- Pulling/rebasing the shared `main` is done on a clean tree, by the human, when agents are idle. Before a schema session, check `supabase migration list` (or your equivalent) to see what is actually applied vs your local files.
