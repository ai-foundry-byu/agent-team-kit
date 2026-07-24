---
name: commit-pathspec-uses-working-tree
description: "git commit -- <paths> commits the WORKING-TREE content of those paths, not what you staged; it silently defeats partial staging (git add -p / apply --cached)."
metadata:
  type: feedback
---

`git commit -- <path>` (and `git commit --amend -- <path>`) commits the **working-tree**
content of those paths, NOT what you carefully staged. It effectively re-`git add`s each
pathspec from the working tree first.

**Why:** this silently defeats partial staging. In a parallel-agents workflow you might stage
only your hunks of a shared file (`git add -p`, or `git apply --cached <mine.patch>`, leaving
a sibling's uncommitted hunk out), then run `git commit -- <file>` — which sweeps the
sibling's line in anyway, because pathspec-commit ignores the index and takes the whole
working-tree file. On a shared branch that quietly commits someone else's in-flight work.

**How to apply:** when a shared file holds both your hunks and a sibling's uncommitted change,
do NOT use `git commit -- <file>`. Stage exactly your hunks, then commit the INDEX with **no
pathspec** (`git commit -m ...`). To repair an already-swept commit: remove the foreign line
from the worktree, `git add` + commit the fix, then re-insert the line as an unstaged edit to
restore the sibling's work. Related: [[never-amend-on-shared-main]], [[format-only-touched-files]].
