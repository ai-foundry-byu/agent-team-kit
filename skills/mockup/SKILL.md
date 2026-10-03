---
name: mockup
description: Build a high-fidelity, throwaway HTML mockup the user can judge in a browser, by editing a frozen snapshot of the real surface when one exists, or writing a standalone page when it does not. Use when the user says "mock this up", "/mockup", "show me what X could look like", "try a layout for", "A/B these two options", or before a /spec on a visual change.
---

# mockup, iterate on the real surface, not a redrawing of it

**The two things that matter are speed and fidelity.** A mockup should be in
front of the user fast, and close enough to the real surface that they can judge
it rather than imagine it.

The usual loop rebuilds the whole surface by hand for every idea. The chrome
around the change is rewritten each time, is subtly wrong each time, and costs
hundreds of lines of hand-written HTML before the actual idea appears on screen.
The better loop starts from a **shell**: a frozen snapshot of the real rendered
page (its actual DOM, stylesheet, fonts and copy) in one self-contained,
editable file. A mockup is then a copy of a shell with one region changed. The
chrome is right because it is not a drawing of the app; it is the app.

Shells need a small freezer tool. `docs/MOCKUP-SHELLS-SPEC.md` (from the agent
team kit) specifies it for any stack. This skill works with or without it:

- **Shell path:** the project has the freezer (look for `mock:shell` /
  `mock:check` scripts, or `.mockups/_shells/`). Use it for any change to an
  existing surface.
- **Fresh path:** no freezer, a brand-new surface, a diagram, or a change so
  structural that little of the frozen layout would survive. Write a standalone
  page (see "Fresh path" below).

## Rules for both paths

- **Where:** `.mockups/` at the repo root, gitignored. Nothing there is ever
  committed. Name the file for the idea, not the surface:
  `.mockups/grade-rail-inline-bands.html`.
- **Use the app's own vocabulary.** Its class names, its design tokens, its icon
  set, its copy voice. Semantic tokens over raw colour scales. Real icons from
  the app's icon library, never emoji, never an invented SVG path.
- **Realistic data.** Real-looking names, lengths, counts and states. Fake data
  is fine as long as it is high fidelity; lorem ipsum is not.
- **Form factor:** follow the project's CLAUDE.md. If it says nothing and the
  surface is not clearly desktop-only, ask whether mobile is in scope.
- **Look at it before you hand it over.** Render it headless and read the
  screenshot (the shell path's `mock:check --shot`, or any headless browser).
  The worst failures are invisible in the diff and obvious in the render.
- **Hand back the clickable absolute path**, e.g.
  `file:///Users/me/project/.mockups/my-idea.html`, so the user opens it in one
  click. (Browser-automation extensions often cannot open `file://`; screenshot
  it headless yourself.)
- **Iterate in place.** Edit the same file and re-send the same link. Do not
  spawn a new file per round.
- **Throwaway.** Once the design is built, the mockup's job is done. Never
  promote one to a tracked folder.

## Shell path

**1. Pick the surface.** The project's shell list names them (`grade`, `home`,
`settings`...). If the request does not obviously name one, ask rather than
guess. A surface with no shell goes to the fresh path; adding a shell is worth
it only for a surface you will mock repeatedly.

**2. Check freshness.** Run the freezer's staleness check. If the target is
`stale` or missing, re-take it before building on it. A stale shell is worse
than no shell: it produces a confident mockup of a layout that no longer exists.
Freeze from YOUR local dev server (on your assigned port) by default, not
production: a mockup is nearly always of a surface you are mid-change on, and
production is only the last release.

**3. Derive, never edit in place.** The shell is the reusable original. Copy it
(or `mock:edit ... -o`) to the new name first.

**4. Find the region without reading the shell.** A shell's head is megabytes of
inlined stylesheet and images. Read the shell's map file (`<shell>.map.json`)
for its `data-mock` anchors and line ranges, or `grep -n` for a distinctive
string from the UI, then read just that line range. Never read the whole file,
and never read the `<style>` block.

**5. Make the change with exact-match edits.** Grep, read the range, Edit. The
freezer breaks the body into short lines precisely so Edit's unique-exact-match
rule works, and that rule is a real safety property here. Two things NOT to do,
both of which produce breakage that is invisible in the diff:

- **Never delete or splice by line range.** A shell packs the closing tags of
  several ancestors onto the end of the last child's line. Deleting "rows 5
  through 9" can take `</tbody></table></div></section>` with them, and the
  table vanishes while the page still renders.
- **Never loop a replace-first-occurrence.** If the original string is still a
  prefix of the replacement, each pass re-matches the one you already changed
  (three badges stacked on one tile).

**When a DOM recipe beats Edit** (`mock:edit --do <recipe.js>`): many
near-identical repeated elements (keep the first row of six), and state rewinds
(turn a fully-populated capture into its empty state across a dozen scattered
edits). Save a reusable state recipe in the project's tracked recipes folder so
the next person does not redo it.

**Inserted content and baked positions.** Anything the live app positioned at
runtime is frozen as absolute pixels. Mark an inserted block that ADDS HEIGHT
with `data-mock-insert` so the shell's shim pushes the overlays below it down.
Do NOT mark an absolutely positioned badge, or a control dropped into an existing
fixed-height row: those take no extra height, and marking them shoves everything
below out of place.

**6. Check it.** Not optional: `mock:check <file> --shot <png> --full` checks tag
balance, detects markup the browser had to repair, confirms the shell's regions
survived, and screenshots it. Read the screenshot.

**7. Hand back the link, then iterate** (rules above).

### States: rewind with a recipe, do not hunt for data

A shell is captured from whatever the account happened to have, usually a full,
happy state. Most of what users report goes wrong in the **empty and early
states**, which no snapshot holds. Do not go hunting for a real empty record:
rewind the captured one with a recipe and layer your idea on top.

## Fresh path

A single self-contained HTML file, no build step:

- Pull the app's real stylesheet or tokens in where you can (link the built CSS,
  or copy the token block), so the type, spacing and colour are the app's.
- Draw only the surrounding chrome the judgment needs. A settings panel needs
  its page header, not the whole nav.
- Real fonts, real spacing, real states.
- If the user is comparing a before and an after, draw them side by side in one
  file. That is something a shell cannot do.

## Showing alternatives

When the ask is "which of these reads better", produce one file per option
(`-a`, `-b`), each derived from the same shell or the same base page, and send
both links. Starting from the same base is what keeps the comparison honest.

**States are not alternatives.** A picker open, a field mid-edit, an error: those
are moments in one design, not competing designs. Build the state the user asked
about, usually the resting one, and stop.

## Cost, honestly

A content change to a captured surface is fast. A state change plus a design
change is not: expect a few recipe iterations and a screenshot read each round.
It is still worth it, because the alternative is a hand-drawn approximation
whose wrongness nobody can see. Do not promise a mockup in a minute and then
spend twenty.
