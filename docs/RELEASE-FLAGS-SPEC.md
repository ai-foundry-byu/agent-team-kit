# Release flags by audience, a build spec

A stack-agnostic specification for **shipping every commit to production switched off, then releasing it one audience at a time from an admin page, with no deploy.** The team sees a feature first, then named users, then a pilot tenant, then everyone. Turning it off again is a click, and a server setting turns it off for everyone whatever the page says.

This is a spec, not code. A coding agent can build it in any stack. It assumes **Postgres + Supabase** and a **server-rendered web framework** (SvelteKit in the reference build; Next, Rails, Django or Laravel work the same way) and gives the generic equivalent wherever that matters. It is grounded in one shipped build on a grading platform: a flag registry, an audience table behind row-level security, an admin page, owner-decided flags for background work, and the debt controls that keep flags from piling up. The lessons are at the end.

It pairs with [`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md) (how a commit reaches staging and production), [`STAGING-TWIN-SPEC.md`](./STAGING-TWIN-SPEC.md) (what a flag cannot make safe, and where that gets rehearsed instead), [`IMPERSONATION-SPEC.md`](./IMPERSONATION-SPEC.md) (whose flags a "view as" session sees) and [`FEEDBACK-LOOP-SPEC.md`](./FEEDBACK-LOOP-SPEC.md) (the bug queue the cleanup task lands in).

Requirements carry IDs (`R1`, `R2`, ...) so a test, a review or a bug can cite one.

---

## 1. What it is, in one paragraph

Deploying and releasing become two separate acts. **Deploying** puts code on the servers; it happens often, it is routine, and on its own it changes nothing anyone sees. **Releasing** decides who sees a feature; it happens on an admin page, one audience at a time, and takes effect within seconds. Because everything new ships dark, the main branch is always safe to deploy, an urgent fix never waits behind half-tested work, and a feature that misbehaves is turned off without a rollback.

---

## 2. What the best teams do, and what a small team takes from it

The pattern is old and well documented. Large engineering organizations work on one trunk in small pieces, merge unfinished work early behind a flag, release to employees first (dogfooding), then to widening rings of customers, and at scale send new code to a small slice of servers first and roll back automatically when error rates move (canaries). Database changes go in compatible steps (expand, migrate, contract) so a schema change never has to land at the same moment as the feature that needs it. Industry research on delivery performance keeps finding that small, frequent, trunk-based changes ship faster and break less.

A small team takes most of it and leaves some:

| Practice | Take it? | Why |
|---|---|---|
| Trunk, small commits, merge dark | Yes | It is the whole point. |
| Release by audience (rings) | Yes, as people and tenants | Team, then named users, then a pilot tenant, then everyone. |
| Percentage rollouts | No | A few hundred users is too few to measure a 1% slice. |
| Canary servers with metric rollback | No | One container, low traffic, nothing to compare against. |
| Expand-contract migrations | Yes | Migrations cannot be flagged (section 12). |
| A vendor flag service | No | A new runtime dependency that sends user ids to a third party, for five audience shapes. |

---

## 3. Vocabulary

| Term | Meaning |
|---|---|
| **Release flag** | A short-lived switch for one new feature, released by audience, removed when the feature is on for everyone. This spec is about these. |
| **Operational flag** | A long-lived kill switch or experiment (`GRADER_RETRIES=0`). Stays an environment variable. Not this system. |
| **Registry** | The list of release flags, in code. |
| **Audience** | Who a flag is on for: Team, named users, tenants, Everyone. Stored in the database. |
| **Subject** | Who a flag is evaluated for: the viewer, or a resource's owner. |
| **Team** | The people who build the product, all of their accounts. One shared definition. |
| **Override** | A per-flag environment variable that beats the table: `FLAG_<KEY>=0` or `=1`. |

**R1. Release flags and operational flags are different kinds, and only release flags live in the table.** An operational kill switch must work when the database does not, so it stays an environment variable. Do not migrate existing env flags into this system.

**R39. Env vars are for what is meant to stay.** A long, growing list of env flags is usually five kinds mixed together:

| Kind | Example | Belongs in |
|---|---|---|
| Kill switch | `GRADER_RETRIES=0` turns a sweep off | env |
| Test stub | `LLM_STUB=1` returns canned output | env |
| Configuration | `REAPER_INTERVAL_MS=180000` | env |
| Parked experiment | built, measured, never turned on | decide: delete it, or make it a release flag with an owner |
| Finished rollout | default-on for months, nobody turns it off | remove it (the release is over) |

Only the first three belong in env. Audit the list for the last two when it passes a dozen or so entries.

**R40. Release flags and entitlements share the mechanism, never the registry.** An entitlement (a feature that depends on a plan, a license or a contract) is permanent and driven by billing; a release flag is temporary and driven by a rollout. Evaluate both with the same machinery if you like, but keep separate lists, so the cap, the cleanup task and `/remove-flag` never touch something a customer paid for.

---

## 4. Audiences

**R2. Five audiences, in widening order: Off, Team, named users, tenants, Everyone.** A flag's audience is the union of the parts that are set. A subject matching any part is in.

**R3. No rule engine, no percentages.** Attribute operators (`plan == "pro" and seats > 50`) become their own bug surface, and percentages need traffic a small product does not have. If a real need for a new audience shape appears, add one column, not a language.

**R4. Team is one shared definition.** "The team" for flags is the same set the staging copy uses ([`STAGING-TWIN-SPEC.md`](./STAGING-TWIN-SPEC.md)): every platform admin, plus every other account carrying the same full name as one of them, plus accounts granted an explicit `team_member` permission (for a test account under another name). One function computes it, both systems call it, and an architecture test fails if a second definition appears. Team is not "super admins": the people building the product hold several accounts each, and most of those are not admins.

**R5. Everyone includes signed-out requests; nothing narrower does.** A marketing page or a sign-in screen can be released to Everyone, and only to Everyone.

---

## 5. Where flags are defined and stored

**R6. The registry in code is the list of flags.** One file declares every flag: key, display name, one-line description, owner, created date. Keys are a typed union, so a typo does not compile and removing a flag makes the compiler name every place still using it.

**R7. The table holds only audiences. A flag with no row is Off.** Shipping code can never release anything by itself, because a new key has no row until someone sets one. A row whose key is no longer in the registry is an **orphan**: it does nothing and the admin page offers to delete it.

```
feature_flags (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  everyone    boolean not null default false,
  team        boolean not null default false,
  user_ids    uuid[]  not null default '{}',
  tenant_ids  uuid[]  not null default '{}',
  updated_at  timestamptz not null default now(),   -- stamped by trigger
  updated_by  uuid references users on delete set null  -- stamped by trigger
)

feature_flag_events (          -- append-only history
  id      bigint generated always as identity primary key,
  key     text not null,
  actor   uuid references users on delete set null,
  at      timestamptz not null default now(),
  before  jsonb,               -- null on insert
  after   jsonb                -- null on delete
)
```

**R8. Row-level security: super admins only, both tables.** Select, insert, update and delete on `feature_flags` require `is_super_admin()`. `feature_flag_events` has a select policy for super admins and **no** insert, update or delete policy at all. Revoke both tables from the anonymous role outright. Who is in a pilot is not something an ordinary user may read.

**R9. History is written only by a trigger.** A `BEFORE` trigger stamps `updated_at` and `updated_by = auth.uid()` (never trusted from the client). An `AFTER` trigger, `SECURITY DEFINER`, appends one event per row change with the before and after audience. Because no caller has an insert policy on the history table, a history row cannot be forged or edited, not even by a super admin.

**R10. Probe the policies in both directions before production.** A tracked script runs, each block in a rolled-back transaction: the anonymous role refused for read and write; a teacher and a tenant admin read zero rows and every write refused; a super admin writes, reads, and gets exactly one history row per change; nobody inserts history directly; a malformed key fails its check; the service role reads. Run it on a local or staging database, then on production. A guard verified only against attack is half verified.

---

## 6. Evaluation

**R11. One pure function decides.** `flagOn(row, subject, override) -> boolean`, with `subject = { userId | null, onTeam, tenantId | null }`. No database, no environment, no framework inside it. Every rule in sections 4 and 7 is a unit test over this function.

**R12. Evaluated once per request, after the impersonation swap.** The request hook builds the subject from whoever the request is now **for**: during a "view as" session, that is the target ([`IMPERSONATION-SPEC.md`](./IMPERSONATION-SPEC.md)). The target's tenant comes from the target's own claims, never from a request-level field that still describes the admin. An admin checking a teacher's view must see the teacher's flags, or every preview of a dark feature lies.

**R13. Resource-scoped surfaces and background work decide by the owner.** A class page, a document, a project: evaluate on the resource's **owner**, so the owner, a co-teacher, an assistant and the resource's end users all see the same product there. Background work (reapers, queue workers, webhooks, scheduled jobs) has no viewer at all, so it can only ask the owner. Expose `flagOnFor(key, ownerId, memo)`; the memo is one per request or per background run, so evaluating fifty items owned by one person costs one owner lookup. A missing owner is evaluated as signed out (Everyone only).

**R14. The override beats the table.** `FLAG_<KEY>=0` turns the flag off for everyone, `=1` turns it on for everyone, any other value means the table decides. Only the exact strings count. The override is the kill switch during an incident, and the way tests and local development force a path.

**R15. Off is byte-identical.** With a flag off for a subject, the page, the prompt, the email and the response are exactly what they were before the feature existed. This is what makes a flag a clean switch and a safe kill switch, and it is tested per feature (a golden snapshot, a markup assertion).

---

## 7. Gating

**R16. Gate on the server, always.** Every flagged load and action checks the flag server-side. A helper `requireFlag(locals, key)` answers **404** when off, so a dark feature is not reachable by its URL and its endpoints do not exist for the wrong people. A flag that only hides a button is not a gate: the action behind the button still works for anyone who sends the request.

**R17. The client receives answers, never the audience.** The page gets `{ key: boolean }` for its subject and nothing else. User ids, tenant ids and the table rows never reach the browser. One test asserts the layout's output shape.

**R18. A debugging marker is fine.** Rendering the viewer's ON keys as an attribute (`<body data-flags="key_a key_b">`) costs nothing, helps support, and gives a browser check something to read. Absent when nothing is on, so pages stay byte-identical.

---

## 8. Reading the table fast and safely

**R19. In-process cache, stale-while-revalidate.** Read every row plus the team set into memory, keep it for about 15 seconds, and after the first load **never make a request wait**: a stale state is returned at once while one refresh runs. A change on the admin page reaches every request within the window, without a deploy. This assumes long-running server processes; on serverless, use a short-TTL shared cache instead.

**R20. The read uses the service client, with the reason at the call site.** Every request evaluates flags, but no ordinary user may read the audience rows (R8). That is the textbook case for the privileged client: read-only, one place, a comment saying why, and an entry in the import-boundary allowlist.

**R21. A failed read keeps the last good state.** If the database is unreachable, keep serving the last state you had and back off for one window. With no state at all, everything is Off, which is the byte-identical path. A flag system must never be the reason a page fails.

**R22. Invalidate on the writer's own change.** After an admin write, drop the cache so the admin's next request sees what they just did. Everyone else catches up within the window.

---

## 9. The admin page

**R23. One page, super admins only, gated twice.** The route sits in the company-only route group (signed in, admin, second factor, company staff), and the load and every action also call the super-admin check. A tenant admin who may enter the admin area gets a 403 here, and the nav entry is absent for them.

**R24. One row per registered flag.** Name, key, description, who added it and when, an audience summary ("Team, 2 teachers, 1 school"), and a status chip: **Off**, **Team**, **Pilot** (anything narrower than Everyone that is more than the team alone), **Everyone**. A counter shows flags in use against the cap (R31).

**R25. The audience editor writes on the caller's own client.** Team and Everyone are checkboxes that save on click; named users are added by search and removed from a pill; tenants are added from a picker. Each action validates its body against a schema and writes through the caller's RLS-bound client, so the database decides. **A write that RLS refuses comes back as zero rows, not an error; treat zero rows as a 403**, or a refused write reports success and does nothing.

**R26. Directory reads use the service client.** A flag can target any user or tenant in the company, but an admin's own RLS usually shows only the people and tenants they are related to. In the reference build a super admin could see 56 of about 2,000 profiles and one school. The search, the picker and history names therefore read through a small, read-only, allowlisted module on the service client. The flag rows themselves stay on the caller's client (R25).

**R27. History in plain words.** The last few events per flag, as sentences built from before and after: "turned on Team", "added Northside High", "removed a teacher", "turned on Everyone". A pure, tested function writes them.

**R28. The page tells the truth about overrides and orphans.** When `FLAG_<KEY>` is set, the row says so, names the variable, and greys out its controls. A row with no flag in the code shows "Removed from code" with a Delete button; Delete refuses any key still in the registry.

---

## 10. Flag debt

Every release flag is two code paths, one of which nobody runs once the feature is on for everyone. Passive reminders do not work; these do.

**R29. The removal clock starts when the flag reaches Everyone.** A remove-by date chosen when the flag is created is a guess made before anyone knows when the feature will ship. The history already records when a flag reached Everyone; a pure function reads it, and a flag that has been on for Everyone for **14 days** with no flip away is **Ready to remove**. Flipping it back restarts the clock.

**R30. Reaching Everyone files one cleanup task in the bug queue.** "Remove flag `<key>`", due 14 days out, who released it, and one question: does this feature need a permanent off switch? It lands where work is already picked up ([`FEEDBACK-LOOP-SPEC.md`](./FEEDBACK-LOOP-SPEC.md)), tagged as automation rather than a person's report. **Idempotent:** no second task while one for that flag is open. Filing never throws; a failure must not undo the release the admin just made.

**R31. A cap, enforced by a test.** At most N release flags at once (10 in the reference build). An architecture test fails on the N+1th, so the person adding a flag removes an old one first. Raising N is a deliberate edit with a reason. A date that fails the build was rejected: it breaks unrelated ships on a calendar day, while the cap blocks only the person adding a flag, which is exactly when cleanup belongs.

**R32. Every flag is named in server code.** An architecture test fails if a registered key appears in no server file, so no flag can exist only as a hidden button. "Server file" means route server files, the server library directory, **and any route helper that imports server-only modules** (Lesson L3).

**R33. A remove-flag skill.** One command: confirm the flag is ready (stop if it is still dark or partial, since removal would release it to everyone), ask the permanent-kill-switch question, delete the registry entry, let the compiler list every call site, keep the ON branch and delete the OFF branch at each, delete tests that pinned the off behavior, delete the row **after** the change deploys (deleting it first turns the feature off for everyone until the deploy lands), close the cleanup task, one commit.

**R34. The release report lists flags.** The ship step prints dark, partial, on for everyone, and ready to remove. Shipping code releases nothing behind a flag, so this is how the person shipping knows what users actually got.

---

## 11. Removal and permanent kill switches

**R35. Removing a release flag removes its kill switch, so decide whether one should stay.** Removing it means turning the feature off later costs a revert plus a release. Keep a permanent kill switch where the feature can **fail without erroring** (it produces wrong output, so nothing triggers its fallback) and its output feeds something that matters (a grade, a payment, a message), or where it writes to the outside world. The cleanup task asks. If yes, convert the check into an operational environment flag (section 3) and document it with the others; then remove the release flag as usual.

**R41. Read what each environment actually sets before removing.** Read the deployed configuration of every environment (production, staging, CI, the disposable one), not the docs: docs drift from what is deployed. A flag forced off somewhere is a reason to stop and ask.

**R42. Remove by substitution, then delete only what became unreachable.** Replace each check with its current value (`true`), let the code simplify, and delete only branches that can no longer run. Do not change function signatures in the same commit.

**R43. Find every caller of an optional flag parameter first.** The trap: a function takes `{ withFeature?: boolean }`, and leaving it out means off. A caller that never passed it is running the OFF path in production right now, while the flag reads "on for everyone". Deleting the off branch silently changes that caller. List every call site and what it passes before deleting anything.

**R44. Check what the protecting tests cover, and what turns the flag off on purpose.** A snapshot test of the main path says nothing about secondary callers. And look for tests or harness configuration that set the flag off deliberately (an end-to-end config that disables a feature for isolation): that flag has quietly become test infrastructure, and removing it changes what those tests exercise.

---

## 12. Migrations are not flagged

**R36. A flagged feature's schema change follows expand-contract.** Migrations run for everyone the moment they apply. So: add the column or table (expand), write both shapes, backfill, switch reads behind the flag, and drop the old shape only after the flag is removed (contract). Every step must be safe for the flag-off code. A destructive migration waits until its feature is fully released.

---

## 13. Which tool for which risk

**R37. Staging copies the audiences.** The staging refresh copies `feature_flags` as reference data, so staging releases what production releases, and never copies the history. A change made on staging lasts until the next refresh.

**R38. Pick the tool by the risk: who, where, and what.** A release flag controls WHO the code runs for. It does not control WHAT the code does, and turning it off undoes nothing already written. The staging twin, with its egress fence, controls WHERE the effects land. So:

- **Deploy-time changes reach everyone before any flag is checked.** Migrations, containers, workers, dependency upgrades, and shared code edited on the way in. Rehearse the build on staging and promote that exact build ([`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md)).
- **For per-request changes, ask three questions about the FIRST audience:** what is the worst case, whose data does it land on, and can it be undone? If it lands on the team's own data, or it is reversible, a flag is enough. If it is irreversible and lands outside the team (a real student's inbox, a live gradebook, a payment), rehearse on the fenced twin first ([`STAGING-TWIN-SPEC.md`](./STAGING-TWIN-SPEC.md)). "Writes to an outside system" is not by itself a staging rule: it depends on whose data the first audience reaches. A team member who is also a real teacher makes Team an audience that reaches real students.
- **Pure refactors (renames, moves, extractions) get tests, not flags.** There is nothing to release.

