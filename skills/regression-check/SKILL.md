---
name: regression-check
description: Impact-analysis + behavior-test pass before finalizing a change, to catch regressions in OTHER features that share code with what you touched. Use when the user says "regression check", "/regression-check", "did I break anything", "check for regressions", or right before committing a change that touches shared/domain code (anything under src/lib/domains, src/lib/server, hooks.server.ts, a +page.server.ts action, or a component many routes import). Especially after changing a function with multiple callers.
---

# regression-check — catch what you broke elsewhere

Most regressions in this codebase come from one move: changing **shared code** (a
function many features funnel through) and only verifying the feature you were
working on. The classic example: a guard added to `persistRubric` (the shared
rubric-save chokepoint) fixed an import bug but silently broke the builder's
"Start over", because both go through that one function.

This skill is the disciplined pass that catches that. Run it BEFORE finalizing a
change, not after the user reports a break.

## When it's worth running

Run it when the change touches code other features depend on:
- anything in `src/lib/domains/**` or `src/lib/server/**`
- a `+page.server.ts` form action, `hooks.server.ts`, an API `+server.ts`
- a component imported by several routes (e.g. `RubricSlot`, `RubricChatBuilder`, the grade surface)
- a DB migration, an RLS policy, or a shared validation schema

Skip it for leaf changes with no shared blast radius (a single page's copy, one
component's styling, a new isolated route).

## The pass

Work through these in order. Be concrete — name real callers and real features,
not categories.

### 1. Map the blast radius
For each symbol you changed (function, action, schema, exported component):
- Find every caller. Use the editor's find-references or:
  `grep -rn "<symbolName>" src --include='*.ts' --include='*.svelte'`
- For a function whose signature or behavior changed, walk callers up to the UI:
  who calls it, and who calls them, until you reach a user-facing feature.

Produce a short list: **symbol → callers → the user features behind them.**

### 2. Judge each affected feature
For every feature in that list, answer in one line: *does my change alter its
behavior, and is that alteration intended?* Flag anything where the answer is
"changes it, and that's NOT what I wanted." That flag is a regression — fix it
before moving on.

Pay special attention to features that depend on the OPPOSITE of what you just
added. (Added a guard that blocks empties? The feature that legitimately empties
is the one at risk.)

### 3. Lock it with a behavior test
For the change AND for each at-risk feature, make sure a test asserts the
**user-facing behavior**, not the implementation. The tell that a test is the
wrong kind: it passes while the feature is broken. "The guard refuses empties" is
an implementation test. "Start over empties the rubric and it stays empty on
reload" is a behavior test — that's the one that catches the regression.

Pick the cheapest layer that still exercises the real path:
- **Unit** (`*.test.ts` next to source) for pure logic — fast, preferred.
- **Integration** for a feature flow through real code (action/persist/db with a
  mock or test client) — the sweet spot for shared-code changes.
- **E2E** (`tests/*.spec.ts`, Playwright) for a full UI→server→DB journey, tagged
  `@critical` if it's a must-never-break path. Slower; reserve for the few flows
  that justify it.

Add the missing test(s). If a behavior genuinely can't be tested cheaply, say so
explicitly rather than skipping silently.

### 4. Run the nets
- `pnpm check` (typecheck + svelte) and `pnpm test` (unit) — always.
- If you touched a `@critical` E2E path: `pnpm test:e2e:critical`.
- Report what ran and what passed. If something's red, it's a finding, not noise.

## Output

End with a tight summary:
- **Blast radius:** symbols changed → features affected.
- **Findings:** any regressions caught (and how fixed), or "none".
- **Coverage added:** the behavior test(s) now guarding this, by name.
- **Nets run:** check / test / e2e results.

Keep it honest: if you couldn't reach a feature with a test, name the gap so the
human can decide.
