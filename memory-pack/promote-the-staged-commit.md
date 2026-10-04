---
name: promote-the-staged-commit
description: "After a staging rehearsal, ship exactly the commit staging is serving, not whatever main holds now. Read the staged SHA from the twin itself; if main moved, list what would ride along and ask."
metadata:
  type: feedback
---

A ship skill that tags HEAD is fine for small fixes. After a rehearsal on staging it is a
trap: anything committed to main since the rc was cut goes to production untested, under the
banner of "we tried it on staging".

**Why:** the point of staging is that prod gets what people actually tried. On a shared
branch that moves dozens of times a day, HEAD at ship time is almost never the staged commit.

**How to apply:**
- Read the staged commit from the twin's own status endpoint (a `commit` field), never from
  "the newest rc tag": a failed rc deploy leaves a tag that never ran.
- Refuse when the staged commit is not on main, when prod is not its ancestor (promoting
  would go backwards), when CI was not green on that SHA, or when a destructive migration is
  in the range.
- If main has moved, show the commits that would ride along and ask once: promote the
  staged build alone, or ship all of main.
- Build the release (version bump, notes) on the staged commit in a temporary worktree,
  apply migrations from that worktree, tag the release commit, merge it back into main so
  the tag stays an ancestor, push both refs atomically, and smoke-test the deployed COMMIT.
- Look up CI by SHA across all runs; `gh run list --commit` misses runs triggered by tags.
- Kit: `skills/promote/`, `docs/RELEASE-PIPELINE.md`. See [[deploy-is-not-release]].