The spec template's Access and release section asks these questions at spec time ([`../skills/spec/TEMPLATE.md`](../skills/spec/TEMPLATE.md)).

---

## 14. Who sees what: a release flag is one of six levers

A release flag is the right tool for one question only: "is this new code on for you yet?" Apps differ per person for other reasons, and each has its own lever. Most mistakes here are the right idea in the wrong lever: a role kept in a flag table, a paid tier kept as a rollout, a rollout kept forever as an env var.

| Lever | Answers | Lifetime | Who changes it | Lives in |
|---|---|---|---|---|
| **Release flag** | Is the new code on for you yet? | Weeks, then deleted | You, during rollout | The flag registry + table (this spec) |
| **Kill switch** | Is this safe to run right now? | Permanent | Ops, in an incident | An env var |
| **Experiment** | Which variant are you in? | Until measured | Product | An experiment framework, not this table |
| **Role / relationship** | Who are you to this data? (a member of this class, staff at this tenant, an alum) | Permanent, per person | The relationship itself (enrolment, employment) | Relationship tables + access policies (row-level security) |
| **Entitlement / enablement** | Does your organisation have this? Entitlement: they bought it (plan, license, contract). Enablement: they switched it on (a tenant setting). | Permanent, per tenant | Billing, a contract, or a tenant admin | The tenant's row: its plan's features, its license, its settings |
| **Preference** | How do you like it? | Permanent, per person | The user | A per-user settings row |

