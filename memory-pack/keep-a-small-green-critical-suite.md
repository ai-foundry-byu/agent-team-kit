---
name: keep-a-small-green-critical-suite
description: "Test the EXISTING behavior a change could break, not just the new code. Match check cost to risk: per-change impact analysis, behavior tests, and a tiny always-green @critical suite gated at pre-push."
metadata:
  type: feedback
---

The regression that bites hardest: you change a shared chokepoint, add a unit test proving
the NEW code's logic, it passes — and a *different* feature that also flowed through that
chokepoint is now silently broken. The green test gave false confidence because it tested the
change, not what the change endangered.

**Why:** a test of the new code passes while the feature it broke is red. The tell of a wrong
test is that it stays green while the user-facing behavior is broken.

**How to apply (layer checks by rarity/risk, not everything on every commit):**
- **Per risky change** — when touching shared/widely-imported code, do a quick impact
  analysis: enumerate the callers of what you changed, name the user-facing features behind
  them, and write a **behavior test** that asserts the user-facing outcome of an *existing*
  feature ("Start over empties the form and stays empty on reload"), not the implementation.
- **Pre-push gate** — run the check + test suite before a push triggers a paid build/deploy.
  Keep it HERMETIC (empty out live-service env vars so integration specs that hit a real dev
  datastore self-skip) or routine drift turns them red and false-blocks pushes.
- **A tiny `@critical` E2E set** — tag the handful of must-never-break journeys and run only
  those as the fast gate; run the full/live suite on demand. Run E2E only against your own
  quiet dev server ([[run-your-own-dev-server]]) or a busy one makes specs flap red.

See [[verify-with-the-real-build]], [[arch-guards-as-alarms]].
