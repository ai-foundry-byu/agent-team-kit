---
name: arch-guards-as-alarms
description: "In an agent-built codebase, ratchet guards (file-size cap for new files, frozen shrink-only ceilings for giants, import-boundary allowlist) fight sprawl. A red guard is an alarm to check cohesion, not a number to game."
metadata:
  type: feedback
---

Agent-built codebases sprawl: files grow without bound and layering boundaries erode, because
each edit is locally reasonable. A layered set of **ratchet guards** keeps it in check:

- **File-size ratchet** — new files cap at a ceiling (e.g. 800 lines); existing giants are
  FROZEN at their current counts (shrink-only, never grow); generated/data files exempt.
- **Import-boundary ratchet** — a dangerous import (e.g. the RLS-bypassing admin client, or a
  server-only module) has an allowlist of current importers grandfathered in; new importers
  FAIL. A companion check drops entries that stop importing it, so the list can't rot.
- **In-session nudge + commit gate** — a PostToolUse hook previews a guard the moment an
  edit trips a ceiling; a pre-commit hook runs format/lint on staged files; the heavier
  check+test runs at pre-push.

**Framing that matters:** a red guard is an ALARM to go check cohesion, not a number to game.

**Why / the hard-won lesson:** pure line-reduction refactoring (lifting logic into leaf
modules) yields only a few percent off each giant and does NOT lower its real blast radius —
the dense shared state stays put. The durable wins are the GUARDS (they stop *new* sprawl),
dead-code deletion, and tests on critical logic. The only thing that truly de-risks a giant is
stateful decomposition into child components/stores — high-risk, browser-verify-gated, and the
agent-weakest kind of work. Don't auto-run a line-golf campaign; add the guards, delete dead
code, and decompose only a file that's become actively painful, one panel at a time.

Gotcha: a whole-repo format can inflate line counts and trip a frozen ceiling at pre-push
(the system working) — re-baseline deliberately, don't silently grow. The kit ships versions
of these guards in `hooks/`. See [[format-only-touched-files]], [[keep-a-small-green-critical-suite]],
[[verify-with-the-real-build]].