**R49. Pick the lever with the first yes.** Ask in order: (1) does it go away when a rollout ends? release flag; (2) is it for switching off in an incident? kill switch; (3) does it depend on the person's relationship to the data? role / relationship; (4) does it depend on what their organisation bought or turned on? entitlement or enablement; (5) does the user choose it? preference. **Tiebreak between 1 and 4: will some customer permanently get "no", on purpose?** Then it is an entitlement and the check stays forever; a release flag's answer ends as "yes for everyone", so its check is deleted.

**R50. Code holds the question, data holds the answer.** For every lever except a kill switch, the check is written once in code ("does this teacher's plan include AI scoring?") and the answer lives in rows (their subscription's plan, their tenant's license). Moving a customer between tiers, changing what a tier includes, or enrolling a student is a data change, never a deploy. The difference between an entitlement and a release flag is only whether the question itself is permanent.

**R51. Roles and relationships are enforced by the database.** The levers, in a Postgres + Supabase stack: relationship tables (`memberships`, `class_members`); small `SECURITY DEFINER` helpers (`is_class_teacher(class_id)`, `is_tenant_admin(tenant_id)`, `has_permission('x')`) that keep policies short; row-level security policies built from those helpers on every table; a permission catalog plus per-person grants for anything finer than a role; a route policy table that decides which areas a role may enter at all; and the role copied into the session token for cheap routing reads (a convenience, never the guard). A server action that must bypass row-level security re-checks with the same helper.

