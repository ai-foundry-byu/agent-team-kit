# The disposable environment, where agents drive

The README lists "separate dev from prod" as an unsolved gap. This is the
solution, and it is the **substrate the agentic QA layer stands on**: the place
where crawlers and the [ux-critique](../skills/ux-critique/SKILL.md) critic can
drive your real app, mutating data and firing actions, without spending real
money, polluting production, or losing the ability to hit undo. Get this wrong
and "let an agent fuzz the app" is a way to email your customers and bill your
LLM account; get it right and it is free, safe, and resettable.

Stack-agnostic. It assumes a Postgres/Supabase-shaped project with a couple of
provider integrations (an LLM, an email sender, maybe an LMS), and calls out the
generic equivalent for anything specific.

> **A sibling, not a replacement.** This doc is where *agents* drive: a seeded or local copy, stubs on for cheap sweeps, safe to wipe. Once real users exist you usually also want a place where *humans* rehearse a build on real-shaped data with real behavior before it ships. That is the staging twin, [`STAGING-TWIN-SPEC.md`](./STAGING-TWIN-SPEC.md): prod's build and config, a slice of the team's own data, and an egress fence. Keep both; they answer different questions. How builds reach each one is in [`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md).

## The one insight: two independent knobs

People conflate "demo vs prod" with "fake vs real." They are **two separate
knobs**, and keeping them apart is the whole trick:

- **WHERE** the app points: a **disposable project** (its own database +
  credentials) vs **production**. Controls data isolation, recoverability, and
  the safety seatbelt.
- **STUBS**: env flags that short-circuit the expensive or irreversible calls
  (real grading/LLM, email sends, LMS pushes) into canned responses. Controls
  **fidelity**, canned vs real behavior.

The payoff of separating them: **fidelity comes from turning stubs off, not from
using prod.** Your app code on the disposable project is the same deploy as prod,
so an *unstubbed* run there exercises the real production code path against a
database you can wipe. You do not need prod to test real behavior. You need the
stubs off.

This matters because the most common failure of a stubbed test environment is a
*fidelity* failure: an agent walks the "grade a paper" flow, the grader is
stubbed to return a fixed score, and the agent files "every grade is identical"
as a bug. That finding is noise the stub manufactured, not a product bug. Real
behavior, on a disposable DB, is what you actually want.

## Three modes, pick by what you are doing

| Mode | How | Fidelity | Cost | Reversible |
|---|---|---|---|---|
| disposable + stubs **on** | source the disposable env (stubs set) | low (canned) | free | yes |
| **disposable + stubs off** | the "real behavior" launcher below | **real LLM / real pipeline** | **real spend** | **yes (reset + reseed)** |
| production | drive prod directly | real everything incl. real data + integrations | real spend | **no** |

- **Default to the disposable project.** Stubbed for cheap broad sweeps (the
  fuzzing crawlers); **stubs-off** when you need real behavior to trust a fix.
- **Production is a deliberate escalation, never a default** (see below).

**Hosted disposable project vs a local one.** The disposable target can be a
*hosted* project (its own cloud database) or a **local** stack on your machine
(a local Supabase, a Docker Postgres). Local is cheaper and more disposable
still, and once real users exist it is the safer default — dev-against-a-shared-
hosted-copy still holds god-mode credentials. The one thing local changes: it
has no inbox anyone triages and a reset wipes it, so a durable *ticket* filed
from a local run belongs in **prod**, separated from human reports by a `source`
queue rather than by living in a second database (see
[walks and sweeps, Part D6](./WALKS-AND-SWEEPS-SPEC.md#d6-a-note-on-where-tickets-live)).
Everything else in this doc — the two knobs, stubs-off fidelity, the seatbelt —
applies to a local target unchanged.

## Why a disposable PROJECT, not just a test account in prod

The obvious shortcut, "I will just sign in as a throwaway account on prod", is
wrong, and it is worth being precise about why, because the reason is subtle.

Row-level security plus a test account limit *who owns the data*: the test user
sees and writes only its own rows. That part is genuinely fine. But a test
account does **not** contain **side effects**. With the stubs off (and on prod
they are off), the same deliberate flows fire for real:

- grading a paper makes a **real, billed LLM call**,
- releasing pushes a **real grade + document to a real LMS course**,
- submitting feedback or a notification sends a **real email**,
- background jobs and webhooks run for real.

And the **fuzzers are worse**: a crawler that POSTs junk to every form action and
clicks every button is *designed* to trip authz holes and side effects. On prod
that is not a test, it is an incident.

So the rule of thumb: **a test account protects your data; the disposable
*project* protects your wallet, your integrations, and your ability to reset.**
RLS cannot give you the last three. Only a separate project can.

## The "real behavior" launcher (stubs off, still disposable)

The highest-fidelity *safe* mode: the disposable project, fidelity stubs off, but
the genuinely irreversible external effects still gated. A launcher that layers
the env explicitly:

```bash
#!/usr/bin/env bash
# Disposable project, REAL behavior. Real grading/LLM (real spend, on purpose),
# but external irreversible effects stay gated (no LMS push, no email).
set -euo pipefail
set -a
[[ -f .env.local ]] && source .env.local      # base: real provider keys (LLM, etc.)
source .env.demo                                # overlay WINS: disposable DB creds
set +a

# SAFETY: refuse to start real-behavior against prod.
case "${PUBLIC_SUPABASE_URL:-}" in
  *YOUR_PROD_REF*) echo "refusing: that is the PROD project" >&2; exit 1;; esac

