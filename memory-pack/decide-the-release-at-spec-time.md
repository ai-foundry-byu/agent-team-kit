---
name: decide-the-release-at-spec-time
description: "Decide how a feature reaches people (release flag, permanent kill switch, rehearse on staging, or no flag) when writing its spec, not at build or ship time, and report a flagged build as 'shipped dark' with its release step."
metadata:
  type: feedback
---

How a feature is released shapes its code: where the check sits, what the off path
returns, whose flags apply, whether a migration must stay readable by the old code. Decided
at build time, that shape already exists and the flag gets bolted on. Decided at ship time,
it is a retraction or a surprise.

**Why:** a mockup is too early (it shows how the feature looks, not how it reaches people);
build time is too late. And an agent that builds a flagged feature and reports "done" leaves
the owner believing it is live when it is off for everyone.

**How to apply:**
- The spec has a required Access and release section: kind and why, the flag key, the one seam the
  check goes in, whose flags apply (viewer or resource owner), the off path, the rollout.
  Unknown is an open question with a recommended answer, never a blank.
- A release flag brings three standard criteria: a browser check that a user WITHOUT the
  flag does not see it, a unit test that flag-off behaves exactly as before, and a structure
  check that every server action and load checks the flag on the server.
- Build with the flag forced on locally (the env override), never by setting a shared
  environment's audience; put the flag-off checks on the verification sheet.
- The build report says "shipped dark" and names the release step (who turns it on first,
  where). Kit: `skills/spec/TEMPLATE.md`, `skills/build-spec/`. See
  [[flag-or-staging-is-whose-data]] and [[branch-once-at-a-seam]].
