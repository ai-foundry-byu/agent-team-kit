# Walks and sweeps, a build spec

A stack-agnostic specification for **two structured browser passes that judge a
running app the way a person would, photograph every state, and file what they
find into the feedback loop**: a **walk** that travels one journey end to end,
and a **sweep** that stands on one screen and clicks every control on it. Both
land in a single navigable HTML report, and each finding becomes a
`bug_reports` row that hands off to [`fix-bug`](../skills/fix-bug/SKILL.md) with
its screenshot and context already attached.

This is a spec, not code, so a coding agent can build it in whatever stack you
use. It pairs with the [crawlers](./CRAWLERS-SPEC.md), the
[ux-critique](../skills/ux-critique/SKILL.md) skill, and the
[feedback loop](./FEEDBACK-LOOP-SPEC.md), and it is the report-producing,
ticket-filing evolution of that critic. It assumes Postgres + Supabase as the
default and calls out the generic equivalent for anything specific.

---

## Where this sits

There are three questions you can ask a running app, and they need three tools:

| Question | Tool | What it produces |
|---|---|---|
| **Did it crash?** | the [crawlers](./CRAWLERS-SPEC.md) | a status catalog: 404s, 500s, cross-tenant leaks |
| **Did the assertion hold?** | your Playwright/spec suite | pass / fail, then throws away everything it saw |
| **Does it make sense, and does every control work?** | **walks and sweeps** | a screenshot of every state + a judged report + filed tickets |

A crawler proves a page didn't error; it cannot see that the page is confusing,
that a button does nothing, or that a stat contradicts the table beneath it. A
spec asserts a handful of things and discards the rest. Walks and sweeps keep
the **whole trail** (a screenshot per state, the URL, the console errors, the
failed requests) and put a human (or an agent) in front of it to judge.

The [ux-critique](../skills/ux-critique/SKILL.md) skill is the ancestor: an
LLM walking a flow with an expectation loop. This spec is what it becomes when
you want it **repeatable, catalogued, and wired to the fix pipeline**: two
named pass types, one report, one filing path.

---

## The two passes at a glance

```
  WALK:   one journey, moving                 SWEEP: one screen, standing still
  ----                                        -----
  sign in, then travel a flow:                enumerate every control on the screen,
  step -> screenshot + write the              then for EACH control:
  expectation -> next step ...                  reset to a known baseline
                                                click exactly that one control
  a failed step is RECORDED, not fatal;         screenshot the result
  "the flow broke here" is the finding          classify what happened:
                                                  navigated / overlay / changed /
  finds: confusing flows, broken                  INERT / error / skipped
  hand-offs, dead ends, stale state
                                                finds: dead controls, wrong
                                                destinations, errors no one clicks
```

They differ in what they visit, not in how they observe. Both want a real
browser at a fixed viewport, a screenshot of every state, and the console
errors + failed requests each interaction produced. Build that shared session
layer once so the two runners cannot drift apart.

---

## Part A, The walk

Travel one journey the way a user walks it, and photograph every screen and
state change on the way through.

### A1. A step carries a written expectation

The unit of a walk is a **step**: an action, plus a plain-language sentence of
what should happen, written *before* the action runs. This is the expectation
loop from the ux-critic (predict → act → observe → judge), and the written
prediction is what turns a finding from a vibe into something concrete. The
sentence lands next to the screenshot in the report, so a reviewer can judge
"is this what I'd expect" without reading the script.

### A2. A failed step does not abort the walk

When a step throws (an element never appears, a click times out), record it as a
failed step **with its screenshot** and keep going. "The flow broke here" is the
single most valuable thing a walk can tell you, and a walk that halts on the
first failure hides every problem after it.

### A3. Capture the whole trail

Per step, record: a screenshot, the URL, the visible heading, the wall-clock,
and two error buckets drained fresh each step: **console errors** and **failed
requests** (any 4xx/5xx the page fired). A page that looks fine but is throwing
a background 400 is a real finding a screenshot alone would miss. On a
production walk, also record the true page latency from the browser's
Navigation Timing (`responseEnd - startTime`); wall-clock includes your own
settle waits and is useless as a latency number.

