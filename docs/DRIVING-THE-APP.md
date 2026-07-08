# Driving and capturing the app

Three related capabilities for seeing and showing what the running app actually does, without clicking through it by hand: high-fidelity screenshots, clean recorded walkthroughs, and driving the app programmatically. They build on two disciplines the rest of the kit already establishes, which is why they live here.

> The sibling to this doc, for when *you* take the keyboard instead of an agent, is [`HANDS-ON-EDITS.md`](./HANDS-ON-EDITS.md): jumping from a rendered element to its source file in one click, and committing only that file without sweeping in a sibling's work.

**The two disciplines they share:**

- **Own dev server on your assigned port.** Start your own (`pnpm dev --port <N> --strictPort`, backgrounded), read the real bound port from the log, and never trust `5173`: it is usually another session's, and concurrent HMR causes phantom failures. Kill only your own PID on cleanup. (This is the kit's `dev-port` hook in action.)
- **Verify by reading state, not pixels.** Confirm navigation and behavior by reading the URL / DOM / network in each tool result, not by eyeballing screenshots. The URL trail is what actually proves a flow worked or a bug exists.

## When to reach for which

- **A still screenshot** when the thing is about one state: a layout, a rendered design, "did this land." Cheapest and fastest.
- **A recording (GIF or video)** when the thing is about a sequence of steps: reproducing a bug (a "repro": the click path that triggers it), demoing a flow, or showing a before/after interaction. For a bug specifically, this lives in the `fix-bug` skill's reproduce phase; record it when the bug is a UI sequence you can drive and a watchable artifact would help.
- **Puppet strings** when you want Claude to exercise a flow end to end and report what happened (the URLs it hit, the resulting state) without you clicking, for example "run the grading flow and show me after my change."

Quick rule: a still is one moment, a recording is a sequence, puppet strings is "go do it and tell me what happened." None of these is always possible; attempt the one that fits the context, and fall back to describing the result when the app cannot be driven.

## 1. High-fidelity screenshots

Drive the running app in a real browser and capture pixel-accurate screenshots of any screen or state. Useful for design review, before/after comparisons, video frames, docs, and confirming a change landed.

Two ways, pick by the job:

- **Playwright (headless Chromium)** for scripted, reproducible captures: `page.goto(url)` then `page.screenshot({ path, fullPage: true })`. Good for CI, batch captures across routes and viewports, and a repeatable "here is screen X" you can re-run. Playwright can also record **video** of a run (`recordVideo` on the browser context) and traces — but the video is written only when the context *closes*, so a recording is a one-shot, not something a long-lived driving session emits (see §3, "a durable driver").
- **Claude-in-Chrome MCP** for ad-hoc, in-your-real-session captures: navigate, then a `computer` screenshot against your logged-in browser. Good for a one-off "show me what this looks like" without writing a script.

Capture **both desktop and mobile** when the surface has both (set the viewport or device), mirroring the mockups rule.

## 2. Recording a clean walkthrough (the recipe)

A reliable recipe for recording a flow as a GIF (or video) that reads clearly, using the Claude-in-Chrome `gif_creator`. The two things that make it good rather than messy: **dry-run before recording**, and **verify via URLs, not visual guesses.**

1. **Set up an environment you control.**
   - Load the Chrome MCP tools you'll need in one ToolSearch batch (the core nav set plus `gif_creator` and `find`).
   - Start your own dev server on a fresh port (backgrounded), then tail the log to confirm the real port. Never trust `5173`.
   - Grab the creds you need (e.g. from the seed script); confirm you have a logged-in session.

2. **Dry-run the whole flow once, WITHOUT recording.** This is the most important step. Walk the flow end to end with no recording, purely to learn the exact element locations and confirm the behavior. Get stable element refs with `find` (e.g. the pencil button) instead of pixel-hunting. Confirm each navigation by reading the URL in the tool result, not by eyeballing the screenshot.

