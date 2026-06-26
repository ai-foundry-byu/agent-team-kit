# Agent Team Kit

**How a two-person AI-native team — or a solo developer running many Claude Code agents at once — works in parallel without stepping on each other.**

An "AI-native team" here means a small team where most code is written by Claude Code agents, often several at once per person. That style is fast, but those agents collide on things that have nothing to do with the code: dev-server ports, the shared database, and the git working tree. This kit is the tooling, **the two ways to run it**, and the working agreements that make parallel agents smooth.

**Read this as three documents in one: an overview, a decision guide, and a setup guide.** It teaches the way of working (why agents collide, the **two modes** that resolve it and how to choose between them, and the human agreements that go with them), helps you pick a mode, then gets it running. If you only want to install it, jump to [Setup](#setup); if you're deciding how to work, read top to bottom. The deep "why" behind every artifact is in [`docs/DESIGN-NOTES.md`](./docs/DESIGN-NOTES.md), and a readable narrative of the session it was designed in is in [`docs/ORIGIN-CONVERSATION.md`](./docs/ORIGIN-CONVERSATION.md).

---

## Two ways to run it — pick one

The kit supports two ways of working, and **almost all of its tooling is shared between them** — the same port assignment, schema lock, architecture guards, skills, specs, discipline, and launchers. They differ in exactly one thing: **how agents are kept from colliding on files.**

- **Stay on main** — every agent commits to one `main`; you keep them apart by pointing each at a different area of the codebase. Lightest, no integration step. You're at the keyboard, supervising.
- **Worktree mode** — each agent works in its own git worktree on its own branch, and a "cockpit" session on `main` merges the results in. Files can't collide, so you can fire several agents and walk away — at the cost of a merge step per worker.

The hard part that *neither* mode escapes is the runtime: **dev-server ports and the shared database collide regardless of branching**, so the kit's hooks handle those in both. (That's also why worktrees alone aren't a complete answer — they isolate files, not ports or the DB.)

### Similar and different

| | Stay on main | Worktree mode |
|---|---|---|
| **How agents are isolated** | by you — partition work by area | by git — each in its own worktree |
| **File-edit collisions** | possible (rare if you partition well) | structurally impossible |
| **Integration step** | none — commits interleave on `main` | a merge per worker (the cockpit does it) |
| **Per-agent setup** | none | each worktree needs its own deps + `.env` |
| **Best when** | you're supervising at the keyboard | you want to fire agents and walk away |
| **Overhead** | lightest | a merge tax + per-worktree setup |
| **Ports, schema lock, guards, skills, specs, discipline, launchers** | ✓ | ✓ (identical) |

The single behavioral difference is the shared-tree git guard (blocking blanket-stage / `reset --hard` / `stash`): needed on `main`, and it **auto-relaxes** inside a worktree, where each tree is private. Everything else is byte-for-byte the same. The full feature-by-feature breakdown and the worktree workflow (the `wt` / `cockpit` launchers, the `merge-worktree` skill) live in [`docs/WORKTREE-MODE.md`](./docs/WORKTREE-MODE.md).

### Which should you use?

- **Default to stay on main** if you're usually at the keyboard, you know the codebase well enough to point agents at non-overlapping areas, and you want the lightest workflow with no merge step. Right for most solo devs and small supervised teams.
- **Reach for worktree mode** when you want agents running **unattended on potentially-overlapping work** — fire several, walk away, tend them from your phone, integrate when they're done. The merge tax buys guaranteed isolation.
- **You don't have to choose once.** Because the modes share a setup, you can stay on `main` by default and spin up a worktree for the occasional risky fan-out. The launchers make it a per-terminal call: `cs <name>` starts a stay-on-main session, `wt <name>` starts a worktree one.

Agents are separate processes that cannot talk to each other, so in **both** modes coordination routes through the **filesystem** (lock files under `.git/.wg-agent/`) and **git** (tracked migrations and shared settings). The hooks are the teeth; the working agreements below are the discipline. You need both.

---

## What's in here (repository map)

```
agent-team-kit/
├── README.md                     # this file: overview, the mode decision, and setup
├── install.sh                    # wire the kit into a project (idempotent, brownfield-safe)
├── bootstrap.sh                  # a collaborator's one-time local setup (run after cloning)
├── worktree-commands.sh          # shell launchers: cs / wt / cockpit / wtls (named, remote-control)
│
├── hooks/                        # the automation
│   ├── settings.json             # .claude/settings.json wiring that registers the Claude hooks
│   ├── scripts/                  # Claude Code hooks (coordination + code-quality)
│   │   ├── dev-port.mjs          # SessionStart: give this session its own dev-server port
│   │   ├── bash-guard.mjs        # PreToolUse: git-safety + schema lock + ad-hoc psql DDL block
│   │   ├── bash-guard.sh         # zero-spawn shell pre-filter in front of the guard
│   │   ├── session-release.mjs   # SessionEnd: free this session's lock + port
│   │   ├── agent-coord.mjs       # shared helpers (coordination dir, worktree detection)
│   │   ├── file-size-budget.mjs  # file-size ratchet: config + helpers
│   │   ├── import-boundaries.mjs # import-boundary guard: config + helper
│   │   ├── file-size-nudge.mjs   # PostToolUse: in-session preview of the arch guards
│   │   └── arch-check.mjs        # the CLI gate behind the nudge (pre-commit / CI)
│   └── githooks/                 # git hooks (run via core.hooksPath)
│       ├── post-merge            # flag DB migrations that arrived when you pull
│       ├── pre-commit            # arch guards on staged files (+ a slot for your formatter)
│       └── pre-push              # typecheck + tests before a push (@critical E2E)
│
├── skills/                       # Claude Code skills — real worked examples to adapt
│   ├── push/                     # cut a release + push, guarded, with customer release notes
│   ├── regression-check/         # impact analysis + behavior tests on shared-code changes
│   ├── fix-bug/                  # load an in-app bug report from the DB and fix it
│   ├── userflow-map/             # maintain a data-driven UI state-machine map
│   └── merge-worktree/           # cockpit-side: integrate a worker branch into main
│
├── snippets/                     # fragments you paste into a project
│   ├── gitignore-additions.txt   # .gitignore lines to share settings + skills
│   ├── CLAUDE-md-section.md       # "concurrent agents on main" rules (stay-on-main)
│   ├── CLAUDE-md-worktree.md      # the worktree-mode variant of that section
│   └── CLAUDE-md-working-discipline.md   # the definition-of-done section
│
└── docs/                         # the reading
    ├── ADOPT.md                  # START HERE to install: the 3 adoption paths + prerequisites
    ├── SETUP-PROJECT.md          # owner install reference (customize knobs, what's tracked)
    ├── SETUP-COLLABORATOR.md     # a teammate joining a repo that already has the kit
    ├── WORKTREE-MODE.md          # the worktree way: full comparison + workflow + commands
    ├── TENDING-AGENTS.md         # verbose, remote control, keep-awake (Mac + Windows)
    ├── HOOKS.md                  # per-hook reference (every hook + the git gates)
    ├── SKILLS.md                 # per-skill reference + how to write your own
    ├── WRITING-CLAUDE-MD.md      # how to write your project's CLAUDE.md (the shared brain)
    ├── CONVENTIONS.md            # transferable repo conventions
    ├── FEEDBACK-LOOP-SPEC.md     # stack-agnostic build spec: the in-app feedback + bug-fix loop
    ├── SIDEBAR-SPEC.md           # stack-agnostic build spec: the collapsible left nav rail
    ├── DESIGN-NOTES.md           # the reasoning behind every choice
    └── ORIGIN-CONVERSATION.md    # a redacted narrative of how the kit came to be
```

The mental model: **`hooks/`** is the automation (Claude hooks + git hooks), **`skills/`** and **`snippets/`** get copied into your project, **`docs/`** is the reading, and the three scripts at the root (`install.sh`, `bootstrap.sh`, `worktree-commands.sh`) are what you actually run.

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
- **Name every session.** With several agents going, launch each with a name — the kit's `wt` / `cockpit` / `cs` launchers set the session `--name` for you. It shows in the `/resume` picker and the terminal title, so you can find a past conversation and tell a dozen windows apart. An unnamed session is a generic path and an indistinguishable tab. (More in [`docs/WORKTREE-MODE.md`](./docs/WORKTREE-MODE.md#name-every-session).)

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