**R52. The UI reads one capability function.** `can(viewer, "capability")` combines role, entitlement or enablement, release flag and preference into one answer, and components ask it, never "is this faculty" or "is flag X on". When a rule changes (supporters now get exports too), it changes in one place. The database still enforces data access underneath: `can()` decides what to show, the policies decide what can be read or written. Each persona (student, faculty, alumni, client) usually gets its own home and navigation built from shared components, rather than one page full of role checks; people with two roles need an explicit rule (a switcher, or the union) decided in the spec.

**R53. Keep the lists apart.** Release flags, entitlements and roles never share a registry: the release-flag cap, cleanup task and removal skill exist to delete checks, and must never reach one a customer paid for or one that defines who someone is. A release flag may TARGET a role ("alumni first") or a tenant ("this pilot school"); that is an audience, not storage.

**Worked example: gating AI grading by plan.** A grading app lets teachers grade manually, with AI scores, or with AI scores and feedback, and the business wants free plans held to manual.

- *Lever:* entitlement (some customers permanently get "no").
- *Code, once:* each plan row gains a feature list (`{ ai_score, ai_feedback }`); one server function `entitlementsFor(user)` reads the teacher's plan and their school's license (a school deal beats a personal plan); the dial shows unavailable modes locked with an upgrade note; the server actions that start AI grading cut the requested modes down to what is allowed; background grading uses the PAPER OWNER's entitlements, since it has no viewer; tests in both directions, including a hand-crafted request from a free plan.
- *Data, forever after:* an upgrade is the billing webhook changing the subscription's plan; "Standard now includes feedback" is an edit to Standard's row; a school deal is a license row. No deploys.
- *Shipping it:* existing free users can use AI scoring today, so the gating code ships dark behind a release flag (`plan_gating`), is checked on the team, existing customers are grandfathered by a data change, then the flag opens to everyone and is removed. The entitlement check stays; the flag only made the rollout safe.

