# Team memory

What this project's team has learned, in Claude Code's memory format, shared
through git. Every teammate's session loads it at start
(`scripts/hooks/team-memory.mjs`), so their agents recall it exactly as they
recall their own memories.

- **One memory per file:** frontmatter (`name`, `description`, `metadata.type`),
  then the fact, then **Why:** and **How to apply:**.
- **`MEMORY.md` is the index:** one line per memory, `- [Title](file.md) — hook`.
  The hook copies these lines into each person's own index, above their personal
  entries.
- **Edit here, not in your memory folder.** The files there are links back to
  these, so an edit lands here either way, but a NEW memory written by an agent
  lands in your personal folder. Promote it with `/share-memory`.
- **Commit changes like code,** with explicit paths. A teammate gets them on
  their next pull and next session.
- **What never goes here:** credentials, customer data, anything about a person
  that they would not put in a shared doc. `/share-memory` scrubs for these.

Seeded from the agent team kit's portable memory pack. Delete what does not fit
this project; edit the rest to its stack.
