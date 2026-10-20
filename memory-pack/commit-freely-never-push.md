---
name: commit-freely-never-push
description: "Commit freely after each unit of work without asking; the owner owns the push/deploy trigger. Commit straight to main (no feature branches by default); never rewrite pushed history."
metadata:
  type: feedback
---

A workflow many solo/small-team owners prefer: **commit often, push never** (unless asked).

- **Commit after each unit of work, without asking.** Committing is pre-authorized and
  reversible (`git reset` while unpushed, `git revert` once pushed), so just do it when a unit
  is done; don't end with "want me to commit?". Use conventional prefixes and stage only the
  files related to the work at hand (the tree often holds unrelated in-flight changes; never
  sweep those in; see [[format-only-touched-files]]).
- **Do NOT push.** Each push to the main branch typically fires a paid production build/deploy,
  so the owner controls exactly when that happens. Leave the push to them; run `git push` only
  when explicitly asked in the moment. (Batch-of-many pushes can burn real money fast, which is the
  reason the owner keeps the trigger.)
- **Commit straight to the main branch, no feature branches** by default when the owner works
  solo; branch-per-change is ceremony they don't want. (This overrides the generic
  branch-first habit; keep it if the project is genuinely multi-author.)
- **Never rewrite pushed history** (no force-push, no amend/rebase of pushed commits). Before
  committing, run the real build for import changes ([[verify-with-the-real-build]]). Under
  parallel agents, also never amend the shared branch ([[never-amend-on-shared-main]]).

**Why:** committing is free and reversible; pushing costs money and ships to users. Separating
the two lets work land continuously while the owner owns the deploy moment.

**If your pipeline deploys on a TAG instead of a push** ([[deploy-is-not-release]], the kit's
`docs/RELEASE-PIPELINE.md`), the push stops being the deploy trigger: push freely to get work
off the machine and through CI, and the owner keeps the tag instead. That is the better
setup once several agents share main.
