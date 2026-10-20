---
name: push
description: Release the newest work on main straight to production (road A of the release pipeline). Lands your own outstanding work, syncs, applies production migrations, writes customer-facing release notes for everything since the last release, bumps the version (patch by default), commits, tags v<version>, and pushes main and the tag together with --atomic; the final tag is what deploys production. Then watches the deploy, smokes the deployed commit, and reports what skipped staging and the flags report. Use when the user says "push", "ship it", "cut a release", "release and push", or "deploy", for small, safe work. For a build that needs rehearsing first, use /stage then /promote. This is the ONLY sanctioned way to push a release; the standing rule is commit-don't-push, and invoking this skill is the user's explicit push authorization for this one run.
---

# push, release HEAD to production

The kit's release pipeline (see [`docs/RELEASE-PIPELINE.md`](../../docs/RELEASE-PIPELINE.md))
keeps three moments apart:

- **A push to `main` runs CI only** (check, test, build). It deploys nothing.
- **An `-rc` tag deploys staging** (the `stage` skill).
- **A final `v<x.y.z>` tag deploys production.** This skill and `promote` are
  the only things that push one.

`/push` is road A: release HEAD of `main` straight to production. Use it for
small, safe or urgent work (a copy fix, a bug fix with a test, anything a
release flag keeps dark). For a deploy-time change (a migration, infrastructure,
dependencies) or a change whose first audience could do irreversible harm
outside the team, use road B: `/stage`, let people try it, then `/promote`,
which releases the exact commit staging served instead of HEAD.

Invoking this skill counts as the explicit "push now" authorization required
by CLAUDE.md; it does NOT carry over to later turns. It does not ask "are you
sure"; it stops only on genuine blockers (below).

> **If your host still deploys on every push to `main`** (a default Vercel or
> Netlify project), the same steps apply, but step 7's push is itself the
> production deploy, so there is no CI-only push and no staging road. Move to
> tag-triggered deploys before several agents or a collaborator share `main`;
> the pipeline doc says how.

## Inputs

- Optional explicit target version in the user's request (e.g. "going to
  0.2.0"). If given, use it. Otherwise bump the **patch** digit of the current
  version in `package.json`.

## Procedure

1. **Preflight and land your own work.**
   - `git status --short`. Commit your own outstanding work with a real
     message, explicit paths only. Leave sibling agents' files alone; never
     discard anything (no `checkout --`, no stash, no `reset --hard`).
   - Confirm you are on `main`.
   - Sync: `git fetch origin --tags`, then `git log --oneline HEAD..origin/main`.
     If it is not empty and you are the integrating session with a clean tree,
     `git pull --rebase origin main`. From a worktree worker, do not release at
     all: releases go out from the cockpit.
   - `git log origin/main..HEAD --oneline`: know exactly what the push will
     publish.

2. **Road check (advisory).** Read the commit prod serves and the commit
   staging serves from their status endpoints. List the commits going out that
   were never on staging and grep their changed paths for road-B kinds
   (migrations, email or outside-system code, prompt files, the worker, the
   container). Do not stop; name them in the report, and point at `/promote` if
   the rehearsed build alone was wanted.

3. **Apply production migrations**, if any are pending, before the deploy.
   Code against a stale schema fails. A destructive migration (a drop, a
   rename, not-null on a populated column) is a stop: say what it will do.

4. **Collect what shipped.** Find the last commit that touched the release
   notes file (`src/lib/content/releases.ts` in the origin project) and list
   everything after it:
   `git log --oneline $(git log -1 --format=%H -- src/lib/content/releases.ts)..HEAD`.
   Cross-check against the newest entry and skip anything its notes already
   describe.

5. **Write the release notes and bump the version.** Add a new entry at the TOP
   of the notes:
   - `version`: the target version. `date`: today, yyyy-mm-dd.
   - `summary`: one sentence naming the headline themes.
   - `sections`: group by customer-visible theme (match prior entries). Plain
     factual copy, **no em dashes**, no internal jargon; write what a user
     sees, not commit subjects. Omit pure-internal work (CI, refactors, test
     scripts, docs); a "Fixes and polish" section may collect small visible
     fixes. Do not oversell or invent. Notes are bundled into the app, so a
     wording fix later costs another deploy.
   - Set `"version"` in `package.json` to the target, and every other place the
     version lives (a `CURRENT_VERSION` constant, the top notes entry).

6. **Verify, then commit.** Run the project check and the version-sync test
   (they must pass). Stage ONLY the notes file and the version files. Commit as
   `chore(release): v<version>` with a body listing the headline themes.
   - **GUARD: commit, tag, and push are SEPARATE steps, never chain them in
     one `;`-joined command.** The `.githooks/pre-commit` gate can reject the
     release commit. If you chain `commit; tag; push`, a blocked commit does
     NOT stop the tag and push, so you tag the prior HEAD without the version
     bump and deploy it. Run the commit alone, confirm it created a new HEAD
     (`git log --oneline -1` shows `chore(release): v<version>`), and only then
     tag: `git tag v<version>`. If the commit is blocked, fix the flagged file,
     re-stage, and re-commit before tagging.

7. **Push both refs atomically.** `git push --atomic origin main v<version>`.
   Without `--atomic`, a rejected `main` still lets the tag land, and the tag
   deploys production from a commit that is not on `main`. If the push is
   rejected (remote ahead), delete the local tag (`git tag -d v<version>`),
   sync as in step 1 (the release commit rebases onto the new tip), re-run the
   check, tag the rebased release commit, and push again. Never force-push.

8. **Watch and smoke.** Background a shell loop on the tag's CI run that exits
   only on a terminal state (never a subagent: they return "monitor armed"
   instead of an outcome). Read the job table before reporting; a job with zero
   steps was refused (billing, quota), not failed. The smoke asserts the
   deployed COMMIT from the status endpoint, not the version.

9. **Notify and report.** If the project runs the
   [feedback loop](../../docs/FEEDBACK-LOOP-SPEC.md), send any reporter notices
   that were held until the fix was live. If it uses release flags, paste the
   flags report (dark, partial, on for everyone, ready to remove): shipping code
   releases nothing behind a flag, so this is what tells the owner what users
   actually got. Then report the version, the themes in the notes, how many
   commits went out, what skipped staging (step 2), and that staging is now
   behind prod and should be re-staged before anyone uses it.

## Stop conditions

- The project check or version-sync test fails: fix or report, do not release.
- A destructive migration is pending.
- A rebase conflicts: abort and report.
- CI is red or the smoke fails on the tag: report it, with the job table. A
  rollback is a manual step (see the pipeline doc, section 4).

## Project-specific to swap

The notes file and its shape, the version files, the check and test commands,
the migrations directory and migrate command, the prod and staging status
endpoints, the CI workflow name, the smoke script, and the reporter-notice step.
