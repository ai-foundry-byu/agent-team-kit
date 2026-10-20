---
name: throwaway-mockups-gitignored
description: "Design mockups are high-fidelity, self-contained HTML in a gitignored dir, pure throwaway (never promoted into the repo), reported as a clickable file:// path so the owner can open them instantly."
metadata:
  type: feedback
---

When exploring a design, produce something the owner can actually open and judge, not a
description. Make it **high-fidelity, self-contained HTML** (real fonts, spacing, states,
realistic data, no build step) in a **gitignored** directory (e.g. `/.mockups/` at the repo
root). The point is a fast see-it-then-iterate loop.

**Why:** mockups are one-session exploration with no lasting value. Keeping them gitignored
keeps them out of git, code search, grep, and the diff: no noise, no "keepers" folder to
maintain. Once a design is built into the app, the mockup's job is done.

**How to apply:**
- One self-contained HTML file per exploration in the gitignored mockups dir. No promotion to
  a tracked location; they are pure throwaway.
- Always report a **control-clickable absolute path** the owner can open from the terminal,
  e.g. `file:///Users/you/project/.mockups/<name>.html` (never a bare relative path). If a
  local server is running, also offer the `http://localhost:<port>/...` form (fonts/hover
  render better there).
- Match the platform actually being designed for (don't spend tokens on a mobile mock for a
  desktop-only app unless asked). This mirrors the kit's `snippets/CLAUDE-md-mockups.md`. See
  [[format-only-touched-files]], [[subtraction-audit-on-redesign]].
