---
name: ai-surface-full-lifecycle
description: "STANDING RULE for AI products: every surface where a model works for the user must offer the full lifecycle — an explicit start, a LIVE progress indicator while running, and a way to stop/interrupt/start-over. Wire cancellation from day one."
metadata:
  type: feedback
---

Every surface where an AI does work for the user must offer the full run lifecycle, uniformly:

1. **Start** — an explicit, obvious trigger.
2. **Stay informed** — a LIVE working indicator while the model runs (animated, with elapsed
   time), not a static "Reading your file…" bubble. The user must be able to tell *alive* from
   *stuck*.
3. **Stop / interrupt / start over** — the user can cancel a running generation at ANY point
   (actually abort the request/job, not just hide the UI) and restart cleanly.

**Why:** one-off AI surfaces keep shipping with partial lifecycles because each is built in
isolation — a chat with no interrupt, a generator with no live status, a long job with no
cancel. Each gap is individually small and collectively makes the product feel broken or
frozen.

**How to apply:** before shipping or modifying ANY AI-invoking surface (chat, generator, draft
endpoint, long-running batch/job), audit it against the three points and harmonize onto shared
status primitives ([[ai-status-motion-one-system]]) rather than bespoke text. When building a
new one, wire cancellation (an AbortController / job-cancel path) from day one — retrofitting
it later is much harder. See [[every-mutating-button-gives-feedback]].
