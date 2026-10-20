# Mockup shells, a build spec

A stack-agnostic specification for the small tool behind the [`mockup`](../skills/mockup/SKILL.md) skill: it **freezes a real rendered page into one self-contained, editable HTML file** (a *shell*), so a design mockup becomes a small edit to the real surface instead of a hand-drawn imitation of it. The same freezer, run over every surface, builds a **clickable prototype**: every screen frozen, the app's own links rewired between them, and a numbered storyboard to walk and mark up by screen number. It replaces Figma for design rounds on an app that already exists.

This is a spec, not code. It is grounded in a shipped implementation (about 2,400 lines of TypeScript over Playwright, for a SvelteKit + Tailwind app). Any headless browser works; the reference uses Playwright. It is most effective when an app's styling is concentrated in one or a few stylesheets (Tailwind, CSS modules compiled to one bundle), and still works otherwise.

---

## Why

Mocking a change to an existing screen used to mean rebuilding the whole screen in throwaway HTML, once per idea: 600 to 1,000 lines before the actual idea appeared, and the chrome wrong in small ways every time. One project ended up with over two hundred mockup files that were mostly this. A shell is that chrome captured from the app itself, so a mockup is a diff against the real thing.

A screenshot would not do: you cannot edit a picture. The source code would not do either: that is just the app again, with its build step. The useful thing is the **rendered output** in a form you can edit without building anything.

---

## The pieces

| Command | Job |
|---|---|
| `mock:shell <surface...>` | Sign in, open a real instance of each surface, freeze it to `.mockups/_shells/<surface>.html` plus a map file. |
| `mock:shell --check` | Report which shells are `fresh`, `stale` or missing. |
| `mock:edit <file> --do <recipe> -o <out>` | Load a file in a headless browser, run a recipe against the DOM, serialize it back. |
| `mock:check <file> [--shot png]` | Structural checks plus a screenshot. Non-zero exit on a hard failure. |
| `mock:flow` | Freeze every surface into `.mockups/flow/NN-<surface>.html`, rewire the app's links between the frozen screens, and write a numbered storyboard `index.html`. |
| `mock:serve` | Serve `.mockups/` over http on 127.0.0.1, so links between screens work in any viewer. |

Plus a registry of surfaces, a recipe helper library, and a recipes folder. Everything under `.mockups/` is gitignored; the tool and the recipes are tracked.

---

## 1. The surface registry

One entry per surface worth shelling:

```
{ id: "grade",
  title: "Grading a paper",
  route: resolve a real instance (find a real record id in the current database),
  sources: ["src/routes/grade/**", "src/components/rail/**"],   // for staleness
  prepare?: script to run before freezing (open a tab, expand a panel),
  persona?: sign in as someone other than the default account,
  viewport?: "desktop" | "mobile" }
```

