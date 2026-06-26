# Worktree mode

The kit runs in **two ways**, and almost all of it is shared between them. The default is **stay-on-main** (every agent commits to one `main`; the coordination hooks keep them from colliding). This doc covers the alternative: **worktree mode**, where each worker runs in its own git worktree on its own branch, and a cockpit session on `main` integrates the results.

Same toolkit, one behavior auto-adapts. Pick by how you work:

- **Stay-on-main** (default) — you're supervising, pointing agents at different areas by hand. Lighter; no merge step.
- **Worktree mode** — you want to fire several agents and walk away. Filesystem isolation means you don't have to referee file overlap; you pay a merge step at integration.

## What's the same, what changes

Read down this table: almost every row is shared. (Full reasoning in the kit README's mode comparison.)

| Feature / tool | Stay-on-main | Worktrees | Note |
|---|:---:|:---:|---|
| Per-session dev port | ✓ | ✓ | Coord state anchored to the common git dir → distinct ports across worktrees |
| Schema lock | ✓ | ✓ | One shared DB in both modes |
| Ad-hoc psql DDL block | ✓ | ✓ | Shared DB → same drift risk |
| **Git safety: blanket-stage + tree-wide destructive** | ✓ needed | ✗ auto-off | **The one flip.** Protects a *shared* tree; worktrees isolate trees, so it relaxes automatically |
| Force-push block | ✓ | ✓ | Protects shared history — always on |
| session-release | ✓ | ✓ | Frees port + lock |
| post-merge migration flag | ✓ | ✓✓ | More central in worktree mode (every integration is a merge) |
| pre-commit / pre-push gates | ✓ | ✓ | Per tree / per push |
| Architecture guards | ✓ | ✓ | Branch-agnostic |
| Skills, specs, discipline, conventions | ✓ | ✓ | About the work, not the branching |
| install / bootstrap / sharing | ✓ | ✓ | Same setup |
| CLAUDE.md coordination section | "on main" variant | worktree variant | Use `snippets/CLAUDE-md-worktree.md` instead |
| Integration / merge workflow | n/a | **added** | The cockpit merges worker branches into main |
| Per-worktree setup tax (`.env`, install) | n/a | **added** | Each fresh worktree needs its env + deps |

The single behavioral difference — the shared-tree git guard — **auto-detects**: it stays strict in the main checkout and relaxes inside a linked worktree (it checks whether your per-tree git dir differs from the shared common dir). No mode flag to set; the guard just does the right thing in each.

## How you work with it

The model is two kinds of terminal:

- **One pinned terminal = the cockpit.** A Claude Code session in the **main checkout**, on `main`, permissions skipped like the workers. This is your dashboard: it watches the repo, does the integration (merging finished worker branches), and runs the push.
- **Every other terminal = a worker.** A Claude Code session in its **own git worktree** on its own branch, permissions skipped, pointed at one task. Spin up as many as you want; they can't collide on files.

### The commands

Source the kit's shell functions once (they wrap Claude Code's native `--worktree` support):

```bash
echo 'source /path/to/agent-team-kit/worktree-commands.sh' >> ~/.zshrc   # (or ~/.bashrc)
```

Then:

```bash
cockpit              # the dashboard: a NAMED session in the main checkout (run from repo root)
wt grading-fix       # a worker: new worktree on branch `grading-fix` + a NAMED session in it,
                     #   permissions skipped — equals:
                     #   claude --worktree grading-fix --name grading-fix --dangerously-skip-permissions
wtls                 # list active worktrees + branches
```

Every launcher auto-sets a session **name** (shown in `/resume` and the terminal title) and skips permissions. **Integration is not a shell command** — from the cockpit, just tell Claude "integrate grading-fix" and it runs the `merge-worktree` skill (clean-tree check, conflict surfacing, prune, and it stops short of pushing).

(Tip: `wt grading-fix --tmux` puts the worker in its own tmux session; extra flags pass through, e.g. `wt grading-fix --model opus`.)

### Name every session

With several agents going, names are how you stay sane. The launchers set one automatically (`--name`), and it shows in two places: the **`/resume` picker** (so you can find "that grading conversation" later) and the **terminal title** (so you can tell a dozen windows apart at a glance). Names follow the branch convention — lowercase-with-dashes, the name you pass: `wt grading-fix` → session `grading-fix`; `cockpit` in a repo named `app` → `app-cockpit`; `cs rubric-copy` → `rubric-copy`.

This matters in **both** modes — even on stay-on-main, name every agent with `cs <name>`. An unnamed session is a generic path in `/resume` and an indistinguishable terminal tab; a named one is findable and glanceable. Make naming a habit, not an afterthought.

### The integration loop

1. **Cockpit up.** Pinned terminal: `cockpit`. This is where you watch and integrate.
2. **Fire workers.** New terminal per task: `wt fix-citations`, `wt rubric-copy`, … each gets an isolated worktree + session and goes to work. Name them for the task — that name becomes the branch you'll merge.
3. **Workers commit to their branches.** They blanket-stage and commit freely (their tree is their own; the guard relaxes). They do **not** merge or push.
4. **Integrate from the cockpit** as each finishes: tell the cockpit Claude "integrate fix-citations" (the `merge-worktree` skill). It verifies a clean tree, merges into `main`, surfaces any conflict instead of guessing, and prunes the worktree. Disjoint work merges trivially; overlapping work becomes a conflict you resolve there.
5. **Ship.** When the merged work is ready, `/push` from the cockpit (the one deliberate, paid act).

## Setup deltas vs stay-on-main

- **Use the worktree CLAUDE.md section.** Swap the stay-on-main "Concurrent agents on `main`" section for `snippets/CLAUDE-md-worktree.md` — it tells workers their tree is their own (blanket-stage freely) but the database is still shared (schema changes still coordinated), and integration happens only in the cockpit.
- **Per-worktree bootstrap.** A fresh worktree has no `node_modules` or `.env.local` (both gitignored). Each worker needs them before it can run the app: copy `.env.local` in and install deps. (You can automate this with a worktree post-create step; at minimum, know it's needed.)
- **The database is still shared.** Worktrees isolate files, not the DB. The schema lock and psql-DDL guard still apply across all worktrees, and migrations are still a coordinate-with-the-human moment.

## When to stay on main instead

Worktree mode earns its merge tax when you're running agents **unattended on potentially-overlapping work**. If you're at the keyboard pointing each agent at a different area, stay-on-main is lighter and has no integration step. The two are not exclusive — you can keep stay-on-main as your default and reach for `wt` only for the occasional fan-out.
