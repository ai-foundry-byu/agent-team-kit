---
name: never-amend-on-shared-main
description: Never git commit --amend or rebase on a shared branch when parallel agents share it; a sibling may have moved HEAD so you rewrite THEIR commit.
metadata:
  type: feedback
---

`git commit --amend` (and rebase, and pathspec-amend `git commit --amend -- <paths>`) is
UNSAFE on a shared branch that concurrent agents commit to. Between your commit and your
amend, a sibling can land a commit on top, moving HEAD. Your amend then rewrites the
SIBLING's commit, folding your changes into theirs and tangling history. Pathspec-amend
also silently KEEPS files the original commit had that you didn't list (a renamed file's
old path lingers as a duplicate).

**Why:** on a shared branch, HEAD is a moving target you don't control; amend/rebase always
act on whatever HEAD is *now*, not the commit you meant.

**How to apply:** get the commit right in ONE `git commit` (stage exact paths, verify with
`git status` first). If you must fix a just-made commit, FIRST confirm HEAD is still yours
(`git log -1` shows your subject) before amending; if a sibling landed on top, make a NEW
follow-up commit instead. Best: work in a git worktree on your own branch, where your branch
and index are isolated and amend is safe again. See [[commit-pathspec-uses-working-tree]],
[[sequential-ids-collide-in-parallel]].