# Fidelity stubs OFF -> real grading / parsing / assistants (real LLM spend).
unset GRADE_STUB PARSE_STUB CHAT_STUB
# Keep the irreversible EXTERNAL effects gated even in real mode:
export LMS_SYNC=0           # no push to a real LMS course
export EMAIL_API_KEY=""     # no real email sends (logs + skips)

exec your-dev-server --port 5183
```

Two things make this safe and correct:

1. **The layering.** Source your real-keys file first so the LLM keys are present,
   then the disposable-env file second so its database credentials *win*. Your
   process env (sourced) takes precedence over the on-disk prod env your dev
   server might also auto-load, so the app talks to the disposable DB while
   keeping real provider keys.
2. **The gate stays even in "real" mode.** "Real behavior" means real *internal*
   behavior (grading, parsing, the LLM). It does **not** mean real *external*
   side effects. Keep the LMS push and email sender off, those are the
   irreversible, customer-visible ones. You want to exercise your pipeline, not
   your integrations.

## Fuzzers vs the deliberate critic

Not all "drive the app" agents carry the same blast radius, and the rule differs:

- **Fuzzers** (the route/action/monkey [crawlers](./CRAWLERS-SPEC.md)) POST junk
  to every action and click everything. **Disposable project only, always.** Give
  them a hard seatbelt (below). They never touch prod.
- **The deliberate critic** ([ux-critique](../skills/ux-critique/SKILL.md)) walks
  intended flows like a careful user. **Default disposable**, but it *may* be
  pointed at prod as a **deliberate escalation** for the rare case that needs real
  prod data (reproducing a bug against a specific real record) or a real
  integration you cannot fake. When you do: the **critic only, never the
  fuzzers**, accept there is **no reset** (the test account's litter accumulates
  in prod forever, clean it up by hand), and do not connect real integrations to
  the test account unless you are deliberately testing them.

## The seatbelt: make "drive prod" hard, not just discouraged

Two guards, both fail-loud, because discipline alone is not enough when an agent
is improvising:

1. **Issuer-abort in the fuzzers.** Before a destructive run, decode the
   signed-in session's issuer (the JWT `iss`, or your auth provider's project
   ref) and **abort unless it is the disposable project**. A mis-pointed run
   cannot fire at prod, the guard is in the tool, not in a human's memory.
2. **Prod-refusal in every DB-touching script.** Each script that reads or writes
   a database (the real-behavior launcher, the migration-port command, any
   findings-close wrapper, the report generator) refuses to run if the resolved
   project ref is prod. One `case` statement; it has caught real mistakes.

## Driving production on purpose: the graded posture

The seatbelt above keeps a pass *off* prod. Sometimes you want the opposite: to
drive **production deliberately**, because only prod has real data shape, live
integrations, real latency, and realtime — things a disposable copy physically
cannot produce. "Never touch prod" leaves those untested. The answer is not a
binary (read-only vs full access) but a **graded posture, enforced at the
network layer**, which is a stronger guard than issuer-abort because it works
*while pointed at prod*:

| Posture | What leaves the browser | Use |
|---|---|---|
| **open** | everything | disposable target only |
| **read-only** | nothing but `GET`/`HEAD` after sign-in | the default for prod |
| **guarded** | writes, except those that reach other people or tenants | prod, on an account you own |

The mechanism is a request interceptor (Playwright `page.route`, or a proxy):
sign-in is the one permitted write, then the posture narrows and **every
non-GET request is aborted in the browser before it reaches the server**, with
each blocked attempt recorded (so "the pass tried to write here" shows up in the
report). This is enforcement, not a label heuristic you can rename your way past.

**The line `guarded` draws is your data vs other people's, not "is it my
account."** Owning the account does not make a broadcast, an LMS push, or an
impersonation safe — those escape the account. So `guarded` blocks a small,
readable **escape list**, each entry with a stated reason:

- **admin / cross-tenant writes** (broadcasts, org/school config, deletions,
  support replies) — they act on every tenant, not just you;
- **impersonation / view-as** — they attribute your writes to a real user;
- **LMS release / pushback** — writes grades into a real course (unblock only
  once the LMS target is genuinely ring-fenced);
- **invites and support replies** — real email to a real person;
- **payments** — real money.

Everything else — creating, editing, grading, curving on your own account,
spending your own credits — goes through, which is exactly the fidelity you came
to prod for. Admin *reads* (a prompt inspector, a health page, a log view) are
GETs, so they work in every posture; it is only the admin *writes* that escape.
Keep the escape list unit-tested in both directions: a rule that stops blocking
is how a broadcast reaches every user, and a rule that over-blocks quietly guts
the fidelity. Guard tooling that can touch prod like you guard app code.

Two corollaries specific to prod:

- **Fuzzers (sweeps, the crawlers) never get `guarded`; they are refused on prod
  outright.** A sweep clicks every control on a screen, and its skip heuristic
  gets caught missing. Only a scripted **walk** — a fixed, navigational path —
  is safe to point at prod, and even then read-only by default.
- **Prod screenshots hold real PII.** A screenshot of a real class carries
  student names and scores (an education record); a finding filed from a prod
  pass omits its image unless the surface holds no real people. Prefer a
  dedicated prod QA account whose classes are your own.

## Migrations: authored once, against prod; the disposable replays

A migration is just a **tracked SQL script** (a ledger table records which a
database has run, so each runs it once, in order). The disciplined model:

- **Author once, against prod (canonical). Never author a disposable-only
  migration.** "Port it over" means run the same files against the disposable
  project. Push to prod (`supabase db push` or your tool's equivalent), then port
  with a one-line `db:push:demo` wrapper that runs the same push against the
  disposable DB's connection string.
- **DDL** (schema: `ALTER TABLE`...) replays everywhere, always port it.
- **A data migration** (DML: `UPDATE`...) is environment-specific: prod's real
  rows are not the disposable project's seeded rows. An *idempotent* backfill
  packaged as a migration file does port; a one-off prod data correction is
  prod-only, and the disposable project gets correctness from its **seed + reset**,
  not by replaying prod's data change.
- **Port before the next run.** A migration shipped to prod but not ported leaves
  the disposable project on a stale schema, so the next crawler/critic run walks
  the wrong schema and the findings are garbage (or a crash that masks real ones).
  Porting right after the prod push is load-bearing, not housekeeping.

## Where findings, fixes, and closes live

This is where the disposable environment meets the [feedback
loop](./FEEDBACK-LOOP-SPEC.md):

- **Findings** the agents file live in the **disposable** inbox (they ride the
  same capture pipeline as a real user report, tagged by `source`). They are
  ephemeral, a reset wipes them, and that is fine: a finding's durable artifact is
  the **fix commit** plus the run's annotated report, not the ticket row.
- **Fixes are code, so they go to the repo and ship to prod** like any change,
  regardless of which inbox the finding sat in.
- **Close a finding against the database it was filed in.** Real user bugs close
  on prod (the normal commit-bound close); agent findings filed on the disposable
  project close there (a thin wrapper that points your `bug:resolve` at the
  disposable env first). Closing where it lives keeps the inbox honest.

## The standard loop, in one line

Port any pending migrations to the disposable project, drive it (stubs off when
you need real behavior), let the agents file findings into its inbox, fix in the
repo, and close on the disposable project, while production stays the place real
users and real bugs live and the one place you never point a fuzzer.