---

## 15. Writing flagged code

**R45. Branch once, at a seam.** Put the check in one place (a load, an action, a component boundary) and let everything below it be ordinary code. A flag scattered through a function cannot be reasoned about, tested in both states, or removed cleanly. If the code has no seam where the feature can be switched, creating one is the first item of the build.

**R46. Additive features return null or empty when off.** The off path then needs no change at all, which is what makes "off is byte-identical" cheap to keep true and easy to test.

**R47. Keep every check a plain `if (flag) ... else ...` on the flag itself.** Do not pass the flag's value around in other variables or derived booleans (`const showX = flag && hasY`): each copy is a place removal can miss, and removal by substitution (R42) depends on seeing the flag at every decision.

**R48. Data must be readable by both paths.** A flag cannot undo a write. Anything the on path writes, the off path must still read correctly, because the flag can be turned off at any moment with that data already there. This is the same constraint expand-contract puts on migrations (R36).

---

## 16. Build checklist

1. The registry: typed keys, name, description, owner, created date, and a registry test that every entry is complete (R6).
2. The pure evaluator and override parser, unit-tested for every audience rule, both directions (R2, R3, R5, R11, R14).
3. The ready-to-remove function over event history (R29).
4. Migration: both tables, RLS, both triggers, revokes. Exact SQL reviewed by a human before it runs anywhere; probe script run on staging, then production (R7 to R10).
5. The one team definition, shared with the staging copy, and its architecture test (R4).
6. The server store: service-client read with the reason, 15-second stale-while-revalidate cache, keep-last-state on failure, invalidate on write (R19 to R22).
7. The request hook: subject built after the impersonation swap; `locals.flags`; the root layout passes booleans only; the body marker (R12, R17, R18).
8. Owner evaluation: `flagOnFor` with a memo, `ownerFlags` for resource layouts (R13).
9. `requireFlag` returning 404 (R16).
10. The admin page: rows, chips, editor on the caller's client with zero-row-is-403, directory module on the service client, history sentences, override lock, orphans, nav entry, route registration (R23 to R28).
11. The cleanup task filer, idempotent and non-throwing (R30).
12. Architecture tests: the cap, server reference, one team definition (R4, R31, R32).
13. The report script and its line in the ship step; the remove-flag skill (R33, R34).
14. The staging copy lists the audience table as reference data and the history as never-copy (R37).
15. A probe flag with its own tiny page, for checking targeting by hand (Lesson L5).

