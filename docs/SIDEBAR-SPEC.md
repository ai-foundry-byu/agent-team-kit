# The collapsible sidebar, a build spec

A stack-agnostic specification for a **collapsible left navigation rail** in the Claude-web model: an expanded panel that collapses to an icon-only rail (and optionally a thin closed strip), where **every icon holds its exact vertical position across the collapse**. That pinning is the signature of the pattern and the thing most implementations get subtly wrong.

Like the [feedback-loop spec](./FEEDBACK-LOOP-SPEC.md), this is a spec, not code, so a coding agent can build it in any stack (SvelteKit, Next/React, Remix, anything). It is grounded in a real, shipped implementation. It also specifies the **version chip + release-notes** plumbing in the header, which couples directly to the bundled [`push`](../skills/push/SKILL.md) skill (covered in section 8).

---

## Why this pattern

A left rail is the spine of an app's navigation, and the collapse is what makes it respectful of screen space. Done well, collapsing feels like the panel simply *narrows*: the icons you navigate by stay exactly where your muscle memory expects them, and only the words fall away. Done badly, the icons jump, re-center, or reflow, and every collapse is a tiny re-orientation tax. The whole spec is organized around making the good version the easy version.

It also carries one piece of product surface that punches above its weight: a **version chip** next to the wordmark that opens release notes. It's a small thing that makes shipping visible to users and gives a natural home for the changelog your release process already produces.

---

## The model: width is the source of truth

The cleanest mental model is **not** a boolean "open/closed." It is a single **width** value that drives everything, with derived zones at breakpoints:

| Zone | Width | What shows |
|---|---|---|
| **Panel** (expanded) | ~240px (default), up to ~360px | wordmark + version chip, icons **and** labels, section headers, trailing affordances |
| **Rail** (collapsed) | ~40px | icons only, section headers become hairline dividers, footer avatar only |
| **Strip** (closed) | ~6px | just a draggable seam; everything hidden |

