# The feedback loop, a build spec

A stack-agnostic specification for an **AI-native in-app feedback and bug-reporting loop**: a widget that captures a report with rich machine context, an admin inbox to triage it, a handoff that loads that full context into a coding agent, and a close-the-loop step that resolves the report and notifies the reporter, bound to the fix commit itself.

This is a spec, not code, so a coding agent can build it in whatever stack you use (SvelteKit, Next/React, Remix, Rails, anything). It assumes **Postgres + Supabase** as the default and calls out what is Supabase-specific with a generic equivalent each time. It pairs directly with the bundled [`fix-bug`](../skills/fix-bug/SKILL.md) skill, which is the agent side of the loop.

---

## Why this loop is worth building

Most feedback systems capture a sentence and lose everything around it. By the time someone looks, the context is gone: what screen, what the user clicked, what errored, what the network did. So reports are vague, repro is guesswork, and the loop never closes back to the person who reported it.

This design inverts that. It is built for a world where a **coding agent does the fix**, so the highest-leverage thing the system can do is **capture enough context that an agent can reproduce and fix the issue without a back-and-forth**, then **close the loop automatically** so reporting feels worth it. Concretely:

- **Capture is rich and passive.** One click grabs the route, a screenshot, the recent click/nav trail, the console and network rings, thrown errors, and the environment, all scrubbed of secrets before they leave the browser.
- **The handoff is one command.** From the inbox, "Open in Claude Code" copies `/fix-bug <id>`. The agent pulls the row, reconstructs the report, downloads the screenshot, and starts with the same context the user had.
- **The loop closes itself.** The fix commit carries a `Bug-Note:` trailer; a git hook resolves the report and notifies the reporter with that note. Fixing and closing are one action, so nothing rots in an inbox.

The result is a feedback channel where reporting is cheap, fixing is well-informed, and the reporter actually hears back.

---

## The loop at a glance

```
  USER                        SYSTEM                         ADMIN / AGENT
  ----                        ------                         -------------
  click Feedback
  (or Cmd/Ctrl+Shift+F)
        |
        v
  panel: describe +     -->   capture context bundle
  pick kind +                 (route, breadcrumbs, console,
  screenshot (opt)            network, errors, env, screenshot)
        |                     scrub secrets client-side
        v                            |
      Send         -->  POST  -->    insert bug_reports row
                                     upload screenshot (private)
                                     stamp server metadata
                                     log bug_events: created
                                            |
                                            v
                                     admin inbox  -------------->  triage: severity + summary
                                     (/admin/bugs)                 "Open in Claude Code"
                                            |                       => /fix-bug <id>
                                            |                              |
                                            |                              v
                                            |                       agent pulls row + context
                                            |                       + screenshot, verifies,
                                            |                       reproduces, fixes
                                            |                              |
                                            |                       commit: "...(bug <id>)"
                                            |                       Bug-Note: <warm sentence>
                                            v                              |
            notify reporter  <--  resolveBug()  <--  post-commit hook -----+
            "We fixed something                (parses id + trailer,
             you reported"                      calls resolve --via commit)
                  |
                  v
        reporter sees it on /feedback (status -> "Fixed", the note,
        can reply or reopen)
```

---

## Part A, The widget (client)

### Mounting and positioning

