---
name: check-before-flagging-a-shipped-feature
description: "Putting a feature behind a release flag after it has shipped RETRACTS it from everyone the moment the flagged build deploys. Check whether it is live and used, set the flag's audience before the deploy lands, and move the release notes and help text with the flag."
metadata:
  type: feedback
---

"Let's make this our first flag" sounds like a no-op for a feature already in the code. It
is not: a flag with no row is OFF, so the deploy that adds the check turns the feature off
for every user who had it that morning.

**Why:** in a real case the feature had shipped to every user hours earlier and the release
notes announced it; the agent first assumed it was only on main. Catching it before the ship
turned an accidental retraction into a deliberate choice.

**How to apply:**
- Before gating, check whether the feature is already in a production release
  (`git merge-base --is-ancestor <feature-commit> <prod-tag>`) and whether anyone used it
  (count its rows). Then choose the first audience on purpose.
- Write the audience to production BEFORE the flagged build deploys, so there is no window
  where nobody has it.
- If it is pulled back to a pilot, remove it from release notes and help articles that most
  users can no longer see, and note in the commit where to restore them from.
- Gate on the server and in the UI together; a hidden button with a live endpoint is not a
  flag. Kit: `docs/RELEASE-FLAGS-SPEC.md`. See [[deploy-is-not-release]].
