---
name: verify-proportional-to-risk
description: "Scale verification to risk. Typecheck-only for trivial changes (copy swaps, class tweaks, one-line ternaries); reserve the live browser pass for behavior and layout."
metadata:
  type: feedback
---

Not every change earns a browser pass. Verifying a placeholder-text change in the browser
costs minutes and screenshots for zero information; a static check already proves it compiles
and the change is visually unambiguous from the diff.

**Why:** over-verifying trivial edits wastes time and tokens; under-verifying risky ones ships
bugs. Match the effort to the failure modes the diff can hide.

**How to apply:** scale verification to risk.
- **Check only, then commit:** copy/placeholder/tooltip swaps, class-name tweaks, obvious
  one-liners: anything whose effect is fully legible in the diff.
- **Verify live (browser/behavior):** new layouts, state transitions, interaction changes,
  data-loading, anything with a failure mode you can't predict from the diff.

The build-before-push rule still stands independently for import changes
([[verify-with-the-real-build]]). See [[run-your-own-dev-server]].