- **Routes are resolved, not hardcoded.** Reuse whatever already knows how to find a real record (a walk harness's screen catalog, a fixtures module). Two copies of that logic drift immediately.
- **Persona overrides matter.** A surface that renders only for a particular role, frozen as the wrong account, captures a page with the surface missing and reports success. Fail when an expected region is absent.

## 2. Capture

- **Freeze the local dev server by default**, falling back to production only when none is up, and say which one it got. A mockup is nearly always of a surface you are mid-change on; production is only the last release. Find *this session's* dev server (its assigned port), never silently borrow a sibling agent's, which may be serving a different working tree.
- **Read-only at the network layer.** Right after sign-in, abort every non-GET request from the page, so a stray click while preparing cannot write to real data.
- **Cache the sign-in** (a saved browser storage state in a gitignored folder; it is a real credential). Verify it before use, so an expired session falls back to a real sign-in rather than freezing a picture of the login page.
- **Fixed viewport per form factor.** Desktop width (for example 1440) by default, and a phone width (for example 390, with a mobile user agent and touch enabled) for a surface or a run marked mobile, since a responsive app renders different markup there. Photograph **tall** (for example 2400), so content the app positions far down the page is in frame. Name mobile captures distinctly (`<surface>.mobile.html`) so the two never overwrite each other.

## 3. Freeze

From the live page, produce one document:

1. **Inline every stylesheet** the page used. A missing stylesheet is a broken mockup, so fail loudly rather than dropping it.
2. **Inline what the CSS references:** fonts above all, then images. Fetch them **from Node, not from inside the page**: the app's Content Security Policy governs in-page fetches and usually does not list every font or avatar CDN, so an in-page fetch silently returns nothing. A shell in a fallback system font reads as a different design. Ask as a browser (send a browser user agent), because font services serve different files to different clients.
3. **Drop every script, `noscript` and `template`.** The shell is static.
4. **Resolve viewport-height units against the capture height.** Apps lock full-bleed surfaces to `100vh`/`100dvh`, which in a frozen file re-collapses to the *viewer's* window and pushes anchored content out of frame again. Rewrite height units to the captured pixel height. Leave width units alone, so horizontal responsiveness survives.
5. **Move big base64 blobs out of the body.** A page image inlined as a data URI is hundreds of KB on one line, and nothing can read around it. Move the bytes into the stylesheet as a `background-image` keyed to the element, and give the `<img>` a transparent pixel. It renders identically and the body stays legible.

## 4. Make it addressable (the part that makes this worth doing)

A frozen page is thousands of lines of class soup. If reading a region costs more than redrawing it, the whole tool is pointless. So:

- **Break lines at block boundaries only.** Break before and after tags where whitespace cannot change rendering (`div`, `section`, `li`, `tr`, `p`, headings...). Never break inside inline formatting contexts (`span`, `a`, `button`, `label`, `svg`): an added newline there is an added space, and a mockup that silently gains a gap between two buttons lies.
- **Put long tags' attributes one per line** past a threshold (around 200 characters). Whitespace between attributes is insignificant to the parser, so this is always safe. Split quote-aware: `class` and `d` values are full of spaces.
- **Emit a landmark map.** Tag every meaningful region with `data-mock="<slug>"` and write `<shell>.map.json`: slug, tag, nesting depth, label, start line, end line. Name a region from what it announces about itself, in order: `aria-label`, then its heading, then a test id, and only then its opening words. The first three survive a re-snapshot.

Target: a median body line of a few dozen characters, so `grep -n` plus reading a forty-line range is the normal way in.

## 5. The insert shim

Anything the live app positioned at runtime (a comment stack beside a document, connector lines, a popover) is frozen as `position:absolute` with a hard `top` in pixels. Insert a block above it and the new content is drawn **underneath** those overlays. Nothing errors, and the diff looks fine.

So every shell carries one small inline script: for each element marked `data-mock-insert`, measure its height and translate every absolutely positioned element below it down by that amount. Make it re-entrant (restore previous transforms before measuring) so a `ResizeObserver` can re-run it without shifts compounding, and move a nested overlay once, with its parent. This is the one script a shell keeps.

## 6. Staleness

Store the commit a shell was frozen at. `--check` diffs each surface's `sources` globs between that commit and HEAD: any change means `stale`. Keep the globs generous. A false "stale" costs one re-snapshot; a false "fresh" costs a mockup that quietly lies. Also record which source the shell came from (`dev` or `prod`), and show it in `--check`, because a production shell can read as fresh while missing work that landed locally hours ago.

## 7. Edit through the DOM: recipes

Text editing is the default (grep, read a range, exact-match Edit), but two jobs need the DOM: many near-identical repeated elements, and state rewinds (turn a full capture into its empty state). `mock:edit` loads the file in a headless browser, injects a helper library, runs the recipe (plain browser JavaScript) in the page, and serializes the document back. Structurally invalid output becomes unreachable.

Helpers, each of which exists because the text-editing version once broke something:

- `region(slug)`: the element with that `data-mock` anchor.
- `keepFirst(selector, n)`, `removeAll(selector)`: deleting repeated rows by line range once ate the closing tags riding on the last row's line.
- `setText(selector, text)`: the same visible "6" appears in four unrelated places, so a global replace hits the wrong ones.
- `insertAfter` / `insertBefore` / `insertInto`: stamp `data-mock-insert` automatically.
- `overlay(target, html)`: for an absolutely positioned badge, which must NOT be marked as an insert (it takes no height, so the shim would shove everything down).
- `icon(name)`: resolve a real glyph from the app's icon set.

Rules: refuse to write into `_shells/` (a missed `-o` once overwrote the snapshot with a variant of itself); default output is in place, `-o` derives a variant; regenerate the map file beside the output. A recipe is executed code: author it, keep it in a tracked recipes folder, never pipe one in from elsewhere. The blast radius is a throwaway headless browser on a `file://` URL with no credentials and no network.

An inline `--do 'return mock.$$(".rail span").slice(0,5).map(e => e.outerHTML.slice(0,120))'` doubles as a way to inspect markup without reading the file.

## 8. Check

`mock:check`, cheapest question first:

1. **Does the raw text balance?** Count open and close tags for the layout-bearing ones (`div`, `section`, `table`, `tbody`, `tr`, `ul`...). Hand edits drop a packed closing tag with no visible sign.
2. **Did the browser have to repair it?** Compare the tag census of the raw text with the census of the parsed DOM. Browsers silently fix broken markup by reparenting, so a page can render "fine" while its table has been hoisted out of its container. The two agree when the markup is sound.
3. **Did the regions survive?** A mockup derived from a shell should still carry that shell's `data-mock` anchors. A missing one means an edit deleted more than it meant to.
4. **Page errors**, and a **screenshot** (`--shot`, `--full` for the whole height) for the agent to read.

Non-zero exit on a hard failure, so it can gate a loop. With no argument, check every mockup in `.mockups/`.

## 9. The prototype (`mock:flow`)

The design-round tool: a clickable, multi-screen prototype of the app, built from the same freezer.

- **Freeze every registered surface** into its own numbered file, `.mockups/flow/NN-<surface>.html`, in registry order. Numbers are how people talk about screens ("screen 4: move the summary above the table"), so keep them stable within a round.
- **Rewire the app's links.** For each internal `href`, find the surface whose route matches the path. A match becomes a link to that screen's file. No match becomes `href="#"` with the original path kept in a data attribute, so a click can say "Not in the prototype yet: /settings/billing" instead of leaving the prototype.
- **Inject a small flow bar** on every screen (marked as not part of the app): a link back to the storyboard, previous and next, and "Screen N of M". Left and right arrow keys step through screens and Escape returns to the storyboard. Intercept form submits and say "Prototype: nothing is saved."
- **Write the storyboard** (`index.html`): one card per screen with a thumbnail, its number, title and surface id, and the screens it links to. Stamp it with when it was frozen and the commit it was frozen from.
- **A mobile run** (`--mobile`) freezes at the phone viewport into `.mockups/flow-mobile/`, with its own storyboard, so a round can review desktop and phone side by side.
- **Re-running rebuilds every screen from the app and discards edits.** Say so in the output. Once screens carry edits, they are edited in place; a re-run starts a fresh round.

## 10. Serving (`mock:serve`)

Serve `.mockups/` over http, bound to 127.0.0.1 only, with `Cache-Control: no-store` so a refresh shows the latest edit, and refuse any path outside `.mockups/`. The reason is practical: editors such as VS Code open a `file://` link as source in a tab, so the links between screens go nowhere. Print the `http://127.0.0.1:<port>/flow/` address the user should open.

---

## Build checklist

1. Surface registry with resolved routes, sources, optional prepare and persona.
2. Capture: own dev server first, read-only network posture, cached and verified sign-in, fixed tall viewport.
3. Freeze: inline styles, fonts and images from Node, strip scripts, pin height units, move blobs to CSS.
4. Line breaking at block boundaries, attribute wrapping, `data-mock` anchors, map file.
5. Insert shim.
6. Staleness check against source globs, source label.
7. `mock:edit` with the helper library and the `_shells/` write guard.
8. `mock:check` with balance, repair detection, region survival, screenshot.
9. One state recipe for your most-mocked surface's empty state, as the worked example.
10. `mock:flow`: numbered screens, rewired links with a "not in the prototype yet" fallback, flow bar, storyboard with thumbnails, optional mobile run.
11. `mock:serve`: 127.0.0.1 only, no-store, confined to `.mockups/`.

## Lessons

- **A stale shell is worse than none.** It produces a confident mockup of a layout that no longer exists. Make `--check` cheap and the skill runs it first.
- **Production is the wrong default.** It is only the last release, and the freshness check could not tell.
- **Capture tall, then pin it.** A short capture put the anchored side content below the fold; a tall capture alone re-collapsed in an ordinary window until height units were pinned.
- **Fonts fail silently.** The CSP blocked in-page font fetches and the shell quietly rendered in a system font. Fetch assets from Node.
- **Serve the prototype; do not hand over `file://`.** In an editor, a `file://` link opens the HTML as source, and the prototype looks broken when it is not.
- **Edits outlive a re-run only if nobody re-runs.** The first round lost its markup to a well-meant `mock:flow` re-run. Print the warning every time.
- **The insert shim is non-negotiable** on any surface with runtime-positioned content. Without it, the first inserted block slid under the overlays and nobody saw it until someone opened the file.
