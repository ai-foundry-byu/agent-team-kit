# Agent Team Kit

**How a two-person AI-native team, or a solo developer running many Claude Code agents at once, works in parallel without stepping on each other.**

An "AI-native team" here means a small team where most code is written by Claude Code agents, often several at once per person. That style is fast, but those agents collide on things that have nothing to do with the code: dev-server ports, the shared database, and the git working tree. This kit is the tooling, **the two ways to run it**, and the working agreements that make parallel agents smooth.

**Read this as three documents in one: an overview, a decision guide, and a setup guide.** It teaches the way of working (why agents collide, the **two modes** that resolve it and how to choose between them, and the human agreements that go with them), helps you pick a mode, then gets it running. If you only want to install it, jump to [Setup](#setup); if you're deciding how to work, read top to bottom. The deep "why" behind every artifact is in [`docs/DESIGN-NOTES.md`](./docs/DESIGN-NOTES.md), and a readable narrative of the session it was designed in is in [`docs/ORIGIN-CONVERSATION.md`](./docs/ORIGIN-CONVERSATION.md).

---

## Two ways to run it, pick one

The kit supports two ways of working, and **almost all of its tooling is shared between them**, the same port assignment, schema lock, architecture guards, skills, specs, discipline, and launchers. They differ in exactly one thing: **how agents are kept from colliding on files.**

- **Stay on main**, every agent commits to one `main`; you keep them apart by pointing each at a different area of the codebase. Lightest, no integration step. You're at the keyboard, supervising.
- **Worktree mode**, each agent works in its own git worktree on its own branch, and a "cockpit" session on `main` merges the results in. Files can't collide, so you can fire several agents and walk away, at the cost of a merge step per worker.

The hard part that *neither* mode escapes is the runtime: **dev-server ports and the shared database collide regardless of branching**, so the kit's hooks handle those in both. (That's also why worktrees alone aren't a complete answer, they isolate files, not ports or the DB.)

### Similar and different

| | Stay on main | Worktree mode |
|---|---|---|
| **How agents are isolated** | by you, partition work by area | by git, each in its own worktree |
| **File-edit collisions** | possible (rare if you partition well) | structurally impossible |
| **Integration step** | none, commits interleave on `main` | a merge per worker (the cockpit does it) |
| **Per-agent setup** | none | each worktree needs its own deps + `.env` |
| **Best when** | you're supervising at the keyboard | you want to fire agents and walk away |
| **Overhead** | lightest | a merge tax + per-worktree setup |
| **Ports, schema lock, guards, skills, specs, discipline, launchers** | ✓ | ✓ (identical) |

The single behavioral difference is the shared-tree git guard (blocking blanket-stage / `reset --hard` / `stash`): needed on `main`, and it **auto-relaxes** inside a worktree, where each tree is private. Everything else is byte-for-byte the same. The full feature-by-feature breakdown and the worktree workflow (the `wt` / `cockpit` launchers, the `merge-worktree` skill) live in [`docs/WORKTREE-MODE.md`](./docs/WORKTREE-MODE.md).

### Which should you use?

- **Default to stay on main** if you're usually at the keyboard, you know the codebase well enough to point agents at non-overlapping areas, and you want the lightest workflow with no merge step. Right for most solo devs and small supervised teams.
- **Reach for worktree mode** when you want agents running **unattended on potentially-overlapping work**, fire several, walk away, tend them from your phone, integrate when they're done. The merge tax buys guaranteed isolation.
- **You don't have to choose once.** Because the modes share a setup, you can stay on `main` by default and spin up a worktree for the occasional risky fan-out. The launchers make it a per-terminal call: `cs <name>` starts a stay-on-main session, `wt <name>` starts a worktree one.

Agents are separate processes. Current Claude Code lets one session send another a message, but a message is plain text that arrives between steps and carries no authority: it cannot hold a lock, block a command, or enforce anything. The kit does not depend on agents messaging each other, so in **both** modes coordination routes through the **filesystem** (lock files under `.git/.wg-agent/`) and **git** (tracked migrations and shared settings). The hooks are the teeth; the working agreements below are the discipline. You need both.

---

## What's in here (repository map)

```
agent-team-kit/
├── README.md                     # this file: overview, the mode decision, and setup
├── install.sh                    # wire the kit into a project (idempotent, brownfield-safe)
├── bootstrap.sh                  # a collaborator's one-time local setup (run after cloning)
├── worktree-commands.sh          # shell launchers: cs / wt / cockpit / wtls (named, remote-control)
│
├── hub/                          # hub-and-spokes: one command center per project, content mounted via --add-dir
│   ├── install-hub.sh            # one-time: create ~/hubs, install the dispatcher + template, add the `hub` alias
│   ├── hub                       # dispatcher: hub ls / hub new <name> / hub <name>
│   └── _template/                # cockpit scaffold copied by `hub new` (launch + CLAUDE.md)
│
├── memory-pack/                  # portable, project-agnostic memories to seed a new project's brain
│   ├── README.md                 # what the pack is + how to adopt it into a project's memory dir
│   ├── MEMORY.md                 # the pack's one-line-per-entry index
│   ├── TEAM-MEMORY-README.md     # becomes .claude/team-memory/README.md when install.sh seeds a project
│   └── *.md                      # one generalized lesson per file (git hygiene, verification, AI UX, …)
│
├── hooks/                        # the automation
│   ├── settings.json             # .claude/settings.json wiring that registers the Claude hooks
│   ├── scripts/                  # Claude Code hooks (coordination + code-quality)
│   │   ├── dev-port.mjs          # SessionStart: give this session its own dev-server port
│   │   ├── bash-guard.mjs        # PreToolUse: git-safety + commit-sweep guard + schema lock + ad-hoc psql DDL block
│   │   ├── bash-guard.sh         # zero-spawn shell pre-filter in front of the guard
│   │   ├── session-release.mjs   # SessionEnd: free this session's lock + port
│   │   ├── team-memory.mjs       # SessionStart: load the tracked .claude/team-memory/ into this session's memory
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
├── skills/                       # Claude Code skills, real worked examples to adapt
│   ├── push/                     # cut a release + push, guarded, with customer release notes
│   ├── stage/                    # put an rc build on the staging twin: migrate, parity check, tag, watch, smoke
│   ├── promote/                  # ship exactly the commit staging serves, not HEAD
│   ├── remove-flag/              # take a release flag out of the code once it is on for everyone
│   ├── regression-check/         # impact analysis + behavior tests on shared-code changes
│   ├── fix-bug/                  # load an in-app bug report from the DB and fix it
│   ├── ux-critique/              # agentic UX critic: walk a flow, file findings as bugs
│   ├── userflow-map/             # maintain a data-driven UI state-machine map
│   ├── merge-worktree/           # cockpit-side: integrate a worker branch into main
│   ├── spec/                     # freeze an exploration into a tagged, approvable spec + punch list
│   ├── build-spec/               # work an approved spec's punch list; close each criterion by its verifier
│   ├── share-memory/             # promote a personal memory into the shared team memory, scrubbed
│   └── mockup/                   # high-fidelity throwaway mockups, edited from a frozen real surface
│
├── snippets/                     # fragments you paste into a project
│   ├── gitignore-additions.txt   # .gitignore lines to share settings + skills
│   ├── CLAUDE-md-main.md          # "concurrent agents on main" rules (the stay-on-main lane)
│   ├── CLAUDE-md-worktree.md      # the worktree-mode variant of that section
│   ├── CLAUDE-md-working-discipline.md   # the definition-of-done section
│   ├── CLAUDE-md-mockups.md       # the mockups / design-iteration loop (gitignored .mockups/)
│   ├── CLAUDE-md-release-flags.md # release flags: decide at spec time, gate at one seam, finish with /remove-flag
│   └── CLAUDE-md-access-model.md  # who sees what: this project's roles, entitlements, preferences and can()
│
└── docs/                         # the reading
    ├── ADOPT.md                  # START HERE to install: the 3 adoption paths + prerequisites
    ├── SETUP-PROJECT.md          # owner install reference (customize knobs, what's tracked)
    ├── SETUP-COLLABORATOR.md     # a teammate joining a repo that already has the kit
    ├── WORKTREE-MODE.md          # the worktree way: full comparison + workflow + commands
    ├── TENDING-AGENTS.md         # verbose, remote control, keep-awake (Mac + Windows)
    ├── DRIVING-THE-APP.md        # screenshots, recorded walkthroughs, driving the app as a user
    ├── HANDS-ON-EDITS.md         # the human keyboard path: element-to-source inspector + safe single-file commit
    ├── HUB-AND-SPOKES.md         # organizing a project across scattered folders: one hub, content as spokes
    ├── HOOKS.md                  # per-hook reference (every hook + the git gates)
    ├── SKILLS.md                 # per-skill reference + how to write your own
    ├── WRITING-CLAUDE-MD.md      # how to write your project's CLAUDE.md (the shared brain)
    ├── CONVENTIONS.md            # transferable repo conventions
    ├── FEEDBACK-LOOP-SPEC.md     # stack-agnostic build spec: the in-app feedback + bug-fix loop
    ├── SIDEBAR-SPEC.md           # stack-agnostic build spec: the collapsible left nav rail
    ├── MOCKUP-SHELLS-SPEC.md     # stack-agnostic build spec: freeze a real page into an editable mockup shell
    ├── IMPERSONATION-SPEC.md     # stack-agnostic build spec: view any page as any user (or role), exit from the rail
    ├── CRAWLERS-SPEC.md          # stack-agnostic build spec: the route/action/browser error crawlers
    ├── WALKS-AND-SWEEPS-SPEC.md  # stack-agnostic build spec: judged browser passes + report + ticket filing
    ├── DISPOSABLE-ENVIRONMENT.md # where agents drive: disposable target, fidelity, graded prod posture
    ├── RELEASE-PIPELINE.md       # deploy is not release: push = CI, rc tag = staging, tag = prod, two roads
    ├── STAGING-TWIN-SPEC.md      # stack-agnostic build spec: staging as prod's fenced twin with the team's data
    ├── RELEASE-FLAGS-SPEC.md     # stack-agnostic build spec: per-audience release flags, ship dark, release by click
    ├── DESIGN-NOTES.md           # the reasoning behind every choice
    └── ORIGIN-CONVERSATION.md    # a redacted narrative of how the kit came to be
```

The mental model: **`hooks/`** is the automation (Claude hooks + git hooks), **`skills/`** and **`snippets/`** get copied into your project, **`docs/`** is the reading, and the three scripts at the root (`install.sh`, `bootstrap.sh`, `worktree-commands.sh`) are what you actually run.

---

## Setup

Two steps: **install once** (identical for both modes), then **pick your lane** and follow that column.

### 1. Install (same for both modes)

The kit runs *against* your repo, not nested inside it. From your project root (commit first, so you can review the diff):

```bash
gh repo clone ai-foundry-byu/agent-team-kit /tmp/agent-team-kit
/tmp/agent-team-kit/install.sh "$PWD"
rm -rf /tmp/agent-team-kit
```

Idempotent and brownfield-safe: it copies the hooks, skills, and launchers in; appends the `.gitignore` + `CLAUDE.md` sections (guarded); sets `core.hooksPath`; and never touches your source. Then:

- **Customize for your stack** if you're not on Supabase + pnpm: `SCHEMA_RE`/`PSQL_DDL_RE` in `bash-guard.mjs`, the pool/`RESERVED_PORT`/`START_HINT` in `dev-port.mjs`, the migrations path in `post-merge`.
- **Load the launchers** once: `echo 'source /path/to/agent-team-kit/worktree-commands.sh' >> ~/.zshrc`.
- Install *mechanics* differ slightly by situation (solo brownfield / new pair / adding a second person), see [`docs/ADOPT.md`](./docs/ADOPT.md). Tending agents while away (verbose, remote control, keep-awake) is the same in both modes, [`docs/TENDING-AGENTS.md`](./docs/TENDING-AGENTS.md).

### 2. Run it: pick your lane

Once installed, everything you actually *do* depends only on the lane you chose:

| | Stay on main | Worktree mode |
|---|---|---|
| **CLAUDE.md rules** | keep the stay-on-main "concurrent agents" section the installer appended | swap it for `snippets/CLAUDE-md-worktree.md` |
| **Start a session** | `cs <name>` in each terminal (named session in the shared tree) | one pinned `cockpit`; each worker is `wt <name>` |
| **Per worker** | nothing | each new worktree: install deps + copy `.env.local` |
| **Integrate** | nothing, commits interleave on `main` | from the cockpit, say "integrate `<name>`" (the `merge-worktree` skill) |
| **Ship** | `/push` for small, safe work; `/stage` then `/promote` for anything riskier | the same skills, run from the cockpit |
| **The rule to remember** | partition by area; stage explicit paths only | workers never merge or push; integrate only from the cockpit |

Full worktree workflow and the feature-by-feature comparison: [`docs/WORKTREE-MODE.md`](./docs/WORKTREE-MODE.md). The human agreements that apply in **both** lanes are the [Collaboration model](#collaboration-model-end-to-end) below. Going deep on the tooling: [`docs/HOOKS.md`](./docs/HOOKS.md) and [`docs/SKILLS.md`](./docs/SKILLS.md).

---

## Collaboration model, end to end

The hooks stop the mechanical collisions. This is the human model that wraps them: the full loop two people run on a shared `main`. It is deliberately lightweight, but adopt all of it, because the pieces reinforce each other.

- **Stay in your lanes.** Before a work block, each person claims a surface ("I'm in grading, you're in rubrics"). You don't need hard walls, you need to not have two people's agents editing the same files at once. You know the codebase, so partition by area and say so out loud. Overlap is where agents fight, and it is the one thing the hooks can't untangle for you.
- **Pull and rebase often, and know that nothing automates it.** No hook pulls or rebases for you, on purpose: grabbing your teammate's commits needs a clean working tree and human judgment on conflicts, which is not something to do mid-task behind an agent's back. So make it a habit: pull-rebase at the start of a session, before you push, and whenever your teammate says "pushed." Frequent small pulls keep divergence tiny and merges trivial; a day of not pulling is how you earn a gnarly conflict. The `post-merge` hook's only job is to *react* after a pull, flagging any migrations that just arrived so you don't fall out of schema sync.
- **Commit small and often.** Small commits make pulls, rebases, and reviews cheap, and they make `git revert` a precise undo. This pairs with the kit's "stage explicit paths" rule.
- **Let one session be the cockpit.** Keep one Claude session in the main checkout for the human-gated acts: the pull-rebase, any merges, and the single push. Worker agents produce; the cockpit integrates, on a clean tree, when workers are idle.
- **Announce migrations, agree who releases.** The schema lock is local to one machine and can't see your teammate, so a migration is a "heads up, pushing schema" message between humans; after pulling their changes, check what is actually applied (`supabase migration list`) before adding your own. Under the [release pipeline](./docs/RELEASE-PIPELINE.md) a push only runs CI, so either of you can push finished work; what needs an owner is the release tag, so decide up front who cuts `-rc` and final tags and you never race a release. Tagging is always a deliberate human act, never an agent's.
- **Review each other's output.** Agents produce a lot of plausible code fast. Even with no pull-request gate, build the habit of reading the diff of what the other's agents committed (a quick `/code-review` on recent commits). Speed without a second set of eyes is how subtle wrong-but-plausible code ships.
- **Share knowledge through tracked files, never personal memory.** Personal Claude memory is per-machine and does *not* travel. Standing rules and how the project works go in `CLAUDE.md`, which every agent reads. Lessons learned along the way (a gotcha, an incident, a "never do X because Y") go in `.claude/team-memory/`, which every teammate's session loads as memory at start; when your agent learns something the other person needs, promote it with `/share-memory`.
- **Name every session.** With several agents going, launch each with a name, the kit's `wt` / `cockpit` / `cs` launchers set the session `--name` for you. It shows in the `/resume` picker and the terminal title, so you can find a past conversation and tell a dozen windows apart. An unnamed session is a generic path and an indistinguishable tab. (More in [`docs/WORKTREE-MODE.md`](./docs/WORKTREE-MODE.md#name-every-session).)

The loop, in one line: claim a lane, pull-rebase, work with your agents, integrate through the cockpit, review, and keep schema and deploys coordinated by hand.

---

## The discipline layer: keeping agent-written code from rotting

Coordination keeps agents from colliding; this layer keeps what they *write* from sprawling. When agents produce a lot of code fast, the failure mode isn't collisions, it's 2,000-line files and quietly-crossed boundaries. Three executable guards push back, all configurable for your project:

- **The file-size ratchet** (`file-size-budget.mjs`). New files cap at a budget (800 lines by default); today's giants are *frozen* (may only shrink); a genuinely-single-concern file is *exempt* with a written reason. A red one is an alarm to check cohesion, never a number to game.
- **The import-boundary guard** (`import-boundaries.mjs`). A dangerous capability (the default example: a privilege-escalating DB client that bypasses row-level security) is allowlisted, any *new* importer fails the gate until it's a deliberate, commented choice. The list may only shrink.
- **Both, two ways:** an in-session **PostToolUse nudge** (`file-size-nudge.mjs`) that flags a violation the moment an edit trips it, and an **`arch-check` CLI** that the **pre-commit** gate runs on staged files so nothing crosses into history.

Alongside them, the **pre-push gate** runs your typecheck + tests (tag must-never-break E2E `@critical`) before a push, and a **definition-of-done** section for your `CLAUDE.md` (`snippets/CLAUDE-md-working-discipline.md`, appended by the installer) spells out what "ready" means, because agents declare victory early. Plus a guide to [writing your `CLAUDE.md`](./docs/WRITING-CLAUDE-MD.md) and transferable [conventions](./docs/CONVENTIONS.md). Together with the coordination hooks, that's the full picture: coordinate, build well, keep it from rotting, and know when it's done.

## Included: the AI-native feedback loop

[`docs/FEEDBACK-LOOP-SPEC.md`](./docs/FEEDBACK-LOOP-SPEC.md) is a high-fidelity, stack-agnostic spec for a feedback system built for the AI-native era: a one-click widget that captures a report with rich machine context (screenshot, breadcrumbs, console and network rings, errors, environment, all secret-scrubbed in the browser), an admin inbox that hands the whole bundle to a coding agent with `/fix-bug <id>`, and a `post-commit` hook that resolves the report and notifies the reporter, bound to the fix commit. It pairs with the bundled `fix-bug` skill, which is the agent side of the same loop.

It's a spec rather than code because the right implementation depends on your stack, but it is detailed down to the modal layout, the database schema and constraints, the capture bundle shape, and a build checklist, so a coding agent can build it in SvelteKit, React, Rails, or anything. It assumes Supabase and calls out the generic equivalent for every Supabase-specific piece. This is, on its own, one of the higher-leverage things a small product team can stand up: it makes reporting cheap, fixing well-informed, and the reply automatic.

## Included: the collapsible sidebar

[`docs/SIDEBAR-SPEC.md`](./docs/SIDEBAR-SPEC.md) is a high-fidelity, stack-agnostic spec for a Claude-model collapsible left nav rail: an expanded panel that collapses to an icon-only rail where **every icon holds its exact vertical position** across the toggle (the detail most implementations get subtly wrong). It specifies the pinning technique (a frozen icon column + fixed row heights + section-headers-become-hairline-dividers), the full anatomy (header, scrollable body, an optional progress stepper, footer account row), drag-to-resize, persistence, collapsed tooltips, the mobile off-canvas drawer, and a build checklist.

It also specifies the header's **version chip + release-notes** plumbing, which couples to the bundled `push` skill: a single version source, a typed `releases` data model, and a `/releases` surface the chip opens. Build those three pieces and `push` keeps them current on every ship. So the sidebar spec and the push skill interlock.

## Included: spec, build-spec, and mockup (the feature loop)

Three skills that carry a feature from idea to verified code, with one human gate in the middle.

- [`mockup`](./skills/mockup/SKILL.md) puts a high-fidelity, throwaway design in front of you fast. Its best path edits a **shell**, a frozen snapshot of the real rendered page (actual DOM, stylesheet, fonts and copy) in one editable file, so the chrome around an idea is the app rather than a drawing of it. [`docs/MOCKUP-SHELLS-SPEC.md`](./docs/MOCKUP-SHELLS-SPEC.md) specifies the freezer for any stack; without it the skill falls back to a standalone page.
- [`spec`](./skills/spec/SKILL.md) turns the exploration (conversation plus mockup) into `.specs/<slug>/spec.md` and a punch list, then **stops for approval**. It keeps the decisions already made and the options rejected, so the build does not reopen them, and it tags every acceptance criterion with what will check it: `walk` (a browser), `unit` (a test) or `structure` (a guard or grep). A criterion that cannot be tagged is too vague to build from. Visibility and permission criteria are always written in both directions.
- [`build-spec`](./skills/build-spec/SKILL.md) works the punch list, one committed item at a time, and closes each criterion by its verifier: tests for `unit` and `structure`, and by default a short **check sheet** of clickable URLs the human drives for `walk` (or a walk runner, if the project has one and asks). It never rewords a criterion to make it pass. State lives in `punchlist.md`, so a fresh session or a worktree agent resumes cold.

Editing a spec by hand is the cheapest iteration available, and it only exists before code does. That gate is the reason these are two skills.

## Included: impersonation ("View as")

[`docs/IMPERSONATION-SPEC.md`](./docs/IMPERSONATION-SPEC.md) is a stack-agnostic spec for letting the builder or any admin open any page of the site as a specific user: the same nav, screens, data, redirects and API answers, with one "Viewing as" marker and an Exit. Its core rule is one server-side resolver of the effective viewer that every page, API route and realtime token calls. It covers who may impersonate whom (a strict rank ladder plus relationship limits, re-checked on every request, step-up on every door), where the doors belong (on the person wherever they appear, an account-menu picker, and "Open as reporter" from a bug report, not only an admin panel), querying as the target with a minted token that fails closed, read-only by default with the reads-that-write and always-blocked lists, expiry that is never silent, audit, and a role-preview mode for design review. Requirements carry IDs so tests and reviews can cite them.

## Included: the error crawlers

[`docs/CRAWLERS-SPEC.md`](./docs/CRAWLERS-SPEC.md) is a high-fidelity, stack-agnostic spec for three backend crawlers that exercise a whole app to find errors before a user (or a demo audience) does: a **route crawler** that hits every page in a matrix of data states (valid, missing, malformed, foreign-owned, mismatched-nesting) and flags 404s, 500s, and cross-tenant leaks; an **action crawler** that POSTs empty and junk payloads at every form action and asserts it fails gracefully, never with a 500; and a **browser monkey** that drives a real browser to catch the client-side errors the other two can't see. Each finds a different class of error, and together they're a fast "is anything broken" pass you can run before every demo.

It's a spec rather than code because route discovery, the data-state matrix, and the "graceful boundary vs. real content" classification are framework-shaped, but it is detailed down to the discovery walk, the classification rules, a hard **safety guard** (the crawlers decode the signed-in session and refuse to fire against anything but a disposable copy of the app), and a throwaway-database recipe, so a coding agent can build it in any stack. It assumes Postgres + Supabase with SvelteKit as the reference and calls out the generic equivalent throughout. Because the crawlers act on a disposable copy, they're safe to run destructively and cheap to run often.

## Included: the UX critic, the walk/sweep harness, and the disposable environment

The crawlers answer *did it break*; the [`ux-critique`](./skills/ux-critique/SKILL.md) skill answers *does it make sense*. It's an LLM critic that walks a flow with an **expectation loop** (predict, act, observe, judge) and files the gaps between expectation and reality through the **same feedback loop**, tagged by `source`, so agent findings land in the same inbox as human reports and hand off to `fix-bug` identically. Each run ends with a self-contained annotated report. Together with the crawlers that's the full agentic QA layer: one finds crashes, the other finds confusion, both file into one inbox.

[`docs/WALKS-AND-SWEEPS-SPEC.md`](./docs/WALKS-AND-SWEEPS-SPEC.md) is the critic made repeatable, catalogued, and wired to the fix pipeline: the higher-fidelity thing the ad-hoc critic grows into. It specifies **two structured browser passes**: a **walk** that travels one journey end to end (a screenshot and a written expectation per step), and a **sweep** that stands on one screen and clicks *every control on it*, classifying each as navigated / overlay / changed / **inert** / error / skipped, where `inert` (a button that does nothing) is the finding invisible to both a journey test and a crawler. Both land in one navigable report whose per-surface verdict is **derived from the evidence, not hand-written**, with an honest "machine-checked vs actually-reviewed" axis. And each finding files as a `bug_reports` row with `source: 'walkthrough'`, carrying the same tidy context package a widget report does (screenshot, route, console/network rings, code pointer, repro command), idempotent by fingerprint, with the report joining ticket state back in so a `/fix-bug <id>` is one copy away and a close refreshes the report. It is the cleanest proof that the feedback spine serves a machine reporter as well as a human one. The doc also carries the hard-won harness-reliability lessons (re-find by a written tag, don't filter on opacity, reset clears preference state, change-detect by content hash, skip domain-mutations-hiding-behind-nouns).

And the substrate that makes all of it safe to run: [`docs/DISPOSABLE-ENVIRONMENT.md`](./docs/DISPOSABLE-ENVIRONMENT.md), the discipline for *where* agents drive. Its core idea, **fidelity comes from turning stubs off, not from using prod**, lets you exercise the real production code path (real LLM spend, on purpose) against a database you can wipe, while a seatbelt (issuer-abort + prod-refusal guards) keeps the fuzzers off production entirely. This is what turns "let an agent fuzz the app" from a way to email your customers into a free, resettable safety net, and it directly closes the "separate dev from prod" gap below.

## Included: the hub-and-spokes workspace pattern

[`docs/HUB-AND-SPOKES.md`](./docs/HUB-AND-SPOKES.md) is the pattern for the *other* half of working with Claude Code: not how agents avoid colliding in one repo, but **how you organize the folders a project spans and where you launch from.** A real project's files are scattered by ownership and audience (code in a git repo, team docs in a shared drive, official docs on an org drive, private material in an account nobody can revoke), and you can't force them into one folder. Meanwhile Claude ties *both* its memory ("the brain," keyed to the launch dir) and its file access (launch dir + `--add-dir`) to **where you start it.** The pattern makes that decision on purpose: one neutral **hub** per project is the base and the brain; all content, code included, is a **spoke** mounted with `--add-dir`. Never make a content folder the base, so you never fork a second empty brain, and organize spokes by **privacy ring** (private/team/external), fencing sensitive ones out of the default mount and opting them in per run.

The tooling is in [`hub/`](./hub/): `./hub/install-hub.sh` creates the `~/hubs` container and a `hub` dispatcher (`hub new <name>`, `hub <name>`), and each hub scaffolds from a template whose `launch` derives its own base path and ships with skip-permissions **off** (the doc's "honest limits" explains why that's the safe default and what Bash can still reach when you turn it on). It composes with the session launchers: the hub sets *where and over what*; `cs` / `wt` / `cockpit` set *how many and how isolated*.

## Included: the portable memory pack

The kit's hooks, skills, and specs are the *mechanisms*; [`memory-pack/`](./memory-pack/) is the *habits*: a curated set of hard-won lessons from building real software with parallel agents, generalized so they seed any project's memory brain. Thirty-two one-lesson-per-file memories in Claude Code's memory format (frontmatter + **Why** + **How to apply**), spanning git hygiene under parallel agents (never amend on a shared branch; `git commit -- <path>` takes the working tree, not the index; sequential IDs collide), verification discipline (build before pushing, verify proportional to risk, test the behavior a change endangers not just the new code), environment safety (develop against a disposable copy; check a secret's shape, never print it), release discipline (deploy is not release; decide the release at spec time; flag or staging is decided by whose data; promote the staged commit; staging is a twin, not a demo; fence outward writes at one chokepoint; check silent callers when removing a flag), design/refactor discipline (subtraction audit on redesign; throwaway gitignored mockups), AI-product UX standards (every AI surface gets start + live progress + stop; one motion system; every mutating button gives feedback), and a few project-neutral working-style and communication conventions (design-first; direct and plain; no em dashes; commit freely but let the owner push; real icons not emoji). Several reinforce a kit artifact and link to it: the memory is the habit, the hook/doc is the enforcement. Adoption is a copy into a project's memory dir plus an append to its `MEMORY.md`; the pack's `README.md` has the one-liner. Drop the ones that don't fit, edit the rest to the stack.

**Team memory: the pack becomes the start of a shared brain.** Memory is the one part of a Claude Code setup that is truly local: it lives under `~/.claude/projects/<launch path>/memory/` and never travels. For a team of two building one thing, that means every lesson one person's agents learn is invisible to the other's. So `install.sh` seeds the pack into a tracked `.claude/team-memory/` folder, and a SessionStart hook ([`team-memory.mjs`](./hooks/scripts/team-memory.mjs)) loads that folder into every teammate's session: each file is linked into their memory folder under its own name, and the team index lines are written at the top of their `MEMORY.md` between marker comments, leaving their personal entries alone. A collaborator clones, runs `bootstrap.sh`, starts a session, and their agents recall the same project lessons yours do; new ones arrive with `git pull`. The [`share-memory`](./skills/share-memory/SKILL.md) skill is the way in: it takes a personal memory, scrubs credentials, customer data and people's names, generalizes it without losing its concrete reason, moves it into the team folder and commits it. Deliberate promotion rather than syncing the whole folder, because a personal memory folder names people, accounts and production details.

## Included: the release pipeline, the staging twin, and release flags

The kit's original deploy model was "a push to main deploys", which is exactly wrong once several agents and a collaborator share `main`: half-finished work goes live, so the owner hoards the push and finished work sits on one laptop. [`docs/RELEASE-PIPELINE.md`](./docs/RELEASE-PIPELINE.md) separates the three moments. **A push saves and runs CI, and deploys nothing. A tag deploys** (`-rc` to staging, a final tag to production). **A flag releases** a feature to an audience. It lays out the two roads from a change to users (straight to prod for small, safe, urgent work; stage then promote for migrations, outward writes and anything a pilot user should try) and the one rule that makes the second road honest: promote the exact commit staging served, not whatever `main` holds now. The [`stage`](./skills/stage/SKILL.md), [`promote`](./skills/promote/SKILL.md) and [`push`](./skills/push/SKILL.md) skills encode it.

[`docs/STAGING-TWIN-SPEC.md`](./docs/STAGING-TWIN-SPEC.md) is what makes staging worth opening: the same build and configuration as production, every difference named on a short allowlist that a parity checker enforces, filled with a **slice** of production (the team's own accounts and what they own, everyone else reduced to locked shells), and an **egress fence** at one chokepoint so nothing on it can reach a real person. It complements the disposable environment rather than replacing it: agents fuzz the disposable copy with stubs on; humans rehearse on the twin with real-shaped data and real behavior.

[`docs/RELEASE-FLAGS-SPEC.md`](./docs/RELEASE-FLAGS-SPEC.md) is the other half: every commit ships dark, and a super admin turns a feature on for the team, named people, a pilot tenant, then everyone, from an admin page with no deploy. Resource-scoped pages and background work decide by the resource's owner, an env var stays the kill switch, and flag debt is fenced by a cap, a cleanup task filed the moment a flag reaches everyone, and the [`remove-flag`](./skills/remove-flag/SKILL.md) skill. Flags cannot make outward writes safe for a team member who is also a real user, which is why the twin stays.

## What we haven't fully solved (gaps worth closing)

Honest commentary, so you don't mistake this kit for more than it is. These are the next things an AI-native team should put in place:

- **Local hooks are a nudge, not a gate. Add CI** (partly addressed: [`docs/RELEASE-PIPELINE.md`](./docs/RELEASE-PIPELINE.md) makes a push run CI, but you still have to write the workflow). Every guard here runs only on machines that wired it, and can be bypassed with a different tool. The real enforcement layer is **CI on push**: run the tests, the lint, and any architecture guards in GitHub Actions so nothing merges to `main` green-on-one-laptop and broken everywhere else. Treat the local hooks as the fast in-loop reminder and CI as the actual gate.
- **Secrets are the unguarded edge.** Sharing a `.env` file hands over full, often god-mode, database and provider access, and nothing in this kit changes that. For a team: never put real secrets in git, use a secrets manager or per-person scoped credentials, and if schema integrity matters, enforce it at the **database role** level (an app role with no DDL privileges), not just the psql hook.
- **Separate dev from prod** (now addressed, see [`docs/DISPOSABLE-ENVIRONMENT.md`](./docs/DISPOSABLE-ENVIRONMENT.md)). If your `.env` points every agent and teammate at the *production* database, then a stray `seed --reset` or destructive query hits real data, and the schema lock can't help across machines. Give the team a throwaway dev database with its own credentials; keep prod access narrow and human-only. The disposable-environment doc is the full treatment: the two-knob (where × stubs) model, the seatbelt guards, and migration porting.
- **Decide the review and revert norms.** Committing straight to `main` means recovery is `git revert`, not branch hygiene. Agree up front on how you review (cadence, who, what triggers it) and how you roll back, before the first bad commit, not after.
- **Watch the spend.** Several agents per person burns tokens and CI minutes fast (and build minutes too, if your host still deploys on every push rather than on tags). Set a shared expectation for both.

None of these are hard to add; they just live beyond the mechanical-collision problem this kit was built to solve.

---

## The origin conversation

This kit was designed in a single working session. [`docs/ORIGIN-CONVERSATION.md`](./docs/ORIGIN-CONVERSATION.md) is a readable, redacted narrative of how it unfolded, from "should I use worktrees?" to the finished kit. The raw verbatim transcript is kept private and out of this repo on purpose: a full session export embeds project-internal context (configuration, infrastructure names, architecture) that does not belong in a shared toolkit. If you want a personal copy of your own sessions, Claude Code's `/export` produces one, but treat it as private.

---

## Good for solo work too

Most of this earns its keep with zero collaborators: port assignment and the git/schema guards protect you from your own parallel agents. The collaborator-specific pieces (the post-merge migration flag, the pull/rebase discipline) simply lie dormant until a second person shows up.
