# Agent Team Kit

**How a two-person, AI-native team works on one shared `main` without stepping on each other.** Also: how a solo developer running many Claude Code agents at once stays out of their own way.

An "AI-native team" here means a small team where most code is written by Claude Code agents, often several at once per person, committing directly to `main`. That style is fast, but it collides on things that have nothing to do with the code: dev-server ports, the shared database, and the git working tree. This kit is the setup and the working agreements that make it smooth.

**Read this as two documents in one: an education and a setup guide.** The first half teaches the way of working (why agents collide, the model that resolves it, and the human agreements that go with it); the setup section and [`docs/`](./docs) get it running on a real project. If you only want to install it, jump to [Setup](#setup); if you are deciding whether to work this way, read top to bottom. The deep "why" behind every artifact is in [`docs/DESIGN-NOTES.md`](./docs/DESIGN-NOTES.md), and the raw origin conversation is in [`conversation-transcript.jsonl`](./conversation-transcript.jsonl).

---

## The model: stay on `main`, isolate the runtime, guard the edges

The default instinct for "many agents" is git worktrees (a branch per agent). For a small AI-native team that is usually the wrong default: worktrees isolate *files*, but the painful collisions are *ports* and the *database*, which live outside the file boundary, and worktrees add a recurring merge tax. So this kit takes the other path:

1. **Everyone commits to `main`.** Partition work by area so agents rarely touch the same files.
2. **Isolate the runtime.** Each agent session gets its own dev-server port automatically.
3. **Guard the dangerous edges with hooks.** Blanket/destructive git, concurrent migrations, and ad-hoc schema DDL are blocked or serialized.
4. **One session is the cockpit.** Keep a Claude session in the main checkout for the human-gated acts: pulling a teammate's commits on a clean tree, merging, migrations, and the single `git push`.

Agents are separate processes that cannot talk to each other, so coordination routes through the **filesystem** (lock files under `.git/.wg-agent/`) and **git** (tracked migrations and shared settings). The hooks are the teeth; the working agreements below are the discipline. You need both.

---

## What the kit gives you

| Path | What it does |
|---|---|
| `hooks/scripts/dev-port.mjs` | Assigns each session its own dev-server port; reserves one for the human |
| `hooks/scripts/bash-guard.mjs` | Blocks tree-wide/destructive git, serializes schema/DB/dep commands behind a lock, blocks ad-hoc psql DDL |
| `hooks/scripts/bash-guard.sh` | Zero-spawn shell pre-filter so the common command path stays fast |
| `hooks/scripts/session-release.mjs` | Frees this session's lock + port on exit |
| `hooks/scripts/agent-coord.mjs` | Shared helpers |
| `hooks/githooks/post-merge` | Flags DB migrations that arrive when you pull |
| `hooks/settings.json` | The `.claude/settings.json` wiring that registers the hooks |
| `snippets/` | `.gitignore` lines and the CLAUDE.md section to paste in |
| `install.sh` | Wires it all into a target project |
| `docs/` | Project setup, collaborator setup, design notes |

---

## Setup

- **Introducing it to a project:** run `./install.sh /path/to/project`, then the manual steps it prints. Full guide: [`docs/SETUP-PROJECT.md`](./docs/SETUP-PROJECT.md).
- **Joining a project that has it:** [`docs/SETUP-COLLABORATOR.md`](./docs/SETUP-COLLABORATOR.md) — a short one-time checklist (the `core.hooksPath` config and the `settings.local.json` split). The recurring gotcha: a file being in the repo is necessary but not sufficient. Skills and settings auto-load, git hooks need one config command, and both can require a fresh session.
- **Customize for your stack:** the guards ship for Supabase + pnpm. Adjust `SCHEMA_RE`/`PSQL_DDL_RE` in `bash-guard.mjs`, the port range in `dev-port.mjs`, and the migrations path in `post-merge`.

---

## Working agreements for the two of you

The hooks stop the mechanical collisions. These are the human norms that keep an AI-native pair sane. Adopt them explicitly:

- **Partition by area, and say so.** Before a work block, each person claims a surface ("I'm in grading, you're in rubrics"). Overlap is where agents fight.
- **Announce before a migration.** The schema lock is *local* to one machine; it cannot see your teammate. So a migration is a "heads up, pushing schema" moment between humans. After pulling their changes, check what is actually applied (`supabase migration list`) before adding your own.
- **One person owns deploys.** Decide who pushes `main` to production, so you don't double-deploy or race releases. Pushing is a deliberate, human-only act here, never an agent action.
- **The cockpit integrates.** Pulling/rebasing the shared `main` happens on a clean tree, run by the human, when agents are idle. Don't let a worker agent pull mid-task.
- **Review each other's agent output.** Agents produce a lot of plausible code quickly. Even with no pull-request gate, build a habit of reading the diff of what the other's agents committed (a quick `/code-review` on recent commits). Speed without a second set of eyes is how subtle wrong-but-plausible code ships.
- **Share knowledge through `CLAUDE.md`, not memory.** `CLAUDE.md` is tracked and steers both your agents identically. Personal Claude memory is per-machine and does *not* travel, so anything the team needs to know goes in `CLAUDE.md`.

---

## What we haven't fully solved (gaps worth closing)

Honest commentary, so you don't mistake this kit for more than it is. These are the next things an AI-native team should put in place:

- **Local hooks are a nudge, not a gate. Add CI.** Every guard here runs only on machines that wired it, and can be bypassed with a different tool. The real enforcement layer is **CI on push**: run the tests, the lint, and any architecture guards in GitHub Actions so nothing merges to `main` green-on-one-laptop and broken everywhere else. Treat the local hooks as the fast in-loop reminder and CI as the actual gate.
- **Secrets are the unguarded edge.** Sharing a `.env` file hands over full, often god-mode, database and provider access, and nothing in this kit changes that. For a team: never put real secrets in git, use a secrets manager or per-person scoped credentials, and if schema integrity matters, enforce it at the **database role** level (an app role with no DDL privileges), not just the psql hook.
- **Separate dev from prod.** If your `.env` points every agent and teammate at the *production* database, then a stray `seed --reset` or destructive query hits real data, and the schema lock can't help across machines. Give the team a throwaway dev database with its own credentials; keep prod access narrow and human-only.
- **Decide the review and revert norms.** Committing straight to `main` means recovery is `git revert`, not branch hygiene. Agree up front on how you review (cadence, who, what triggers it) and how you roll back, before the first bad commit, not after.
- **Watch the spend.** Several agents per person burns tokens and (if you deploy on push) build minutes fast. Set a shared expectation for both.

None of these are hard to add; they just live beyond the mechanical-collision problem this kit was built to solve.

---

## The origin conversation

`conversation-transcript.jsonl` is the raw session this kit was designed in, kept as the rationale of record. Note it is the machine-readable transcript captured mid-session, so it cannot include the session's final turns. For a clean, complete, human-readable copy, run Claude Code's `/export` at the end of a session and save the result alongside it.

---

## Good for solo work too

Most of this earns its keep with zero collaborators: port assignment and the git/schema guards protect you from your own parallel agents. The collaborator-specific pieces (the post-merge migration flag, the pull/rebase discipline) simply lie dormant until a second person shows up.
