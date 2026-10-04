# The staging twin, a build spec

A stack-agnostic specification for a **staging environment that is a faithful twin of production**: the same build, the same configuration, the same infrastructure, and a copy of the team's own corner of the production data, with exactly one deliberate difference in behavior. Nothing that happens on the twin reaches a real person. The team signs in as themselves, sees what they see on production, and rehearses a release (a migration, an LMS write, an email, a sign-in change) before a single customer gets it.

This is a spec, not code. A coding agent can build it in any stack. It assumes **Postgres + Supabase** as the reference (a second Supabase project for staging, Supabase Auth, Supabase Storage) and a container host with per-environment variables (the reference is Railway), and gives the generic equivalent wherever that matters. It is grounded in one shipped build in a grading platform with an LMS integration (Canvas), an email sender, an in-app bug loop and several background sweeps. The lessons are at the end.

It pairs with:

- [`DISPOSABLE-ENVIRONMENT.md`](./DISPOSABLE-ENVIRONMENT.md): where **agents** drive. The twin is where **humans** rehearse. Section 2 draws the line.
- [`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md): how a build reaches the twin (a release-candidate tag) and how the exact build the team tried is promoted to production.
- [`RELEASE-FLAGS-SPEC.md`](./RELEASE-FLAGS-SPEC.md): what a flag can make safe in production, and what it cannot (anything that writes to the outside world). The second category is the twin's job.
- [`FEEDBACK-LOOP-SPEC.md`](./FEEDBACK-LOOP-SPEC.md): a bug reported on the twin lands in production's inbox (section 11).
- [`IMPERSONATION-SPEC.md`](./IMPERSONATION-SPEC.md): "view as" works on the twin exactly as on production, against copied people.

Requirements carry IDs (`R1`, `R2`, ...) so a test, a review or a bug can cite one.

---

## 1. What it is, in one paragraph

Staging used to be a separate demo world: seeded accounts, invented classes, settings that drifted from production week by week. A test there proved little, because when it passed nobody could say whether production would behave the same way. The twin replaces that. It runs production's exact build and configuration, checked by a parity tool that fails on any difference not on a short named list. Its data is a slice of production: every account belonging to the testing team and everything those accounts own, with every other person reduced to a locked shell. Its one behavioral difference is an **egress fence**: email reaches only the team and test addresses, and LMS writes reach only a sandbox LMS instance the team controls, where the team's real courses are mirrored. Deploys to it are deliberate, never automatic.

---

## 2. Vocabulary, and where the twin sits

| Term | Meaning |
|---|---|
| **Twin** | The staging environment this spec builds. Its own database project, its own host environment, production's code and settings. |
| **The team** | The small set of accounts allowed to exist as real, sign-in-able people on the twin (section 6). |
| **Slice** | The rows copied from production: the team's accounts, what they own, and what integrity requires. |
| **Shell** | A copied person who is not on the team: enough of a profile for names to render, and no way to sign in. |
| **Fence** | The one function every outbound write and read passes through. A pass-through in production; an allowlist on the twin. |
| **Sandbox LMS** | An LMS instance the team owns (e.g. `sandbox.instructure.com`), where the twin's LMS writes are allowed to land. |
| **Mirror** | A course rebuilt in the sandbox LMS from the twin's copy of a production class. |
| **Parity check** | The tool that compares the two environments and fails on unlisted differences. |

**The twin is not the disposable environment.** They answer different questions and you want both:

| | Disposable environment | Staging twin |
|---|---|---|
| Who drives | agents: crawlers, sweeps, the critic | people: the team, a pilot teacher, a demo audience |
| Data | seeded, wiped freely | a slice of production, refreshed on a schedule |
| Stubs | on for cheap sweeps, off for fidelity | always off: real behavior |
| Fuzzers allowed | yes, always | no |
| Its job | find crashes and confusion cheaply | rehearse a release, demo on real-shaped data |
| Deploys | whatever the agents need | deliberate, by tag only (R4) |

**R1. Never point a fuzzer at the twin.** It holds real student writing and real names. The disposable environment's seatbelt (issuer-abort, prod-refusal) treats the twin's project ref as production.

---

## 3. The one rule

**R2. The twin differs from production only by a short, named list, and every entry on the list carries a reason.**

Same build. Same environment variables, by name and by value. Same migration ledger. Same database region and compute size. Same host region. Same auth configuration. The differences are written down in one file, each with a sentence saying why:

```
ALLOWED_DIFFERENT = {
  DATABASE_URL:          "each environment's own database",
  SUPABASE_URL:          "each environment's own project",
  SERVICE_ROLE_KEY:      "each project's own key",
  AUTH_JWT_SECRET:       "each project's own signing secret",
  LMS_TOKEN_ENC_KEY:     "tokens are encrypted per environment",
  JOB_QUEUE_EVENT_KEY:   "own job-queue environment",
  JOB_QUEUE_SIGNING_KEY: "own job-queue environment",
  PUBLIC_APP_URL:        "each environment's own host",
}
STAGING_ONLY = {
  STAGING_EGRESS:        "the fence switch (R13)",
  STAGING_EGRESS_HOSTS:  "the fence's host allowlist",
  STAGING_EGRESS_EMAILS: "the fence's email allowlist",
  PROD_BUG_FORWARD_URL:  "where staging forwards bug reports (R29)",
}
```

Everything not on these lists must be equal. A variable that exists on one side only is a difference. A value that differs is a difference. That list is the contract; a reviewer reads it to know exactly how far a test on the twin can be trusted.

**R3. Shared and separate resources are a decision, written down.** The reference build chose:

- **Separate:** the database, the storage bucket, the auth signing secret, the token-encryption key, the job-queue environment. Sharing any of these lets the twin read or act on production state.
- **Shared:** the AI provider keys. Grading on the twin must be real grading, and the cost is one shared rate limit. Say so in the list's comment.

**R4. Deploys to the twin are deliberate.** Nothing reaches it except a release-candidate tag (`v<next>-rc<n>`, see [`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md)) or the stage command that pushes one. A build that changes under whoever is demoing is worse than no staging at all; an automatic deploy-on-push is how a staging environment gets abandoned.

