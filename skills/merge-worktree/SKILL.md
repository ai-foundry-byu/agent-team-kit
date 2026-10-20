---
name: merge-worktree
description: Integrate a finished worktree worker's branch into main and clean up, from the cockpit session. Use when the user says "integrate <name>", "merge the <name> worktree", "bring in the <name> worker/branch", "merge worker <name>", or "integrate all the worktrees", the cockpit-side integration step of worktree mode. Verifies you're on main with a clean tree, merges, surfaces conflicts instead of guessing, prunes the worktree, and stops short of pushing.
---

# merge-worktree: integrate a worker branch from the cockpit

In worktree mode, workers run in their own git worktrees on their own branches and never merge to `main` themselves. Integration happens here, in the **cockpit** session (on `main`, in the main checkout). This skill does that integration with the guards a bare `git merge` lacks.

## Input

A worker's name (e.g. `grading-fix`, as passed to `wt`) or its branch name, or "all" to integrate every finished worktree. `wt <name>` runs `claude --worktree <name>`, which creates the branch `worktree-<name>` (worktree at `.claude/worktrees/<name>`), so a bare name maps to the branch `worktree-<name>`. Confirm the branch with `git worktree list`; if you're unsure which workers exist, run it first.

## Procedure

1. **Preflight, confirm you're the cockpit, on a clean tree.**
   - You must be in the MAIN checkout on `main`: `git rev-parse --abbrev-ref HEAD` is `main`, AND `git rev-parse --git-dir` equals `git rev-parse --git-common-dir` (i.e. NOT inside a linked worktree). If you're in a worktree, you're a worker, do not integrate; tell the user to run this from the cockpit.
   - The working tree must be **clean**: `git status --short` is empty. If it's dirty, STOP and ask, a merge needs a clean tree, and you must never sweep unrelated changes into it.
   - `git worktree list` to see the worktrees and branches; confirm the named branch exists.
   - Make sure the worker is **done**: its work is committed to its branch. If its worktree still has uncommitted changes, those aren't on the branch yet, flag it rather than merging a stale snapshot.

2. **Merge.** `git merge --no-edit <branch>`.
   - **On conflict: STOP. Do not guess.** Show the conflicting files (`git diff --name-only --diff-filter=U`), explain what overlapped, and resolve only with the user's intent, or hand it back to them. Blind-resolving a merge is how plausible-but-wrong code ships.
   - For "all" / multiple branches, merge them **one at a time**. Each later merge runs against a `main` the earlier ones already changed, so a conflict can surface on the 2nd or 3rd even if each branch was clean against the original `main`.

3. **Clean up** (after a clean merge): `git worktree prune` (clears the worktree entry once the worker's session auto-removed its directory) and `git branch -d <branch>` (safe delete, it's merged). If `-d` refuses, the branch isn't fully merged; investigate, don't `-D` force it.

4. **Report, don't push.** Summarize what merged, any conflict you resolved (and how), and that it's on `main` **locally**. Do NOT push, remind the user that shipping is the separate `/push` step (the deliberate, often paid, act), run when they're ready. If you integrated several workers, note they're now batched for a single push.

## Guardrails

- Only ever from the cockpit (main checkout, on `main`, clean tree).
- Never blind-resolve conflicts. Never force-delete a branch. Never push as part of this skill.