- **Global.** Mount once in the root layout so it is present on every page.
- **Fixed bottom-right corner**, inset ~20px from the true viewport edge. (Note: if your app toggles a scrollbar gutter, pin to the true edge and compensate, or the tab will jump.) High stacking order (e.g. `z-index: 50`) so it floats above app content.
- **A docked launcher tab** is the resting state (pair it with a Help tab if you have one; keep them locked to the same edge).
- **Keyboard shortcut:** a 3-key chord (e.g. `Cmd/Ctrl + Shift + F`) opens it from anywhere. Avoid 2-key chords (collisions).
- **Programmatic open:** expose an event (e.g. dispatch a custom `open-feedback` event) so other surfaces (a "report a problem" link, a reporter's feedback page) can open it.
- **Screenshot warm-up:** on the launcher button's `pointerdown`, fire a "prime" event that begins loading the screenshot library and capturing, before the panel even renders. Capture feels instant this way.

### The panel

Four states: `launcher` (docked tab), `panel` (the form), `annotate` (full-screen screenshot editor, optional), `sent` (success toast, auto-dismiss ~4s).

```
                                          +-------------------------------------+
                                          |  Feedback                       [x] |
                                          |-------------------------------------|
                                          |  +-------------------------------+  |
                                          |  |   [ screenshot preview ]      |  |   <- click to zoom/annotate
                                          |  |   (captured automatically)    |  |
                                          |  +-------------------------------+  |
                                          |  [x] Include this screenshot        |
                                          |                                     |
                                          |  What should we fix or improve?     |
                                          |  +-------------------------------+  |
                                          |  | Tell us anything.        [mic]|  |   <- textarea, 2000 max,
                                          |  |                               |  |      voice input optional,
                                          |  +-------------------------------+  |      counter when <200 left
                                          |                                     |
                                          |  It's:  ( Bug ) ( Confusing ) (Idea)|   <- single-select, default Bug
                                          |                                     |
                                          |                        [  Send  ]   |
                                          +-------------------------------------+
  [ Feedback ]  <- docked launcher tab
```

**Fields:**

| Field | Type | Rules |
|---|---|---|
| screenshot preview | image | Auto-captured. Optional "Include this screenshot" checkbox, default **on**. Click to zoom / annotate (optional). |
| description | textarea | Max 2000 chars. Placeholder "Tell us anything." Show a remaining-chars counter under ~200 left. Optional voice-to-text button. Stored as `expectation`. |
| kind | single-select buttons | `bug` \| `confusing` \| `idea`. Default unset, sent as `bug`. (This is the only "category" axis; keep it to three.) |
| Send | button | Snapshots values, submits, optimistically shows success, resets, auto-collapses. |

**Panel width** ~380px, capped to viewport minus a margin. Form is keyboard-accessible; Escape collapses to launcher.

### Context capture (passive, on open/send)

Assemble a context bundle on the client (see Part C for the exact shape). It includes: the URL/route and title, viewport and device pixel ratio, color scheme, timezone and locale, scroll position, the last interacted element (a stable selector + its visible text), a small performance snapshot, and four **ring buffers** (most-recent-N, cap ~25 each): breadcrumbs (nav/click/input trail), console lines, network requests, and thrown errors.

Implement the rings as lightweight global instrumentation installed at app boot: patch `console.*`, wrap `fetch`/XHR, listen for `window.onerror`/`unhandledrejection`, and record route changes and clicks. Each ring keeps only the last ~25 entries so the payload stays small.

### PII scrubbing (do this client-side, before anything is sent)

Run every captured string (breadcrumb detail, console text, network URL, error message and stack) through a scrubber that redacts secrets:

- **JWTs:** `eyJ...[.]...[.]...` (three base64url segments) → `[redacted-jwt]`
- **Long opaque tokens:** any `[A-Za-z0-9_-]{40,}` run → `[redacted]`
- **Secret query params:** `?token=`, `&apikey=`, `&access_token=`, etc. → value `[redacted]`
- **Sensitive keys** matching `/(authorization|api[-_]?key|token|secret|password|bearer|cookie|session)/i` → `[redacted]`

Truncate per field (breadcrumb detail ~160, console ~300, network URL ~300, error message ~300, stack ~2000, first ~6 frames). The system never deliberately collects names, emails, or user data; scrubbing is the passive guard against secrets leaking through URLs/logs. (Screenshots can still contain on-screen PII; keep the bucket private, below.)

### Screenshot capture

- Use a DOM-to-PNG library (e.g. `modern-screenshot`, or `html2canvas`); native where available. Dynamic-import it so it's off the critical path; warm it on launcher `pointerdown`.
- Capture `document.body` at scale 1, with a solid background color, after `document.fonts.ready`, **excluding** the widget itself and anything marked `data-feedback-ignore`.
- Failure returns null and never blocks send. Guard the base64 payload (drop if > ~4MB client-side; the server enforces a hard cap too).
- Send as a `data:image/png;base64,...` string in the bundle.

### Submit and offline resilience

On Send: snapshot the form values, `POST` the bundle to the intake endpoint, optimistically show the success state, reset the form, auto-collapse after ~4s. **If the POST fails, enqueue the bundle to `localStorage` and retry on next app boot** so a flaky network never loses a report.

---

## Part B, Data model

Three tables plus a private storage bucket. SQL is plain Postgres; the RLS blocks are Supabase-specific with a generic note after.

### `bug_reports`, the report

```sql
create table bug_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete set null,  -- reporter; null = anonymous
  kind            text not null default 'bug' check (kind in ('bug','confusing','idea')),
  expectation     text,                       -- the reporter's words (what they expected)
  route           text,                       -- where it happened (pathname), <=256
  app_version     text,                       -- human version tag, <=40
  app_commit      text,                       -- exact deployed commit SHA (stamped server-side)
  session_id      text,                       -- browser session uuid, <=80
  context         jsonb not null default '{}'::jsonb,   -- the capture bundle (Part C)
  screenshot_path text,                       -- '{id}/screenshot.png' in the private bucket

  -- triage
  severity        text check (severity in ('low','med','high')),
  summary         text,                       -- admin shorthand, <=280
  reporter_role   text,                       -- reporter's role at filing time (attribution)
  org_id          uuid references organizations(id),  -- reporter's org (was school_id)
  impersonating   boolean,                    -- filed from an admin/demo session?

  -- lifecycle
  status          text not null default 'open' check (status in ('open','triaged','resolved')),
  created_at      timestamptz not null default now(),
  triaged_at      timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id) on delete set null,
  resolved_via    text check (resolved_via in ('admin','cli','commit','system')),

  -- resolution
  resolution      text check (resolution in ('fixed','noise','duplicate','wontfix','by_design')),
  fixed_commit    text,                       -- short SHA, kept only for 'fixed'
  duplicate_of    uuid references bug_reports(id) on delete set null,
  reporter_note   text,                       -- warm sentence shown to the reporter, <=600

  -- denormalized thread state (kept current by a trigger on bug_messages)
  last_message_at   timestamptz,
  last_message_role text check (last_message_role in ('reporter','team')),

  -- the constraints that make the model honest:
  constraint resolution_requires_resolved
    check (resolution is null or status = 'resolved'),
  constraint fixed_requires_note
    check (resolution is distinct from 'fixed' or reporter_note is not null),
  constraint no_self_duplicate
    check (duplicate_of is null or duplicate_of <> id)
);

create index bug_reports_created_idx       on bug_reports (created_at desc);
create index bug_reports_user_idx          on bug_reports (user_id, created_at desc);
create index bug_reports_open_idx          on bug_reports (created_at desc) where status = 'open';
create index bug_reports_kind_idx          on bug_reports (kind, created_at desc);
create index bug_reports_status_idx        on bug_reports (status, created_at desc);
create index bug_reports_duplicate_of_idx  on bug_reports (duplicate_of) where duplicate_of is not null;
```

The two constraints worth calling out, because they encode the loop's discipline at the database level:
- **`fixed_requires_note`**, you cannot mark a report `fixed` without a reporter-facing note. This is what guarantees the loop actually closes *to the reporter*, not just internally. The skill and the git hook both honor it; the DB enforces it as a backstop.
- **`resolution_requires_resolved`**, a resolution only exists on a resolved report. No half-states.

### `bug_messages`, the two-way thread

```sql
create table bug_messages (
  id          uuid primary key default gen_random_uuid(),
  bug_id      uuid not null references bug_reports(id) on delete cascade,
  sender_role text not null check (sender_role in ('reporter','team')),
  sender_id   uuid references auth.users(id) on delete set null,  -- null for CLI/agent-authored team messages
  body        text not null check (length(btrim(body)) > 0),       -- <=2000 enforced server-side
  created_at  timestamptz not null default now()
);
create index bug_messages_bug_id_created_idx on bug_messages (bug_id, created_at);
```

After-insert trigger keeps the parent's `last_message_at` / `last_message_role` current (denormalized so the inbox can sort/badge without a join):

```sql
create function bug_messages_touch_parent() returns trigger
  language plpgsql security definer as $$
begin
  update bug_reports
     set last_message_at = new.created_at,
         last_message_role = new.sender_role
   where id = new.bug_id;
  return new;
end $$;
create trigger bug_messages_touch_parent_t
  after insert on bug_messages
  for each row execute function bug_messages_touch_parent();
```

*(Generic equivalent: do this update in your application's "post a message" handler instead of a DB trigger.)*

### `bug_events`, the audit log

Every lifecycle transition is appended here, so the report's history is reconstructable.

```sql
create table bug_events (
  id           uuid primary key default gen_random_uuid(),
  bug_id       uuid not null references bug_reports(id) on delete cascade,
  at           timestamptz not null default now(),
  kind         text not null check (kind in ('created','triaged','resolved','reopened')),
  from_status  text,
  to_status    text,
  via          text check (via in ('admin','cli','commit','system','reporter')),
  actor_id     uuid references auth.users(id) on delete set null,  -- null for commit-hook closes
  resolution   text,         -- snapshot at this transition
  fixed_commit text,         -- snapshot
  note         text,         -- snapshot of reporter_note
  metadata     jsonb not null default '{}'::jsonb   -- e.g. {severity, summary} on triage
);
create index bug_events_bug_id_at_idx on bug_events (bug_id, at);
```

### Private screenshot bucket

```sql
-- Supabase Storage:
insert into storage.buckets (id, name, public) values ('feedback', 'feedback', false);
```

Private (never public). One PNG per report at `{report_id}/screenshot.png`. The server (service role) uploads on intake; admins read via short-lived **signed URLs** (~10–15 min). *(Generic equivalent: any object store with a private bucket and presigned GET URLs, e.g. S3.)*

### Authorization (RLS, Supabase-specific, with the generic rule)

```sql
alter table bug_reports enable row level security;

-- reporter can file (including the anonymous path)
create policy "insert own report" on bug_reports for insert
  with check (user_id = auth.uid() or user_id is null);

-- reporter sees only their own reports
create policy "read own report" on bug_reports for select
  using (user_id = auth.uid());

-- admins see and update everything
create policy "admin read"   on bug_reports for select using (is_global_admin());
create policy "admin update" on bug_reports for update using (is_global_admin());
```

`bug_messages`: reporter can read/insert messages on reports they own (and only as `sender_role = 'reporter'` with `sender_id = auth.uid()`); admins read all. `bug_events`: admin read only. Storage: admins read the `feedback` bucket.

**Generic equivalent (no RLS):** enforce the same rules in your application's data layer: a reporter query is always scoped to `user_id = current_user`; admin endpoints check an admin role; screenshot access goes through a server endpoint that checks admin and returns a presigned URL. The *rules* are the spec; RLS is just one way to enforce them at the database edge.

---

## Part C, The context bundle (JSON shape)

Stored verbatim in `bug_reports.context`. This is what makes agent-side repro possible.

```jsonc
{
  "session_id": "uuid",
  "captured_at": "ISO-8601",
  "url": "/path?query",
  "title": "document.title",
  "user_agent": "navigator.userAgent",
  "viewport": { "w": 1440, "h": 900, "dpr": 2 },
  "color_scheme": "dark|light",
  "timezone": "America/Denver",
  "locale": "en-US",
  "scroll": { "x": 0, "y": 1280 },
  "last_element": { "selector": "button.save", "text": "Save" },   // or null
  "perf": {
    "load_ms": 1240, "ttfb_ms": 180, "dom_ms": 600,
    "long_tasks": 3,
    "heap_used_mb": 48, "heap_limit_mb": 2048,
    "connection": { "type": "4g", "downlink": 10, "rtt": 50 }
  },
  "breadcrumbs": [ { "t": 1719440000000, "type": "nav|click|input", "detail": "scrubbed <=160" } ],
  "console":    [ { "t": 1719440000001, "level": "log|info|warn|error", "text": "scrubbed <=300" } ],
  "network":    [ { "t": 1719440000002, "method": "POST", "url": "scrubbed <=300", "status": 500, "ms": 240, "ok": false } ],
  "errors":     [ { "t": 1719440000003, "message": "scrubbed <=300", "stack": "scrubbed <=2000", "source": "file:line:col" } ]
}
```

Every ring is capped (~25 entries) and every string is scrubbed and length-clamped per Part A.

---

## Part D, Backend plumbing

### Intake endpoint, `POST /api/feedback/report`

Receives the bundle and:

1. **Rate-limit** (soft abuse ceiling): if this user filed >= ~6 reports in the last ~2 minutes, silently return `{ ok: true, throttled: true }` (no error shown to the user).
2. **Upload the screenshot** (best-effort, non-blocking): decode the data URL, enforce a hard cap (~6MB), upload to `feedback/{id}/screenshot.png`; on success set `screenshot_path`, on failure set it null and still insert the report.
3. **Stamp server-side metadata** the client must not be trusted to set: the exact deployed commit SHA (from your deploy env var, e.g. `VERCEL_GIT_COMMIT_SHA`, first ~12 chars), the reporter's role and org from the server session, and whether the session is an admin impersonation. Attribute `user_id` to the real admin if impersonating.
4. **Insert** the `bug_reports` row (`status = 'open'`).
5. **Log** a `bug_events` row: `kind = 'created'`, `to_status = 'open'`, `via = 'reporter'`.

Returns `{ ok: true, id }`.

### The repair bundle, `buildRepairMarkdown(row)`

A pure function that renders a report row into a readable markdown brief for the agent (the skill reads this plus the raw `context` JSON). Shape:

```
# bug {id8} · {kind}{ · severity}
- status / expected / screen+version / when+session / reporter / agent / viewport / last interaction / scroll / perf
## errors (thrown)       -> message + source + first 6 stack frames
## failed requests       -> method url -> status (ms)
## console               -> level + text
## what they did         -> clock-time breadcrumbs, most recent last
## screenshot            -> saved to feedback/{path} (downloaded alongside as screenshot.png)
```

Keep it a pure function so it powers both the inbox's "copy repair bundle" and the skill's local materialization.

### The single close path, `resolveBug(db, id, input)`

Every close, from the admin UI, the CLI, or the commit hook, goes through one function so the rules and the notification can't be bypassed.

```
input: {
  resolution:   'fixed' | 'noise' | 'duplicate' | 'wontfix' | 'by_design',
  fixedCommit?: short SHA   (kept only when resolution === 'fixed'),
  duplicateOf?: uuid        (kept only when resolution === 'duplicate', not self),
  reporterNote?: string     (<=600; REQUIRED when resolution === 'fixed'),
  resolvedBy?:  admin user id,
  via?:         'admin' | 'cli' | 'commit' | 'system'
}
```

Steps: validate (`fixed` without a note throws), sanitize (clamp the note, drop `fixedCommit`/`duplicateOf` when they don't apply), snapshot the prior status, update the row (`status='resolved'`, resolution fields, `resolved_at/by/via`), append a `bug_events` `resolved` row, then **notify the reporter** (best-effort, non-blocking): title "We fixed something you reported" (for `fixed`) or "We reviewed your feedback", message = the `reporter_note` or a templated default, deep-linked to the reporter's feedback page. If notify fails, log and move on; the resolution already committed.

A matching `reopenBug()` clears the resolution fields and appends a `reopened` event.

### CLI, `bug:resolve`

A thin script over `resolveBug()` for the agent and the hook:

```
bug:resolve <id> [--resolution fixed|noise|duplicate|wontfix|by_design]
                  [--commit <sha>] [--note <text>] [--duplicate-of <id>] [--via commit]
```

Conveniences: default `--resolution fixed`; if `fixed` and no `--commit`, default to `git rev-parse --short HEAD`; accept a short id prefix and resolve it to the one matching report.

---

## Part E, Closing the loop

### The `post-commit` git hook (the keystone)

This is what makes "fix" and "close" a single action. On every commit, the hook scans the message; if it references a bug, it resolves it.

```sh
#!/bin/sh
# post-commit, if this commit fixes a reported bug, close it and notify the reporter.
msg=$(git log -1 --pretty=%B)
id=$(printf '%s' "$msg" | sed -n 's/.*(bug \([0-9a-f][0-9a-f-]\{5,\}\)).*/\1/p' | head -1)
[ -z "$id" ] && exit 0                                  # not a bug-fixing commit -> no-op

note=$(printf '%s' "$msg"       | sed -n 's/^Bug-Note:[[:space:]]*//p'       | head -1)
resolution=$(printf '%s' "$msg" | sed -n 's/^Bug-Resolution:[[:space:]]*//p' | head -1)

if [ -n "$resolution" ] && [ "$resolution" != "fixed" ]; then
  pnpm bug:resolve "$id" --via commit --resolution "$resolution" ${note:+--note "$note"}
elif [ -n "$note" ]; then
  pnpm bug:resolve "$id" --via commit --note "$note"
else
  echo "WARNING: commit landed but bug $id was NOT closed, a 'fixed' close needs a 'Bug-Note:' trailer."
  echo "         amend it (git commit --amend) or run: pnpm bug:resolve $id --note \"...\""
fi
exit 0   # never fail the commit; it already landed
```

Commit convention the agent follows:

```
fix(parser): handle nested conditions without crashing (bug 43f4d0f6)

Bug-Note: The editor no longer crashes when a rule nests conditions.
Bug-Resolution: fixed
```

Rules: the hook is a no-op on commits without `(bug <id>)`, it never fails the commit, and it warns loudly if a fix lacks the required `Bug-Note:` (the DB also refuses a noteless `fixed`). *(This hook is wired the same way as the kit's other git hooks: `core.hooksPath` + `bootstrap.sh`.)*

### What the reporter sees, the `/feedback` page

The reporter-facing surface lists the user's own reports with **reporter-safe status labels** (never the internal `open/triaged/resolved`): "Submitted", "Reviewing", "Fixed" (or "Reviewed" for a non-fixed close). Each report card shows a status timeline, their original words and screenshot, the two-way message thread, and, when fixed, the warm `reporter_note`. The reporter can **reply** in the thread, and **reopen** a report if the fix didn't actually resolve it. A small impact badge ("you've sent N reports, M shipped a fix") makes reporting feel worthwhile. Notifications deep-link here.

---

## Part F, The admin inbox and triage

### Inbox, `/admin/bugs`

Lists reports filtered by status (`open` default, then `triaged`, `resolved`), newest first. Each row: a kind icon (bug / confusing / idea), the truncated description (or "({kind}, no note, see context)"), a metadata line (`route · vX · timeago`), and right-side badges (severity, resolution, a camera icon if a screenshot exists). Click through to the detail page.

### Detail and triage, `/admin/bugs/{id}`

Loads the full row, the reporter's profile, a **signed URL** for the screenshot, the message thread, and the rendered repair markdown, and computes the `/fix-bug {id}` command.

Top actions:
- **Open in Claude Code**, copies `/fix-bug {id}` to the clipboard (the handoff to the agent).
- **Copy repair bundle**, copies the markdown + context for local/AI use.
- **Fixed**, opens a form (required `reporter_note`, optional `fixed_commit`) → `resolve` with `resolution='fixed'`.
- **Close as…**, quick buttons for `noise` / `wontfix` / `by_design`, and a `duplicate` (with a canonical id).
- **Reopen**, if resolved, clears the resolution and re-opens.

Triage panel (when `open`): set `severity` (low/med/high) and a `summary`; moves `status: open → triaged`, stamps `triaged_at`, logs a `triaged` event. The page also renders the context as readable widgets: the breadcrumb trail, failed network requests highlighted, console errors, the screenshot, the last-clicked element, and the environment. The **message thread** lets the team ask the reporter a clarifying question (`ask` action posts a `team` message and notifies the reporter "We have a question about your report").

---

## Part G, Building it in your stack

### Supabase-specific vs generic

| Piece | Supabase form | Generic equivalent |
|---|---|---|
| Reporter scoping | RLS `using (user_id = auth.uid())` | App-layer: always scope reporter queries to the current user |
| Admin access | RLS `using (is_global_admin())` | App-layer admin-role check on admin endpoints |
| Screenshot storage | private `feedback` bucket + signed URLs | Any object store, private bucket, presigned GET URLs |
| Thread denormalization | after-insert trigger | Update the parent in your "post message" handler |
| Service-role writes | service-role client bypasses RLS for intake/upload/events | A trusted server context / DB role for those writes |
| Realtime (optional) | tables are realtime-capable | Poll, or your own websockets, if you want live inbox updates |
| Deployed commit | `VERCEL_GIT_COMMIT_SHA` | Your platform's build-commit env var |

The behavior, the schema, the constraints, and the loop are the spec. Auth, storage, and realtime are pluggable.

### Build checklist for a coding agent

1. **Schema**, create `bug_reports`, `bug_messages`, `bug_events`, the private screenshot bucket, the two load-bearing CHECK constraints, the indexes, and the thread-denormalization trigger (or its app-layer equivalent). Add authorization (RLS or app-layer) per Part B.
2. **Capture lib**, global ring buffers (console/network/errors/breadcrumbs, cap ~25), the client-side secret scrubber, and `buildContext()`.
3. **Widget**, the docked launcher + panel with the three fields and four states, the screenshot capture (warm on pointerdown, exclude the widget), the keyboard chord, and `submitReport()` with localStorage retry.
4. **Intake endpoint**, rate-limit, screenshot upload, server-stamped metadata, insert, `created` event.
5. **Resolution core**, `buildRepairMarkdown()`, `resolveBug()` (with the `fixed`-needs-a-note rule and the reporter notification), `reopenBug()`, and the `bug:resolve` CLI.
6. **Close-the-loop**, the `post-commit` hook and the commit-trailer convention.
7. **Reporter surface**, the `/feedback` page (safe status labels, thread, reopen, impact badge) and the notification deep-link.
8. **Admin inbox**, list + detail/triage, signed-URL screenshots, the "Open in Claude Code" handoff, and the resolve/triage/reopen/ask actions.
9. **Wire the agent side**, install the [`fix-bug`](../skills/fix-bug/SKILL.md) skill so `/fix-bug <id>` pulls the row, materializes the repair markdown + context + screenshot, and follows the verify-first procedure before fixing and committing with a `Bug-Note:`.

### How it pairs with the `fix-bug` skill

The widget and schema are the *capture and storage* half; the [`fix-bug`](../skills/fix-bug/SKILL.md) skill is the *fix* half, and the `post-commit` hook is the *closure* that binds them. Build all three and the loop is complete: a user's one-click report becomes a fully-contexted agent task, a verified fix, and an automatic, warm reply back to the person who reported it. That round trip, made cheap, is what turns feedback into a fast product-iteration engine.