---

## 4. The parity check

**R5. One script compares the two environments and exits 0 (match), 1 (drift, each difference named) or 2 (could not run).** It checks:

1. **Environment variables**, by name and by a hash of the value. Never print a value. Report `NAME: differs`, `NAME: set on staging only`, `NAME: set on production only`.
2. **Migration ledgers**: the list of applied migration versions on each database. Report the versions on one side only.
3. **Database infrastructure**: region and compute tier of each project, through the provider's management API.
4. **Host infrastructure**: region (and plan, if the host exposes it) of each service.
5. **The auth email hook**: the twin's auth provider must send its mail through the **twin's** hook URL, never production's (R16).

**R6. Exit 2 is not a pass.** Missing credentials, an unlinked host CLI or an API outage report "could not run" and say why. A caller that treats 2 as 0 has turned the check off.

**R7. The check runs in three places:** the stage command (after migrating the twin, before tagging, and a failure stops the deploy); the end of every data refresh; and nightly. The pure comparison (two maps in, a list of differences out) lives in a library with unit tests in both directions: an allowed difference passes, an unlisted one fails, a staging-only name outside `STAGING_ONLY` fails.

---

## 5. The data: a slice, not a dump

The team's slice gives the same fidelity for the people testing, at a fraction of the size, without every other customer's data. The planner decides which rows come over by walking foreign keys from the team's accounts. Its rules are the heart of this spec, because each one exists to stop a specific leak.

**R8. The walk rules.**

