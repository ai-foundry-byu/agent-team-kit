# Hooks reference

Detailed documentation of every hook in the kit: what it is, how it works, why it matters, what to customize, and where its limits are. If you want the high-level rationale instead, read `DESIGN-NOTES.md`; this is the per-artifact reference.

There are **two kinds of hook** in this kit, and the distinction matters:

- **Claude Code hooks** — registered in `.claude/settings.json`, fired by Claude Code around its own lifecycle and tool calls (session start/end, before/after a tool runs). These coordinate the *agents*.
- **Git hooks** — scripts in `.githooks/`, fired by git around git operations (commit, merge, push). These coordinate around the *repository*. Git only runs them if `core.hooksPath` is set (a per-clone config), which is why collaborators have a one-time setup step.

Everything shares one piece of state: a coordination directory at `.git/.wg-agent/`, described at the end.

---

## The wiring: `.claude/settings.json`

This file is what makes the Claude Code hooks active. Each entry binds a lifecycle event (and, for tool hooks, a tool matcher) to a command. The kit registers four:

```jsonc
SessionStart  -> dev-port.mjs            // assign a dev port
PreToolUse/Bash -> bash-guard.sh         // guard every shell command
PostToolUse/Edit|Write -> file-size-nudge.mjs  // in-session arch-guard preview
SessionEnd    -> session-release.mjs     // free the lock + port
```

**Why it matters:** the scripts can live in the repo, but nothing runs them until this file points at them. And because Claude Code reads `settings.json` at session start, a freshly-pulled change needs a new session to take effect. The file is tracked (see the `.gitignore` snippet) so the wiring travels; personal overrides go in the gitignored `settings.local.json`, which merges over it.

A hook returns its verdict by exit code: **exit 0** allows (and is silent), **exit 2** blocks the action and feeds its stderr back to the agent as the reason. That two-value contract is the whole enforcement mechanism.

---

## `dev-port.mjs` — SessionStart: one dev server per agent

**What it is.** A SessionStart hook. It runs once when a Claude Code session begins.

