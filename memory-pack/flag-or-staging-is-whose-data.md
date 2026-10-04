---
name: flag-or-staging-is-whose-data
description: "A release flag controls WHO code runs for, not WHAT it does, and turning it off undoes nothing written. Deploy-time changes always rehearse on staging; per-request changes rehearse only if the FIRST audience could do irreversible harm outside the team."
metadata:
  type: feedback
---

"Anything that writes to an outside system goes to staging first" sounds safe and is the
wrong rule. It sends harmless changes through a slow road and still misses the real
question.

**Why:** the three tools answer different questions. A flag decides who the code runs for.
The staging twin, with its egress fence, decides where the effects land. Neither decides
what the code does, and switching a flag off does not unsend an email or un-post a grade.

**How to apply:**
- **Deploy-time changes reach everyone before any flag is checked:** migrations, containers,
  workers, dependency upgrades, shared code edited on the way in. Rehearse the build on
  staging and promote that exact build.
- **Per-request changes:** ask about the FIRST audience: what is the worst case, whose data
  does it land on, can it be undone? Team data or reversible: a flag is enough. Irreversible
  and outside the team (a real inbox, a live gradebook, a payment): staging first.
- Watch the hidden case: a team member who is also a real teacher, clinician or seller
  makes "Team" an audience that reaches real people.
- **Pure refactors** (renames, moves, extractions) get tests, not flags or rehearsals.
- Answer this in the spec's Release section ([[decide-the-release-at-spec-time]]). Kit:
  `docs/RELEASE-PIPELINE.md` section 5, `docs/RELEASE-FLAGS-SPEC.md` R38.