3. **Record the clean take.**
   - `gif_creator` start_recording.
   - Screenshot immediately for a clean first frame, plus a padding frame.
   - For each step: hover, screenshot, click, screenshot. The hover surfaces the tooltip so a viewer reads your intent; every navigate / computer action is auto-captured as a frame.
   - Extra frames at the end so the payoff state lingers.
   - stop_recording, then export with `download: true`, a descriptive filename, and overlays on (action labels, click indicators, progress bar).

4. **Deliver and clean up.** Locate the exported file and send it with the file tool. Kill only your own dev-server PID.

## 3. Puppet strings: drive the app programmatically (spec)

The idea: instead of clicking through the app yourself and then asking Claude for the URLs of what it built, give Claude a harness to **drive the app as a user and report back what happened** (the resulting URL, the state, a screenshot). Put the app on puppet strings.

This is a spec, not code, because the implementation differs by stack. For a typical web app it is two layers:

- **The UI layer.** Playwright or the Claude-in-Chrome MCP drives the browser (click, fill, navigate) and reads URLs, DOM, and network from tool results. Claude exercises the real interface a user would, and reports the URL trail and a screenshot.
- **The flow / backend layer.** A family of project scripts (for example `demo:*` / `seed:*` commands) that exercise whole scenarios end to end via HTTP, server actions, and background jobs, seeding real data, so Claude can run a full flow in seconds without a browser. (LawGrader's `pnpm demo:*` toolkit is a real instance of this.)

**Why the UI layer, when the backend layer is faster: fidelity.** This is the whole point, so lead with it. Driving the real interface with Playwright is the *highest-fidelity* way to see and validate what a user actually experiences — a real browser runs all of your client code (hydration, reactive state and effects, client-side validation, real navigation) and receives *trusted* input events (an actual click at the element, real focus, real keystrokes), exactly as a human's browser does. If the button's own click handler is broken, only this layer catches it. It is a fidelity ladder: writing rows straight to the DB is fastest and lowest fidelity (skips the server entirely — fine for seeding, never for validating); the backend/HTTP layer runs the real server path but none of the client, so it proves the endpoint, not the experience; the UI layer is the only one that exercises the experience itself. So rank by what you are after — reach for the UI layer whenever fidelity is the point ("does this actually work for a user?", "a demo of the real thing"), and use the lower layers to set up state fast, then hand off to the UI for the part that matters.

The payoff: you say "run the grading flow and show me," and Claude drives the real app, reports the URLs it hit and a screenshot of the result, instead of you clicking through and it guessing. Build the layer that fits your stack; the value is the same, the human sees what the app did without doing the clicking.

### A durable driver: patterns from building one

The two-layer sketch above is the *shape*. These are the patterns that make a real UI-layer driver usable rather than painful, learned building one end to end (a `pnpm drive` harness that creates a class, builds an assignment from files, imports past work, and grades — as the actual signed-in human). Framed generally; the specifics are Playwright.

- **Persistent host, attachable stages — not launch-run-close.** The naive loop (launch a browser, run the flow, close it) is miserable to iterate on: the window pops up and vanishes, every run replays from the top, and any error kills the window before you can look. Instead run *one* persistent browser that stays open (`launchPersistentContext` with `--remote-debugging-port`), and have each run `connectOverCDP` to it, drive from wherever it currently is, and detach *without* closing it. The window becomes a place you keep, not a flash. Stash the CDP endpoint + base URL in a tiny session file so each stage follows the host without re-passing flags.
- **Drive the real account, not only a seeded persona.** The flow/backend layer runs as a fixture user; a driver that acts as the *actual* signed-in human is a different and valuable thing — it verifies the real experience and can produce a demo of real data. Keep the session in a persistent profile so it stays logged in between runs.
- **OAuth refuses an automated browser.** A CDP-controlled Chrome trips Google's "this browser or app may not be secure" and the OAuth flow dead-ends — by design, not worth fighting. The ways in: a password credential on the same account (mint one via the admin API, store it gitignored) or a persistent profile that is already signed in. Don't burn a cycle automating the OAuth screen.
- **Own your dev server; never borrow a live one.** A server already answering on a port belongs to another agent — attaching couples you to their lifecycle and their possibly-broken state. Boot your own, skip past occupied ports to a free one, and stop only the server you started. (The sharp edge behind "never trust 5173": several `pnpm dev` in one repo dir also clobber shared generated files like `.svelte-kit`, so a foreign server may be 500ing anyway.)
- **Make dispatched background work actually run.** A flow that fires an async job (a queue/worker like Inngest) will not *finish* under your driver unless a worker is processing that exact server — the run just sits pending. Bake the app's inline-execution flags (LawGrader's `GRADE_SYNC` / `PARSE_INLINE`) into the driver's own dev server so the real work runs in-process and the flow completes: self-contained, no separate runner to babysit.
- **Wait on the app's own "done" signal, never a sleep.** Async and LLM steps finish at unpredictable times; key each wait on the element that *only* appears when that work is done — a testid, a status pill, the row that renders after a fetch resolves. Corollary: a step's chrome rendering is not its data loading. Wait for the network-loaded rows to actually appear before reading them; reading a table mid-fetch silently returns zero.
- **Act as a user; do not reach behind the UI.** Click the visible affordance — the upload *door* plus `page.waitForEvent('filechooser')` — not the hidden `<input>`. `setInputFiles` on a concealed input proves nothing about whether the real control works, which is the whole point of driving the UI. And never click a *container* that overlaps real controls (a step card whose center sits over its buttons): the stray click fires an event no user would and can swallow the next real one. When a click fails, first suspect you are clicking the wrong thing, not the app.
- **Screenshot on every failure.** Capture the exact failing state to a file the instant a stage throws. It turns "the click timed out" into "oh — the server is 500ing / a modal is covering the button / I searched the wrong row" in one look; that is how the real causes get found in seconds instead of guessed at.
- **Idempotent, resumable stages.** Each stage checks the current state and skips work already done (class exists → open it; assignment drafted → skip the upload; rubric attached → skip the import). Re-running is then safe and cheap, and you never replay the whole loop to fix one step.
- **Recording is a one-shot, separate from the persistent host.** Because `recordVideo` finalizes only on context close (§1), an always-open host never writes a file. A clean demo/marketing clip needs its own throwaway run that opens, performs, and closes — then transcode the `.webm` to mp4 for sharing. Slow the actions down (Playwright `slowMo`) or it is too fast to watch.

