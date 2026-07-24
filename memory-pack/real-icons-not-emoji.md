---
name: real-icons-not-emoji
description: "In UI, use the project's real icon set for all iconography; never emoji or unicode glyphs as icons or buttons. Text-only chips are fine as text."
metadata:
  type: feedback
---

For UI iconography, use the project's real icon library (e.g. Lucide, Heroicons, Phosphor, or
whatever the codebase standardizes on). Never use emoji or unicode glyphs (✦ ＋ ⚖ ▸ ✕ 🗑 👁 ✨
✓ etc.) as icons or button graphics.

**Why:** emoji/unicode glyphs render inconsistently across platforms and fonts, don't inherit
`currentColor` or sizing cleanly, and look off next to the real icon set. A codebase that
mixes them reads as unfinished. Placeholder emoji tend to sneak in during fast prototyping and
should be swapped before shipping.

**How to apply:** when a control needs an icon, import the matching component from the project's
icon set and size/color it consistently with the rest of the app (inherit `currentColor`, a
standard size class, `aria-hidden="true"` when decorative). Text-only chips or labels (e.g.
"Auto" / "AI" / "You") are fine as plain text. Match whatever idiom the existing chrome uses.
See [[design-first-then-verify]].