**What it does.** It walks a port range (default `5180`–`5199`), claims the first free one with an atomic `mkdir` marker plus a real TCP bind check (so it won't hand out a port something else is already on), records the owning session and a timestamp, and injects the assignment into the session as context: "your dev server port is N; start it with `pnpm dev --port N --strictPort`." A claim older than 12 hours is treated as abandoned and reclaimable.

**Why it matters.** This is the single most valuable piece, because dev-server port thrash is the most frequent real-world collision. Without it, every agent assumes Vite's default `5173`, so multiple `pnpm dev` instances fight over one port and you get 503s, phantom 404s, and dead clicks that look like app bugs but are just two servers colliding. Reserving `5173` for the human and handing each agent its own port removes an entire class of "is the app broken or is it me" confusion. `--strictPort` matters too: if two sessions race onto the same port, the second `pnpm dev` fails loudly instead of silently drifting onto someone else's server.

**Customize (the per-project config block at the top of the file).** Four constants:
- `POOL_LOW` / `POOL_HIGH` — the agent dev-server pool (default `5180`–`5199`, 20 slots).
- `RESERVED_PORT` — your dev server's default port, kept for the human. Vite's `5173` by default; Next's is `3000`; a custom server is whatever you set.
- `START_HINT(port)` — how your stack launches a dev server on a chosen port: `pnpm dev --port N --strictPort` (Vite/SvelteKit), `pnpm dev -p N` (Next), `PORT=N pnpm dev` (Node/Express).

**Choosing the pool — what's off-limits.** Avoid privileged ports below `1024` (need root), the ephemeral range `49152`–`65535` (the OS hands these out for outbound connections, so binding there invites random collisions), and on macOS `5000`/`7000` (AirPlay Receiver / Control Center grab them — a classic "why won't my dev server start"). Steer clear of common local services too (`5432` Postgres, `3306` MySQL, `6379` Redis, `8080` proxies). The conventional dev-server zone is `3000`–`9999`; the default pool sits just above Vite's `5173` and clears all of the above. Don't leave the pool open-ended — a small *defined* range is what keeps agents off service and ephemeral ports.

**One pool per app.** Port claims live in each repo's `.git/.wg-agent`, so two different apps' agents can't see each other's claims; only the bind-check catches a real collision. If you run agents on two apps at once, give each its own non-overlapping pool (e.g. app A `5180`–`5199`, app B `3010`–`3029`) so they never contend for the same OS port.

**Limits.** The claim reduces races but can't fully prevent two simultaneous SessionStarts from picking the same free port; `--strictPort` is the backstop. It assigns a port; it does not start or stop servers.

---

## `bash-guard.mjs` + `bash-guard.sh` — PreToolUse: the gatekeeper on every shell command

This is the largest hook and does three jobs. It runs before every Bash tool call, on the raw command string, and is the one place an agent can be *stopped* rather than nudged.

### The pre-filter (`bash-guard.sh`)

**What it is.** A thin shell wrapper that the settings.json actually points at; it decides whether the real guard needs to run.

**Why it exists.** A PreToolUse/Bash hook fires on *every* shell command. Spawning Node each time (~35ms) just to discover that `ls` isn't dangerous is wasted latency on the hottest path in a session. The wrapper checks the command with shell builtins only (`read` + a `case` glob, zero extra processes) and only spawns Node for command shapes that could actually be blocked (git mutations, schema/dep commands, psql). Everything else returns in a few milliseconds. A false match just pays for Node and is then allowed, so correctness never depends on the glob being exact, only speed does. This is a general pattern worth stealing: **put a cheap filter in front of an expensive guard when the guard runs on a hot path.**

### Job 1: git safety

**What it does.** Blocks two families of git command:

- **Blanket staging** — `git add -A`, `git add .`, `git commit -am`. On a shared working tree these stage *everything*, including a sibling agent's in-flight edits, producing commits that mix two agents' work. The guard forces explicit paths (`git add path/a path/b`).
- **Tree-wide destructive commands** — `git reset --hard`, `git checkout -- .`, `git clean -f`, `git stash`, and force-push. These act on the *whole* tree and will silently destroy another agent's uncommitted work.

**Why it matters.** These two have very different stakes, and the second is the scary one. A blanket commit is messy history you can untangle later. A stray `git reset --hard` or `git stash` is an hour of another agent's work *gone*, with no commit to recover from. On a single-agent repo these commands are routine; on a shared tree they are footguns, and the guard turns the footgun into an explained refusal. It also blocks force-push because rewriting shared history is the one git act that can damage a *collaborator's* clone, not just the local tree.

**How it stays precise.** It strips quoted substrings before matching, so a commit *message* that mentions "git add ." doesn't trip the staging block, and it anchors flags to sit right after the subcommand so a stray token in an argument doesn't false-positive.

**Customize.** The `GIT_BLOCKS` array — add or relax patterns. **Limits.** It is regex over a shell string, not a git parser; exotic phrasings can evade it, and it only governs the `git` CLI.

### Job 2: the schema lock

**What it does.** Serializes schema-mutating commands (migrations, type generation, seeding, dependency installs) behind a single repo-wide lock. The first agent to run such a command acquires the lock (an atomic `mkdir` of a lock dir under the coordination directory) and records itself as owner; a second agent's schema command is blocked with "another session holds the schema lock, wait and retry." The lock is a **self-healing lease**: an owner that goes quiet for 10 minutes is considered stale and the lock is stealable, so a crashed session can never deadlock the team.

**Why it matters.** Two migrations at once, or a `seed --reset` while another agent is mid-task, corrupts shared state in ways that are miserable to debug because nothing *errors* — the database just quietly becomes wrong. Serializing these is the difference between "agents take turns at the schema" and "agents race at the schema." The self-healing lease matters as much as the lock: a naive lock that never expires turns one crashed agent into a frozen team.

**Customize.** `SCHEMA_RE` — the set of commands that count as schema work. This is the most stack-specific knob; replace the Supabase/pnpm patterns with your migration, codegen, seed, and dependency commands. `LEASE_SECONDS` — how long before a quiet lock is stealable.

**Limits.** The lock is **local to one machine.** It coordinates this laptop's agents; it knows nothing about a remote collaborator's machine. Cross-person migration coordination is a human conversation, not this lock.

### Job 3: the ad-hoc psql DDL block

**What it does.** Blocks schema DDL typed directly into `psql` (`CREATE`/`ALTER`/`DROP` + object, `TRUNCATE`, `GRANT`/`REVOKE`). It deliberately leaves `SELECT` reads and `psql -f <file>` untouched.

**Why it matters.** The team's shared understanding of "what is the schema" rests on one invariant: every schema change is a tracked migration file applied through the migration tool, which records it in the database's `schema_migrations` table. DDL run straight through psql writes to the database but leaves *no* file and *no* row in that table — pure invisible drift, the exact thing that makes two people disagree about the schema. The block preserves the invariant. The reason it costs nothing: **DDL and querying are disjoint operations.** Querying is `SELECT`; blocking `ALTER`/`CREATE`/`DROP` removes zero query power, so you keep full freedom to inspect the database.

**Customize / remove.** Drop it if you don't use psql. **Limits (important).** It is a tripwire, not a fence: it is regex (finite keyword list), it only knows `psql` (a Node `pg` script or a GUI sails past), and `psql -f` is an intentional hole. It is a client-side nudge toward migrations, not a security control. The real boundary, if you need a guarantee, is a **database role with no DDL privileges**.

---

## `session-release.mjs` — SessionEnd: clean up after yourself

**What it is.** A SessionEnd hook, run once when a session ends.

**What it does.** Frees the schema lock and the dev-port claim that this session owns. It checks ownership first, so it never releases another session's resources.

**Why it matters.** It is the fast path that returns the lock and port the instant a session ends cleanly, instead of waiting for the staleness leases to expire. The leases (10 minutes for the lock, 12 hours for the port) are the backstop for *unclean* deaths; this hook handles the common clean case immediately, so the next agent isn't waiting on a timeout for a resource nobody is using.

**Limits.** Best-effort; if a session is killed hard, SessionEnd may not fire, and recovery falls back to the staleness leases.

---

## `agent-coord.mjs` — the shared helper

**What it is.** Not a hook itself, but the small module the hooks import. It parses the hook's stdin payload and, crucially, resolves the **coordination directory**.

**Why it matters.** It computes the coordination path via `git rev-parse --git-common-dir`, not a literal `.git`. That one detail makes the whole system correct under git worktrees: a per-worktree `.git` would give each agent its *own* lock (no mutual exclusion at all), whereas the common dir resolves to the same absolute path for the main checkout and every worktree. If you only read one function to understand why the locks actually work, it is this one.

---

## `post-merge` — a git hook: migration awareness on pull

**What it is.** A *git* hook (in `.githooks/`, not a Claude Code hook), fired by git after a `merge` or `pull` completes.

**What it does.** It diffs what just arrived against your prior state and, if any migration files were added or modified, prints a loud notice listing them and pointing at `supabase db push` (to apply) and `supabase migration list` (to check applied-vs-local drift). It is silent when no migrations changed.

**Why it matters.** With two people on one `main`, a routine `git pull` can quietly bring your teammate's migration files into your tree while the shared database is already ahead of, or behind, your local schema. A quiet pull is easy to miss; this turns "you silently fell out of sync with the schema" into an unmissable message at the exact moment it happens. It is deliberately **git-only** (no network, no credentials) so every pull stays instant; the live "is the database actually in sync" check is the explicit `supabase migration list` it points you to.

**Customize.** The migrations directory path it watches. **Setup caveat.** Git won't run it until the collaborator sets `git config core.hooksPath .githooks` once — by design (pulling code shouldn't silently run scripts).

