---
name: env-flags-are-for-what-stays
description: "Env vars hold what is meant to stay: kill switches, test stubs, configuration. Rollouts belong in release flags (per request, by audience, registered with an owner); entitlements share the mechanism but never the registry."
metadata:
  type: feedback
---

An env flag list that grows without limit is usually five kinds of thing mixed together, and
only three of them belong there.

**Why:** env vars are read at deploy, apply to everyone, and change only with a redeploy.
That is right for a kill switch that must work when the database does not, a test stub, or
a tuning value. It is wrong for a rollout, which needs per-request evaluation, audiences, a
change without a deploy, and an owner who removes it.

**How to apply:**
- Sort the env list into: **kill switches**, **test stubs**, **configuration** (keep), and
  **parked experiments** and **finished rollouts** (do not keep). A parked experiment is
  deleted or becomes a release flag with an owner; a finished rollout is removed.
- New features get a release flag, registered in code with an owner and a created date.
  Its env override (`FLAG_<KEY>=0`) is its kill switch while it lives.
- **Entitlements** (plan, license, contract) are permanent and billing-driven. Evaluate them
  with the same machinery if convenient, but keep a separate list, so the release-flag cap,
  cleanup task and removal skill never touch something a customer paid for.
- Kit: `docs/RELEASE-FLAGS-SPEC.md` R1, R39, R40. See [[deploy-is-not-release]].
