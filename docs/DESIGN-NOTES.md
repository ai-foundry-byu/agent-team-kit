# Design notes: why each piece exists

This is the reasoning behind the kit, so you can adapt it rather than cargo-cult it. A readable, redacted narrative of the session it came from is in [`ORIGIN-CONVERSATION.md`](./ORIGIN-CONVERSATION.md); the raw transcript is kept out of this repo on purpose (see the README).

## The framing decision: stay on `main`, don't reach for worktrees

The first instinct for "many agents, one repo" is git worktrees: each agent on its own branch in its own directory. For a solo dev or a small team this is usually the wrong default, because it solves the problem you mostly don't have and skips the ones you do.

Map the collisions:

| Collision | Worktrees fix it? |
|---|---|
| Dev server port thrash | No, each worktree still runs its own dev server on its own port |
| Database / schema collisions | No, all worktrees share one `.env` / one database; isolation stops at the filesystem |
| File-edit overwrites | Yes, separate working dirs |
| Git staging confusion | Yes, separate index per worktree |

Worktrees isolate *files*. The painful collisions (ports, database) live *outside* the file boundary, so worktrees don't touch them, and they add a recurring **N-way merge tax**: three branches don't merge as a set, you merge them one at a time into `main`, and the later merges run against a `main` the earlier ones already changed. If the streams overlapped, worktrees didn't prevent the conflict, they relocated it to merge time.

So this kit takes the other path: **everyone commits to `main`, you partition work by area, and you isolate the runtime (ports) and guard the dangerous edges (git, schema) with hooks.** Worktrees remain a deliberate escape hatch for the rare task where two agents must edit the same files unattended, not the default.

The integration model that pairs with this: keep one Claude session as a **cockpit** in the main checkout. It does the human-gated acts (pulling a collaborator's commits on a clean tree, merging, the single `git push`). Worker agents produce; the cockpit integrates.

## The coordination substrate: the filesystem

Claude Code agents are independent processes with separate context. They cannot message each other. There is an experimental "agent teams" feature with a shared task list and mailbox, but it defaults to one working directory (so agents still collide on files), keeps its file-locking internal (no API you can borrow), and is not stable. So this kit assumes no inter-agent channel and routes all coordination through **lock files on disk** plus **git**.

Lock state lives under `.git/.wg-agent/`, resolved via `git rev-parse --git-common-dir`. That matters: a per-worktree `.git` would give each agent its *own* lock (no mutual exclusion). The common dir is the same absolute path for the main checkout and every worktree, so the lock is genuinely shared.

## The hooks, one at a time

- **`dev-port.mjs` (SessionStart).** Each session needs its own `pnpm dev`. It claims a free port in a range (atomic `mkdir` marker + a real bind check), reserves the human's default port, and injects the assignment as context. Abandoned claims are reclaimable after a staleness window. This is the single highest-value piece, because port thrash is the most frequent real-world pain.

- **`bash-guard.mjs` (PreToolUse on Bash).** Three jobs in one process:
  1. **Git safety.** Blocks blanket staging (`git add -A`, `commit -am`) that sweeps in siblings' work, and tree-wide destructive commands (`reset --hard`, `clean -f`, `stash`, `checkout -- .`, force-push) that *destroy* siblings' uncommitted work. The destructive set is the higher-stakes one: a bad commit is messy history, but a stray `reset --hard` is an hour of someone else's work gone.
  2. **Schema lock.** Serializes migrations / codegen / seeding / dependency changes behind a repo-wide, self-healing lease (10-minute staleness steal, so a crashed session can't deadlock the rest). It's a *local* lock: it coordinates this machine's agents, not a remote collaborator.
  3. **Ad-hoc psql DDL block.** See below.

- **`bash-guard.sh` (the pre-filter).** The guard would otherwise spawn node on *every* Bash call (~35ms) just to find most commands aren't relevant. The shell wrapper checks with builtins only (`read` + `case` glob, zero extra processes) and only spawns node for command shapes that could be blocked. A false match just pays node and is allowed, so correctness never depends on the glob being exact.

- **`session-release.mjs` (SessionEnd).** Frees this session's lock and port on a clean exit. The staleness leases are the backstop for unclean exits.

## The database awareness model

With two people (and their agents) sharing one database, "are we on the same page about the schema" has a precise answer:

- **Git is the ledger of *intended* migrations**, the tracked files in your migrations directory.
- **The database's own `supabase_migrations.schema_migrations` table is the *applied* truth**, every migration version it has actually run. Query it directly (works with just a connection string, no CLI) or via `supabase migration list`, which diffs local files against it.
- The gap between the two is drift. With two authors that gap is what bites you, so the `post-merge` git hook flags migration files that arrive on a pull, and the discipline is to check applied-vs-local before starting schema work.

The whole model depends on one invariant: **every schema change goes through the migration tool**, so that table stays a complete record. Anything that changes the DB without a migration (ad-hoc DDL, dashboard edits) is invisible to both git and the table.

## The psql DDL guard, and its honest limits

`bash-guard.mjs` blocks `psql` + DDL verbs (`CREATE`/`ALTER`/`DROP` + object, `TRUNCATE`, `GRANT`/`REVOKE`). It leaves `SELECT` reads and `psql -f <file>` alone, because **DDL and querying are disjoint**, you lose no query power by blocking schema mutation.

Know what it is and isn't:

- It is a **regex tripwire, not a SQL parser**: finite keyword list (false negatives on exotic DDL), and rare false positives on reads containing DDL words as data.
- It only knows **psql**. A Node `pg` script, a GUI client, or the dashboard SQL editor sail past it.
- `psql -f` is an **intentional hole** (the sanctioned fallback), but that path also skips `schema_migrations`. Prefer the migration tool.
- It is a **client-side nudge, not a boundary**. Anyone with the connection string can bypass it with another tool. True enforcement is a **database role with no DDL privileges**, a different mechanism for when you need a guarantee instead of a guard rail.

## Sharing the setup: tracked vs local

Claude Code reads config and skills from canonical locations, so sharing is just "put the file where git can carry it":

- `.claude/settings.json`, auto-read; tracking it shares the hook wiring. Personal config goes in `.claude/settings.local.json` (gitignored), which *merges over* the shared file, local winning. So sharing never clobbers a teammate's personal settings.
- `.claude/skills/*`, auto-discovered from that path; tracking the directory shares project skills. (A blanket `.claude/` ignore blocks this; use the `.claude/*` + negation form.)
- Git hooks (`.githooks/`), the scripts travel, but `core.hooksPath` is a per-clone git config each person sets once. Git won't auto-honor a repo's hooks path, by design.

The recurring lesson: **a file in the repo is necessary but not sufficient.** Skills and settings auto-load; git hooks need one config command; both can require a fresh session to pick up.
