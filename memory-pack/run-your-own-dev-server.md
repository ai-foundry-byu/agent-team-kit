---
name: run-your-own-dev-server
description: "Never trust the default dev port under parallel agents. Start your OWN server, read the real bound port, kill only your PID. Flaky 503/404/dead-clicks under concurrent HMR are environmental, not app bugs."
metadata:
  type: feedback
---

When several agents (or you + an agent) work one repo at once, a dev server is often already
listening on the default port that you did NOT start, plus its file-watching/HMR. Targeting
it produces **misattributed failures**: transient 503s on data requests, phantom 404s after a
redirect races a reload, dead clicks, and stale element references, all of which look
exactly like app bugs but are pure dev-environment noise that can't happen in production.

**Why:** assuming the default port is yours couples your verification to another session's
server, its state, and its reload storms. Two dev servers in one repo dir can also clobber
shared generated files, so a foreign server may be erroring anyway.

**How to apply:**
- Before browser-verifying, start your OWN server in the background (survives across turns).
  **Read the actual bound port from its startup log** ("Local: http://localhost:5174/") and
  target that; never hardcode the default. Force a fixed free port with a strict-port flag
  where the tool supports it (and beware arg-forwarding quirks like a literal `--` swallowing
  the flag).
- Kill ONLY the PID you started; never blanket-kill by process name: that destroys siblings'
  servers. Check what's live first (`lsof -iTCP:<range> -sTCP:LISTEN`).
- Point your E2E runner at your own port too (many default to the same shared port and reuse
  a running server); a spec run against a foreign server fails misleadingly.
- When you see flaky 503/404/dead-click symptoms on localhost, suspect the environment first:
  check for a competing server and reload bursts before chasing a code cause. Repeated
  exit-134/SIGABRT dev crashes are usually heap OOM from too many concurrent servers: grep
  the log for "heap out of memory" and raise the heap or shut a competing server.

This is the habit behind the kit's `dev-port` hook (see `hooks/scripts/dev-port.mjs` and
`docs/DRIVING-THE-APP.md`). See [[verify-proportional-to-risk]].
