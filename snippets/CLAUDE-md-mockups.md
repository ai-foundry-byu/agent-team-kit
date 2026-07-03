<!--
Paste this into your project's CLAUDE.md (the installer appends it). It steers
agents to produce high-fidelity, reviewable mockups in a gitignored .mockups/
folder and hand you a clickable link, for a fast design-iteration loop.
-->

## Mockups and design iteration

When I ask for a design, a mockup, a layout, or "show me what X could look like," build a **high-fidelity, standalone mockup** I can actually judge: a single self-contained HTML file, real styling and representative content, no build step. Favor producing something I can look at over describing it; the point is a fast see-it-then-iterate loop.

- **Where:** put mockups in `.mockups/` at the repo root. That folder is gitignored, so mockups never get committed and never muddy code search, grep, or the diff.
- **Hand me the link:** finish by printing the clickable absolute path, e.g. `file:///Users/me/project/.mockups/grade-rail.html`, so I can open it in one click and review.
- **Iterate in place:** when I ask for changes, edit the same file (or a clearly named variant) and re-send the link. Keep all of it out of git.
- **Disposable by design:** mockups are throwaway. Once the design is built into the app, the mockup's job is done. Nothing here gets promoted into version control.
- **Both form factors by default:** unless the app is clearly desktop-only or mobile-only, produce **both a desktop and a mobile** mockup, since the two often diverge in meaningful ways. If it is ambiguous whether mobile is in scope, ask; or I will tell you up front ("desktop only" / "both" / "mobile").
- **Fidelity over sketch:** real fonts, spacing, states, and realistic data, close enough that I can evaluate the actual design, not a wireframe.
