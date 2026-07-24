---
name: every-mutating-button-gives-feedback
description: "Every button that mutates or submits must give instant press feedback AND an in-flight state, so a laggy action never invites a double-click. Spinner replaces the label in place at fixed width; the button self-disables."
metadata:
  type: feedback
---

The bug this prevents: "click lags, user re-clicks, action fires twice." Every button that
triggers work needs two layers of feedback:

1. **Instant press (global, free):** every `<button>` visibly responds to `:active` (e.g.
   sinks 1px) so a press registers immediately, before any async work returns. Apply it
   globally so no button is missed.
2. **In-flight state:** on submit, the label is replaced IN PLACE by a spinner at the button's
   exact idle width (never grows/shrinks — the Linear/Vercel/Stripe default), and the button
   **self-disables** to block double-submits. Keep a screen-reader announcement for the busy
   state.

**Why:** without immediate feedback users assume the click missed and click again, firing
duplicate mutations; a button that changes width on load makes layouts jump.

**How to apply:** provide one shared `Button` component with `loading`/`loadingLabel` and use
it for every mutating action; drive it from your form-submit state so it flips automatically.
Choose the in-flight indicator by kind of work (neutral spinner for plumbing, the model
indicator for AI work) per [[ai-status-motion-one-system]]. Both press planes must respect
`prefers-reduced-motion`. See [[ai-surface-full-lifecycle]].