1. **Seeds:** the team's account ids (section 6).
2. **Down from a person only along ownership links.** A person owns a row when the link means "belongs to": `owner_user_id`, `teacher_id`, `profile_id`, `author_user_id`, and `user_id` only on tables that are genuinely personal (memberships, connections, preferences). A `user_id` that means "acted on" (a log line, an audit row) is not ownership.
3. **Down from an owned row only along `ON DELETE CASCADE`.** A cascade is the schema saying "this child cannot exist without its parent", which is the right definition of "part of the thing the team owns". A nullable, set-null link is a reference, not a part.
4. **Up for integrity.** Every copied row's parents come over so foreign keys hold. **An upward parent is context: it is copied, and it is never walked down from.** Without this flag, the class a team member's assignment points at drags in every other teacher's papers in that class.
5. **Membership tables walk down.** A class membership, an assignment collaborator, a library share: the team's membership row is theirs, and it brings the class into scope as owned.
6. **Reference tables are copied whole.** Schools, email domains, licenses, plans, model prices, admin settings, public library content. They hold no student writing and the product looks wrong without them.
7. **A never-copy list is explicit.** Logs, telemetry, visits, the bug queue and its events, notifications, support threads, step-up codes, API keys, impersonation sessions, caches. A table on neither list fails the planner, so a new table is classified on purpose.
8. **Staging-owned tables are excluded from the copy and survive the wipe.** The twin's institutional LMS configuration (section 9) is the reference example.

**R9. Non-team people become locked shells.** Every person a copied row references who is not on the team comes over with: their real name (so a roster and a paper render), a **placeholder email on a test domain you own** (`student-<hash>@mirror.example.org`), an auth row with **no password and no linked identities**, and a ban that never expires. Belt and braces: even a fence bug cannot email a real student, because no real student address exists on the twin.

**R10. Scrub rules fail closed.** A short table of `(table, column) -> rule` replaces sensitive values (emails, tokens, secrets, free-text that can hold an address). The planner fails when a column whose name looks sensitive (`*email*`, `*token*`, `*secret*`, `*password*`, `*key*`) has no rule and no explicit "safe" mark. Copied LMS connections arrive with **tokens nulled**: refreshing or revoking a copied token acts on the real grant (some LMSs invalidate the old access token on refresh; some refresh tokens are single-use), so one staging refresh could disconnect a teacher in production. Testers connect on the twin and mint their own grant.

**R11. The copy job is the one component that holds production credentials, so it is the one that must be unable to write production.**

- A **read-only database role** on production: `SELECT` only, `default_transaction_read_only = on`, `BYPASSRLS` so it can read the slice. Auth tables the role cannot be granted directly are read through views in a private schema.
- The job refuses to start unless the **target** is the twin's project ref, checked before it reads anything (a `case` on the ref, the disposable environment's prod-refusal guard).
- Storage objects are **downloaded** from production and uploaded to the twin. A test asserts the production storage client is never asked to upload, move or remove.
- The copy streams table by table (`COPY ... TO STDOUT` into `COPY ... FROM STDIN`) with the target session in **replica mode** (`session_replication_role = replica`), so triggers and foreign-key checks do not fire mid-load and the guard triggers of the live app do not reject historical rows.
- **The wipe runs in one replica-mode session too**, including the auth tables' foreign-key closure. A normal-mode `DELETE FROM auth.users` cascades through app tables whose own guard triggers then refuse the delete, and the whole refresh rolls back.
- After the load: lock the shells, null any dangling references the slice cut, apply the scrub, restore the staging-owned rows, re-point the mirrors (section 8), run the parity check.

---

## 6. Who the team is

**R12. One function defines the team, and every consumer calls it.** The copy planner, the bug-forward endpoint (section 11) and production's release flags (see [`RELEASE-FLAGS-SPEC.md`](./RELEASE-FLAGS-SPEC.md)) all ask the same question; three definitions drift.

The reference definition, derived on every call so a new admin account joins without a code change:

1. every platform admin (company staff);
2. plus every account carrying the same full name as one of them (people accumulate accounts: a work address, a personal one, a legacy one);
3. plus every account explicitly granted a `team_member` permission, **as data** (a row in the permissions table, granted by an insert with who asked and why, never in a migration).

**Granted accounts do not seed the name match.** A test account named "TEST" must not pull every other account named "TEST" into the team. The pure function takes three inputs (admin ids, candidate profiles, extra ids) and is unit-tested for exactly that case.

---

## 7. The egress fence

**R13. One environment flag switches it.** `STAGING_EGRESS=fenced` on the twin; unset in production, where the fence is a pass-through and production's behavior is byte-identical.

