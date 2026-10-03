# Impersonation ("View as"), a build spec

A stack-agnostic specification for letting the builder of an app, or any admin, **open any page of the site as if they were a specific user**: the same navigation, the same screens, the same data, the same redirects, the same API answers. Nothing is mocked or redrawn. The server resolves a different identity for the request, the app renders for it, and one marker says so and offers the way out.

This is a spec, not code. A coding agent can build it in any stack (SvelteKit, Next/React, Rails, Django, Laravel, anything). It assumes **Postgres + Supabase** as the reference and gives the generic equivalent wherever that matters. It is grounded in two shipped builds: a **person** impersonation in a grading platform (signed session, a token minted as the target, rank ladder, audit) and a **role** preview in an alumni portal (one resolver for pages and API, narrow-only, a marker that works collapsed and on a phone). Each did something the other did not, and each had gaps the other had already closed. This spec is the union, with the gaps closed. The lessons are at the end.

It pairs with [`SIDEBAR-SPEC.md`](./SIDEBAR-SPEC.md) (where the marker lives), [`FEEDBACK-LOOP-SPEC.md`](./FEEDBACK-LOOP-SPEC.md) (a report filed while impersonating must say so) and [`DISPOSABLE-ENVIRONMENT.md`](./DISPOSABLE-ENVIRONMENT.md) (agents driving the app must not start impersonation).

Requirements carry IDs (`R1`, `R2`, ...) so a test, a review or a bug can cite one.

---

## 1. What it is, in one paragraph

An admin picks a person. From that moment, until they exit or the session runs out, **every request the admin's browser makes is answered as that person would be answered**, while the server always knows who is really at the keyboard. The admin can move freely around the site: every page they can reach is a page the person can reach, and every page they cannot reach redirects exactly as it would for the person. Looking is safe. Acting is off by default. Everything is logged.

---

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Actor** | The real, signed-in human. Never changes during impersonation. |
| **Subject** | The identity the app renders for. Equals the actor when nobody is impersonating. |
| **View as a person** | The subject is a real, specific account. You see *their* data. This is the core feature. |
| **View as a role** (preview) | The subject is the actor's own account with a narrower role. You see *your* data through *their* permissions. Cheaper, safer, good for design review and demos. |
| **Persona** | A role plus any permission flags that change what renders (`employer`, `employer + consortium`). What a role preview picks from, and what the test matrix walks. |
| **Session** | One impersonation, from start to exit or expiry. A server-side row, not just a cookie. |
| **Door** | Any UI element that starts a session. |
| **Marker** | The always-visible indicator that a session is active, with the exit. |

Both modes are one feature with one resolver (`R1`). Never build them as two mechanisms with two cookies (Lesson L2).

**Build order:** person mode is the feature this spec is about, and the one support actually needs ("why does Jane see an empty dashboard?"). Role preview is a few extra lines once the resolver exists. If you only have time for one, build person mode with read-only writes. If your app has no RLS and no per-user data yet, role preview alone may be all you need for now, and the resolver keeps the door open.

---

## 3. The one rule

**R1. Every page, layout, redirect, API route, background-triggering action and realtime channel asks one server function who is looking, and that function already returns the subject.**

```
viewer(request) -> {
  subjectId,       // whose app this is: rendering, queries, permissions
  role,            // the subject's effective role
  can,             // capability set derived from role (+ flags), see R2
  actorId,         // the real signed-in user, always
  actorRole,       // the actor's real role, for the few places allowed to read it
  session: null | {
    id, mode: "person" | "role", kind: "support" | "acting",
    startedAt, expiresAt, reason, returnTo
  }
}
```

The function is evaluated once per request and cached for the rest of that request. Nothing else reads the session cookie, and nothing else reads the auth session to decide what to render.

If any screen reads the actor's role or queries the account row itself, the impersonation leaks: the nav changes but the page still shows admin buttons, or the page hides a button that the API still accepts. The whole feature is one resolution point plus the discipline that nothing bypasses it. Grep for direct reads (`session.user`, `auth.uid()` in app code, `profile.role`, `role === "admin"`) and route every one through `viewer()`.

**Only these may read the actor:** the resolver itself, the marker, the exit, the audit log, feedback attribution (section 11), and the short list of **actor-only surfaces** you name explicitly (for example the release-notes page or a version chip that only staff see). Write that list down in code, next to the resolver, so it is reviewable.

