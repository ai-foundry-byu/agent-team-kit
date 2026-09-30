# View as, a build spec

A stack-agnostic specification for letting an admin see an app exactly as another kind of user sees it: the same navigation rail, the same screens, the same redirects, the same API answers. Nothing is mocked or hand-drawn. The app renders for a different identity, and a small marker in the rail says so and offers the way out.

This is a spec, not code. It assumes **Postgres + Supabase** as the default and gives a generic equivalent where that matters. It pairs with [`SIDEBAR-SPEC.md`](./SIDEBAR-SPEC.md) (where the marker lives) and [`FEEDBACK-LOOP-SPEC.md`](./FEEDBACK-LOOP-SPEC.md) (reports filed during a preview must say so).

---

## Vocabulary

Two different features get called "impersonation." Name them apart and build them apart.

| Term | What it swaps | Whose data you see | Typical use |
|---|---|---|---|
| **View as a role** (preview) | The role and permission set | Your own | "What does a student's app look like?" Design review, QA, demos. |
| **View as a person** (impersonation) | The whole identity | Theirs | "Why does Jane see an empty dashboard?" Support. |

A **persona** is one role plus any permission flags that change what renders (for example `employer` and `employer + consortium`). The persona list is the thing an admin picks from, and the thing the test matrix walks.

Build the role preview first. It is cheap, safe, and answers most questions. Add person impersonation only when support needs it, because it carries real risk (below).

---

## The one rule

**Every screen, layout, redirect, and API guard asks one server function who is looking, and that function already returns the previewed identity.**

```
effectiveViewer(request) -> {
  role,          // what everything renders for
  permissions,   // derived from role (+ flags)
  realRole,      // what the account actually is
  viewingAs,     // "" or the persona being previewed
  actor,         // the real user id, always
}
```

If screens read `realRole` or query the account row themselves, the preview leaks: the rail changes but the page still shows admin buttons, or the page hides a button the API still accepts. The whole feature is one resolution point plus discipline that nothing bypasses it. Grep for direct role reads (`profile.role`, `user_profiles.role`, `role === "admin"`) and route every one through the resolver. Only the resolver and the audit trail may read the real role.

Pair this with **capabilities, not role checks**. Screens ask `can.postJobs`, `can.seePay`, `can.manageRoles`, from one `access(role)` table. Then a new persona is one row in that table, and the preview is automatically faithful for it.

---

## Mode 1: view as a role

### Storage

A cookie holding the persona key, for example `view-as=student`. Path `/`, `SameSite=Lax`, a short lifetime (a day), cleared on sign-out.

It does not need signing, because the server enforces the guard below on every request. Tampering with the cookie can only pick another persona from the allowed list.

### The guard

- Only roles marked `canPreview` in the access table may preview (usually just admin/faculty).
- The persona must be on the allowed list, and **every allowed persona must be strictly narrower than the real role.** A preview can take capabilities away. It never adds one.
- Check the real role on every request, not once at switch time. Demoting an admin ends their preview on the next request.
- An unknown or disallowed cookie value resolves to `""` (no preview), silently.

### Fidelity

- **Rail:** built from the effective role, so it is the exact rail that persona gets, including counts and badges.
- **Pages:** every gated page redirects exactly as it would for that persona (an admin page bounces a previewing admin to Home).
- **API:** the API guard uses the same resolver, so a request the persona could not make is refused with the same status (usually 403). A preview that only hides buttons is not a preview.
- **Personal data stays yours.** Your name, your profile completeness, your own records. Say this in the switcher's help text. If a persona's screens depend on data you do not have (a cohort year, an enrollment), the page shows its empty state, which is itself worth seeing. When that is not enough, use Mode 2 or a demo account.
- **Row-level security still runs as you.** If the database grants admins rows that the persona would not get, the UI must filter by capability. Do not rely on RLS to make a role preview faithful. If a surface cannot be made faithful this way, it is a candidate for Mode 2.

### Writes

Allowed, as you, on your own account, within the persona's capabilities. Nothing extra is needed because the API guard already answers as the persona.

### Switching