**R14. One chokepoint.** Every outbound call that writes, and every call to an LMS or file provider even when it only reads, goes through one helper:

```
fencedFetch(kind, url, init)      // throws EgressFenced when the host is not allowed
assertHostAllowed(kind, url)      // the same check, for SDKs that do their own fetch
partitionRecipients(addresses)    // -> { allowed, fenced }, for email
```

Hosts come from `STAGING_EGRESS_HOSTS`; email recipients from `STAGING_EGRESS_EMAILS` plus the team's addresses plus the test domain. The fenced kinds in the reference build: LMS APIs (and their OAuth token, refresh and revoke endpoints), LTI grade and roster services, cloud file providers, the email sender, payment checkout, the issue tracker. **AI providers are not fenced** (R3).

Reads are fenced too. A copied token pointed at a real LMS could otherwise pull a real roster onto the twin.

**R15. An architecture test fails on any outbound call that bypasses the fence.** It scans the server code for `fetch(` and known SDK constructors and requires each to be inside the fence helper or on an `EXEMPT` list with a one-line reason (the app calling itself, the database provider, the AI providers). Out-of-process workers count: a worker in another language gets the same scan for hard-coded hosts.

**R16. Every channel, including the ones you did not write.** The auth provider's own mail (magic links, password resets, email changes) must route through the twin's **own** send-email hook, so it meets the email fence. Copying production's hook URL "for parity" would send the twin's auth mail through production's mailer unfenced; the parity check asserts the hook host is the twin's.

**R17. Background sweeps run on the twin exactly as in production, and hit the same fence.** Retries, reapers, reminders, pushback. The pushback sweep is the dangerous one: a fresh copy is full of released-but-not-yet-pushed rows, and the sweep exists to push them.

**R18. Fenced is not failed.** The UI says what happened: "Fenced on staging: not sent to this LMS course." No error color, no Retry button, no "connection broken" state. A health check that meets a fenced host does **not** stamp the connection as unhealthy (a fenced refusal is a known outcome, not a failure). A refusal the user can act on names the fix: "Staging can't write to this LMS course. Ask the owner to add it to the staging allowlist."

---

## 8. The sandbox LMS mirror

The fence alone makes LMS features untestable: every write is refused. The mirror gives the twin somewhere real to write.

**R19. A mirror is built from the twin's copy, never exported from the real LMS.** Exporting needs a credential per teacher at an institution you do not control, and an LMS cannot move enrollments or student work between instances anyway. Everything the app knows about a class is already in the twin.

**R20. Stable keys make it idempotent.** Re-running the mirror for a class reuses everything:

- the course by **SIS id** `mirror-<class id>`;
- each assignment by **integration id** = the app's assignment id;
- each user by **SIS user id** = the app's profile id;
- students get **real names and placeholder emails** on the test domain (or no email channel at all), so the sandbox LMS can never email a real student;
- each team member gets a sandbox login and a teacher enrollment in their own mirrored courses (their sandbox passwords live in a gitignored file, never in chat or the repo).

**R21. Submissions are made as the students**, through the LMS's admin masquerade (`as_user_id` on Canvas), uploading the twin's stored file, so a grade, a comment and a report PDF land on a real submission in SpeedGrader.

**R22. Every skip is logged with its reason.** A paper with no stored file, a missing user, an LMS state you did not expect. Treat a missing submission record as unsubmitted (a brand-new course has not materialized the record yet). A run ends with `course <id>, <n> assignments, <n> students, <n> submitted, skipped <n>: <reasons>`.

