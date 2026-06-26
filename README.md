# Agent Team Kit

A drop-in setup for running **several Claude Code agents on one shared `main` branch** without them stepping on each other, plus the discipline a **two-person team** (or a solo dev driving many agents) needs to share that setup cleanly.

It came out of a real working session on a SvelteKit + Supabase project. The full origin story and reasoning are preserved verbatim in [`conversation-transcript.jsonl`](./conversation-transcript.jsonl); the distilled "why" is in [`docs/DESIGN-NOTES.md`](./docs/DESIGN-NOTES.md).

## The problem this solves

When you run multiple Claude Code agents at once against the same repo, they collide on things that have nothing to do with the code:

- **The dev server port** — multiple `pnpm dev` instances fighting over `5173`, causing 503s and phantom failures.
- **The database / schema** — two migrations, or a `seed --reset` while another agent is working, corrupting shared state.
- **The git working tree** — one agent sweeping another's changes into a commit (`git add -A`), or a tree-wide `git reset --hard` / `git stash` wiping a sibling's uncommitted work.
- **The shared remote `main`** — once a collaborator is pushing too: pulls, rebases, and migration drift.

Git worktrees isolate *files* but do nothing for ports or the database, and they add a merge tax. This kit takes the other path: **stay on `main`, isolate the runtime, and enforce the dangerous edges with hooks.**

## The core idea

Claude Code agents are separate processes. They cannot see each other's plans. So coordination has to route through something they all touch:

- **The filesystem** — lock files under `.git/.wg-agent/` (anchored to the shared git dir, so they work across worktrees too).
- **Git** — tracked migration files and a shared `.claude/settings.json`.

The hooks are the teeth. The docs are the discipline. Neither alone is enough.

## What's inside

| Path | What it is |
|---|---|
| `hooks/scripts/dev-port.mjs` | SessionStart: assigns each session its own dev-server port, reserves one for the human |
| `hooks/scripts/bash-guard.mjs` | PreToolUse: blocks tree-wide/destructive git, serializes schema/DB/dep commands behind a lock, blocks ad-hoc psql DDL |
| `hooks/scripts/bash-guard.sh` | Zero-spawn shell pre-filter in front of the guard (keeps the common path fast) |
| `hooks/scripts/session-release.mjs` | SessionEnd: frees this session's lock + port |
| `hooks/scripts/agent-coord.mjs` | Shared helpers (coordination dir, stdin parse) |
| `hooks/githooks/post-merge` | Flags DB migrations that arrive when you pull |
| `hooks/settings.json` | The `.claude/settings.json` wiring that registers the hooks |
| `snippets/gitignore-additions.txt` | The `.gitignore` lines (share settings + skills, keep personal local) |
| `snippets/CLAUDE-md-section.md` | The "concurrent agents on `main`" rules to paste into your project's CLAUDE.md |
| `install.sh` | Wires all of the above into a target project |
| `docs/` | Project setup, collaborator setup, and design notes |

## Quickstart

**Install into a project:**

```bash
./install.sh /path/to/your/project
```

Then finish the manual steps it prints (gitignore, CLAUDE.md, stack customization), and start a fresh Claude Code session so the hooks load. Details: [`docs/SETUP-PROJECT.md`](./docs/SETUP-PROJECT.md).

**Joining a project that already has it:** [`docs/SETUP-COLLABORATOR.md`](./docs/SETUP-COLLABORATOR.md) — a short one-time checklist (the `core.hooksPath` config and the `settings.local.json` split).

## Customize for your stack

The guards ship tuned for **Supabase + pnpm**. Adjust these for your stack:

- `hooks/scripts/bash-guard.mjs` — `SCHEMA_RE` (which commands serialize behind the lock) and `PSQL_DDL_RE` (the ad-hoc-DDL block).
- `hooks/scripts/dev-port.mjs` — `LOW`/`HIGH` port range and the reserved human port.
- `hooks/githooks/post-merge` — the `supabase/migrations/` path it watches.

## The team-of-two workflow

The model that pairs with this kit: stay all on `main`, partition work by area, and reserve one Claude session as a **cockpit** in the main checkout for integration (pulling the collaborator's commits on a clean tree, merging, and the one human-run `git push`). Worktrees are an optional escape hatch for the rare task where two agents must edit the same files; they are not the default. See `docs/DESIGN-NOTES.md` for the full reasoning, including why worktrees were considered and set aside.

## Good for solo work too

Most of this earns its keep with zero collaborators: the port assignment and the git/schema guards protect you from your *own* parallel agents. The collaborator-specific pieces (post-merge migration flag, the pull/rebase discipline) simply lie dormant until a second person shows up.
