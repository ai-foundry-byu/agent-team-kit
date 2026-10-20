---
name: verify-with-the-real-build
description: "The fast typecheck can pass while the real build/deploy fails. Before pushing anything that adds or moves imports, run the real production build, not just the quick check."
metadata:
  type: feedback
---

A fast type/lint check validates types and templates but often does NOT enforce everything
the real build does: most notably server/client import boundaries and tree-shaking. A
server-only import leaking into a client bundle can pass the quick check and `git push`
cleanly, then fail the production build/deploy (which is frequently auto-triggered on push).

**Why:** the green-check-but-red-deploy gap is invisible until the deploy fails, and by then
the broken commit is already on the shared branch (and may have burned a paid build).

**How to apply:**
- Before pushing anything that adds or moves imports in client-reachable code, run the real
  **build** and confirm it completes, not just the quick check.
- In client code, never import a **runtime value** from a barrel/index that re-exports
  server-only modules; import the function from its specific leaf module, and import types
  with a type-only import (erased, so they never drag the server graph into the bundle).
- The build may need a specific runtime/toolchain version; a local build failure about an
  unsupported version is a local toolchain issue, not a code bug. See
  [[verify-proportional-to-risk]], [[keep-a-small-green-critical-suite]].
