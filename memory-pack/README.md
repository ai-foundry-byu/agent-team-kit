# Memory pack: portable, project-agnostic memories

A curated set of hard-won lessons from building real software with parallel Claude Code
agents, **generalized** so they seed any project's memory brain. They are the human-and-agent
working knowledge the rest of the kit's tooling (hooks, skills, specs) assumes but can't
enforce: git hygiene under parallel agents, verification discipline, environment safety,
design/refactor discipline, AI-product UX standards, and a few working-style and
communication conventions (project-neutral, not tied to any one person).

Each file is one memory in Claude Code's memory format: YAML frontmatter (`name`,
`description`, `metadata.type`) then a short body with **Why** and **How to apply**. They
are deliberately stack-agnostic: where a stack detail helps, it appears as "e.g." not as a
requirement. Several reinforce a kit artifact and link to it; the memory is the *habit*, the
doc/hook is the *mechanism*.

## What's in the pack

| Memory | The lesson in one line |
|---|---|
| `never-amend-on-shared-main` | Never `--amend`/rebase on a shared branch under parallel agents; a sibling may have moved HEAD. |
| `commit-pathspec-uses-working-tree` | `git commit -- <path>` commits the working tree of those paths, not your staged index. |
| `format-only-touched-files` | Never run a whole-repo formatter; format only the files you touched. |
| `sequential-ids-collide-in-parallel` | Parallel agents grab the same next number in any monotonic sequence (migrations, fixtures). |
| `run-your-own-dev-server` | Never trust the default port; run your own, read the real bound port, kill only your PID. |
| `verify-with-the-real-build` | The fast typecheck can pass while the real build/deploy fails; build before pushing. |
| `verify-proportional-to-risk` | Scale verification to risk: typecheck trivial copy, browser-verify behavior/layout. |
| `keep-a-small-green-critical-suite` | Test the *existing* behavior a change could break, not just the new code; gate a tiny @critical suite. |
| `develop-against-a-disposable-copy` | Never point local dev at the production datastore once real users exist. |
| `subtraction-audit-on-redesign` | When a redesign supersedes a surface, delete what it obsoletes in the same wave. |
| `throwaway-mockups-gitignored` | Hi-fi self-contained HTML mockups in a gitignored dir, throwaway, share a clickable `file://` path. |
| `ai-surface-full-lifecycle` | Every AI-working surface needs start + live progress + stop/start-over; wire cancel from day one. |
| `ai-status-motion-one-system` | Standardize "working" indicators onto a few shared primitives; color encodes kind of work. |
| `every-mutating-button-gives-feedback` | Instant press + in-flight spinner (label replaced in place, fixed width, self-disabling). |
| `arch-guards-as-alarms` | Ratchet guards are alarms to check cohesion, not numbers to game. |
| `design-first-then-verify` | Surface tradeoffs + a quick mockup before building; harden for robustness; verify honestly. |
| `communicate-direct-and-plain` | Answer first, short rationale, no throat-clearing; drafted copy stays plain and factual. |
| `no-em-dashes` | Never use em dashes in copy, comments, commits, notes, or chat replies. |
| `commit-freely-never-push` | Commit each unit of work without asking; the owner owns the push/deploy trigger. |
| `real-icons-not-emoji` | Use the project's real icon set for UI iconography; never emoji/unicode glyphs. |
| `deploy-is-not-release` | A push runs CI only; a tag deploys (rc to staging, final to prod); a flag releases to an audience. |
| `promote-the-staged-commit` | After a staging rehearsal, ship exactly the staged commit, read from the twin itself. |
| `staging-is-a-twin-not-a-demo` | Same build and config as prod, differences named and enforced by a parity checker, the team's data slice. |
| `fence-outward-writes-at-one-chokepoint` | One fenced-fetch helper with allowlists, and an arch test that fails on any bypass. |
| `check-before-flagging-a-shipped-feature` | A new flag retracts a live feature; check, set the audience before deploy, move notes and help. |
| `check-a-secrets-shape-never-print-it` | Diagnose credentials by length, charset and a harmless probe; never print the value. |
| `decide-the-release-at-spec-time` | Kind, key, seam, whose flags, off path and rollout are decided in the spec; a flagged build reports "shipped dark". |
| `flag-or-staging-is-whose-data` | A flag controls who, not what; rehearse deploy-time changes, and per-request ones only if the first audience could harm outsiders irreversibly. |
| `branch-once-at-a-seam` | One flag check at one seam, a plain if/else, off returns null, data readable by both paths. |
| `env-flags-are-for-what-stays` | Env holds kill switches, stubs and config; rollouts are release flags; entitlements get their own list. |
| `removing-a-flag-check-silent-callers` | Before deleting the off branch, read deployed config and find callers that leave an optional flag param out. |
| `pick-the-lever-by-lifetime-and-owner` | Per-person differences pick one lever (flag, kill switch, role, entitlement, preference) by lifetime and owner; never a role or paid tier in a flag. |

`MEMORY.md` here is the pack's index in the same one-line-per-entry format the memory system uses.

## How to adopt into a project

**With the kit (recommended):** `install.sh` seeds this pack into the project's
tracked `.claude/team-memory/` folder, and the `team-memory` SessionStart hook
loads it into every teammate's session. Nothing to copy by hand, and anything
the team learns later is added with the `/share-memory` skill. Trim the seeded
files to fit the project and commit.

**Personal only (no team folder):** Claude Code memories live under
`~/.claude/projects/<encoded-launch-path>/memory/`, keyed to where you launch
Claude. The encoding turns every non-alphanumeric character of the absolute path
into `-`. From the project you want to seed:

```sh
DEST="$HOME/.claude/projects/$(pwd | sed 's#[^A-Za-z0-9]#-#g')/memory"
mkdir -p "$DEST"
cp /path/to/agent-team-kit/memory-pack/*.md "$DEST"/
rm -f "$DEST/README.md" "$DEST/TEAM-MEMORY-README.md"
# MEMORY.md was just overwritten if one existed: restore yours and append the
# pack's lines instead if so.
```

Then trim: delete any memory that doesn't fit the project, and edit the rest to
match its stack. These are a **starting brain**, not gospel; the point is to not
re-learn the same lessons from zero on every new codebase.
