# Driving and capturing the app

Three related capabilities for seeing and showing what the running app actually does, without clicking through it by hand: high-fidelity screenshots, clean recorded walkthroughs, and driving the app programmatically. They build on two disciplines the rest of the kit already establishes, which is why they live here.

**The two disciplines they share:**

- **Own dev server on your assigned port.** Start your own (`pnpm dev --port <N> --strictPort`, backgrounded), read the real bound port from the log, and never trust `5173`: it is usually another session's, and concurrent HMR causes phantom failures. Kill only your own PID on cleanup. (This is the kit's `dev-port` hook in action.)
- **Verify by reading state, not pixels.** Confirm navigation and behavior by reading the URL / DOM / network in each tool result, not by eyeballing screenshots. The URL trail is what actually proves a flow worked or a bug exists.

## 1. High-fidelity screenshots

Drive the running app in a real browser and capture pixel-accurate screenshots of any screen or state. Useful for design review, before/after comparisons, video frames, docs, and confirming a change landed.

Two ways, pick by the job:

- **Playwright (headless Chromium)** for scripted, reproducible captures: `page.goto(url)` then `page.screenshot({ path, fullPage: true })`. Good for CI, batch captures across routes and viewports, and a repeatable "here is screen X" you can re-run. Playwright can also record **video** of a run (`recordVideo` on the browser context) and traces.
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

The payoff: you say "run the grading flow and show me," and Claude drives the real app, reports the URLs it hit and a screenshot of the result, instead of you clicking through and it guessing. Build the layer that fits your stack; the value is the same, the human sees what the app did without doing the clicking.

---

These pair naturally: the puppet-strings harness drives a flow, the screenshot/recording capability captures it, and the port + verify-by-URL disciplines keep both reliable across many concurrent agents.