---

## The coordination state: `.git/.wg-agent/`

All cross-session state — port claims and the schema lock — lives here. Two properties are deliberate:

- **It is inside `.git`,** so it is never tracked and needs no `.gitignore` rule. Coordination state is machine-local by nature; it should never be committed.
- **It is anchored to the common git dir,** so it is shared across the main checkout and any worktrees on the same machine.

If you ever need to debug the system, this is where to look: `ports/<n>/owner` shows who holds each port, `schema.lock/owner` shows who holds the schema lock and when they last touched it.

---

## Architecture guards — keeping agent-written code from sprawling

Four scripts form the kit's *code-quality* layer (distinct from the coordination hooks above). They run the same two judgements in two places: an in-session nudge and a commit-time gate.

- **`file-size-budget.mjs`** (config + helpers). The file-size ratchet. `BUDGET` caps new files (800 lines by default); `FROZEN` grandfathers today's oversized files at their current count (shrink-only); `EXEMPT` lets a genuinely-single-concern file off with a written reason; `isGoverned` selects which files the guard covers (edit the extensions/root for your stack). The number is an *alarm to check cohesion*, not a target — the fix is "split along the seam," never "delete lines to get under it."
- **`import-boundaries.mjs`** (config + helper). The import-boundary guard. `RESTRICTED_RE` matches a dangerous import (default: a privilege-escalating server DB client that bypasses RLS); `ALLOWLIST` grandfathers the current importers (shrink-only); any new importer fails until it's added with a call-site reason. Use it for any capability you want kept rare and intentional.
- **`file-size-nudge.mjs`** (PostToolUse hook). Runs both guards the moment an Edit/Write trips one and surfaces it to the agent (exit 2 + stderr). Advisory — it never blocks the edit (which already happened); it's the in-loop reminder so violations get fixed before commit.
- **`arch-check.mjs`** (CLI gate). Runs both guards over the files you pass (the pre-commit hook passes the staged files) or the whole `src/` tree (use this form in CI). Exit 1 on any violation — the *enforcement* the nudge previews.

