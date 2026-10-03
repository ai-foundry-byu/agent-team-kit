---
name: build-spec
description: Execute an approved spec from .specs/<slug>/: work the punch list, close each acceptance criterion with the cheapest verifier that can actually check it, and commit as you go. Use when the user says "build it", "/build-spec", "execute the spec", "work the punch list", or approves a spec written by /spec. Resumable: state lives in punchlist.md, so a fresh session continues where the last one stopped.
---

# build-spec, work the list until every criterion is closed

The spec named the criteria. This skill turns them into code, and the definition
of done is **every criterion closed by the cheapest verifier that can actually
check it**, not "the diff looks right".

Three verifiers, and the spec already tagged which is which:

| Tag           | Closed by                                                    |
| ------------- | ------------------------------------------------------------ |
| **unit**      | a test next to the source                                    |
| **structure** | an architecture guard or a grep assertion                    |
| **walk**      | a browser check: the check sheet (default), or a walk step    |

Project commands below are written generically (`<typecheck>`,
`<targeted tests>`, `<full suite>`). Take the real ones from the project's
CLAUDE.md.

## Verification mode, decide once, at the start

**Default: tests plus a check sheet.** Write and run the `unit` and `structure`
tests as you go, and collect every `walk` criterion into `.specs/<slug>/check.md`,
a numbered sheet the user drives in a few minutes. This is the mode unless a
walk is asked for.

**Walk mode** only when the project has a walk harness, the spec names a
scaffolded walk, AND the user asks for it (or the journey is one that will
regress silently and is worth a runner). A walk is real coverage and real cost:
a live account, fixture data, a fence around shared tenants, and an iteration
budget. Do not default to it, and never scaffold one mid-build without asking.
In walk mode, read the project's walk-writing guide before touching the walk
file; most early failures in a new walk are the assertion, not the app.

## The check sheet

One entry per `walk` criterion, in the order the user would naturally travel
them. Three lines each, nothing more:

```
### 2.2, a group-scoped coordinator cannot publish school-wide   [criterion 2.2]
Go:      http://localhost:<your port>/department   (as the group-scoped coordinator)
Do:      open the "Visible to" picker on any unshared row
Expect:  the group is offered. School-wide is NOT in the list.
```

- **`Go:` is a full clickable URL** on the dev server you built against, not a
  bare route. Every entry is one click from where the user is.
- **The negative is its own entry.** "X is absent for Y" gets its own number,
  never a clause on the positive. A hand check is weakest exactly there.
- **Name the persona and the route.** A check that starts "log in as someone in
  the department" is a check nobody runs.
- **Expect one observable thing.** If the Expect line needs an "and", split it.
- **Say which criteria cannot be checked by hand**, and how they were closed
  instead (usually a unit test over the same predicate).

Mark each entry as you verify it yourself in the browser, when you can. What you
could not reach (a second persona you have no password for, a state that needs
fixture data) stays unchecked and is reported as such. An unchecked line is
information. A line you claim to have checked and did not is a lie the user will
find later.

## Before starting

1. Read `.specs/<slug>/spec.md` end to end, including **Considered and
   rejected** and **Decisions already made**. They exist so you do not
   re-litigate them. If you think a rejected option is right, say so once and
   defer to the user.
2. Read `punchlist.md` and take the first unchecked item.
3. Start a dev server only if you need a browser, and only on the port assigned
   to this session, never the human's.

## The loop, per item

1. **Implement it.** Match the surrounding code. Put new data access behind the
   module that owns it, not inline in a route or component.
2. **Write the tests the item makes necessary.** Close its `unit` criteria with
   tests and its `structure` criteria with a guard or a grep assertion. These
   never appear in a browser, so they are the easiest to skip. Include the tests
   for any dependency the change CREATES (moving a write behind an access policy
   means the code now depends on that policy; a write the policy blocks often
   reports success and does nothing).
3. **Add the item's `walk` criteria to `check.md`** (or fill in its walk steps,
   in walk mode). The criterion text is frozen: it is what the user approved. If
   a criterion cannot be checked as stated, that is a finding for the user, not a
   licence to reword it.
4. **Run the targeted tests** for what you touched: the co-located tests and any
   suite you know shares the code.
5. **Look at it in the browser** when the item is visual, and compare it with the
   mockup the spec names. A screenshot is worth more than a paragraph claiming
   the layout matches.
6. **Check the box in `punchlist.md`** and commit that item alone, with explicit
   paths (`git commit -m "..." -- <paths>`), so a sibling agent's staged work is
   never swept in.

Repeat. State lives in the file, so a fresh session resumes by re-reading it.

## When a check fails, read it before changing anything

Ask which it is: a **real defect** (fix the app), a **mistaken expectation** (a
finding for the user, not a rewrite), or a **fixture gap** (say so, do not fake
it).

Confirm a suspected real defect independently before reporting it: a query, a
second surface, a log line. A `select count(*)` that returns 0 turns a theory
into a fact.

In walk mode, the usual early reds, in rough order of frequency: waiting for a
navigation that a client-side form submit never makes; an "is it visible"
assertion not scoped to a region, so it matches the same text elsewhere on the
page; a persona switch that dropped state held in a cookie; a soft delete, so
the database is the wrong oracle for teardown; a missing fixture reported as a
product bug. Cap the loop at **10 passes** over the walk, then stop and report
what is stuck, with screenshots.

## Never do this

- **Do not reword a criterion to make it pass.** That is the line the user
  approved. Changing an expectation because the code disagrees inverts the
  whole exercise.
- **Do not drop a failing check.** Report it.
- **Do not claim a browser check you did not run.**
- **Do not lift a fence** so a write can land. Fences guard real tenants.

## Finishing

- `<typecheck>` and the targeted tests green. Run `<full suite>` only if you
  touched shared code, plus `/regression-check`.
- Review the diff (the project's review skill if it has one; otherwise read it
  yourself, top to bottom, as a reviewer would).
- **Leave your dev server running and hand over the link.** In check-sheet mode
  the user IS the walk, so the last thing you say includes
  `http://localhost:<your port>/<the route to open first>` and the path to
  `check.md`. Killing the server at the end of a build the user is about to
  verify is the one wrong move here. Say which port it is, and kill it when they
  say they are done.
- Hand over `check.md` with what you verified marked, plus screenshots of the
  surfaces you changed. In walk mode, send the recording instead: the video is
  how the user judges fidelity without driving the app.
- Report honestly: criteria closed and by which verifier, criteria left open and
  why, anything you assumed. If a criterion turned out to be uncheckable as
  written, say so plainly. It is the most useful thing you can hand back.

Then stop. Releasing is a separate, deliberate step (`/push` or the project's
release skill), and only when asked.
