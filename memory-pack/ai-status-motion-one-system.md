---
name: ai-status-motion-one-system
description: "Standardize every 'something is working' animation onto a small set of shared primitives with one rule: color encodes the KIND of work. Don't hand-roll spinners; respect prefers-reduced-motion."
metadata:
  type: feedback
---

Standardize every "something is working" indicator across the app onto ONE rule and a small
set of shared primitives, so motion never has to be guessed and every surface feels like one
system. **The rule: color tells what kind of work it is.**

A workable primitive set (adapt names/looks to your brand):
- **Thinking indicator** — a *model* is running. A distinctive mark + a steady (not flashing)
  label + elapsed seconds. Reserve this look for AI work specifically.
- **Spinner** — the *system* is busy (save / upload / fetch / render / delete). A plain
  neutral spin; inherit color on colored buttons.
- **Status dot** — a *background job* is alive (a pulsing dot); a static variant = failed.

**Why:** hand-rolled `animate-spin`/`animate-pulse` markup scattered across surfaces drifts
into a dozen slightly different looks, and users can't learn what any one of them means. A
shared vocabulary makes state legible at a glance.

**How to apply:** put the primitives in one place, document the color rule, and reach for them
instead of inline animation. All motion must respect `prefers-reduced-motion`. Prototype
competing looks as throwaway HTML ([[throwaway-mockups-gitignored]]) before committing to one.
See [[ai-surface-full-lifecycle]], [[every-mutating-button-gives-feedback]].
