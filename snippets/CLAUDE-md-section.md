<!--
Paste this section into your project's CLAUDE.md. It tells every Claude Code
agent how to behave on a shared `main`. The hooks enforce the load-bearing
parts; this text covers the discipline the hooks can't.
Adjust stack-specific names (supabase, pnpm, db:types, seed:dev) to match yours.
-->

## Concurrent agents on `main`

You may be one of several Claude Code agents working on `main` at the same time, and `main` may also be shared with a remote human collaborator who pushes periodically. Coordination hooks (`scripts/hooks/{dev-port,bash-guard,session-release}.mjs`, wired in `.claude/settings.json`) enforce the load-bearing parts; the rest is discipline. Cross-session state lives under `.git/.wg-agent/` (anchored to the common git dir, so it is shared across worktrees and never tracked).

- **Expect foreign changes.** `git status` and the working tree will often show uncommitted edits you did not make: a sibling agent mid-task. This is normal. Do not revert, stash, commit, or "tidy" another agent's changes. If you are unsure whether a change is yours, leave it.
- **Stage explicit paths only.** Commit the specific files you edited (`git add path/a path/b`); never `git add -A` / `git add .` / `git commit -am`, which sweep in siblings' in-flight work. (The bash-guard hook blocks the blanket forms.)
- **Never run tree-wide destructive git.** `git reset --hard`, `git checkout -- .`, `git clean -f`, `git stash` act on the WHOLE tree and will destroy other agents' uncommitted work. Scope to your own paths. (Hook-blocked.)
- **Don't pull or rebase on your own.** Grabbing the collaborator's commits (`git pull --rebase` / `git fetch` + `git rebase origin/main`) needs a clean tree and is a cockpit-only act the human runs when all agents are idle. Don't do it mid-session.
- **Dev server.** Start your own on the port the SessionStart hook assigned you; never touch the reserved human port. Kill only your own PID.
- **Schema/DB/deps are serialized.** Migrations, type generation, seeding, and dependency changes go through a repo-wide lock (bash-guard); a blocked command means another agent is mid-schema-work, so wait and retry. The lock is LOCAL: it does not coordinate with a remote collaborator, so coordinate migrations by hand.
- **DB changes travel as tracked migration files.** Every schema change is a numbered file in your migrations dir; never ad-hoc `psql`/dashboard DDL, which drifts the DB from the files with no trace. The bash-guard hook blocks schema DDL typed directly into psql; psql reads and `psql -f <file>` are unaffected. Git is the ledger of *intended* migrations; the applied truth lives in `supabase_migrations.schema_migrations` on the DB. A `post-merge` hook flags migrations that arrive when you pull.
- **Sharing the setup.** `.claude/settings.json` is tracked so the hook wiring travels; personal or machine-specific config belongs in `.claude/settings.local.json`, which stays gitignored. The two merge with local winning, so committing `settings.json` never clobbers a teammate's personal settings.