**R23. Re-pointing goes through the owner's own staging connection.** The twin's links (class, assignment, the student's LMS user id) are rewritten to the mirror only once the class owner has signed in to the twin through the LMS (section 9), because a write posts as the connection that owns the link. Until then the mirror run reports "not re-pointed: the owner has not signed in on staging yet". The nightly refresh re-applies existing mirrors automatically, so testers do not re-mirror each morning. Re-pointing creates links where the production class had none.

---

## 9. Sign-in parity

**R24. The institutional door is screen for screen production's flow.** The user enters their institution email, sees the LMS's Authorize screen, and lands on their own Home. The only visible difference is the host in the address bar: the twin's institution configuration points at the sandbox LMS, with its own developer key, not marked trusted if production's is not.

**R25. The twin refuses to create accounts through that door.** On production the door finds or creates an account from the LMS profile. On the twin a sandbox LMS user whose email matches no copied account is refused with a plain message, and nothing is created. The twin admits only the team.

**R26. The twin's institution configuration is staging-owned.** The copy never brings production's over, the wipe never removes the twin's, and its client secret is encrypted with the **twin's** encryption key. Store it once, verify it (Lesson L5), and it survives every refresh.

Two behaviors to explain to testers before they hit them:

- **The LMS signs in whoever is already signed in to it in that browser.** The email typed on the sign-in page only picks which institution to send you to. If the browser holds another sandbox session, the twin signs that person in. "Sign out of the sandbox LMS first" belongs in the invitation email.
- **LMS affordances appear only on LMS-linked records.** A paper whose assignment is not linked shows no LMS action, by design. Test on a mirrored class.

---

## 10. Infrastructure and refresh

**R27. Infrastructure matches.** Database region and compute tier, host region and plan. A latency or timeout bug that only appears at production's size is a bug the twin should show. The parity check reads both through the management APIs (R5).

**R28. The refresh runs on demand and nightly.** On demand: `staging:refresh`. Nightly: a scheduled CI job with the copy role's connection string, the twin's connection string and storage keys, and the LMS admin token as secrets. Ship it **disabled** until every secret is set, and say so in the README; a scheduled job that fails every night trains everyone to ignore it.

A refresh wipes the twin. Never run one under someone mid-demo, and tell testers their work on the twin lasts until the next refresh.

---

## 11. The one sanctioned write to production: bug reports

A tester's bug report belongs in the team's real inbox, attributed to the real person, not in a second queue nobody watches.

**R29. The twin forwards; it never holds a production database credential.** The feedback widget's server handler, on the twin, posts the parsed report over HTTPS to one production endpoint (`POST /api/internal/staging-bug`).

**R30. The endpoint accepts a bug report and nothing else.**

- A shared secret in a header, compared in constant time; 404 when the secret is unset or the endpoint is itself fenced (it never runs on the twin).
- 401 on a missing or wrong secret.
- 403 when the reporter id is not on the team (R12), checked on production.
- The same rate limit as the widget, the same intake path, one table written.
- A body schema validated before anything else runs.

**R31. Reports carry their environment.** An `environment` column (`production` by default, `staging` for forwarded ones) and a STAGING badge in the inbox list and detail. Production's own reports are unchanged.

**R32. Failure is visible and recoverable.** When production cannot be reached, the report is saved on the twin and the widget says "Saved on staging. It will reach the main inbox when production is back." A retry forwards what waited.

---

## 12. Build checklist

1. The allowed-difference list and the parity library + CLI, with exit codes 0/1/2 and tests both ways (R2, R5 to R7).
2. Match infrastructure: region, compute, plan. Give the twin its own auth secret, encryption key, job-queue keys and storage (R3, R27).
3. The team function, pure core plus the database read, including the `team_member` permission (R12).
4. The slice planner as a pure library: walk rules, the context flag, reference and never-copy lists, the unclassified-table failure, the scrub rules with fail-closed detection (R8 to R10).
5. The read-only production role and the copy job: target-ref guard, replica-mode wipe and load, storage download-only, shells locked, staging-owned rows restored (R9, R11).
6. The fence helper, wired into every outbound call; the architecture test with its `EXEMPT` reasons; the auth email hook pointed at the twin (R13 to R16).
7. Fenced-not-failed copy in every surface that shows a push or send result; health checks that ignore fenced refusals (R18).
8. The sandbox LMS: developer key, admin token, the mirror script with stable keys, masquerade submissions, skip logging, owner-gated re-point (R19 to R23).
9. The twin's institution config and the no-account-creation rule on the institutional door (R24 to R26).
10. Bug forwarding: endpoint, environment column, badge, fallback (R29 to R32).
11. The stage command runs migrations on the twin, then parity, then tags (R4, R7). The nightly refresh, disabled until its secrets exist (R28).

## 13. Test checklist

**Parity**
- An allowed difference passes; an unlisted one fails and is named; a staging-only name outside the list fails.
- A migration applied on one side only fails the check.
- The check exits 2, not 0, without credentials.

**Slice**
- On a fixture: the team's owned papers come over; another teacher's papers in a class the team only references do not (the context flag).
- A table on neither list fails the planner.
- A sensitive-looking column with no scrub rule fails the planner.
- After a real refresh, by query: every non-team person has a placeholder email, no password, a ban; no LMS token is non-null; no demo account remains; the count of classes equals owned + co-taught + context.

**Fence**
- Every fenced kind refuses a non-allowlisted host and passes an allowlisted one; in production every call passes through unchanged.
- Email: team and test-domain addresses pass, any other address is fenced and logged.
- The architecture test fails when a new `fetch(` is added outside the fence without an `EXEMPT` reason.
- NEGATIVE, by hand: on the twin, an LMS action on an unmirrored class shows the fence message, posts nothing, and leaves the connection healthy.

**Mirror and sign-in**
- Re-running the mirror creates nothing new and submits nothing twice.
- By hand: the team member signs in through the institutional door and lands on their own Home; a comment, a release and an undo on a mirrored paper appear in the sandbox SpeedGrader.
- NEGATIVE: a sandbox LMS user who matches no copied account cannot create an account on the twin.

**Bug forward**
- No secret, a wrong secret, and a non-team reporter are each refused; a valid forward writes one report with `environment = staging`.
- With production unreachable, the report is saved on the twin and the widget says so.

---

## 14. Lessons from the build

- **L1. The first release candidate went red in CI.** A shared-code change (a new internal endpoint) was verified with targeted tests only; the full suite would have caught a missing route-table row, a missing CSRF exemption reason and a tenant-attribution assertion. Run the full suite for shared-code changes before the first tag, not after.
- **L2. Context parents leaked a whole class.** The first planner walked down from every copied row, including parents copied only for integrity, and planned about 1,200 papers against 663 the team actually owned. The fix was one flag (upward parents are context, never walked down) and a regression test on a fixture shaped like the leak (R8.4).
- **L3. The mirror submitted 15 of 74 papers, silently.** A brand-new course had not materialized submission records yet, and "no record" was treated as "already handled". Treating a missing record as unsubmitted, and logging every skip with its reason, took it to 74 of 74, and a second run submitted nothing (R22).
- **L4. The twin shared production's auth signing secret** until the parity check named it. Copying production's variables wholesale copies the ones that must differ; the allowed-difference list is how you notice (R2).
- **L5. A client secret was wrong twice, both times invisibly.** First, the value copied from the LMS admin screen was its truncated display (five characters and `...`), saved and then encrypted. Later, a freshly regenerated secret was pasted with the sentence's trailing period. Both produced the same symptom: the Authorize screen worked (it needs only the client id) and the token exchange failed with `invalid_client`. Check a secret's **shape** (length, character set, first and last character class) without printing it, and probe the token endpoint with a bogus code: `invalid_grant` means the client id and secret were accepted, `invalid_client` means they were not.
- **L6. The copy role and the guard migrations needed live probes.** A role or trigger that decides who may do what was checked by running the refused and the permitted roles inside rolled-back transactions on the twin, then on production. Reading the SQL was not enough on an earlier migration in the same codebase.
- **L7. The typed email does not choose the account.** A tester typed one institution address and was signed in as a different person, because the sandbox LMS session in that browser belonged to someone else. It is the production behavior too; put it in the tester's instructions (section 9).
- **L8. "The feature is missing" was a test on the wrong record.** A tester looked for the LMS comment action on a paper whose assignment had no LMS link, where it correctly does not appear. Pick a mirrored record, and say so in the check sheet.
- **L9. A secret pasted into chat is a secret in a transcript.** Keep tester passwords and client secrets in gitignored files the human edits; have the agent verify them by shape and by probe, never by echoing them.