## 17. Test checklist

**Evaluation**
- No row: off for everyone, including the team.
- Team: on for every team account, including ones that are not admins; off for everyone else.
- A tenant turns it on for that tenant's users and no one else; a named user turns it on for that person only.
- Everyone: on for signed-out requests; nothing narrower is.
- `FLAG_<KEY>=0` beats Everyone; `=1` beats no row; `true` is ignored.

**Subject**
- Viewing as a user outside the audience shows the flag off, and the marker absent.
- On a resource page, an assistant outside the pilot gets the flag when the owner is in it; an assistant inside the pilot does not get it on a resource owned by someone outside.
- Twenty items of one owner cost one owner lookup and one table read.

**Gating**
- With the flag off, the flagged route is a 404 and the flagged action refuses, for a hand-crafted request too.
- With the flag off, the surface is byte-identical to before the feature.
- The layout's output contains booleans only, no ids.

**Security**
- The probe script, both directions (R10).
- A tenant admin gets a 403 on the admin page and has no nav entry.

**Admin page**
- A change shows for the next request of the writer at once, and for everyone within the cache window.
- History reads in plain words and names the actor.
- Search finds a user the admin has no relationship with.
- An override greys out its row; an orphan offers Delete; Delete refuses a registered key.

**Debt**
- Fourteen days on Everyone reads Ready to remove; thirteen does not; flipping back restarts.
- Reaching Everyone files one task; reaching it again with the task open files none.
- An N+1th flag fails the cap test; a flag named nowhere on the server fails its test.

