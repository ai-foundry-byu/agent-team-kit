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
gh repo clone sdmurff/agent-team-kit /tmp/agent-team-kit
/tmp/agent-team-kit/install.sh "$PWD"
rm -rf /tmp/agent-team-kit
```

Prefer to keep it around for updates? Clone it once to a permanent spot and re-run its installer against any project:

```bash
gh repo clone sdmurff/agent-team-kit ~/tools/agent-team-kit      # once
~/tools/agent-team-kit/install.sh /path/to/any/project           # any time
```

Either way, the kit's own `.git` never enters your repo. The installer **copies into logical locations in YOUR repo**:

| Lands at | What |
|---|---|
| `scripts/hooks/*` | the coordination hooks |
| `.githooks/post-merge` | migration-awareness git hook |
| `.claude/settings.json` | hook wiring (or it flags a merge if you already have one) |
| `.claude/skills/*` | the skills |
| `bootstrap.sh` | collaborator setup |
| `docs/FEEDBACK-LOOP-SPEC.md` | the feedback build spec (so you can build from it) |

It also **appends** the share rules to `.gitignore` and the concurrent-agents section to `CLAUDE.md` (guarded, never duplicating), and sets `core.hooksPath = .githooks`. It **never touches your source** and is **idempotent** (safe to re-run). Review with `git status` / `git diff`, then commit.

---

## The three paths

### A. Solo dev, existing project (brownfield)

The common case: a built-out repo where you want to harden how you work with agents.

1. From your project root, run the pull-it-in block above.
2. Review the diff and commit.
3. Customize for your stack if you're not on Supabase + pnpm (3 spots; the installer lists them).
4. Start a **fresh** Claude Code session. You now have per-session dev ports plus the git / schema / psql guards protecting you from your **own** parallel agents.
5. (optional) Build the feedback loop: tell your agent *"build the feedback loop from `docs/FEEDBACK-LOOP-SPEC.md` for our stack."* Review, commit.

The collaborator-only pieces lie dormant until you add someone, so there is nothing to turn off.

### B. New two-person team, new project (greenfield)

1. Create and `git init` the project (or clone your starter), make a first commit.
2. One person runs the pull-it-in block, customizes for the stack, commits, and **pushes**.
3. The other clones the **project** and runs `./bootstrap.sh`.
4. Both read "Collaboration model, end to end" in the [README](../README.md): claim lanes, pull-rebase often, one person owns deploys.
5. (optional) Build the feedback loop from the spec.

### C. Solo project, adding a second person (transition)

You already did path A while solo. To bring someone on:

1. Confirm the shared artifacts are committed: `.claude/settings.json`, `.claude/skills/`, `scripts/hooks/`, `.githooks/`, the CLAUDE.md section, the `.gitignore` lines (the installer set these up). **Push.**
2. Purge anything sensitive from history first if needed.
3. The new person clones the **project** and runs `./bootstrap.sh` (sets their git hooks path; prints the two manual bits: personal config in `settings.local.json`, and start a fresh session).
4. Switch on the human agreements: both read the collaboration model. The shifts from solo are: stay in lanes, pull-rebase often, announce migrations, decide who owns deploys.

Same install you already did, now with a second clone plus the agreements active.

---

## Updating later

Re-run the pull-it-in block any time to refresh the hooks, skills, and spec to the latest kit version (it's idempotent). One caveat: re-running **overwrites the hook scripts**, so if you've customized `bash-guard.mjs` or `dev-port.mjs` for your stack, keep those tweaks minimal and re-apply them after an update (or fork the kit and install from your fork).
