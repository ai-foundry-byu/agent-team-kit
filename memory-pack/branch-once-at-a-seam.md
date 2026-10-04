---
name: branch-once-at-a-seam
description: "Put a flag's check in one place, as a plain if/else on the flag, with the off path returning null or empty for additive features; never pass the flag value around, and keep data readable by both paths."
metadata:
  type: feedback
---

Flagged code is written once and removed once. The way it is written decides whether
removal is a mechanical substitution or an archaeology dig.

**Why:** a flag scattered through a function, or copied into derived booleans
(`const showX = flag && hasY`), cannot be tested in both states cleanly and is easy to remove
incompletely. And a flag cannot undo a write: if the on path stores something the off path
cannot read, turning the flag off breaks the very users it was meant to protect.

**How to apply:**
- **Branch once, at a seam:** a load, an action, a component boundary. Everything below it
  is ordinary code. No seam yet? Creating one is the first build step.
- **Additive features return null or empty when off**, so the off path needs no change and
  "off is byte-identical to before" is cheap to keep and to test.
- **Keep each check a plain `if (flag) ... else ...` on the flag itself.** Do not thread its
  value through other variables or parameters.
- **Data must be readable by both paths**, the same rule expand-contract puts on migrations.
- **Gate on the server**, not only in the UI; a hidden button over a live endpoint is not a
  flag. See [[decide-the-release-at-spec-time]], [[removing-a-flag-check-silent-callers]].