Reference breakpoints from the real implementation: show the wordmark at width ≥ 240; drop to the icon rail below ~132; snap to the closed strip below ~28. The **toggle** button flips between panel and rail; the edge is also **drag-resizable** to any width (optional polish, but it's where the "width is truth" model pays off).

You can ship a simpler **binary** version first (a boolean `collapsed`, panel vs rail) and add drag later. The layout rules below are identical either way; only the state source differs.

---

## The two states, drawn

**Expanded panel:**

```
+--------------------------------------+
|  Wordmark        v0.2.28        [▣]   |   header: wordmark + version pill + toggle
+--------------------------------------+
|  (◇) Home                            |   primary item (active = tinted bg)
|                                      |
|  CLASS                               |   section header (uppercase, muted)
|  (◇) LAW 550                  (⇅)    |   item + trailing switcher caret
|                                      |
|  ● ASSIGNMENT                        |   stepper: status node + header
|  │ (◇) Legal Memo             (⇅)    |
|  ● RUBRIC                            |
|  │ (◇) Open Memo Assignment   (⇅)    |
|  ● SUBMISSIONS                       |
|  │ (◇) 15 Law Clerk...  1 of 2 (⇅)   |   count badge + caret
|  ○ REPORT                            |
|    (◇) 15 Law Clerk Open Memo        |
|                                      |
|  TOOLS                         (⌄)   |   collapsible section
|  (◇) Admin                           |
|  (◇) Connect LMS                     |
+--------------------------------------+
|  (avatar) Scott Murff         (⇅)    |   footer: account popover
+--------------------------------------+
```

**Collapsed rail**, note every `(◇)` sits at the **same vertical position** as above:

```
+------+
| [▣]  |   toggle fills the header
+------+
| (◇)  |   Home   (active = tinted bg)
| ──── |   divider  (was "CLASS")
| (◇)  |   class
| ──── |   divider  (was "ASSIGNMENT")
| (◇)  |   assignment
| (◇)  |   rubric
| (◇)  |   submissions
| (◇)  |   report
| ──── |   divider  (was "TOOLS")
| (◇)  |   admin
| (◇)  |   connect lms
+------+
| (av) |   avatar only
+------+
```

---

## The pinning invariant (the crux)

Every nav row keeps its icon at the exact same vertical pixel position whether expanded, collapsed, or mid-drag. This is achieved with **plain layout, no absolute-positioning tricks**, via three rules:

1. **A frozen icon column.** Every row begins with a fixed-width, non-shrinking icon box at x=0:
   - width = the rail width (e.g. **40px**), `flex: none` (never grows or shrinks), icon centered both axes (e.g. a 16px glyph in the 40px box).
   - The nav body has **no left padding**, the icon column *is* the left edge. So when collapsed, that column fills the rail exactly; when expanded, it's the anchor and the label sits to its right.

2. **Fixed row heights.** Every row is a fixed height so nothing reflows when text disappears:
   - item rows: **32px**; section-header rows: **28px** (with a small top margin for grouping); footer row: **32px**.

3. **Collapse hides text, not structure.** On collapse, only the label and trailing affordances (caret, count, badge) are conditionally removed. The row, its height, and the icon box are untouched. Critically, **section headers collapse to a hairline divider that occupies the same 28px box**:

   ```
   Expanded:   [  CLASS                    ]   28px box, label at left padding
   Collapsed:  [  ────────────────────     ]   28px box, a 1px rule with side margins
   ```

   Because the header's box height is preserved, the icon row *below* it never shifts. This is the single most important detail: a header that would otherwise collapse to zero height is the classic cause of icons "jumping" on collapse.

**The mantra:** the sidebar shrinks *to the right*. The icon column never moves; labels and affordances simply stop rendering. If you ever reach for absolute positioning or per-state re-centering to make the icons line up, step back, the fixed-column + fixed-row-height approach makes it fall out for free.

---

## Anatomy

### Header

- **Wordmark** (full brand text) when the panel is wide enough (≥ ~240px); a compact **lettermark** when narrower; nothing in the rail except the toggle.
- **Version chip**, a small rounded pill immediately right of the wordmark showing `v{version}`, linking to the release-notes surface (section 8). Hidden when the wordmark is hidden.
- **Collapse toggle**, a split-pane glyph. Right-aligned in the panel header; fills the header in the rail. Bound to a keyboard shortcut (e.g. `Cmd/Ctrl + \`).

### Body (scrollable)

The body scrolls independently between the fixed header and footer (hide the scrollbar chrome for a clean look). It is a sequence of **sections**, each a header row plus item rows.

- **Item row:** icon (in the frozen column) + label + optional trailing affordance, with an active state (tinted background + medium-weight tinted text + `aria-current="page"`).
- **Trailing affordances:**
  - **Switcher caret** (an up/down chevron) on items that represent a *selection* (the active class, assignment, rubric). Clicking opens a popover to switch or create. Shown only when expanded.
  - **Count badge** (e.g. "1 of 2") on items with a position within a set. Shown only when expanded.
  - **Section collapse chevron** on optional groups (e.g. a "TOOLS" group that the user can fold).

### The optional stepper

One section can be a **progress stepper** (in the source app: Assignment → Rubric → Submissions → Report). Each step header carries a status node on a vertical spine:

- **Done**, filled accent circle with a white check.
- **Current**, filled accent circle with the step number, ringed.
- **To-do**, hollow circle with a muted number.
- **Connectors**, a short vertical hairline between consecutive nodes (not after the last).

The current step is computed from gates (e.g. `current = !defined ? 'assignment' : !rubricDecided ? 'rubric' : !allConfirmed ? 'submissions' : 'report'`), and each step's state is `done / current / todo` by comparing to the current step. When collapsed, the stepper drops its indent and spine so the icons return to the rail column, and the step headers collapse to the same hairline dividers as any other header.

### Footer

An account row pinned at the bottom (outside the scroll area): the avatar in the frozen icon column, then the user's name and a chevron when expanded. It's the trigger for an account popover (account, feedback, sign out, etc.). On collapse, only the avatar remains, same fixed 32px row, so it stays put.

---

## The data / section model

The source app hardcodes the section structure in markup and streams *data* (classes, assignments, submissions) in via props. For a clean rebuild, model it as data:

```ts
type NavItem = {
  icon: IconRef;              // an icon component / name
  label: string;
  href: string;
  active?: boolean;           // usually derived from the current route
  trailing?:                  // optional right-edge affordance
    | { kind: 'switcher'; onOpen: () => void }
    | { kind: 'count'; text: string }       // e.g. "1 of 2"
    | { kind: 'badge'; text: string };
};

type NavSection = {
  header?: string;            // uppercase label; becomes a hairline divider when collapsed
  collapsible?: boolean;      // a foldable group (e.g. "TOOLS")
  items: NavItem[];
  stepper?: boolean;          // render items as a progress stepper with status nodes
};

type SidebarModel = {
  brand: { wordmark: IconRef; lettermark: IconRef; homeHref: string };
  sections: NavSection[];
  footer: { avatar: string | null; name: string; menu: NavItem[] };
};
```

Active state is best **derived from the current route** rather than stored, so navigation keeps it correct automatically.

---

## Behaviors

- **Persistence.** Persist the width (or the boolean) in `localStorage`. For SSR frameworks, also mirror it into a **cookie** so the server renders the correct width on first paint and avoids a flash. Hydrate from storage on mount.
- **Transition.** Animate `width` / `transform` at ~150ms ease-out. **Suppress** the transition during drag and during route-driven snaps (so a forced collapse is instant, not a laggy slide), then re-enable it for manual toggles.
- **Drag-to-resize** (optional). A thin `role="separator"` handle on the right edge: pointer-down starts a drag, pointer-move updates a transient width (no persist), pointer-up commits and persists. Snap to the closed strip below the strip breakpoint.
- **Route-scoped auto-collapse.** Focus surfaces (a full-screen editor, a grading view) can collapse the sidebar **transiently, never persisted**, and restore the user's saved width on exit. This keeps the nav from getting "stuck" closed after an unexpected navigation.
- **Collapsed tooltips.** In the rail, hovering a row shows its label as a tooltip. **Render the tooltip outside the sidebar** (a fixed-position node) so it escapes the sidebar's stacking context, positioned just right of the rail and vertically centered on the hovered row.
- **Keyboard + a11y.** Toggle shortcut (`Cmd/Ctrl + \`); `aria-current="page"` on the active item; `aria-label`s on icon-only controls; the resize handle is a labelled separator; focus-visible rings on rows.

---

## Responsive / mobile

Below the `md` breakpoint (~768px), switch from *narrowing* to an **off-canvas drawer**:

- The sidebar is a fixed-width panel (~240px) that slides in/out via `translate-x` (`-translate-x-full` when closed), rather than resizing.
- A separate **hamburger button** (top-left, above content) opens it; a dark **backdrop** overlay closes it on tap. (The collapse toggle is a desktop control; the hamburger is the mobile one.)
- The main content gets a left margin equal to the sidebar width on desktop, and **no** margin on mobile (the drawer floats over content). Add top padding on mobile to clear the hamburger.

---

## The version chip + release notes (and the `push` skill)

This is the header's product surface, and it's the consumer side of your release process. Three small pieces of plumbing make it work, and the bundled `push` skill is what keeps them current.

### 1. A single version source

Keep one canonical version. In the source app it's derived from the release data and mirrored into `package.json`:

```ts
export const CURRENT_VERSION = releases[0]?.version ?? '0.0.0';
```

The chip reads it; the release process bumps it (and `package.json`) together so they never drift.

### 2. The release-notes data model

Release notes are typed data, not prose buried in commits:

```ts
type ReleaseSection = {
  heading: string;            // e.g. "Grading with AI", "Fixes and polish"
  items: string[];            // plain, customer-facing bullet strings
};

type Release = {
  version: string;            // semver, e.g. "0.2.28"
  date: string;               // "YYYY-MM-DD"
  summary: string;            // one or two customer-facing sentences
  sections: ReleaseSection[]; // ordered top to bottom
};

export const releases: Release[] = [ /* newest first */ ];
```

### 3. The release-notes surface

A `/releases` page (or a "What's new" modal) that renders `releases` newest-first: each entry shows its version, formatted date, summary, and sections. The version chip links to it with a `return` param so the user can get back:

```
href = "/releases?return=" + encodeURIComponent(currentPath)
```

### How `push` drives it

The bundled [`push`](../skills/push/SKILL.md) skill is the producer for this consumer. On a release it:

1. reads the commits since the last release,
2. writes a new `Release` (version, today's date, a customer-facing summary, themed sections) and **prepends** it to the `releases` array,
3. bumps the version in `releases.ts` and `package.json` together,
4. commits as a release and pushes.

So the sidebar spec and the skill interlock: **build the three pieces above** (version source, `releases` data, `/releases` surface), and `push` keeps them current every time you ship. The skill as bundled references these by the source app's names (`src/lib/content/releases.ts`, `CURRENT_VERSION`, `/releases`), adapt those paths to where you put them. (See `docs/SKILLS.md` for why `push` is shaped the way it is.)

---

## Building it in your stack

### Framework-specific vs generic

| Piece | Source-app form | Generic equivalent |
|---|---|---|
| Reactivity | Svelte 5 runes + a class store | Any state container (React context/store, signals) |
| Styling | Tailwind utility classes | Any CSS; the *values* (40px column, 32/28px rows) are the spec |
| Active route | SvelteKit `page` route id | Your router's current-path |
| SSR no-flash | cookie read in the layout load | Any SSR cookie/Server Component read |
| Icons | Lucide components | Any icon set |
| Persistence | `localStorage` + cookie mirror | Same |

The behavior and the **measurements** (frozen 40px icon column at x=0, fixed 32px/28px rows, headers-become-dividers, 150ms ease-out, the width breakpoints) are the spec; the framework is pluggable.

### Build checklist

1. **State**, a `width` (or boolean `collapsed`) as the source of truth; derive panel/rail/strip; persist to `localStorage` + a cookie for SSR.
2. **Shell**, fixed-position `aside` with a fixed header, a scrollable body (scrollbar hidden), and a fixed footer.
3. **The frozen column**, a 40px, `flex:none`, centered icon box starting every row at x=0; nav body with no left padding.
4. **Fixed rows**, 32px items, 28px headers; on collapse hide labels + trailing affordances; render section headers as a hairline divider that keeps the 28px box.
5. **Items + affordances**, active state from the route; switcher carets, count badges, and (optionally) the progress stepper with done/current/todo nodes and connectors.
6. **Toggle + drag**, the split-pane toggle (with a keyboard shortcut) flipping panel↔rail; optionally a draggable edge handle writing the transient width.
7. **Transitions**, ~150ms ease-out on width/transform, suppressed during drag and route-snaps.
8. **Collapsed tooltips**, rendered outside the sidebar, fixed, centered on the hovered row.
9. **Footer**, the account row collapsing to just the avatar (same fixed row height).
10. **Responsive**, off-canvas drawer + hamburger + backdrop below `md`; content margin = sidebar width on desktop only.
11. **Version chip + release notes**, the three pieces above, wired to the bundled `push` skill.
