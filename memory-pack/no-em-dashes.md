---
name: no-em-dashes
description: "Never use em dashes in anything anyone will read: UI copy, marketing, headings, code comments, commit messages, customer-facing notes, AND chat replies. Use commas, colons, periods, or 'and'."
metadata:
  type: feedback
---

Never use em dashes (—) in ANY text a person will read: marketing pages, UI strings, headings,
button labels, meta descriptions, prose, code comments, commit messages, customer-facing notes,
AND chat replies. Use commas, colons, periods, or "and"/"but" instead.

**Why:** em dashes read as AI-generated; keeping them out makes copy feel human. This is a
common repeat lapse — the dash gets written by reflex and never checked — so treat it as
mechanical, not merely intentional.

**How to apply:** before committing OR sending any message, scan for "—" and rephrase every
hit. Prefer a comma or period for an aside, a colon for an intro, "and"/"but" for a join. For
commits that touch copy or comments, `grep -n "—" <touched files>` and fix each. Watch the
sharpest edges: any note that notifies someone the instant it lands (a bug/reporter note, a
release note) gets no second chance, so draft it em-dash-free the first time. Hyphens in
compound words (AI-powered, copy-paste) are fine; this is only the em dash. A "—" used as an
empty-value placeholder glyph in a data table is a typographic convention, not prose; leave
those. See [[communicate-direct-and-plain]].
