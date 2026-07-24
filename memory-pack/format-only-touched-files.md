---
name: format-only-touched-files
description: "Never run a whole-repo formatter; it sweeps unrelated formatting drift into your working tree. Format only the files you touched."
metadata:
  type: feedback
---

A whole-repo format command (e.g. `prettier --write .`, `gofmt ./...`, `black .`) reformats
the ENTIRE repo, not just your changes. Running it leaves whitespace/format-only diffs in
files unrelated to the task, which violates "only stage files related to the work at hand."
Worse under parallel agents: a sibling's uncommitted edits are already in the tree, and a
whole-repo format collides with them and can sweep them into your commit.

**Why:** the standing rule is never sweep unrelated pre-existing changes into a commit; a
whole-repo format manufactures exactly those, and on a shared tree it can clobber a sibling.

**How to apply:** format only the files you touched — pass explicit paths
(`prettier --write <file1> <file2>`), or let a staged-files-only pre-commit hook handle it.
Stage explicit paths, never `git add -A` / `git add .`. If the repo genuinely needs a
one-time repo-wide reformat, do it as its own dedicated `style:` commit when no parallel
session is mid-edit. See [[commit-pathspec-uses-working-tree]].
