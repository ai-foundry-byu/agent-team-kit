---
name: fix-bug
description: Load an in-app bug report by id straight from the database and start fixing it. Use when the user says "fix bug <id>", "/fix-bug <id>", pastes a bug_reports id, or clicks "Open in Claude Code" in the /admin/bugs inbox (which copies `/fix-bug <id>` to the clipboard). Pulls the report row, reconstructs the session timeline, downloads the screenshot, and begins diagnosis with full native context already loaded.
---

# fix-bug — load a bug report and fix it

A teacher filed a bug through the in-app feedback widget. The report lives in the
`bug_reports` table (the source of truth) with a rich context bundle: route,
breadcrumbs, console + network rings, environment, and a screenshot in the
private `feedback` storage bucket. This skill pulls all of it locally so you can
fix the bug with the same context the teacher had.

## Input

A `bug_reports` id (full UUID or the short 8-char prefix shown in the inbox).
Call it `$ID`.

## Procedure

1. **Load env.** The connection string and Supabase keys are in
   `lawgrader/.env.local`: `DATABASE_URL`, `PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`. Read them from there; do not hardcode.

2. **Fetch the row** with psql, as JSON. If given a short prefix, match on
   `id::text LIKE '<prefix>%'`:

   ```bash
   psql "$DATABASE_URL" -At -c \
     "select row_to_json(b) from bug_reports b where id::text like '$ID%' limit 1;"
   ```

   If no row, stop and say so.

3. **Materialize the bundle** under `lawgrader/.bugs/<short-id>/`:
   - `context.json` — the row's `context` field, pretty-printed (raw timeline,
     console, network, env).
   - `report.md` — a readable summary: the teacher's `expectation`, `route`,
     `app_version`, failed requests, console errors, and the breadcrumb trail.
     (The same shape `buildRepairMarkdown` produces in
     `src/lib/server/feedback/bug-reports.ts` — reuse that format.)

4. **Download the screenshot** if `screenshot_path` is set (service-role read of
   the private bucket):

   ```bash
   curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$PUBLIC_SUPABASE_URL/storage/v1/object/feedback/<screenshot_path>" \
     -o lawgrader/.bugs/<short-id>/screenshot.png
   ```

5. **Read everything in — lead with what the teacher saw and said.** Start with
   the two human inputs, in this order:
   1. **View `screenshot.png` first** (you read PNGs natively — the marked-up
      screen is real multimodal context). Look at what they circled, where they
      were, and what the UI actually shows.
   2. **Read the teacher's narrative** — the `expectation` in `report.md`, in
      their own words: what they expected and what they got.

   Only then bring in the telemetry to corroborate: read `context.json` and the
   rest of `report.md` (failed request + console error, breadcrumbs, env) and the
   candidate files those point at. The screenshot and narrative are the primary
   account; the rings confirm and localize it.

6. **Verify the claim is real — BEFORE touching any code.** A report is a user's
   account of what they saw PLUS, usually, their theory about the cause. The
   account may be right while the theory is wrong, and users routinely
   misinterpret working behavior as broken. Do not inherit their diagnosis.
   Separate the two:
   - **Observation** — what actually happened on screen (anchor this in the
     screenshot and the teacher's narrative, then corroborate with the
     breadcrumbs + network/console rings).
   - **Their theory** — *why* they think it happened ("it only sees X", "it
     never saves", "the button is broken"). Treat this as a hypothesis to
     **disprove**, not a spec to implement.

   Then establish ground truth before deciding anything:
   - **Read the actual code path** the complaint names and check whether the
     behavior they want already exists. The most common false fix is *adding
     something that is already there* — verify presence/absence in the code, do
     not assume from the report.
   - **Reproduce the behavior.** If the rings carry a thrown error or a failed
     request, that is your repro — confirm the code path produces it. If it is a
     **quality/behavior complaint with no error** (nothing failed in telemetry),
     the rings cannot confirm it — reproduce it live: run the app (the `/run`
     skill or `pnpm dev`) and, when feasible, open the **exact entity from the
     report** (the `route`/ids in the row) and drive the same action. Inspect the
     real payload/DOM, not your assumption of it.

   Classify the result, and only ONE outcome leads to a code change:

   | Finding | Action |
   |---|---|
   | **Real bug**, reproduced | proceed to step 7 (fix) |
   | **Works as designed** (their theory was wrong; behavior is correct) | do NOT fix — close `by_design` with a kind note (step 8's close path) |
   | **Misunderstanding / UX confusion** (right that it's confusing, wrong that it's broken) | usually a clarity/affordance change, not the fix they asked for — decide deliberately, or close `by_design` |
   | **Cannot reproduce** | do not guess-fix — note what you tried and leave it `open` (or ask the reporter for the missing detail) |

   When the verdict is "not a bug", say so plainly and close it honestly — a
   respectful "we looked, here's how it actually works" beats shipping a change
   that fixes nothing. Surface a genuinely uncertain call to the user rather than
   forcing it.

7. **Diagnose and fix (only a verified real bug).** With the repro in hand, find
   the responsible code and apply the fix per the repo's normal workflow. Fix the
   actual failure you reproduced — not the user's guessed cause if verification
   showed it was elsewhere.

8. **Close the loop in the commit.** Closing is not a separate step you have to
   remember — it is bound to the commit by a `post-commit` git hook
   (`.githooks/post-commit`). Reference the bug id and carry the customer-facing
   note as a trailer, and the hook stamps the row resolved **and** notifies the
   reporter automatically (via the same `pnpm bug:resolve` → `resolveBug()` path
   the admin UI uses). So the fix and its closure are one action:

   ```
   fix(grade): re-run surfaces the failure reason (bug 84b05db6)

   Bug-Note: Re-run now tells you why it could not run instead of spinning silently.

   Co-Authored-By: …
   ```

   - The `Bug-Note:` is shown to the reporter on their /account "Your feedback"
     drawer AND is the body of the in-app notification. Write ONE warm, plain
     sentence (no internal jargon, no file names). It is REQUIRED for a fix —
     commit without it and the hook **warns** and leaves the row `open` (the DB
     CHECK refuses a noteless `fixed`). Recover with `git commit --amend` (the
     hook re-fires) or run `pnpm bug:resolve "$ID" --note "…"` manually.
   - **Not a real bug?** Close it with the honest reason via a `Bug-Resolution:`
     trailer — `noise | duplicate | wontfix | by_design` (these read to the
     reporter as a neutral "Reviewed"; a note is optional). For a duplicate, run
     `pnpm bug:resolve "$ID" --resolution duplicate --duplicate-of <id>` (the
     hook handles note + resolution trailers, not duplicate-of).
   - The hook is a no-op on any commit without a `(bug <id>)` tag, and it can
     never fail the commit — it only stamps and, on a gap, warns.

9. **`.bugs/` is local-only.** It is gitignored; never commit report bundles
   (they contain student PII from screenshots and prompts).

## Notes

- The DB row is canonical and always current — prefer re-querying over any stale
  local copy.
- If the screenshot 404s or capture failed at report time, proceed without it;
  the structured context usually pinpoints the bug on its own.