**R2. Capabilities, not role checks.** Screens ask `can.postJobs`, `can.seeGrades`, `can.manageUsers`, from one `access(role, flags)` table. A new persona is then one row in that table, and impersonation is automatically faithful for it. A scattered `role === "faculty"` is a place where the preview will lie.

---

## 4. Who may impersonate whom

**R3. Rank ladder, strictly downward.** Give every role a rank (example: `owner 5 > superadmin 4 > org admin 3 > school admin 2 > teacher 1 > member 0`). An actor may impersonate a subject only if the actor's rank is **strictly greater** than the subject's. Rank is the **highest** role the person holds across all their memberships. The one exception you may choose: the top rank (the builder, the owner) may view anyone, including peers, because "the builder can see any page as any user" is the point of the feature. Make that a deliberate, named rule, not an accident of a missing check.

**R4. Relationship limits on top of rank.** Below the top tiers, rank is necessary but not sufficient. A teacher may view as students *enrolled in a class they teach*; an org admin may view as members *of their org*. Express this as one function `mayImpersonate(actor, subject) -> { ok, reason }` that the start path and the per-request check both call. Check the relationship at the right scope (a co-teacher yes, a teaching assistant only if you decide so), and test the scope you chose.

**R5. Role preview is narrow-only.** In role mode, every persona offered must be **strictly narrower** than the actor's real role. A preview can take capabilities away. It never adds one. Assert this in a unit test over the access table.

**R6. Re-authorize on every request, not once.** The resolver re-runs `mayImpersonate` (rank and relationship) on every request. Demoting the admin, removing the teacher from the class, or deleting the target ends the session on the next request (section 9 says how that ending is shown).

**R7. Step up before person mode, on every door.** Starting a person session requires the actor to have passed a second factor recently (TOTP, passkey, or an emailed code bound to the session), whatever door they used. A step-up that guards only the admin panel and not the other doors guards nothing. Role preview does not need step-up, because it cannot show anything the actor could not already see.

**R8. No chains, no self.** Refuse starting a session while one is active (exit first), refuse impersonating yourself, and refuse impersonating an account that is itself mid-impersonation if your stack can tell.

**R9. Optional permission flag.** If some top-rank staff should not be able to impersonate, gate it with a named permission (`impersonate_users`). If you seed such a permission, enforce it. A permission that exists and is never checked reads as a control that is not there.

---

## 5. Where the doors live

The feature does **not** need to live behind an admin panel. The authority check lives on the server (section 4). The door is just a convenience, and it belongs wherever the actor is **already looking at the person**. Show a door only to an actor who would pass `mayImpersonate` for that subject, so a door never leads to a refusal.

**R10. Door 1, contextual (primary).** A "View as" action on the person, everywhere the person appears to someone allowed to impersonate them:

- their profile or directory page;
- their row in any list: user admin, class roster, member directory, org members;
- the reporter field of a bug or feedback report;
- an audit entry or support conversation that names them.

This is the door that gets used. In the alumni portal the natural place was the dashboard and the member pages, not an admin screen; in the grading platform it was the user list *and* the class roster. Put a small, quiet icon-plus-label action there. It does not need to be prominent, because the people who use it know to look for it.

**R11. Door 2, global picker.** One "View as..." entry in the account menu (or a command palette) that opens a search over the people the actor may impersonate, scoped by `mayImpersonate` on the server. This is for "I know the name, I am somewhere else." In role mode the same menu lists the personas, minus the current one. Search by name and email, cap the result count, and never return people the actor could not impersonate.

**R12. Door 3, deep link ("open this page as them").** The highest-value door for support: from a bug report, **"Open as reporter"** starts a session for the reporter and lands on the exact URL they reported from. Generalize it as `startImpersonation(subject, { landOn: url })`. If the subject cannot open that URL, land on the subject's home and say so.

**R13. Where a session lands.** In order: the `landOn` URL if given; else **the page the actor is on now, if the subject can open it**; else the subject's home. Staying on the current page is what makes "view any page as anyone" feel real: you look at a page, wonder how it looks for Jane, and see it without losing your place.

**R14. Reason, inferred first.** Capture a reason on every session, but do not make the common case type it. Each door supplies a default reason from its context ("from bug report #123", "from roster: Torts 101", "from user admin"). A free-text field is optional at start. Require typed text only where policy demands it (regulated data, a production tenant you do not own). Store which door was used as a separate enum (`door`), never by matching the reason text (Lesson L7).

