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
  removes its env kill switch too. Anything that writes outward (an LMS, email,
  payments) or costs money per use usually should keep one. If yes, do not
  delete the check: convert it to an OPERATIONAL env flag (a small
  `<name>On()` helper reading the env var, documented with the other
  operational flags), then continue with the registry and row steps. When
  unsure, ask the user.

## 2. Remove it from the code

1. Delete the entry from the flag registry.
2. Run the typecheck. The compiler now names every call site: the server gate
   (`requireFlag`), owner checks (`flagOnFor`), the viewer's flags, a class
   page's flags.
3. At each site keep the ON branch and delete the OFF branch. A server gate
   call is deleted outright. Delete code only the off branch used, and tests
   that pinned the off behaviour; keep tests of the feature.
4. Grep for the key as a string to catch comments, docs, help articles and
   walk files. Restore any user-facing help text that was withheld while the
   feature was dark.
5. Typecheck green, then the targeted tests for every file touched, plus the
   flag arch test.

## 3. Remove the row and close the task

Delete the row on the flags admin page: once the key is out of the code it
shows as "Removed from code" with a Delete button. **If the change is not
deployed yet, leave the row**: deleting it first turns the feature OFF for
everyone until the deploy lands. Say the row is left for after the next ship.

Close the cleanup task in the bug queue through your canonical close path,
never raw SQL.

## 4. Commit

One commit, explicit paths: `refactor(flags): remove <key>, on for everyone
since <date>`. Then stop. It reaches users with the next ship, whose flag
report will no longer list it.

## Project-specific to swap

The registry path, the server gate and owner helper names, the flags report
command, the admin page route, the cleanup task's queue and close path, and
where operational env flags are documented.