### A4. Follow real data, don't pin to ids

A walk that hardcodes `/c/abc123` rots the moment that record is deleted. Have
each step discover the next target from what the current page actually renders
(the first class link, the most-recently-touched assignment), so the walk
survives real data moving underneath it. If the seed has nothing to point at,
skip that leg rather than fake it.

---

## Part B, The sweep

Stand on one screen and click **every control on it, one at a time**, to answer
a question neither a journey test nor a crawler can: on this screen, what does
each button actually *do*?

### B1. The outcome taxonomy (the whole point)

For each control: return the screen to a known baseline, click exactly that
control, wait, screenshot the result, and classify it as one of:

| Outcome | Meaning |
|---|---|
| **navigated** | the URL moved |
| **overlay** | a dialog, drawer, menu or popover opened |
| **changed** | the page content changed in place |
| **inert** | nothing observable happened |
| **error** | the click threw, or the page logged an error / failed a request |
| **skipped** | not clicked on purpose (destructive, external, or a state mutation) |

**`inert` is the finding that matters most.** A control that does nothing is
invisible to a journey test (which never clicks it) and to a crawler (which only
checks the page didn't crash). The sweep is the only pass that catches a dead
button, a mis-wired handler, or a link to nowhere.

### B2. Reset to baseline before every click: and reloading is not enough

Between clicks the screen must return to exactly where it started, or one early
click contaminates every measurement after it. Reloading the URL is
insufficient: some controls persist UI preferences (a collapsed nav, a
remembered tab) in `localStorage` or a non-auth cookie, so clicking "collapse
the sidebar" once silently changes the screen every later control is judged
against. The reset must **drop client-side preference state** (clear
`localStorage`/`sessionStorage` and non-session cookies, keeping only auth) and
then reload.

### B3. Change detection needs a content hash, not a length

Deciding "changed vs inert" by comparing the amount of text on the page is
wrong: a sort control reorders rows without changing a single character count,
and "the table re-sorted" must not read as "nothing happened." Hash the visible
text (plus a node count) and compare hashes. Detect an opened overlay by
counting `[role=dialog]`/`[role=menu]`/`open` elements before and after.

### B4. Re-find controls by a tag you write, not by their label

To click control *n* after a reset, you must locate the same element again.
Re-deriving a selector from the control's visible label loses every icon-only
button and mis-hits every duplicate label on the page. Instead, during
enumeration **stamp each control with an index attribute** (`data-sweep-n="k"`)
and select on that. Corollary: do **not** filter enumeration on `opacity`. A
control that is transparent until you hover its row (a table row's actions, a
switcher) is a real control a user can click, and a real click hovers it on the
way in; filtering it out makes it enumerate at baseline and then vanish, which
the sweep can only report as a phantom error.

### B5. Skip what mutates or escapes: two kinds

A sweep clicks *everything*, so it needs a guard, and the guard has two parts
because state changes hide behind two kinds of label:

- **Verb labels** (delete, archive, release, send, upgrade): a keyword list.
- **Noun labels that are secretly mutations.** The subtle one. On a grading
  rail, a rubric level chip reads "Good 20" and *scores the paper*. A keyword
  list never catches that. So keep a second list of domain scoring/confirm
  vocabularies, and skip those too. (This is not hypothetical: a first sweep
  clicked fifteen level chips and un-confirmed a graded paper before the guard
  existed.)

Both are **recorded as skipped with a reason**, not silently dropped, so the
report is honest about what it did and didn't exercise. External links (another
origin, `mailto:`) are recorded, not followed.

### B6. A dry run keeps the catalog honest

Sweeping every screen takes real time, but a route can silently stop resolving
when the app changes (a page starts linking to `.../build` instead of the bare
hub). Provide a **dry run** that signs in, resolves every catalogued screen's
route (including the ones whose path depends on seeded data), and reports how
many controls each has, without clicking anything. Run it after any routing change; it
re-validates the whole catalog in seconds and names the screens the app no
longer reaches.

---

## Part C, The report

Both passes render into **one** navigable HTML file (screenshots referenced by
relative path, not base64, so it opens straight off disk). It has three layers.

### C1. A triage overview, verdict derived from evidence

