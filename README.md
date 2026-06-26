# Agent Team Kit

**How a two-person, AI-native team works on one shared `main` without stepping on each other.** Also: how a solo developer running many Claude Code agents at once stays out of their own way.

An "AI-native team" here means a small team where most code is written by Claude Code agents, often several at once per person, committing directly to `main`. That style is fast, but it collides on things that have nothing to do with the code: dev-server ports, the shared database, and the git working tree. This kit is the setup and the working agreements that make it smooth.

**Read this as two documents in one: an education and a setup guide.** The first half teaches the way of working (why agents collide, the model that resolves it, and the human agreements that go with it); the setup section and [`docs/`](./docs) get it running on a real project. If you only want to install it, jump to [Setup](#setup); if you are deciding whether to work this way, read top to bottom. The deep "why" behind every artifact is in [`docs/DESIGN-NOTES.md`](./docs/DESIGN-NOTES.md), and a readable narrative of the session it was designed in is in [`docs/ORIGIN-CONVERSATION.md`](./docs/ORIGIN-CONVERSATION.md).

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
| `skills/` | Four real skills as worked examples (push, regression-check, fix-bug, userflow-map) |
| `install.sh` | Wires the hooks, skills, and bootstrap into a target project |
| `bootstrap.sh` | One-command local setup a collaborator runs after cloning |
| `docs/HOOKS.md`, `docs/SKILLS.md` | Detailed per-artifact reference (every hook, every skill) |
| `docs/FEEDBACK-LOOP-SPEC.md` | Stack-agnostic build spec for the in-app feedback + bug-fix loop |
| `docs/` | Project setup, collaborator setup, design notes |

---

## Setup

- **Introducing it to a project:** run `./install.sh /path/to/project`, then the manual steps it prints (gitignore, CLAUDE.md, stack customization). Full guide: [`docs/SETUP-PROJECT.md`](./docs/SETUP-PROJECT.md).
- **Joining a project that has it (plug-and-play):** clone it, then run `./bootstrap.sh` from the project root. It does the one-time local setup (sets the git hooks path, restores exec bits, sanity-checks Node + settings) and prints the only two things it can't automate: put personal config in `.claude/settings.local.json`, and start a fresh Claude session. Details: [`docs/SETUP-COLLABORATOR.md`](./docs/SETUP-COLLABORATOR.md). The gotcha to remember: a file being in the repo is necessary but not sufficient. Settings and skills auto-load, git hooks need that one config command (which `bootstrap.sh` runs), and both can require a fresh session.
- **Customize for your stack:** the guards ship for Supabase + pnpm. Adjust `SCHEMA_RE`/`PSQL_DDL_RE` in `bash-guard.mjs`, the port range in `dev-port.mjs`, and the migrations path in `post-merge`.
- **Go deep:** every hook is documented in [`docs/HOOKS.md`](./docs/HOOKS.md), every bundled skill in [`docs/SKILLS.md`](./docs/SKILLS.md).

---

## Collaboration model, end to end

The hooks stop the mechanical collisions. This is the human model that wraps them: the full loop two people run on a shared `main`. It is deliberately lightweight, but adopt all of it, because the pieces reinforce each other.

- **Stay in your lanes.** Before a work block, each person claims a surface ("I'm in grading, you're in rubrics"). You don't need hard walls, you need to not have two people's agents editing the same files at once. You know the codebase, so partition by area and say so out loud. Overlap is where agents fight, and it is the one thing the hooks can't untangle for you.
- **Pull and rebase often, and know that nothing automates it.** No hook pulls or rebases for you, on purpose: grabbing your teammate's commits needs a clean working tree and human judgment on conflicts, which is not something to do mid-task behind an agent's back. So make it a habit: pull-rebase at the start of a session, before you push, and whenever your teammate says "pushed." Frequent small pulls keep divergence tiny and merges trivial; a day of not pulling is how you earn a gnarly conflict. The `post-merge` hook's only job is to *react* after a pull, flagging any migrations that just arrived so you don't fall out of schema sync.
- **Commit small and often.** Small commits make pulls, rebases, and reviews cheap, and they make `git revert` a precise undo. This pairs with the kit's "stage explicit paths" rule.
- **Let one session be the cockpit.** Keep one Claude session in the main checkout for the human-gated acts: the pull-rebase, any merges, and the single push. Worker agents produce; the cockpit integrates, on a clean tree, when workers are idle.
- **Announce migrations, own deploys.** The schema lock is local to one machine and can't see your teammate, so a migration is a "heads up, pushing schema" message between humans; after pulling their changes, check what is actually applied (`supabase migration list`) before adding your own. And decide up front who pushes to production, so you never double-deploy or race a release. Pushing is always a deliberate human act here, never an agent's.
- **Review each other's output.** Agents produce a lot of plausible code fast. Even with no pull-request gate, build the habit of reading the diff of what the other's agents committed (a quick `/code-review` on recent commits). Speed without a second set of eyes is how subtle wrong-but-plausible code ships.
- **Share knowledge through `CLAUDE.md`, not memory.** `CLAUDE.md` is tracked and steers both your agents identically. Personal Claude memory is per-machine and does *not* travel, so anything the team needs to know goes in `CLAUDE.md`.

The loop, in one line: claim a lane, pull-rebase, work with your agents, integrate through the cockpit, review, and keep schema and deploys coordinated by hand.

---

## Included: the AI-native feedback loop

[`docs/FEEDBACK-LOOP-SPEC.md`](./docs/FEEDBACK-LOOP-SPEC.md) is a high-fidelity, stack-agnostic spec for a feedback system built for the AI-native era: a one-click widget that captures a report with rich machine context (screenshot, breadcrumbs, console and network rings, errors, environment, all secret-scrubbed in the browser), an admin inbox that hands the whole bundle to a coding agent with `/fix-bug <id>`, and a `post-commit` hook that resolves the report and notifies the reporter, bound to the fix commit. It pairs with the bundled `fix-bug` skill, which is the agent side of the same loop.

It's a spec rather than code because the right implementation depends on your stack, but it is detailed down to the modal layout, the database schema and constraints, the capture bundle shape, and a build checklist, so a coding agent can build it in SvelteKit, React, Rails, or anything. It assumes Supabase and calls out the generic equivalent for every Supabase-specific piece. This is, on its own, one of the higher-leverage things a small product team can stand up: it makes reporting cheap, fixing well-informed, and the reply automatic.

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

This kit was designed in a single working session. [`docs/ORIGIN-CONVERSATION.md`](./docs/ORIGIN-CONVERSATION.md) is a readable, redacted narrative of how it unfolded, from "should I use worktrees?" to the finished kit. The raw verbatim transcript is kept private and out of this repo on purpose: a full session export embeds project-internal context (configuration, infrastructure names, architecture) that does not belong in a shared toolkit. If you want a personal copy of your own sessions, Claude Code's `/export` produces one, but treat it as private.

---

## Good for solo work too

Most of this earns its keep with zero collaborators: port assignment and the git/schema guards protect you from your own parallel agents. The collaborator-specific pieces (the post-merge migration flag, the pull/rebase discipline) simply lie dormant until a second person shows up.