**Removal** (run before `/remove-flag` deletes anything)
- Every environment's deployed value for `FLAG_<KEY>` is known, from the deployed config, not the docs.
- Every caller of any optional flag parameter is listed with what it passes; none relies on "left out means off".
- No test or harness config sets the flag off on purpose; if one does, it is rewritten first.
- With the flag on, data written by the on path still reads correctly with the flag off (R48), checked before the flag ever reached Everyone.

---

## 18. Lessons from the build

- **L1. Flagging a shipped feature retracts it.** The first real flag went on a feature that had already shipped to every user that morning, which the person adding the flag believed was still unreleased. A flag with no row is Off, so the deploy would have taken the feature away from everyone. Before choosing a flag's first audience, check whether the feature is already live and whether anyone has used it (a count of its rows is enough), and **set the audience before the deploy lands**, so there is no window where nobody has it.
- **L2. Release notes and help text follow the flag.** The release notes had already announced the feature and the help center described it. Narrowing the audience meant removing both in the same release, and noting in the commit where to restore the help text when the flag reaches Everyone.
- **L3. Route helpers are server code too.** The server-reference test first counted only route server files and the server library, and failed on the first real flag, whose check lived in a helper beside the page. The rule it learned: a route file that imports server-only modules is server code, because the framework refuses to bundle it for the browser.
- **L4. Admin RLS is not the directory.** The first version of the admin search, picker and history names read people and tenants through the admin's own client. RLS showed 56 of about 2,000 profiles and one school, with no error, so "add a pilot teacher" would have offered almost nobody. A company-wide picker needs the service client; the audience writes still do not.
- **L5. Give the probe flag a page.** A flag that gates nothing cannot be checked by hand, and the server-reference test had nothing to find. A tiny page that renders "the probe flag is on for you" and is a 404 for everyone else makes every targeting rule checkable in a browser, and gives the guard its first real reference.
- **L6. Watch the guard fail before trusting it.** The server-reference test passed only after the probe page existed; before that it failed, which is the evidence it guards anything. A guard that has only ever been green has not been shown to work.
- **L7. Evaluate after the swap, from the target's own claims.** The request carried two descriptions of identity during impersonation, and the convenient field for the tenant still described the admin. Building the subject from the target's own claims is what makes a preview of a dark feature honest.
- **L8. Zero rows is a refusal.** An RLS-refused update returns success with nothing changed. Every admin write checks that a row came back and reports 403 when none did.
