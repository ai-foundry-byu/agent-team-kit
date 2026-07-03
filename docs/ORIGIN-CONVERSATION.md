# How this kit came to be

A redacted, readable narrative of the working session this kit was designed in. The raw verbatim transcript is kept private and out of this repo, because a full session export embeds project-internal context (config, infrastructure names, architecture) that does not belong in a shared toolkit. The reasoning below is what matters, and it is fully general.

The project context is a SvelteKit + Supabase app with an async job layer, where most code is written by Claude Code agents. References to specific internals are generalized.

---

## 1. The opening question: all on `main`, or worktrees?

The developer was running several Claude Code agents at once, all committing to `main`, and pointing each at a different area by hand. It mostly worked, but agents collided, and one collision dominated: they thrashed the dev server, fighting over a single port. The question was whether to keep working all-on-`main` or adopt git worktrees, and whether a per-session assigned port would help.

The key reframe: the pains are two separate problems with separate fixes. **File-edit collisions** (two agents editing the same file) and **runtime collisions** (the dev server, the database). Worktrees isolate the filesystem, which addresses the first, but the developer barely had the first problem, and worktrees do nothing for the second. So the conclusion was to stay on `main` and fix the runtime layer directly: a SessionStart hook that assigns each session its own dev-server port and reserves one for the human.

## 2. Serializing the database

Next: how do independent agents avoid running migrations or seeds on top of each other? The insight is that agents are separate processes that cannot talk to each other, so coordination has to route through something they all touch: a lock file on disk. We worked through tiers, from "just dispatch schema work serially yourself" up to a PreToolUse hook that blocks colliding schema commands with a self-healing lease (so a crashed agent can't deadlock the team).

## 3. Checking the platform's own features

Before hand-rolling, we reviewed Claude Code's multi-agent features. The finding: the "agent teams" capability is experimental, defaults to a shared working directory (so agents still collide on files), and keeps its locking internal with no API to borrow. So the platform did not offer a better primitive than a lock file, which confirmed the filesystem-coordination approach. The one genuinely useful pointer was that the database has its own authoritative record of applied migrations, which became central later.

## 4. Giving worktrees a fair shake

The developer pushed back: had worktrees been dismissed too quickly? We steelmanned them properly. The honest ledger: worktrees make file and staging collisions structurally impossible and let you run agents unsupervised, at the cost of a per-worktree setup tax, a shared database they do not isolate, and a recurring N-way merge. We walked the actual merge mechanics, including the "cockpit" idea: one session in the main checkout that does the human-gated integration. The decision held: stay on `main`, keep worktrees as an occasional escape hatch, not the default.

## 5. Building the hooks

We built the coordination hooks and tested each:

- A SessionStart hook assigning a distinct dev-server port per session, reserving the human's default port.
- A PreToolUse hook that blocks blanket and tree-wide-destructive git (which would sweep in or destroy other agents' uncommitted work) and serializes schema/dependency commands behind a repo-wide lock.
- A SessionEnd hook to release the lock and port.

A subtle but load-bearing detail: the lock lives in a directory anchored to the *common* git dir, so it is genuinely shared across worktrees rather than giving each its own private lock.

## 6. Making it fast

The Bash guard ran on every shell command, which meant spawning Node each time just to discover that most commands are harmless. We put a zero-spawn shell pre-filter in front of it (builtins only), so only command shapes that could actually be blocked reach the real guard. The lesson: when a guard sits on a hot path, gate it with a cheap filter.

## 7. Enter the collaborator

A second human joined the picture, committing to and pushing the same `main`. This added the integration layer: pulling and rebasing on a clean tree (a human-gated, cockpit act that no hook automates by design), and migration awareness across two people. We added a `post-merge` git hook that flags migration files arriving on a pull, and leaned on the database's own applied-migrations record as the source of truth for "are we actually in sync." The honest limit: the lock is local to one machine, so cross-person migration coordination is a human conversation.

## 8. Sharing the setup

We worked through how the setup reaches a collaborator. The hook scripts are tracked, but the wiring lives in a config file that was gitignored, so we un-ignored it (and the skills directory) carefully, learning that you can only re-include a file when its parent directory is not itself ignored. The discovery rules became a theme: a file being in the repo is necessary but not sufficient. Settings and skills auto-load, git hooks need a one-time `core.hooksPath` config, and both can require a fresh session. That insight produced the collaborator bootstrap script.

## 9. Narrowing the psql guard

The developer wanted to stop ad-hoc schema changes from drifting the database away from the migration files, but without losing the ability to query. The resolution rests on a clean distinction: DDL and querying are disjoint, so the guard blocks schema DDL typed into psql while leaving reads and file-applied migrations untouched. We were careful to document its limits: it is a tripwire and a nudge, not a security boundary. The real boundary, if you need one, is a database role with no DDL privileges.

## 10. Codifying it

Finally, recognizing the whole approach was reusable, we packaged it into this kit: the hooks, example skills, an installer, a collaborator bootstrap, the gitignore and CLAUDE.md snippets, and these docs, so future two-person AI-native teams (and solo developers with many agents) can model the same way of working.