After writing the cookie, re-render from the server (a full refresh or the framework's router refresh), so layouts, pages, and redirects all recompute. Do not switch client state only. That was the first version's bug: the rail changed and the page did not.

The switch is a mutation, so it follows the button feedback rule: instant press state, an in-flight label ("Switching…", "Exiting…"), controls disabled until done.

---

## Mode 2: view as a person

Only when support needs to see a specific account. Everything in Mode 1 applies, plus:

### Storage

- A server row per session: `impersonation_sessions(id, actor_id, target_id, reason, kind, started_at, expires_at, ended_at)`.
- The cookie holds `<session id>.<HMAC>`, `HttpOnly`, `SameSite=Lax`, signed with a **dedicated** secret (not the database service key).
- Short lifetime (an hour), with the remaining time shown in the marker.

### Resolution

On every request: verify the signature, load the row, check it has not ended or expired, check `actor_id` equals the real signed-in user, and **re-check the actor is still allowed to impersonate this target** (rank and relationship, for example a teacher only their own enrolled students).

Then query the database **as the target**: mint a short-lived JWT with `sub = target`, plus a custom claim `impersonator = actor`, and use it for that request's client. This makes RLS return exactly what the target sees.

**Fail closed.** If the JWT secret is missing, refuse the session. Never fall back to a service-role client. That shows more than the target could see and allows writes nobody could make.

### Who may impersonate whom

A rank ladder (`superadmin > admin > staff > member`), and you may only pick someone strictly below you. Relationship limits on top where they exist. Superadmins can be further restricted from impersonating other admins.

### Writes

Pick one per `kind` and state it in the marker:

- `support`: **read-only.** Every non-GET request is refused by the server with a clear message. Most support questions are answered by looking.
- `acting`: writes allowed, only where genuinely needed, and each write records `impersonator_id` (from the JWT claim, via a trigger or a column default) so the data shows an admin did it.

Always blocked regardless of kind: sending email or messages to real people, payments, grade pushes to external systems, changing the target's auth (password, email, MFA), and starting another impersonation.

### Audit

Log start, end, expiry, and every denied attempt, with the reason. In `acting` mode, also log each write.

---

## The affordance

The user sees the app at full fidelity with one small addition.

- **Rail marker.** At the top of the rail, directly under the header, a light block on the dark rail: eye icon, "Viewing as a student", and an **Exit** button. It is the only element in the rail that is not part of the persona's own rail.
- **Collapsed rail.** The icon column keeps the eye, and an × exit button beneath it, with a tooltip "Viewing as a student. Exit".
- **Phone width.** The rail is a closed drawer, so the marker also appears as a chip in the top bar ("Viewing as a student · Exit"), shown only below the drawer breakpoint.
- **Person mode is louder.** The marker names the person and shows the time remaining and the reason, and cannot be collapsed away. A role preview stays quiet.
- **Entry points.** A "View as" group in the account menu listing each persona (minus the current one), and optionally a persona switcher on the admin Home. There is no need to show it on every page.
- **Exit always lands somewhere valid.** After exiting, refresh in place; the admin can open every page the persona could.
- The marker needs no top-of-page banner on desktop. One marker, one exit.

---

## Attribution elsewhere

- **Feedback reports** filed during a preview carry `viewing_as` (and in Mode 2, `impersonating = true`, target id) in their context, and the `user_id` is the real actor.
- **Analytics, NPS prompts, product tours, "last seen":** skip them while previewing, or tag them, so admins do not pollute the numbers or mark tours complete for a student.
- **Emails the app would send "to you"** go to the real actor.

---

## Build checklist

1. One `access(role)` capability table. List personas, mark which roles `canPreview`, assert each persona is narrower than its previewer.
2. One `effectiveViewer()` resolver. Page, layout, and API guards all call it.
3. Grep for direct role reads and route them through the resolver.
4. Cookie write + server refresh on switch, with in-flight feedback.
5. Rail marker with Exit (expanded, collapsed, phone chip). Account menu entries.
6. Stamp `viewing_as` on feedback reports; skip analytics while previewing.
7. Mode 2 only if needed: session table, signed cookie, minted JWT, fail-closed, rank check per request, read-only by default, audit log.

## Test checklist

Walk the matrix of **personas × gated surfaces**, not a sample:

- For each persona, the rail's item list matches a real account of that persona exactly.
- Every gated page redirects for each persona that lacks it (including admin pages).
- Every gated API route returns the refusal status for each persona that lacks it.
- A tampered cookie (unknown value, a wider role, a non-admin sending it) resolves to no preview.
- Exit from every surface returns the admin's own view with no stale state.
- Collapsed rail and phone width both show the marker and a working exit.
- A feedback report filed while previewing records `viewing_as`.
- Mode 2: expired, ended, forged, and other-actor sessions are all refused; a write in `support` is refused; the service-role fallback is absent.

---

## Lessons from two builds

- **Client-only previews drift.** A first version switched the rail in React state and left pages on the real role. The fix was moving the cookie read into the server's member context, which every page and API already called. It took nine files and fixed every surface at once.
- **Two mechanisms, two cookies, one confused app.** A later app had a signed person-impersonation session and, separately, a role-only cookie, with overlapping UI and different rules. Keep one resolver with two modes.
- **Signing with the service key** couples two secrets that should rotate independently. Use a dedicated one.
- **Re-authorize per request.** A check only at session start leaves a removed teacher with access for the rest of the hour.
- **Unattributed writes** are the worst failure: the data says a student did something an admin did. Default to read-only and stamp `impersonator_id` when writes are allowed.
