---
name: share-memory
description: Promote personal Claude Code memories into the project's shared team memory (.claude/team-memory/), scrubbed and generalized so a collaborator's agents recall them too. Use when the user says "share that memory", "/share-memory", "add this to team memory", "my collaborator should know this", "what in my memory is worth sharing", or "seed the team brain".
---

# share-memory, move what the team needs from your head into the repo

Personal memory lives on one machine. Team memory is a tracked folder,
`.claude/team-memory/`, that the `team-memory` SessionStart hook loads into
every teammate's session. This skill is the deliberate step between them: pick,
scrub, generalize, move, commit.

Deliberate on purpose. A personal memory folder names people, accounts,
machines and production details, and some of it is about the person rather than
the project. Syncing the whole folder would leak that; promoting one memory at a
time does not.

## Step 1, pick

- **Named:** the user names one or more memories. Find them in this session's
  memory folder (`~/.claude/projects/<encoded launch path>/memory/`).
- **Survey:** "what is worth sharing?" Read the personal `MEMORY.md` index (not
  every file) and propose a short list, grouped:
  - **Share:** `feedback` and `project` memories about how this codebase, its
    environments and its tools behave; `reference` memories that point at
    team-visible resources.
  - **Ask first:** working-style preferences (they may be the user's alone, or
    the team's convention).
  - **Keep personal:** `user` memories about the person, anything about one
    machine, anything already in `CLAUDE.md` (do not duplicate it).
- Skip anything already in `.claude/team-memory/MEMORY.md`. If a team memory
  covers the same ground, propose an edit to it instead of a second file.

Wait for the user to confirm the list before writing.

## Step 2, scrub

For each memory, remove or replace:

- **Credentials and secrets:** keys, tokens, passwords, connection strings,
  signed URLs, private hostnames. Remove them, and say where the value lives
  instead ("in `.env.local`, see the setup doc").
- **Customer and user data:** names, emails, ids, document contents, anything a
  real user of the product wrote.
- **People:** a teammate's name becomes their role ("the product owner", "the
  collaborator") unless the user says the name is fine to share.
- **One machine:** absolute home paths, local ports, editor setup. Make them
  relative to the repo or drop them.

Show each scrubbed memory and get a yes before writing it. If a memory cannot be
scrubbed without losing its point, say so and leave it personal.

## Step 3, generalize without going vague

The test for a team memory: a collaborator who was not there can act on it.

- Keep the **concrete Why**: the incident, the number, the date it was learned.
  "Measured on 2026-08-19: five full-suite runs at 6-12 GB each put the machine
  in swap" is a reason; "tests use memory" is not.
- Turn "I" and "we decided last Tuesday" into the rule and its date.
- Convert relative dates to absolute ones.
- Keep `[[links]]` to other memories, and check each target exists in the team
  folder. A link to a memory that stays personal should become plain text.

## Step 4, move

1. Write `.claude/team-memory/<name>.md` (same format: frontmatter, fact,
   **Why:**, **How to apply:**).
2. Add one line to `.claude/team-memory/MEMORY.md`: `- [Title](<name>.md): hook`.
3. **Delete the personal copy** and remove its line from the personal
   `MEMORY.md`. Otherwise it shadows the team version: the hook never overwrites a
   personal file of the same name, and the two drift.
4. The hook links the team version into the memory folder at the next session
   start. Nothing else to do.

## Step 5, commit

Team memory is code: commit it with explicit paths, one concern per commit, and
follow the project's push rule.

```
git commit -m "docs(team-memory): <what was shared>" -- .claude/team-memory/<name>.md .claude/team-memory/MEMORY.md
```

Report what was shared, what was scrubbed from each, and what stayed personal
and why.

## Editing or retiring a team memory

Edit the file in `.claude/team-memory/` directly and commit it. To retire one,
delete the file and its index line and commit; the hook removes the stale link
from everyone's memory folder at their next session. A team memory that turned
out to be wrong should be deleted, not left with a correction beside it.
