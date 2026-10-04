---
name: fence-outward-writes-at-one-chokepoint
description: "In any non-prod environment holding real-shaped data, route every outbound call (LMS, email, storage providers, payments, webhooks) through one fence helper with a host and recipient allowlist, and keep an arch test that fails on any outbound fetch that bypasses it."
metadata:
  type: feedback
---

Copying prod data into staging is safe only if staging cannot reach the people in it. A
fence that lives in a dozen call sites is a fence with a dozen gaps; the next integration
someone adds will not know about it.

**Why:** the dangerous writes are the ones that leave the system: a grade posted to a real
course, an email to a real student, a token revoked at a real provider. Row-level security
and test accounts do nothing about them.

**How to apply:**
- One env flag turns the fence on (unset in prod, so the helper is a pass-through there).
  Allowlists for hosts (the sandbox LMS) and recipients (the team, test accounts).
- One helper every outbound fetch goes through (`fencedFetch(kind, url, init)`), plus a
  recipient partitioner for email. Auth emails sent by the identity provider go through the
  same rule via its send hook.
- An architecture test walks the source and fails on any outbound fetch that is neither
  fenced nor on an EXEMPT list with a written reason.
- Fenced is not failed: the UI says "fenced on staging" rather than an error with a retry,
  and health checks do not mark a fenced host as broken.
- The one sanctioned exception (e.g. staging bug reports forwarded into prod's queue) is a
  narrow endpoint with a shared secret, a team-membership check and a rate limit.
- A feature flag cannot replace this: a team member trying a flagged feature in prod is
  often also a real user with real recipients. See [[staging-is-a-twin-not-a-demo]].
