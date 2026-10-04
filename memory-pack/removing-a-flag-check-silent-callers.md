---
name: removing-a-flag-check-silent-callers
description: "Before deleting a flag's off branch: read every environment's deployed value, list every caller of an optional flag parameter (left out often means OFF), check what the tests cover, and find tests that disable the flag on purpose."
metadata:
  type: feedback
---

"The flag is on for everyone, so delete the off branch" can change production behaviour
silently, because "on for everyone" describes the flag, not every code path.

**Why:** an optional boolean parameter (`{ withFeature?: boolean }`) treats "left out" as
off. A secondary caller that never passed it has been running the OFF path in production all
along; deleting that branch changes what it does with no test going red, since the snapshot
that protects the main path says nothing about secondary callers.

**How to apply:**
- **Read the deployed config of every environment** (prod, staging, CI, disposable), not the
  docs, for the flag and its env override. Docs drift from what is deployed.
- **List every caller of any optional flag parameter** and what it passes; decide each one.
- **Name the test that covers each caller**, or write one first.
- **Grep tests and harness config for the flag set off on purpose** (an end-to-end setup
  that disables a feature for isolation). That flag has become test infrastructure.
- **Remove by substitution:** replace the check with its current value, delete only code
  that became unreachable, and leave signature changes for a follow-up.
- **Keep a permanent kill switch** where the feature can fail without erroring (wrong output,
  no fallback fires) into something that matters. Removing it makes "turn it off" a revert
  plus a release. Kit: `skills/remove-flag/`, `docs/RELEASE-FLAGS-SPEC.md` R35, R41-R44.
