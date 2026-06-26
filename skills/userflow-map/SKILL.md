---
name: userflow-map
description: Work on the app's user-flow state-machine map in docs/userflow/. Use when the user wants to map a new screen, edit screen metadata (jobs, ways in, actions, ways out), wire transitions, add a screenshot/thumbnail, rebuild the flow graph, OR run the feedback loop — flag an issue / log feedback on a screen, reference an element by address (e.g. create.actions.3), or resolve/implement/close a flagged issue. Triggers on "add a screen to the userflow", "update/continue the user flow map", "map this screen", "flag X on the map", "log an issue", "fix/implement issue i1", "rebuild the flow diagram", or dropping a new screenshot for the flow doc.
---

# userflow-map

Maintains the data-driven UI state-machine documentation at
`docs/userflow/`. The data is the single source of truth; the HTML graph and the
markdown table are generated. **Always edit the JSON and rebuild — never hand-edit
the generated `userflow.html` or the table in `userflow.md`.**

## First step, always

Read `docs/userflow/README.md`. It is the authoritative spec for the JSON schema,
the node/edge `kind`s, the file layout, and the conventions. This skill is just the
procedure; the README is the contract. If the schema and this file ever disagree,
the README wins.

## When to use

- "Map this screen" / "add a screen to the userflow" / "add screen N"
- "Update the flow map" (edit jobs, ways in, actions, ways out, routes)
- "Wire X to Y" (add/adjust transitions)
- "Rebuild the flow graph" / "regenerate the table"
- The user dropped a new screenshot intended for the flow doc.

## Procedure

1. **Read** `docs/userflow/README.md`, then `docs/userflow/userflow.json` to see
   current nodes/edges and match existing style.

2. **Screenshot (if adding a screen).** The user supplies the image — this skill
   does not capture screens. Move/rename it into `docs/userflow/screens/` as
   `NN-slug.png` (zero-padded number, kebab slug). For Mac screenshots with messy
   names, move by capture time to avoid hidden-character filenames:
   `mv Screenshot*10.20.05*.png docs/userflow/screens/04-assignment-builder.png`.
   View images first (Read the file) to confirm what the screen actually shows
   before writing its metadata.

3. **Edit `userflow.json`** (the only hand-edited file):
   - Add/modify the node in the array position matching its vertical order
     (`entry` first, `screens` in order, `future` last). Fill `kind`, `n`,
     `title`, `route`, `note`, `thumb`, and the four lists (`jobs`, `waysIn`,
     `actions`, `waysOut`). Use `job` instead of lists for `entry`/`future`.
   - Wire `edges`: add the inbound ("ways in") and outbound ("ways out")
     transitions. Repoint the prior `future` stub's edge to the new real node;
     optionally add a fresh `future` stub for what comes next.
   - `kind`: `forward` (solid indigo happy path), `back` (dashed grey return,
     auto-curves left), `next` (dashed brass into an unmapped screen).

4. **Rebuild** (deterministic, no deps):
   ```bash
   cd docs/userflow && node build.mjs
   ```

5. **Verify**:
   - `node build.mjs` printed the expected node/edge counts.
   - No orphan node (every non-entry node has ≥1 inbound edge) and no dead-end
     screen (every screen has ≥1 outbound edge). Flag any to the user.
   - To eyeball the graph, open `docs/userflow/userflow.html` (file:// is fine;
     relative thumbnails load). If a visual check is needed and the MCP browser
     can't load file://, serve it: `python3 -m http.server 8799` in the folder.

6. **Commit** the change (conventional `docs(userflow): ...`), staging only
   `docs/userflow/` (and the skill if changed). Per project rules: commit, do not
   push.

## Logging / resolving issues (the feedback loop)

When the user flags something (a product change or a map fix), add an entry to
top-level `issues[]` in `userflow.json` — do NOT just make the change silently:
- `target`: element address — `<nodeId>.<field>.<n>` (1-based, matches the card
  numbering, e.g. `create.actions.3`) or `<from>-><to>` for an edge.
- `about`: `product` (change the app) | `map` (fix this map).
- `severity`: `bug` | `change` | `idea` | `question`. `status`: `open`.
- `note` (why) + optional `change` (the concrete edit). Stable `id` (i1, i2, …),
  never reused.
Then `node build.mjs` — it renders on-map flags + an Issues panel + a punch-list.
When the change is implemented, flip the issue to `status: "done"` (keep it as the
changelog; git holds the before/after). Bump the affected node's `verifiedAt` after
re-checking it against the live app.

## Dispatching a fix (inline vs subagent)

When the user says "implement i1" / "fix this," the issue is usually a **product**
change (edit the real SvelteKit app), tracked by the map. Decide how to execute:

- **Single, small, one-file change → do it inline** in the main session. Faster,
  keeps shared context. (Removing the `create.actions.3` checkbox is this case:
  edit `/c/new`'s component, drop the field default.)
- **Several issues at once, or a large/multi-file change → fan out subagents**,
  one per issue, in parallel; use `isolation: "worktree"` if they touch overlapping
  files. Then reconcile the results.

Either way, the main session **owns the loop and the bookkeeping** — don't delegate
that: implement → run `pnpm check`/`pnpm build` (the grading barrel is server-coupled;
build catches import-guard breaks `check` misses) → flip the issue to `status: "done"`
→ ask the user to re-screenshot → bump the node's `verifiedAt` → `node build.mjs`.
Follow project rules for the app change itself (CLAUDE.md): commit, do NOT push.

## Resuming a session

The project memory primes Claude that this system exists. To re-enter: read
`docs/userflow/README.md` and `userflow.json`, then continue. The user typically
opens with "continue the userflow map," "flag X," or "implement i<n>."

## Notes

- Changing how the graph *looks or behaves* (layout, pan/zoom, colors) means
  editing `userflow.template.html`, then `node build.mjs`. Schema/data changes
  stay in `userflow.json`.
- Voice/brand: no em dashes; Manuscript++ palette only (see `BRAND.md`).
