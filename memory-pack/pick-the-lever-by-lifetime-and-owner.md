---
name: pick-the-lever-by-lifetime-and-owner
description: "When something should differ per person or organisation, choose the lever by how long it lasts and who changes it: release flag, kill switch, role/relationship, entitlement/enablement, or preference. Never keep a role or a paid tier in a release flag."
metadata:
  type: feedback
---

"Faculty should see X", "free plans can't use Y" and "roll Z out to the pilot school" all
look like flags, and only the last one is. Putting the others in the flag table means
authorization or billing rules live in something designed to be deleted.

**Why:** each lever has a different lifetime and owner, so it needs a different home. A
release flag lasts weeks and you change it. A role lasts as long as the relationship
(enrolment, employment) and is enforced by the database. An entitlement lasts as long as the
customer's deal and billing changes it. A preference is the user's. Mixing them puts the
release-flag cap and removal skill one step away from deleting someone's access or a paid
feature.

**How to apply:** take the first yes:
1. Goes away when a rollout ends? **Release flag.**
2. For switching off in an incident? **Kill switch** (env).
3. Depends on the person's relationship to the data (class, tenant, own records)?
   **Role / relationship**: an access policy built from a small helper, on the database.
4. Depends on what the organisation bought or switched on? **Entitlement** (plan, license)
   or **enablement** (tenant setting), on the tenant's row.
5. The user chooses it? **Preference.**

Tiebreak: will some customer PERMANENTLY get "no", on purpose? Then it is an entitlement,
and its check stays forever. In every case the code holds the question and the rows hold
the answer, so moving someone between tiers or roles is a data change, not a deploy. UI reads
one capability function (`can(viewer, "x")`); the database still enforces data access. Decide
it in the spec's Access and release section ([[decide-the-release-at-spec-time]]). Kit:
`docs/RELEASE-FLAGS-SPEC.md` section 14. See [[env-flags-are-for-what-stays]].