**Seeding for a brownfield repo:** run `node scripts/hooks/arch-check.mjs` once, then paste the over-budget files into `FROZEN` and any flagged importers into `ALLOWLIST`. That grandfathers your current state so only *new* sprawl is blocked, and the ratchet tightens as you pay it down.

**Why it matters:** this is the failure mode coordination doesn't touch. Agents write a lot of code fast; without a ratchet, files grow to thousands of lines and dangerous imports spread silently. The guards make both a deliberate, visible choice.

---

## Git gates: `pre-commit` and `pre-push`

Two *git* hooks (in `.githooks/`, run via `core.hooksPath`), staged so the cheap checks run before history and the heavier ones before a push.

- **`pre-commit`** — fast, staged-files-only. Runs `arch-check.mjs` on the files in the commit so sprawl / boundary violations never enter history. There's a marked spot to add your formatter/linter (staged files only). Kept light so "commit often" stays cheap. Bypass: `git commit --no-verify`.
- **`pre-push`** — the heavier gate before a push (which often triggers a paid build/deploy): your typecheck (`CHECK_CMD`) and tests (`TEST_CMD`), both set in a config block at the top of the file. Tag must-never-break E2E specs `@critical` and add them to `TEST_CMD` (e.g. `playwright test --grep @critical`). Kept fast (no full E2E/build) so it doesn't discourage pushing; run the full suite in CI post-push. Bypass: `git push --no-verify`.

**Install caveat:** the installer copies these only if the project doesn't already have a `pre-commit` / `pre-push` — it won't clobber yours; if you have them, merge the kit's logic in by hand. Like `post-merge`, they need `core.hooksPath .githooks` set (the installer and `bootstrap.sh` do this).
