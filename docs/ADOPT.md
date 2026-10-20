# Adopting the kit

How to bring this into your work, by situation. All three paths share one idea:

> **The kit is a tool you RUN AGAINST your repo, not something that lives inside it.**
> You clone the kit to a scratch location, run its installer pointed at your
> project, and the artifacts land in logical places in your repo. No nested git
> repository, no submodule, no repo-within-a-repo.

---

## Before you start (environment)

Have these in place first:

- **A git repo for your project**, initialized, with a **clean working tree** (commit or stash first) so you can review exactly what the install adds. Starting fresh? `git init` your project first.
- **Node** on your `PATH` (the Claude Code hooks run on Node).
- **Claude Code** installed, and you work in it from the **project root** (a VS Code terminal or any terminal).
- **Your package manager** (pnpm by default; adjust the guards if you use another).
- **Access to the kit** to clone it (`gh` authenticated, or the repo shared with you).
- For the **feedback widget** later: a Postgres database (Supabase by default) and an object store for screenshots.

---

## Pull it into your repo (the no-nesting pattern)

From inside your project's root:

```bash
# Clone the kit to a scratch dir OUTSIDE your repo, install into your repo, clean up.
gh repo clone ai-foundry-byu/agent-team-kit /tmp/agent-team-kit
/tmp/agent-team-kit/install.sh "$PWD"
rm -rf /tmp/agent-team-kit
```

Prefer to keep it around for updates? Clone it once to a permanent spot and re-run its installer against any project:

```bash
gh repo clone ai-foundry-byu/agent-team-kit ~/tools/agent-team-kit      # once
~/tools/agent-team-kit/install.sh /path/to/any/project           # any time
```

Either way, the kit's own `.git` never enters your repo. The installer **copies into logical locations in YOUR repo**:

| Lands at | What | On re-run |
|---|---|---|
| `scripts/hooks/*` | every hook script: `agent-coord.mjs`, `arch-check.mjs`, `bash-guard.mjs`, `bash-guard.sh`, `dev-port.mjs`, `file-size-budget.mjs`, `file-size-nudge.mjs`, `import-boundaries.mjs`, `session-release.mjs`, `team-memory.mjs` | overwritten |
| `.githooks/post-merge` | migration-awareness git hook | overwritten |
| `.githooks/pre-commit`, `.githooks/pre-push` | the git gates (architecture guard before a commit, check and tests before a push) | copied only if absent; an existing one is flagged for a hand merge |
| `.claude/settings.json` | Claude Code hook wiring | copied only if absent; an existing one is flagged for a hand merge |
| `.claude/skills/*` | all thirteen skills (see [`SKILLS.md`](./SKILLS.md)) | overwritten |
| `.claude/team-memory/` | team memory, seeded from the kit's `memory-pack/` (its `README.md` is the pack's `TEAM-MEMORY-README.md`) | seeded once; left alone if the folder exists |
| `bootstrap.sh` | collaborator setup | overwritten |
| `worktree-commands.sh` | the `wt` / `cockpit` / `cs` / `wtls` launchers | overwritten |
| `docs/FEEDBACK-LOOP-SPEC.md`, `docs/SIDEBAR-SPEC.md`, `docs/DRIVING-THE-APP.md`, `docs/MOCKUP-SHELLS-SPEC.md` | build specs and the app-driving guide | overwritten |
| `docs/RELEASE-PIPELINE.md`, `docs/STAGING-TWIN-SPEC.md`, `docs/RELEASE-FLAGS-SPEC.md` | the release pipeline docs the `push`, `stage`, `promote` and `remove-flag` skills point at | overwritten |

It also **appends**, guarded so a re-run never duplicates:

- to `.gitignore`: the `.claude` share rules (`.claude/*`, `!.claude/settings.json`, `!.claude/skills/`; if you already have a blanket `.claude/` ignore it tells you what to change and leaves the file alone), `.mockups/`, `.specs/`, and `!.claude/team-memory/`;
- to `CLAUDE.md`: three sections, the concurrent-agents rules (stay-on-main), working discipline, and mockups and design iteration.