The report opens on a table: one row per journey and per screen, each with a
**verdict that is computed, never hand-written**, so it cannot drift from what
was recorded:

- **Needs action**: a step broke, or a high-severity finding.
- **Worth a look**: smaller findings, a control that did nothing, or an error
  the page logged that no one has filed.
- **Working well**: the pass ran clean.
- **Not run yet**: no pass recorded (kept visible on purpose; the catalog is a
  coverage map, and an unrun surface is a gap, not an absence).

Plus what's driving the verdict in one line, and how much of the surface the
pass covered (a capped or partly-skipped sweep says so).

### C2. The confidence axis (the honest half)

A pass reads as **machine-checked only** until a reviewer has actually looked at
every screenshot and marks it reviewed. This separates "the classifier found
nothing" from "a human confirmed it's fine": two different claims that a naive
report renders identically. A half-read pass can never present itself as a clean
bill of health.

### C3. Per-step / per-control detail

Every screenshot, its written expectation (walk) or auto-classified outcome
(sweep), and folded-in console errors and failed requests. Findings the reviewer
wrote attach to the exact step or control that produced them.

---

## Part D, Tie into the feedback loop (the payoff)

A finding is only worth producing if acting on it is cheap. So a finding is
**not a new data type**: it is a [`bug_reports`](./FEEDBACK-LOOP-SPEC.md) row,
filed through the same intake a human widget report uses, which means it
inherits the entire pipeline for free: the admin inbox, triage, the
`/fix-bug <id>` warm start, the screenshot bucket, and the close-on-commit hook.
Rebuilding any of that behind a second table would buy nothing.

### D1. Same storage, separate queue

