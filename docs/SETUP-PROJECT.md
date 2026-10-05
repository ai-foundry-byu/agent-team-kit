# Setting the kit up in a project

The full step-by-step for all three situations is in [`ADOPT.md`](./ADOPT.md): the prerequisites, the no-nesting install pattern, and the solo-brownfield / new-pair / adding-a-second paths. This page is just the reference tables those paths lean on.

## The installer, in one line

From your project root, after committing your working tree (so you can review what's added):

```bash
gh repo clone ai-foundry-byu/agent-team-kit /tmp/agent-team-kit
/tmp/agent-team-kit/install.sh "$PWD"
rm -rf /tmp/agent-team-kit
```

The kit is run *against* your repo, not nested inside it. `install.sh` is idempotent and safe on a built-out repo: it copies the hooks, skills, `bootstrap.sh`, and the feedback spec into place; appends the `.claude` share rules to `.gitignore` and the concurrent-agents section to `CLAUDE.md` (guarded, never duplicating); sets `core.hooksPath`; and never touches your source.

## Customize for your stack

The defaults assume Supabase + pnpm. Edit:

- `scripts/hooks/bash-guard.mjs`, `SCHEMA_RE` (the commands that serialize behind the schema lock) and `PSQL_DDL_RE` (the ad-hoc-DDL block; remove it if you don't use psql).
- `scripts/hooks/dev-port.mjs`, the config block: `POOL_LOW`/`POOL_HIGH` (the agent port pool), `RESERVED_PORT` (your dev server's default port, kept for the human), and `START_HINT` (your stack's dev-server command). Give each app its own non-overlapping pool if you run several at once.
- `.githooks/post-merge`, the migrations directory it watches.

## What gets committed vs stays local

- **Committed (shared):** `scripts/hooks/*`, `.githooks/*`, `.claude/settings.json`, `.claude/skills/*`, `docs/FEEDBACK-LOOP-SPEC.md`, the CLAUDE.md section, the `.gitignore` lines.
- **Local per machine:** `.claude/settings.local.json` (personal config), and `core.hooksPath` (each clone sets it once; `bootstrap.sh` does it).
- **Never tracked:** `.git/.wg-agent/` coordination state (it lives inside `.git`).

## Verify

Start a fresh session and try a blocked command (`git add -A`, or an inline `psql ... ALTER TABLE ...`), the guard should refuse with an explanation. A normal `ls` or `git status` should be untouched and fast.
