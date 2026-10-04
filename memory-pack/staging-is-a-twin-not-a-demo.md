---
name: staging-is-a-twin-not-a-demo
description: "Staging is only worth having if it is prod's twin: same build, same config, matched infrastructure, the team's own data, with every difference named on a short allowlist that a parity checker enforces. Anything else proves little."
metadata:
  type: feedback
---

A staging environment that drifts (other settings, a stale schema, seeded demo data, a
different region) turns every "it worked on staging" into a guess, and people stop opening
it. The fix is not more discipline; it is a checker.

**Why:** the only question staging answers is "will this behave the same in prod". Each
undeclared difference is a place that answer can be wrong. A real case: staging quietly
shared production's auth signing secret until the parity check flagged it.

**How to apply:**
- Same artifact and same config. Differences are a named allowlist, each with a reason
  (its own database and keys, its own auth secrets, the egress fence, its own job-queue
  environment). Everything else must match.
- A parity checker compares env names and hashed values (never print them), migration
  ledgers, database region and compute, host region, and auth hooks. Run it before every
  staging deploy and nightly; a drift stops the deploy.
- Fill it with a SLICE of prod: the team's own accounts and what they own, other people
  reduced to locked shells with placeholder emails. Real-shaped data, nobody else's.
- Fence everything outward (see [[fence-outward-writes-at-one-chokepoint]]) and give it a
  sandbox for the integrations (a sandbox LMS with mirrored courses).
- Deploys to it are deliberate (an rc tag), never automatic, so a demo build holds still.
- This is a different job from the disposable environment where agents fuzz with stubs on;
  keep both. Kit: `docs/STAGING-TWIN-SPEC.md`.
