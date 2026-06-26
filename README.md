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
| `hooks/scripts/{file-size-budget,import-boundaries,arch-check,file-size-nudge}.mjs` | Architecture guards: file-size ratchet + import-boundary guard, as a CLI gate (`arch-check`) and an in-session nudge |
| `hooks/githooks/post-merge` | Flags DB migrations that arrive when you pull |
| `hooks/githooks/{pre-commit,pre-push}` | Commit gate (arch guards on staged files) + push gate (typecheck + tests / `@critical` E2E) |
| `hooks/settings.json` | The `.claude/settings.json` wiring that registers the hooks |
| `snippets/` | `.gitignore` lines and the CLAUDE.md section to paste in |
| `skills/` | Four real skills as worked examples (push, regression-check, fix-bug, userflow-map) |
| `install.sh` | Wires the hooks, skills, and bootstrap into a target project |
| `bootstrap.sh` | One-command local setup a collaborator runs after cloning |
| `docs/HOOKS.md`, `docs/SKILLS.md` | Detailed per-artifact reference (every hook, every skill) |
| `docs/WRITING-CLAUDE-MD.md`, `docs/CONVENTIONS.md` | How to write your `CLAUDE.md` + transferable repo conventions |
| `docs/FEEDBACK-LOOP-SPEC.md` | Stack-agnostic build spec for the in-app feedback + bug-fix loop |
| `docs/SIDEBAR-SPEC.md` | Stack-agnostic build spec for the collapsible left nav rail (+ version chip / release notes) |
| `docs/ADOPT.md` | The three adoption paths (solo brownfield, new pair, solo-adding-a-second) + prerequisites |
| `docs/` | Project setup, collaborator setup, design notes |

---

## Setup

**The kit is a tool you run *against* your repo, not something that lives inside it.** You clone it to a scratch location, run the installer pointed at your project, and the artifacts land in logical places in your repo. No nested git repo, no submodule, no repo-within-a-repo. Prerequisites and the full scenario-by-scenario guide are in [`docs/ADOPT.md`](./docs/ADOPT.md).

**Pull it into your project** (run from your project root, after committing your working tree so you can review what's added):

```bash
gh repo clone sdmurff/agent-team-kit /tmp/agent-team-kit
/tmp/agent-team-kit/install.sh "$PWD"
rm -rf /tmp/agent-team-kit
```

The installer is idempotent and safe on a built-out repo: it copies the hooks, skills, `bootstrap.sh`, and the feedback spec into place; appends the share rules to `.gitignore` and the concurrent-agents section to `CLAUDE.md` (guarded, never duplicating); sets `core.hooksPath`; and never touches your source. Review the diff, then commit.

**Three paths, all using that one installer** (details in [`docs/ADOPT.md`](./docs/ADOPT.md)):

- **Solo dev, existing project (brownfield).** Run it, commit, start a fresh session. You get per-session dev ports plus git/schema/psql guards for your own parallel agents. Optionally hand `docs/FEEDBACK-LOOP-SPEC.md` to your agent to build the feedback loop.
- **New two-person team (greenfield).** One person installs, customizes, commits, and pushes; the other clones the project and runs `./bootstrap.sh`. Both adopt the collaboration model below.
- **Solo project adding a second person.** You already installed it solo; the new person clones and runs `./bootstrap.sh`, and you switch on the human agreements.

**Customize for your stack** if you're not on Supabase + pnpm (`SCHEMA_RE`/`PSQL_DDL_RE` in `bash-guard.mjs`, the port range in `dev-port.mjs`, the migrations path in `post-merge`), and **go deep** in [`docs/HOOKS.md`](./docs/HOOKS.md) and [`docs/SKILLS.md`](./docs/SKILLS.md).

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

## The discipline layer: keeping agent-written code from rotting

Coordination keeps agents from colliding; this layer keeps what they *write* from sprawling. When agents produce a lot of code fast, the failure mode isn't collisions — it's 2,000-line files and quietly-crossed boundaries. Three executable guards push back, all configurable for your project:

- **The file-size ratchet** (`file-size-budget.mjs`). New files cap at a budget (800 lines by default); today's giants are *frozen* (may only shrink); a genuinely-single-concern file is *exempt* with a written reason. A red one is an alarm to check cohesion, never a number to game.
- **The import-boundary guard** (`import-boundaries.mjs`). A dangerous capability (the default example: a privilege-escalating DB client that bypasses row-level security) is allowlisted — any *new* importer fails the gate until it's a deliberate, commented choice. The list may only shrink.
- **Both, two ways:** an in-session **PostToolUse nudge** (`file-size-nudge.mjs`) that flags a violation the moment an edit trips it, and an **`arch-check` CLI** that the **pre-commit** gate runs on staged files so nothing crosses into history.

Alongside them, the **pre-push gate** runs your typecheck + tests (tag must-never-break E2E `@critical`) before a push, and a **definition-of-done** section for your `CLAUDE.md` (`snippets/CLAUDE-md-working-discipline.md`, appended by the installer) spells out what "ready" means — because agents declare victory early. Plus a guide to [writing your `CLAUDE.md`](./docs/WRITING-CLAUDE-MD.md) and transferable [conventions](./docs/CONVENTIONS.md). Together with the coordination hooks, that's the full picture: coordinate, build well, keep it from rotting, and know when it's done.

## Included: the AI-native feedback loop

[`docs/FEEDBACK-LOOP-SPEC.md`](./docs/FEEDBACK-LOOP-SPEC.md) is a high-fidelity, stack-agnostic spec for a feedback system built for the AI-native era: a one-click widget that captures a report with rich machine context (screenshot, breadcrumbs, console and network rings, errors, environment, all secret-scrubbed in the browser), an admin inbox that hands the whole bundle to a coding agent with `/fix-bug <id>`, and a `post-commit` hook that resolves the report and notifies the reporter, bound to the fix commit. It pairs with the bundled `fix-bug` skill, which is the agent side of the same loop.

It's a spec rather than code because the right implementation depends on your stack, but it is detailed down to the modal layout, the database schema and constraints, the capture bundle shape, and a build checklist, so a coding agent can build it in SvelteKit, React, Rails, or anything. It assumes Supabase and calls out the generic equivalent for every Supabase-specific piece. This is, on its own, one of the higher-leverage things a small product team can stand up: it makes reporting cheap, fixing well-informed, and the reply automatic.

## Included: the collapsible sidebar

[`docs/SIDEBAR-SPEC.md`](./docs/SIDEBAR-SPEC.md) is a high-fidelity, stack-agnostic spec for a Claude-model collapsible left nav rail: an expanded panel that collapses to an icon-only rail where **every icon holds its exact vertical position** across the toggle (the detail most implementations get subtly wrong). It specifies the pinning technique (a frozen icon column + fixed row heights + section-headers-become-hairline-dividers), the full anatomy (header, scrollable body, an optional progress stepper, footer account row), drag-to-resize, persistence, collapsed tooltips, the mobile off-canvas drawer, and a build checklist.

It also specifies the header's **version chip + release-notes** plumbing, which couples to the bundled `push` skill: a single version source, a typed `releases` data model, and a `/releases` surface the chip opens. Build those three pieces and `push` keeps them current on every ship. So the sidebar spec and the push skill interlock.

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