What must **not** be shared is the *queue*. A human's report is a customer
signal; a walk/sweep finding is your own QA output, generated in batches, and
mixing them drowns the former and distorts every "how much feedback did we get"
count. The [feedback spec's `source` column](./FEEDBACK-LOOP-SPEC.md#findings-come-from-humans-or-agents-the-source-tag)
is exactly this axis: file with `source: 'walkthrough'` (alongside `'user'`,
`'ux-critic'`, the crawler sources), and give the inbox a filter (*from people*
/ *from our passes* / *all*), defaulting to people.

### D2. The finding carries the same tidy context package

The whole reason the widget is worth building is that it captures enough context
for an agent to fix without a back-and-forth. A filed finding carries the same
bundle shape, assembled from the run instead of the browser:

- the **screenshot** of the exact step or control (uploaded to the same
  `{id}/screenshot.png` path the widget uses, so nothing downstream special-cases
  it),
- the reviewer's **expected / observed / why-it-matters**,
- the **route**, and for a sweep the control's label, role, region and outcome,
- the **console errors and failed requests** captured at that moment (they land
  in the same `context.console` array `fix-bug` already reads),
- the **code pointer** and **suggested fix**,
- the exact **command that reproduces** the pass, and *where it was found* (a
  local build with seeded data, or production).

Severity rides along too: unlike a scripted `bug:file`, a walk/sweep finding
was already severity-judged against a screenshot during review, so dropping it
would throw away the reviewer's read.

### D3. Idempotent filing, by a stable fingerprint

Re-running a sweep must not spam the inbox. Give each finding a **stable id
slug** and fingerprint it as `hash(passId :: findingId)`, using the finding's own id
rather than its title, so its wording can be rewritten later without orphaning the
ticket. Before filing, look up open `source: walkthrough` rows by fingerprint
and skip the ones already filed.

### D4. The report joins the inbox back: one copy, one paste

The report is a *render of two things*: the evidence on disk, and the state of
the tickets those findings became. At build time, query the inbox for filed
findings (keyed by fingerprint) and render one action row per finding: either a
copyable `/fix-bug <id>` with the ticket's live status, or a copyable "file it"
command if it isn't filed yet. Reading the report and acting on it become the
same motion. Nothing is written back into the notes file, so there is no second
source of truth to drift.

A resolved ticket deliberately does **not** make the finding vanish; it reads
*"fixed in `<sha>`, re-run to verify"*, because a fix is only proven when the
pass runs again. That closes the loop: run → review → file → fix → re-run.

### D5. A close refreshes the report

The report shows ticket state, so a close makes it stale. Rebuilding is cheap
and read-only, so hang it off the event that already closes the loop: the
[`post-commit` hook](./FEEDBACK-LOOP-SPEC.md#the-post-commit-git-hook-the-keystone)
that resolves a bug also rebuilds the report. (An admin-UI close won't fire a
local hook; a generated file is a render, not a live view, so accept a
one-command refresh there rather than pretending otherwise.)

### D6. A note on where tickets live

The [disposable-environment doc](./DISPOSABLE-ENVIRONMENT.md) says agent
findings live in the *disposable* inbox and close there. That holds when your
disposable target is a hosted project with its own inbox. When the disposable
target is instead a **local, ephemeral** database (no one triages it, a reset
wipes it), the durable ticket belongs in **prod**, and you separate the two
audiences by *queue* (D1) rather than by *database*. Evidence is gathered
locally; the ticket lives where `fix-bug` and close-on-commit already look.

---

## Part E, Where these run (local vs production)

Local and production answer different questions, and the pass type decides which
is safe. The full model (the disposable target, the graded posture that lets a
walk touch production safely) is in
[`DISPOSABLE-ENVIRONMENT.md`](./DISPOSABLE-ENVIRONMENT.md). The rules that
matter here:

- **Local (or the disposable project) answers "is it coherent."** Does every
  control do something, does the flow make sense. Cheap, free, resettable, no
  real PII. Both passes run here freely.
- **Production answers "is it true."** Real data shape (a full cohort, long
  names, messy uploads), real integrations, real latency, and realtime; none of
  which local can produce. Only a **walk** goes here, and only **read-only or
  guarded** (Part E of the disposable doc: writes enforced-off at the network
  layer, with an escape list for effects that reach other people).
- **Never sweep production.** A sweep is a fuzzer with a politeness filter, and
  the filter is a heuristic that gets caught missing. Refuse it outright.
- **Production screenshots contain student/customer PII.** A finding filed from
  a prod pass omits its screenshot unless a class with no real people is in
  frame; the narrative, logs and code pointer still go.
- **Attach the server's half.** When a production step fails or logs a 5xx, pull
  the matching window from your host's logs (`railway logs`, `vercel logs`, …)
  and attach it to that step, so the finding carries both what the user saw and
  what the server did.

---

## Build checklist for a coding agent

1. **A shared browser session** (viewport, screenshot, console + failed-request
   capture, a settle that waits for in-flight fetches but is capped so a
   websocket page doesn't hang), and a network-layer posture switch (open /
   read-only / guarded).
2. **The walk runner** (Part A): steps with written expectations, failed-step
   recording, real-data discovery. Author walks for your core journeys.
3. **The sweep runner** (Part B): enumerate-and-tag, reset-to-baseline,
   click-and-classify with the outcome taxonomy, the two skip guards, a dry run.
   Catalog the screens worth sweeping.
4. **The report** (Part C): the triage overview with a derived verdict, the
   confidence axis, per-state detail, one HTML file.
5. **The filing path** (Part D): file findings as `bug_reports` rows with a
   `source` tag and the context bundle, idempotent by fingerprint; join ticket
   state back into the report; refresh on close.
6. **Wire the environment rules** (Part E): read-only/guarded posture on prod,
   sweep-refuses-prod, PII-safe screenshots, host-log capture.

---

## How it pairs with the rest of the QA layer

- The [crawlers](./CRAWLERS-SPEC.md) answer *did it break* across every URL and
  action: the broad, cheap first net.
- **Walks and sweeps** answer *does it make sense* and *does every control
  work*: the judged pass, with a report a product owner can read.
- The [feedback loop](./FEEDBACK-LOOP-SPEC.md) is the shared spine: crawler
  findings, critic findings, walk/sweep findings, and real human reports all
  land in one inbox and hand off to [`fix-bug`](../skills/fix-bug/SKILL.md) the
  same way.

One finds crashes, one finds confusion and dead controls, and both feed the same
one-command fix pipeline. That is the full agentic QA layer: a person says "walk
the app and show me what's wrong," and gets a report they can act on without
clicking a thing.