## 4. Reliability gotchas when an agent drives the browser

Hard-won, from running the [crawlers](./CRAWLERS-SPEC.md) and the [ux-critique](../skills/ux-critique/SKILL.md) critic. Browser automation is flaky in specific, predictable ways; design around them instead of fighting them.

- **The first synthetic click often does not register.** A coordinate click can land before the element is interactive, so it highlights but does nothing; the second works. This silently eats sign-ins and nav clicks. The fix: do not click hopeful coordinates for load-bearing actions. Fill inputs by **element-reference**, then **submit the form via JS** (`form.requestSubmit()`), or click by a stable ref with a verify-and-retry. A real form-POST then redirect is solid once submitted; it is the coordinate click that is unreliable.
- **Distinguish a tool flake from a real app bug.** "First click did nothing, second worked" can be the automation flake above *or* a genuine app race (e.g. a realtime subscription firing an `invalidate()` that cancels an in-flight client-side navigation). Same symptom, different cause. Before filing it as a bug, check whether the failing target is on a page that even has the suspected mechanism, and reproduce by hand; do not let your own synthetic-click flakiness masquerade as a product bug.
- **A backgrounded tab freezes `requestAnimationFrame` and `ResizeObserver`.** When the automated tab is not the foreground tab, the browser throttles it: rAF and RO callbacks never fire, so anything that lays out or animates on them looks broken or empty. Pump a frame (take a screenshot, which forces a paint) before reading the DOM, and do not trust an "empty" measurement from a hidden tab.
- **Verify by reading URLs and the DOM in tool results, not by eyeballing pixels.** A screenshot tells you it *looks* right; the URL trail and DOM tell you it *is* right. Assert on those.

---

These pair naturally: the puppet-strings harness drives a flow, the screenshot/recording capability captures it, the reliability gotchas above keep the driving honest, and the port + verify-by-URL disciplines keep it all reliable across many concurrent agents.
