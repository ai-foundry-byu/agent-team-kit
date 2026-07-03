---
name: ux-critique
description: Agentic UX critic. Drive the app in a real browser through a key flow and judge, at each step, whether what happens next is intuitive and what a user would expect, then file the gaps as triageable findings through the existing feedback pipeline. Use when the user says "/ux-critique", "walk me through X and critique it", "UX review", "does this flow make sense", "find UX issues", or wants a fresh-eyes bug list before a demo. NOT for finding crashes/404s (that is the crawlers).
---

# ux-critique, does it make sense, not just does it work

A worked example to adapt. The [crawlers](../../docs/CRAWLERS-SPEC.md) answer
*did it break*. This answers *does it make sense*: it drives the real app through
a flow and, at each step, asks the question a deterministic check cannot. **I
clicked X expecting Y, did Y happen? Is the next step obvious? Is this what a user
would expect?** Findings are the gaps between expectation and reality. They file
through the **same [feedback pipeline](../../docs/FEEDBACK-LOOP-SPEC.md)** as real
user reports, tagged `source: ux-critic`, so they land in the same inbox and hand
off to `fix-bug`.

To adapt this to your project: swap in your disposable-env launch, your sign-in,
your feedback-submit hook, and your report path. The method below is the
transferable part.

## The one non-negotiable: drive the disposable environment, never prod

This drives a real browser and mutates data. Run it against the
[disposable environment](../../docs/DISPOSABLE-ENVIRONMENT.md), never prod. Before
anything, prove the target:

1. Bring up the disposable dev server. Prefer **real behavior** (fidelity stubs
   off) so you judge the real production code path, not a canned stub, a stubbed
   grader returning a fixed score will manufacture false "everything is identical"
   findings. The stubbed mode is fine for non-LLM flows.
2. Sign in as your test user and **decode the session issuer**, it must be the
   disposable project ref, not prod. If it is not, STOP.
3. If unsure the data is clean, reset + reseed the disposable project first.

**Sign in robustly.** Browser automation's first synthetic click often does not
register, and it bites the login button. Fill the fields by element-reference and
**submit the form via JS** (`form.requestSubmit()`) rather than a coordinate
click, a sign-in is a form-POST then redirect, so once submitted properly it is
solid. (More: [DRIVING-THE-APP.md](../../docs/DRIVING-THE-APP.md).)

## The expectation loop (the whole method)

For each meaningful step, in order:

1. **Ground the expectation in the code, not a map.** Read the route's load +
   action handlers + the main component first, so your "should happen" is anchored
   in what the app actually does, plus product sense and the conventions in
   `taste.md`. (Do not lean on a stale generated map; fresh code reading beats it.)
2. **Predict.** Write the expectation out loud: "Clicking Publish should make the
   assignment live and confirm it." A written prediction is what makes a finding
   concrete instead of a vibe.
3. **Act.** One real action.
4. **Observe.** Screenshot + what changed in the DOM + did the URL move + did
   feedback appear.
5. **Judge.** Does reality match the prediction? Is it intuitive? Record only
   genuine gaps; resist nitpicking, `taste.md` says what is already known-fine.

## Filing a finding

File **in context, one at a time, on the screen where you found it** (the bundle
is captured at submit time; batching at the end gives stale screenshots). Call a
**dev-only hook** that runs your normal feedback-submit path (so it self-captures
the screenshot + breadcrumbs/console/network rings, the same telemetry a real
report carries) and tags `source: ux-critic`. Carry the richer fields too, they
are what make the report actionable:

```js
await window.__uxCritic.submit({
  kind: "bug" | "confusing" | "idea",
  expectation: "Expected: <prediction>. Observed: <what happened>. Why it matters: <impact>.",
  run: "<flow>-<date>",          // SAME id for every finding in one walk
  title: "<one-line headline>",
  severity: "high" | "med" | "low",
  codePointer: "<file/function where the fix likely lives>",  // you read the code, record it
  suggestedFix: "<one line>",
  region: { x: 19, y: 30, w: 14, h: 5, label: "1" }  // the offending box, % of the screenshot
});
```

Park the richer fields under the report's `context` (e.g. `context.critic`) so
they ride the same row. The predict + observe contrast is the value: a normal
report says "X broke," a critic report says "I expected A, got B."

## The annotated report (a standard run output)

End every run by compiling the findings into one **self-contained annotated HTML
report**, the artifact the owner scans to see the gaps without re-walking. It is a
*render* of the findings already filed, not extra capture: a small script queries
the run's findings, downloads their stored screenshots, base64-embeds them, and
writes one HTML file. Each card: the screenshot with a callout box drawn from
`region`, the predict/observe text, the code pointer, a suggested fix, the repro
breadcrumb, and a link to the finding in the inbox. Three views from one capture:
the report (human), the rows (machine), the inbox (triage). For findings the
in-app hook cannot reach (an auth page with no widget, or a non-event like a click
that does nothing), the report script takes a hand-added card with a local
screenshot.

## Calibrate every run

**Read `taste.md` first**, it is the owner's accumulated verdicts on what is a real
issue vs intentional (e.g. "the uniform scores are stub data, not a bug"). It is
what keeps this from crying wolf. **After the run**, walk the findings with the
owner, mark each real/noise, and append the verdicts *with the why* to `taste.md`
so the next run is sharper. The taste file, hand-curated from corrections, is the
real intent spec, and the only thing that should grow over time.

## Honest framing (tell the user)

It is a **catalog, not a gate**: LLM judgment varies run to run, so treat the
output as a fresh-eyes bug list to triage, never a pass/fail check. It covers
"walking a flow as a user"; it does not cover data shapes that only break
rendering, or anything needing a human to judge "is this output *correct*." And
browser automation is flaky, a first click can silently not register, itself a
finding worth confirming, not an excuse to give up.

## After: triage, fix, close

Findings are in the inbox with `source: ux-critic`. Triage, then `fix-bug` on the
keepers. The fix is **code, so it ships to prod** like any change; if it needs a
migration, author it against prod and port to the disposable project. The finding
lives in the disposable inbox, so **close it there** (point your `bug:resolve` at
the disposable env). The durable record of the fix is the commit + the report; the
disposable bug row is just the working ticket.
