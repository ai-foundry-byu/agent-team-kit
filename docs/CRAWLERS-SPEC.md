# The error crawlers, a build spec

A stack-agnostic specification for three **backend crawlers that exercise a whole app to find errors before a user, or a demo audience, does**: a route crawler that loads every page in a matrix of data states, an action crawler that fires junk at every form action, and a browser monkey that drives a real browser for the client-side errors the first two can't see. They share one goal, **no errors during a demo**, and one non-negotiable, they only ever run against a **disposable copy** of the app.

This is a spec, not code, so a coding agent can build it in whatever stack you use (SvelteKit, Next/React, Remix, Rails, anything). The hard parts, route discovery, the data-state matrix, and the "graceful boundary vs. real content" classification, are framework-shaped, so each is described as a rule you re-implement, not a snippet you paste. It assumes **Postgres + Supabase** and a **filesystem-routed framework (SvelteKit as the reference)** as the default and calls out what is stack-specific with a generic equivalent each time.

---

## Why crawl your own app

The bugs that embarrass you in a demo are rarely in the happy path you rehearsed. They're the stale bookmark to a deleted record, the button nobody clicks until a customer does, the page that renders fine with your data and explodes on someone else's. They're unrepeatable by hand and invisible to unit tests, which assert known inputs, not "every page in every state."

