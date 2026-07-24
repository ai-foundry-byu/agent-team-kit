# Memory pack — portable, project-agnostic memories

A curated set of hard-won lessons from building real software with parallel Claude Code
agents, **generalized** so they seed any project's memory brain. They are the human-and-agent
working knowledge the rest of the kit's tooling (hooks, skills, specs) assumes but can't
enforce: git hygiene under parallel agents, verification discipline, environment safety,
design/refactor discipline, AI-product UX standards, and a few working-style and
communication conventions (project-neutral, not tied to any one person).

Each file is one memory in Claude Code's memory format: YAML frontmatter (`name`,
`description`, `metadata.type`) then a short body with **Why** and **How to apply**. They
are deliberately stack-agnostic — where a stack detail helps, it appears as "e.g." not as a
requirement. Several reinforce a kit artifact and link to it; the memory is the *habit*, the
doc/hook is the *mechanism*.

## What's in the pack

| Memory | The lesson in one line |
|---|---|
| `never-amend-on-shared-main` | Never `--amend`/rebase on a shared branch under parallel agents — a sibling may have moved HEAD. |
| `commit-pathspec-uses-working-tree` | `git commit -- <path>` commits the working tree of those paths, not your staged index. |
| `format-only-touched-files` | Never run a whole-repo formatter; format only the files you touched. |
| `sequential-ids-collide-in-parallel` | Parallel agents grab the same next number in any monotonic sequence (migrations, fixtures). |
| `run-your-own-dev-server` | Never trust the default port; run your own, read the real bound port, kill only your PID. |
| `verify-with-the-real-build` | The fast typecheck can pass while the real build/deploy fails — build before pushing. |
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

`MEMORY.md` here is the pack's index in the same one-line-per-entry format the memory system uses.

## How to adopt into a project

Claude Code memories don't live in your repo — they live under
`~/.claude/projects/<encoded-launch-path>/memory/`, keyed to where you launch Claude
(the `<encoded-launch-path>` is your project's absolute path with `/` → `-`). To seed a
project with this pack:

```sh
# from the project you want to seed (so $PWD is its launch dir)
DEST="$HOME/.claude/projects/$(pwd | sed 's#/#-#g')/memory"
mkdir -p "$DEST"
cp /path/to/agent-team-kit/memory-pack/*.md "$DEST"/
# then merge the pack's index lines into the project's MEMORY.md (create it if absent)
cat /path/to/agent-team-kit/memory-pack/MEMORY.md >> "$DEST/MEMORY.md"
```

Then trim: delete any memory that doesn't fit the project, and edit the rest to match its
stack. These are a **starting brain**, not gospel — the point is to not re-learn the same
lessons from zero on every new codebase.

> Note: `MEMORY.md` in a real memory dir is the index (one line per memory). If the project
> already has one, append the pack's lines rather than overwriting, then de-dupe.