And it sets `core.hooksPath = .githooks`.

It **never touches your source** and is **idempotent** (safe to re-run). Review with `git status` / `git diff`, then commit.

---

## The three paths

### A. Solo dev, existing project (brownfield)

The common case: a built-out repo where you want to harden how you work with agents.

1. From your project root, run the pull-it-in block above.
2. Review the diff and commit.
3. Customize for your stack if you're not on Supabase + pnpm (the installer's closing message lists the spots; [`SETUP-PROJECT.md`](./SETUP-PROJECT.md) explains each).
4. Start a **fresh** Claude Code session. You now have per-session dev ports plus the git / schema / psql guards protecting you from your **own** parallel agents.
5. (optional) Build the feedback loop: tell your agent *"build the feedback loop from `docs/FEEDBACK-LOOP-SPEC.md` for our stack."* Review, commit.

The collaborator-only pieces lie dormant until you add someone, so there is nothing to turn off.

### B. New two-person team, new project (greenfield)

1. Create and `git init` the project (or clone your starter), make a first commit.
2. One person runs the pull-it-in block, customizes for the stack, commits, and **pushes**.
3. The other clones the **project** and runs `./bootstrap.sh`.
4. Both read "Collaboration model, end to end" in the [README](../README.md): claim lanes, pull-rebase often, agree who cuts release tags (see [`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md)).
5. (optional) Build the feedback loop from the spec.

### C. Solo project, adding a second person (transition)

You already did path A while solo. To bring someone on:

1. Confirm the shared artifacts are committed: `.claude/settings.json`, `.claude/skills/`, `.claude/team-memory/`, `scripts/hooks/`, `.githooks/`, `bootstrap.sh`, `worktree-commands.sh`, the copied `docs/`, the CLAUDE.md sections, the `.gitignore` lines (the installer set these up). **Push.**
2. Purge anything sensitive from history first if needed.
3. The new person clones the **project** and runs `./bootstrap.sh` (sets their git hooks path; prints the two manual bits: personal config in `settings.local.json`, and start a fresh session).
4. Switch on the human agreements: both read the collaboration model. The shifts from solo are: stay in lanes, pull-rebase often, announce migrations, agree who cuts release tags.

Same install you already did, now with a second clone plus the agreements active.

---

## Optional: the hub-and-spokes workspace setup

Separate from installing the kit *into a repo*, and done **once per machine**: the
hub-and-spokes tooling sets up how you launch Claude across a project whose files are
scattered (code repo + shared drive + org/personal storage). One neutral **hub** per
project is the base and the memory anchor; all content is a **spoke** mounted via
`--add-dir`. It's orthogonal to the per-repo install above, a repo you harden with the
installer is simply one of a hub's spokes.

```bash
./hub/install-hub.sh            # create ~/hubs, install the `hub` dispatcher + template, add the alias
hub new myproject               # scaffold a cockpit
$EDITOR ~/hubs/myproject/launch # set SPOKES (one --add-dir per content folder)
hub myproject                   # launch
```

The full pattern, the privacy-ring model, and the honest limits are in
[`HUB-AND-SPOKES.md`](./HUB-AND-SPOKES.md).

## Updating later

Re-run the pull-it-in block any time to refresh the hooks, skills, and spec to the latest kit version (it's idempotent). One caveat: re-running **overwrites everything marked "overwritten" in the table above**: the hook scripts, `.githooks/post-merge`, the skills, `bootstrap.sh`, `worktree-commands.sh` and the copied docs. If you've customized `bash-guard.mjs`, `dev-port.mjs`, `file-size-budget.mjs`, the `post-merge` migrations path or a skill for your project, keep those tweaks minimal and re-apply them after an update (or fork the kit and install from your fork). `.githooks/pre-commit`, `.githooks/pre-push`, `.claude/settings.json` and `.claude/team-memory/` are never overwritten.
