---
name: remove-flag
description: Take a release flag out of the code once its feature is on for everyone. Deletes its registry entry, keeps the "on" branch and deletes the "off" branch at every call site, deletes its table row, and closes its cleanup task, in one commit. Use when the user says "remove flag X", "/remove-flag X", "clean up the flag", or a "Remove flag X" cleanup task comes up in the bug queue.
---

# remove-flag, finish a released feature

A release flag (see `docs/RELEASE-FLAGS-SPEC.md`) exists to release a feature
by audience. Once the feature is on for everyone, the flag is debt: two code
paths, one of which nobody runs. Removing it is part of finishing the feature.
The cap on live flags (an arch test) is what makes that stick.

Argument: the flag key, e.g. `/remove-flag comment_export`.

## 1. Check it is ready, and ask the one question

Run your flags report (`pnpm flags:report` or equivalent, against prod).

- It should read **Ready to remove** (on for everyone for the cleanup window,
  14 days by default) or at least **On for everyone**. If it is still dark or
  partial, STOP: removing the flag would release the feature to everyone. Say
  so and ask.
- **Does the feature need a permanent off switch?** Removing a release flag
  removes its env kill switch too, and turning the feature off afterwards costs
  a revert plus a release. Keep one where the feature can **fail without
  erroring** (wrong output, so no fallback fires) and that output feeds
  something that matters (a grade, a payment, a message), or where it writes
  outward (an LMS, email) or costs money per use. If yes, do not
  delete the check: convert it to an OPERATIONAL env flag (a small
  `<name>On()` helper reading the env var, documented with the other
  operational flags), then continue with the registry and row steps. When
  unsure, ask the user.

## 2. Look before you cut

Four checks, each a trap that ships a silent production change if skipped.
Report what each found before deleting anything.

1. **What does each environment actually set?** Read the DEPLOYED config of
   production, staging, CI and any disposable environment for `FLAG_<KEY>`
   (the host's variables, the CI workflow), not the docs. Docs drift. A flag
   forced off anywhere is a reason to stop and ask.
2. **Who calls it without saying?** Find every function that takes the flag
   as an optional parameter (`{ withFeature?: boolean }`) and list every
   caller with what it passes. A caller that leaves it out is running the OFF
   path in production today, even though the flag reads "on for everyone".
   Deleting the off branch silently changes that caller; decide for each one.
3. **What do the protecting tests really cover?** A snapshot of the main path
   says nothing about secondary callers. Name the test that covers each
   caller from step 2, or write one first.
4. **Does anything turn it off on purpose?** Grep tests, fixtures and harness
   config (end-to-end env files, test setup) for the flag set off. If a suite
   disables the feature for isolation, the flag has become test
   infrastructure: rewrite that setup before the flag goes.

## 3. Remove it from the code

1. Delete the entry from the flag registry.
2. Run the typecheck. The compiler now names every call site: the server gate
   (`requireFlag`), owner checks (`flagOnFor`), the viewer's flags, a class
   page's flags.
3. At each site, **substitute** the check with its current value (`true`),
   let the code simplify, and delete only what can no longer run. A server
   gate call is deleted outright. Do not change function signatures in the
   same commit (an optional parameter from step 2 is removed in a follow-up,
   once its callers are settled). Delete tests that pinned the off behaviour;
   keep tests of the feature.
4. Grep for the key as a string to catch comments, docs, help articles and
   walk files. Restore any user-facing help text that was withheld while the
   feature was dark.
5. Typecheck green, then the targeted tests for every file touched, plus the
   flag arch test.

## 4. Remove the row and close the task

Delete the row on the flags admin page: once the key is out of the code it
shows as "Removed from code" with a Delete button. **If the change is not
deployed yet, leave the row**: deleting it first turns the feature OFF for
everyone until the deploy lands. Say the row is left for after the next ship.

Close the cleanup task in the bug queue through your canonical close path,
never raw SQL.

## 5. Commit

One commit, explicit paths: `refactor(flags): remove <key>, on for everyone
since <date>`. Then stop. It reaches users with the next ship, whose flag
report will no longer list it.

## Project-specific to swap

The registry path, the server gate and owner helper names, the flags report
command, the admin page route, the cleanup task's queue and close path, and
where operational env flags are documented.