**R15. Never on the agent's path.** Automated agents and crawlers driving the app must not be able to start a session. Block the start endpoint in the agent's guarded mode ([`DISPOSABLE-ENVIRONMENT.md`](./DISPOSABLE-ENVIRONMENT.md)).

---

## 6. Session storage

**R16. Role mode** may use a plain cookie holding the persona key (`view-as=student`), `Path=/`, `SameSite=Lax`, a day's lifetime. It needs no signature, because the resolver enforces R5 on every request and a tampered value can only pick another allowed persona. Set it **server-side** (an endpoint or form action), not with `document.cookie`, so sign-out can clear it (R19).

**R17. Person mode** needs a server row and a signed cookie:

```
impersonation_sessions (
  id            uuid primary key,
  actor_id      uuid not null references users,
  subject_id    uuid not null references users,
  mode          enum('person','role') not null,
  kind          enum('support','acting') not null default 'support',
  door          enum('contextual','picker','deep_link','admin','dev') not null,
  reason        text not null,
  return_to     text,                    -- where the actor was when they started
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz,
  end_cause     enum('exit','expired','revoked','superseded','signed_out'),
  check (actor_id <> subject_id)
)
```

- The cookie holds `<session id>.<HMAC>`, `HttpOnly`, `Secure`, `SameSite=Lax`, signed with a **dedicated** secret (`IMPERSONATION_SECRET`), never the database service key (Lesson L5). Compare signatures in constant time.
- Default lifetime one hour (`IMPERSONATION_TTL_SECONDS`), configurable.
- One active session per actor: starting a new one ends the old with `end_cause = superseded`.
- Lock the table down: only the server's privileged path writes it; actors may read their own rows; nobody else reads it. Do not rely on a broad grant plus RLS alone if your platform makes the grant easy to widen by accident.
- Keep the actor's real auth session untouched in its own cookie. Impersonation is a layer on top, so exiting is just removing the layer.

**R18. Multiple tabs.** The cookie applies to every tab. Every tab shows the marker on its next request. Exiting in one tab ends the session for all; the others find out on their next request (section 9). Do not try to impersonate per tab.

**R19. Sign-out ends it.** Signing out ends any active session (`end_cause = signed_out`) and clears both the person and role cookies, so the next person to sign in on that browser does not start inside someone else's view.

---

## 7. Resolution: rendering and querying as the subject

**R20. On every request** the resolver: verifies the signature, loads the row, checks `ended_at` is null and `expires_at` is in the future, checks `actor_id` equals the real signed-in user, re-runs `mayImpersonate` (R6), and only then sets `subjectId`.

**R21. Query as the subject.** The database must answer as the subject would, or the page is a lie that looks like the truth. Pick the mechanism your stack has, in this order of preference:

| Stack | How to query as the subject |
|---|---|
| Supabase / PostgREST | Mint a short-lived JWT with `sub = subject`, `role = authenticated`, and a custom claim `impersonator = actor`, signed with the project's JWT secret, and build that request's database client from it. RLS then returns exactly what the subject sees. |
| Plain Postgres with RLS | Per request, in a transaction: `SET LOCAL ROLE app_user; SELECT set_config('request.jwt.claims', '{"sub":"<subject>","impersonator":"<actor>"}', true);` so policies read the subject. |
| App-level authorization (no RLS) | Pass `viewer.subjectId` into the policy layer (Pundit, CanCan, Django permissions, a repository's `scopeFor(user)`) everywhere it currently receives the session user. This is R1 applied to data. |

**R22. Fail closed.** If the mechanism cannot be set up (the JWT secret is missing, minting fails), **refuse the session** and show the actor why. Never fall back to a service-role or superuser client. That fallback shows more than the subject could see, so the page is wrong in the dangerous direction, and it allows writes nobody could make (Lesson L4).

**R23. Everything else that carries identity follows the subject:**

- realtime and websocket tokens are minted for the subject;
- signed file URLs are issued under the subject's access;
- server-side caches keyed by user use `subjectId`;
- client-side caches (query caches, stored state, service-worker caches) are cleared on start and exit, so the actor never sees a blend of two people;
- the subject's display preferences apply (time zone, locale, theme, density), because "as they see it" includes when their deadline appears to fall. State this in the marker's detail if it surprises.

**R24. Role mode queries as the actor.** In role preview the database still answers as you. If RLS grants admins rows that the persona would not get, the UI must filter by capability (R2). Do not rely on RLS to make a role preview faithful. Where a surface cannot be made faithful this way (a directory that shows admins every hidden profile), either filter it by `can`, or route that question to person mode. Say so in the switcher's help text: "You keep your own data. Pages show what a student can do, not a particular student's records."

**R25. Switching re-renders from the server.** After starting, switching or exiting, do a full server render (a reload, or the framework's router refresh that re-runs server loaders), so layouts, pages and redirects all recompute. Never switch client state only (Lesson L1). The control follows the button-feedback rule: instant press state, an in-flight label ("Switching...", "Exiting..."), disabled until done.

---

## 8. Writes and side effects

The rule people get wrong: impersonation is for **looking**. A write made while impersonating is recorded as the subject unless you do something about it, and "the data says the student did it" is the worst failure this feature has.

**R26. `support` (default): read-only.** The server refuses every mutating request (non-GET HTTP methods, form actions, RPC mutations) with a clear message: "You are viewing as Jane. Exit to make changes." Enforce it in the same middleware that runs the resolver, not per handler, so a new handler is covered by default. Disable mutating controls in the UI too, but the server is the guard.

**R27. Reads that write are writes.** Some GETs mutate: opening a notification marks it read, opening an assignment stamps "first viewed", visiting updates "last seen", a page view advances a tour. In support mode these must not fire for the subject. List them, and gate each on `viewer.session == null`. Otherwise the admin's look clears Jane's unread badge, and Jane's teacher sees that she opened the feedback when she did not.

**R28. `acting`: writes allowed, attributed.** Only for an explicit need (fixing a stuck setup for a user who asked), chosen at start, louder marker, and every write records the actor: an `impersonator_id` column filled from the token claim by a trigger or column default, plus an audit entry per write. Pick which tables need the column; the audit entry covers the rest.

**R29. Always blocked, in every kind:**

- sending email, SMS, push or in-app messages to real people;
- payments, refunds, plan changes;
- pushes to external systems (grade passback, CRM sync, webhooks);
- changing the subject's authentication: password, email, MFA, linked accounts, API keys;
- starting another impersonation;
- elevating anyone's role or granting access.

**R30. Suppress the actor's footprint.** While impersonating, skip analytics events, NPS and survey prompts, product-tour completion, "last seen" and visit tracking, brand or onboarding stamps, and recommendation signals, or tag them `impersonated` and exclude them from every metric. Emails the app would send "to you" go to the actor.

In role mode the writes are the actor's own and land on the actor's account, so R26 to R28 do not apply, but R27 and R30 do (a preview must not complete the student tour on your account either), and any feature that would act on other people (posting to a shared board, inviting someone) should either be refused for the preview or simulated with an explicit "(Preview: nothing was sent.)" result. Simulating is better than refusing when the screen is the thing being reviewed.

---

## 9. Ending a session

**R31. Exit returns the actor to where they were.** Exit ends the row (`end_cause = exit`), clears the cookie, clears client caches (R23), and lands on `return_to` if the actor can open it, else the current page if the actor can open it, else the actor's home. Exit is a POST, works from every page, and works even if the session row is already gone.

**R32. Expiry is never silent.** When a request arrives with a session that has expired, been revoked (R6 failed) or been ended in another tab, do **not** quietly continue as the actor. Render a short interstitial: "Your view as Jane ended at 3:42 (expired). You are back as yourself." with links to "Return to where I was" and "View as Jane again". A page that silently switches from Jane's data to the admin's data mid-investigation is a convincing lie: in one build, an admin diagnosed a "missing rubric" bug that was really their own view after the hour ran out (Lesson L6). Mark the row `end_cause = expired`.

**R33. The countdown is live.** The marker's remaining time ticks (a timer, not a value computed once at render). In the last five minutes it changes tone and offers "Extend" (which re-runs R6 and R7's recency check and pushes `expires_at`), so an expiry is never a surprise.

---

## 10. The marker

The actor sees the site at full fidelity with one addition.

**R34. One marker, always visible, never part of the subject's UI.**

- **With a rail:** at the top of the rail, directly under the header, a block in a contrasting tone: an eye icon, "Viewing as Jane Doe" (person) or "Viewing as a student" (role), and an **Exit** button. It is the only element in the rail the subject would not see.
- **Collapsed rail:** the icon column keeps the eye and an exit icon beneath it, with a tooltip "Viewing as Jane Doe. Exit".
- **Phone width, or no rail:** a slim bar or chip at the top of the page, "Viewing as Jane Doe · Exit", shown wherever the rail is hidden.
- **Person mode is louder than role mode.** It names the person, shows their role, the remaining time and the reason, and **cannot be dismissed**. A role preview may be quieter and, if you like, dismissible to a smaller chip, but the exit must always remain reachable.
- **`acting` is loudest.** A distinct warning tone and the words "Changes you make are recorded as made by you on Jane's behalf."
- **Accessibility:** the marker is a landmark with an accessible name, the exit is reachable by keyboard from anywhere, and the tone is not the only signal (the words carry it).
- **Tab title:** prefix the document title ("[Jane Doe] Dashboard") so a background tab shows it too.
- One marker, one exit. No second banner on desktop.

The marker is drawn from `viewer.session` by the app shell, not by individual pages, so a page cannot forget it.

---

## 11. Attribution and audit

**R35. Audit log.** Write an append-only entry for: start (actor, subject, mode, kind, door, reason, ranks), end (cause), expiry, extend, every **denied** start with the reason it was denied, every refused write in support mode (method, route), and, in acting mode, every write. Entries name the actor, the subject and the session id. Retain them per your security policy.

**R36. Visibility to the subject.** Decide, and write down, whether a person is told they were viewed. Common answers: a "Recent support access" list on their security page for person-mode sessions by staff; nothing for a teacher viewing their own student inside the class relationship. Either answer is defensible. Not deciding is not.

**R37. Feedback reports.** A report filed while impersonating records `user_id = actor`, plus `impersonating = true`, `subject_id`, `mode`, and in role mode `viewing_as`. The screenshot shows the subject's screen, which is the point; the attribution must still be the real reporter.

---

## 12. Data the actor should not see even as the subject

Impersonation shows what the subject sees. Some things the subject sees are still not the actor's business:

- **Secrets in the UI:** the subject's API keys, recovery codes, connected-account tokens. Mask them while impersonating, whatever the subject would see.
- **Private messages,** if your app has them and your policy says support does not read them. Gate them on `viewer.session == null` and show "Hidden during support view."
- **Regulated data** (health, financial, student records under a privacy law): check whether your obligations allow staff to view it at all, and if so whether a typed reason (R14) is required.

List these surfaces next to the actor-only list from R1. They are the only places that may read `viewer.session` to show *less*.

---

## 13. Build checklist

1. Access table: `access(role, flags) -> can`, the persona list, the rank of each role, and a test that every role-preview persona is narrower than its previewer (R2, R3, R5).
2. `mayImpersonate(actor, subject)` with rank + relationship, unit-tested both directions (R3, R4).
3. The `viewer()` resolver, cached per request, used by every page, layout, API route and realtime token (R1, R20).
4. Grep for direct role and session reads; route each through `viewer()`. Write the actor-only and hide-from-actor lists (R1, section 12).
5. Session table, signed cookie with a dedicated secret, TTL, one active per actor, sign-out clears both cookies (R16 to R19).
6. Query-as-subject for your stack, failing closed (R21, R22). Realtime tokens, signed URLs, caches (R23).
7. Middleware that refuses writes in support mode; the reads-that-write list; the always-blocked list (R26, R27, R29).
8. Footprint suppression: analytics, tours, surveys, last-seen (R30).
9. Doors: contextual action on every person surface, the account-menu picker, "Open as reporter" on bug reports, all hidden when `mayImpersonate` would refuse, all behind step-up for person mode (R7, R10 to R14).
10. Landing and exit with `return_to`, server re-render, in-flight feedback, cache clearing (R13, R25, R31).
11. Expiry interstitial and a live countdown with Extend (R32, R33).
12. Marker: rail, collapsed, phone, tab title; person louder than role; acting loudest (R34).
13. Audit entries and feedback attribution (R35, R37). Decide R36.

## 14. Test checklist

Walk the matrix of **subjects × gated surfaces**, not a sample.

**Fidelity**
- For a real account of each persona, viewing as that account renders the same nav items, the same page content and the same redirects as signing in as it. (Capture both and diff them; this is the strongest single test.)
- Every gated page redirects for each subject that lacks it, including admin pages.
- Every gated API route returns the refusal status for each subject that lacks it.
- Realtime subscriptions deliver what the subject would get, not the actor.

**Authority**
- Each rung of the ladder: allowed strictly downward, refused upward and sideways (except the named top-rank rule). Each relationship limit: allowed inside, refused outside.
- Every door is absent for an actor who would be refused, and the server refuses a hand-crafted start anyway.
- Person mode without recent step-up is refused from every door, not only the admin one.
- Demoting the actor or removing the relationship mid-session ends it on the next request, with the interstitial.

**Session integrity**
- Forged signature, unknown id, another actor's session id, ended row, expired row: each is refused, and each shows the interstitial (or nothing, for a forgery), never a silent fall-through.
- The JWT secret absent: start is refused, and no code path reaches a service-role client.
- Sign-out clears both cookies; the next sign-in on that browser starts clean.
- A tampered role cookie (unknown value, a wider role, sent by a non-admin) resolves to no preview.

**Writes and side effects**
- In support mode, every mutating route is refused with the message, including one added after this feature (the middleware covers it by default).
- Viewing a notification, an assignment, or any reads-that-write surface leaves the subject's state unchanged.
- No email, message, payment or external push leaves the system during a session, in any kind.
- In acting mode, a write carries `impersonator_id` and an audit entry.

**UI**
- The marker shows in the expanded rail, the collapsed rail, at phone width and in the tab title; Exit works from each.
- Exit lands on `return_to`; a role-preview exit refreshes in place.
- The countdown ticks; Extend works; expiry shows the interstitial.
- A feedback report filed during a session is attributed to the actor and flagged.

---

## 15. Lessons from two builds

- **L1. Client-only previews drift.** The alumni portal's first version switched the sidebar in client state and left pages and APIs on the real role. Moving the cookie read into the server's member context, which every page and API already called, fixed every surface at once. That is R1 in practice.
- **L2. Two mechanisms, one confused app.** The grading platform grew a signed person session and, separately, a role-style "student view" with its own banner, its own exit and different rules. Keep one resolver with two modes and one marker component with variants.
- **L3. A role preview is not a data preview.** The alumni portal's role preview narrowed every page and API but still queried as faculty, and a faculty RLS policy shows every profile, so "view as a student" showed profiles a student could not see. Either filter by capability (R24) or use person mode for data questions. And say which in the switcher.
- **L4. The service-role fallback.** The grading platform fell back to a service-role client when the JWT secret was missing, which over-shows data and allows unscoped writes. Fail closed (R22).
- **L5. One secret, two jobs.** Signing the session cookie with the database service key couples two secrets that should rotate independently. Use a dedicated one.
- **L6. Silent expiry is a convincing lie.** After the hour ran out, the same page kept rendering under the admin's own access, the banner just vanished, and a real bug investigation chased a symptom that was the admin's view, not the teacher's. Show the ending (R32), and keep the countdown live (R33): the first build's countdown was computed once and never ticked.
- **L7. Do not key behavior off free text.** One build decided which banner to show by matching the session's reason string, which anyone starting a session could spoof. Use an enum (`kind`, `door`).
- **L8. Rank must include the low rungs.** Teachers had no rank of their own, so every teacher's "view as my student" was refused, and nobody noticed for weeks because staff always hit the top-rank shortcut. Test every rung, especially the bottom ones (R3).
- **L9. Every door needs the same guard.** Step-up protected the admin users page and not the two other doors that started the same kind of session. Put the check in `startImpersonation`, not in the page that hosts the button (R7).
- **L10. Writes recorded as the subject.** With no read-only mode and no `impersonator_id`, a write during a session looked exactly like the subject's own. Default to read-only (R26) and attribute when writes are allowed (R28).
- **L11. Re-authorize per request.** A check only at start leaves a removed teacher with access for the rest of the hour (R6).
- **L12. A cookie that outlives the sign-out.** A browser-set preview cookie survived sign-out for a day. Set it server-side and clear it on sign-out (R16, R19).
- **L13. Framework control flow inside `try`.** A redirect implemented as a thrown exception was caught by the surrounding error handler, so the start "succeeded" and went nowhere. If your framework redirects by throwing, re-throw it from every `catch` on the start and exit paths.
- **L14. Admin checks that disagree.** During a role preview, admin pages redirected and one admin API refused, but the bug-inbox actions read the real role directly and kept working. That is a missed R1 read; the grep in checklist step 4 is how you find them.