A crawler turns that open-ended fear into a closed, repeatable catalog. The app already exposes every page and action over HTTP; the only trick is to enumerate them, feed them the *weird* states (a deleted id, a malformed id, another tenant's id), and check that each one fails *gracefully* instead of leaking, crashing, or dead-ending. Run it before a demo and the question "is anything broken right now" has an answer in thirty seconds instead of a held breath.

The three crawlers exist because there are three distinct error classes and no single tool sees all of them:

- **Server load errors** (a page's data fetch 404s, 500s, or leaks): the **route crawler**, GET-only.
- **Action crashes** (a form action 500s on bad input instead of returning a validation failure): the **action crawler**, which POSTs.
- **Client-side errors** (an uncaught exception, a hydration mismatch, a render that only breaks in the browser): the **browser monkey**, which drives a real browser.

Build the route crawler first, it's the cheapest and catches the most; add the others as the payoff justifies.

---

## The three crawlers at a glance

```
  DISCOVER                 RESOLVE                    HIT                      CLASSIFY
  --------                 -------                    ---                      --------
  walk the route tree  ->  fill [params] from the  -> GET each url         ->  status + (is the body
  -> url patterns +        DB: real ids (valid) +     (route crawler)          a real page, an error
     their [param] slots   bad ids (missing /                                  boundary, or a crash?)
                           malformed / foreign /   -> POST empty+junk       -> HTTP status only
                           mismatched)                bodies to actions        (a 5xx is the crash)
                                                      (action crawler)
                                                   -> load in a real        -> pageerror + console
                                                      browser, click           + 5xx network
                                                      (browser monkey)

                         ── all three first verify the target is the DISPOSABLE copy, or abort ──
```

Each crawler produces a list of **findings** (high-confidence problems) and, for the route crawler, **reviews** (lower-confidence, needs a human judgment call). Both are written to a JSON report so you can diff runs.

---

## The disposable target, non-negotiable

Every crawler in this spec mutates data, calls external services, or both. None of that can touch production. So the first thing each crawler does, before a single page is hit, is **prove it is pointed at a throwaway copy of the app, and abort if not** (Part D). The target itself has three properties:

1. **An isolated database**, a separate project/instance, not prod. Seeded with realistic-but-fake data so pages have something to render. Resettable in seconds (re-seed) so a destructive run leaves no residue.
2. **External calls stubbed.** The app reads env flags that short-circuit anything that costs money or reaches the outside world, the LLM/AI calls, email, payment, the LMS push. A crawler clicking "charge" or "send" must hit a deterministic stub, never the real thing. (Most apps already have these flags for tests; reuse them.)
3. **A seeded identity** the crawler signs in as, with known credentials and known data it owns, so the "valid" cases have real ids to use.

The same disposable copy doubles as your demo-prep environment: the *read-only* route crawler is safe to run against it (or even a real staging deployment) right before you present.

---

## Part A, The route crawler

GET every page in a matrix of data states and check each behaves. The single highest-value tool here, and the one to build first.

### A1. Discover the routes

Produce a list of `{ pattern, params, kind }`, where `pattern` is a URL template like `/c/[classId]/a/[assignmentId]`, `params` is its dynamic slots, and `kind` is `page` (renders) or `endpoint` (returns data).

- **Filesystem-routed frameworks** (SvelteKit, Next, Remix): walk the routes directory. A directory is a *navigable page* only if it holds the file that renders one (`+page.svelte`, `page.tsx`, etc.), a bare server/loader file with no view is an action target, not a URL, skip it for GETs. Strip route-group segments (`(app)`), and read `[param]` / `[...rest]` / `[[optional]]` slots from the segment names.
- **Table-routed frameworks** (Rails, Express): read the route table the framework already exposes (`rails routes`, the router config) instead of walking the filesystem. Same output shape.

### A2. Resolve params into a data-state matrix

This is the heart of it. For each route's params, generate URL instances across five states. The first is the control; the other four are the "weird" states real users reach:

| State | The id you substitute | What it simulates | Expected |
|---|---|---|---|
| **valid** | a real id the seeded user owns | the happy path | 2xx |
| **missing** | a well-formed but nonexistent id (random UUID) | a deleted record / stale bookmark | graceful 404 |
| **malformed** | a syntactically invalid id (`not-a-uuid`) | a hand-edited / garbage URL | graceful 404 |
| **foreign** | a real id owned by *another* user | a cross-tenant link | 404 (RLS denies) |
| **mismatched** | a real child of a *different* parent (real class A + assignment from class B) | a recombined/stale nested link | 404 (not in this parent) |

Pull the real ids (valid, foreign, the mismatched child) from the DB with a privileged read at startup, keyed to the seeded user. Generate one all-valid instance, then one instance per param where *that* param is bad and the rest are valid, plus the mismatched-nesting instance for nested routes. For nested routes, pick a **coherent** valid combo (a child that genuinely belongs to the chosen parent), or your "valid" case trips the route's own parent-membership guard and looks like a bug when it isn't.

Routes whose params you can't resolve to anything real (opaque tokens, slugs with no seed) get only the missing/malformed states, still useful, they confirm the route degrades.

### A3. Hit, with a real authenticated session

Get a real session the production way: drive the app's actual sign-in (post to the login action, keep the cookies) rather than minting a token by hand, so you exercise the same auth path a user does. Replay those cookies on every request, and **do not follow redirects** (so an auth bounce shows up as a 3xx to the login page instead of silently following).

### A4. Classify, the part everyone gets wrong

A naive crawler checks only the status code and drowns in false positives. The signal is **status code + what the body actually is**. Read the page body (at least for non-2xx, ideally always) and decide whether it rendered a real page, your styled error boundary, or a crash. The distinctions that matter:

- **A bad-id URL that renders REAL content (2xx, not the error boundary)** is the dangerous finding, a missing existence check, or worse, a cross-tenant leak. This is invisible to a status-only crawler because the status is 200.
- **A bad-id URL that renders the error boundary** is the app handling it. Ideal if the status is also 404; if the boundary renders at status 200, that's a lower-severity *review* (an SEO/monitoring smell, not a broken screen). *(Watch for this one: a framework that streams part of the layout can commit a 200 before a downstream load throws, so your 404s quietly ship as 200s. Worth catching.)*
- **Any 5xx** is a crash, a finding, regardless of state.
- **A 404 that renders the framework's bare fallback** instead of your styled boundary is a dead-end worth a styled page.
- **Role-awareness:** routes a role shouldn't see (an admin area, crawled as a non-admin) are *expected* to be blocked; an error boundary there is correct, and *real content* there is a privilege-escalation finding. Tag those routes and invert the expectation.

Split the output into **findings** (high-confidence: 5xx, real-content-on-bad-id, valid-page-errors) and **reviews** (judgment calls: the 200-vs-404 status smell, unseeded-param 200s). Don't let the reviews bury the findings.

### A5. Endpoints

For data endpoints (not pages), do a lighter sweep: GET with valid params and flag only 5xx. They answer in JSON, not your 404 page, so the body-classification above doesn't apply, and most are POST-only (a GET 405 is the contract working, not a bug).

---

## Part B, The action crawler

POST empty and junk payloads at every form action and assert each fails *gracefully*, a typed validation failure, never a 5xx crash. The mutating counterpart to the route crawler, and the one that catches the "click a button and it errors" bugs GET-crawling can't.

### B1. Discover the actions

Enumerate every mutation entry point: form actions (in filesystem frameworks, the named actions exported from a route's server file; the POST target is `<route>?/<action>` or similar) and mutating endpoints (POST/PUT/PATCH/DELETE handlers). Substitute real ids into parameterized routes the same way Part A does.

### B2. Fire bad payloads

For each action, POST two bodies:

- **empty**, no fields at all.
- **junk**, a grab-bag of the common field names across your app set to values designed to be *rejected*: a random UUID for id fields, a non-UUID for others, unparseable JSON for JSON fields, a wrong confirmation string for delete confirmations.

The elegant property: because the payloads are *invalid*, a well-validated action rejects them *before* it writes anything, so the crawler **mostly doesn't mutate** despite POSTing to "delete" and "release". (Actions with no required fields can still fire, that's what the reset between runs is for.)

### B3. Classify on the real HTTP status

The subtlety: in many frameworks a form action *always* replies HTTP 200 with an envelope describing success/failure/redirect, the logical status lives *inside* the envelope. So you must classify on the **transport status**, which means POSTing directly and reading `res.status`, not going through a client helper that only hands you the envelope. The rule is then clean: **a 5xx is an unhandled crash (a finding); everything else, a 200 with a `failure` envelope, a 303 redirect, a thrown 4xx, is the action handling bad input.** A junk payload that yields a graceful `fail(400)` is success; a junk payload that yields a 500 is the bug.

A bonus check, if you can identify destructive actions: a junk payload that *succeeds* on a delete/release is a missing-validation finding, not just the absence of a crash.

---

## Part C, The browser monkey

Drive a real browser through every page to catch what never reaches the server: uncaught JS exceptions, hydration/runtime errors, console errors, and 5xx calls the page fires itself. The route crawler checks the *load*; this checks what happens once the page is *live*.

### C1. Auth and navigation

Reuse the programmatic session from Part A, then inject its cookies into the browser context (a browser-automation tool lets you set cookies directly), so the monkey is signed in without re-driving the login UI. Visit each page (reuse Part A's discovery + valid ids).

Wait for the document, then a short fixed beat for hydration and mount effects, **not** the network-idle signal: an app with a realtime websocket (Supabase Realtime, a live socket) never goes idle, so network-idle waits hang every page until timeout. `domcontentloaded` + a ~700ms settle is the reliable pattern.

### C2. Collect what breaks

On each page, listen for and record: **uncaught page errors** (the highest-signal, a real JS exception), **console errors** (medium-signal, filter the known-benign, a missing favicon, dev-only warnings), and **network responses with a 5xx status** fired from the page. Report page errors as findings; console errors as reviews.

### C3. The optional click pass

Behind a flag, after a page settles, click each visible, safe-looking button and re-check for new errors. Skip anything whose label looks irreversible (`delete`, `remove`, `sign out`) and auto-dismiss native dialogs (a `confirm()` blocks automation). This is genuinely flakier and lower-yield than the load sweep, build it second, keep it opt-in.

---

## Part D, The safety guard, the load-bearing piece

The crawlers mutate and POST, so a mis-set target URL pointed at production would be a disaster. The guard makes that impossible, and it is the one part you must not skip.

After signing in, **decode the identity the target server actually handed back and confirm it belongs to the disposable copy**, abort otherwise. Concretely: the session cookie carries a signed token whose issuer/project ref identifies the backend (a Supabase JWT's `iss` is `https://<project-ref>.supabase.co/...`). Read that ref, compare it to the disposable project's ref (from the crawler's own config), and if they don't match, **exit with a loud refusal before hitting anything**. This catches the case where someone points `DEMO_URL` at a prod-backed server: even though the dev server *looks* local, its session proves which database it talks to.

Two corollaries:

- **Self-configure to the disposable target.** Load the disposable env (its keys, its db url) with override, so the crawler's own privileged DB read (Part A's id resolution) hits the *same* database the server does. A mismatch here, the registry reading prod while the server reads the copy, hands out ids that don't exist on the target and produces phantom 404 "findings". Auto-align the registry to the server's identity.
- **Reset after a destructive run.** A data-only re-seed (schema untouched) restores the known fixture in seconds, so the next run starts clean.

This same "decode the session, refuse unless it's the throwaway" guard is what lets you run the destructive crawlers as freely as the read-only one.

---

## What you get, and the build checklist

The endgame is a one-command pre-demo pass: reset the disposable copy, then run all three crawlers; green across them means the code paths a demo touches are exercised and clean, and since the deployed code is byte-identical, demo-green implies prod-green for those paths.

Build it in this order, each step independently useful:

1. **The disposable target** (Part D's environment): an isolated DB, seeded, external calls stubbed, resettable. Nothing below is safe without it.
2. **The safety guard** (Part D): decode-the-session-and-refuse, plus self-align the id registry. Build this *with* the first crawler, not after.
3. **The route crawler** (Part A): discovery -> data-state matrix -> authenticated GET -> body-aware classification -> findings/reviews report. The 80/20.
4. **The action crawler** (Part B): discover actions -> empty/junk POST -> classify on transport status.
5. **The browser monkey** (Part C): inject session -> load sweep -> pageerror/console/5xx capture. Add the click pass last, opt-in.
6. **The ritual:** wire `reset -> route -> action -> monkey` into one command, and run it before every demo (and the read-only route crawler against your live staging right before you present).

A note on honesty: a crawler is a *catalog*, not a proof. It covers "every URL in every data state" and "every action with bad input", it does not cover multi-step flows, specific data shapes that only break rendering, or anything that needs a human to judge "is this output correct". It is the fast, broad first net, run it often, and let what it surfaces point you at the narrow cases worth a closer look.
