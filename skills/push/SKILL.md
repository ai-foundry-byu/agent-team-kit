---
name: push
description: Cut a release and push main to GitHub (which triggers the paid Vercel production build). Writes customer-facing release notes for everything committed since the last release, adds them to the in-app Releases tab (src/lib/content/releases.ts), bumps the version (patch by default), commits the release, then pushes. Use when the user says "push", "ship it", "cut a release", "release and push", or "deploy". This is the ONLY sanctioned way to push, the standing rule is commit-don't-push, and invoking this skill is the user's explicit push authorization for this one run.
---

# push, cut a release, then push to GitHub/Vercel

Pushing `main` triggers a paid Vercel production build, so a push should always
ship as a *release*: versioned, with customer-facing notes in the app. This
skill does that, then pushes. Invocation of this skill counts as the explicit
"push now" authorization required by CLAUDE.md; it does NOT carry over to later
turns.

> **Two deploy triggers.** This skill assumes the host deploys on every push to `main`. If several agents or a collaborator share `main`, prefer a pipeline that deploys on TAGS instead (a push runs CI only, an `-rc` tag deploys staging, a final tag deploys prod); see [`docs/RELEASE-PIPELINE.md`](../../docs/RELEASE-PIPELINE.md) and the `stage` and `promote` skills. In that setup this skill's steps are the same, but the last one pushes `main` and the version tag together with `git push --atomic`.

## Inputs

- Optional explicit target version in the user's request (e.g. "going to
  0.2.0"). If given, use it. Otherwise bump the **patch** digit of the current
  version in `package.json`.

## Procedure

1. **Preflight.**
   - `git status --short`, only release files may be staged by this skill.
     Unrelated dirty files stay untracked/unstaged; never sweep them in.
   - Confirm you are on `main` and the working tree has no staged changes you
     didn't make. If there are uncommitted changes that look like they belong
     in the release (work the user just finished), stop and ask whether to
     commit them first.
   - `git log origin/main..HEAD --oneline` after a `git fetch origin`, know
     exactly what the push will publish.

2. **Collect what shipped.** Find the last commit that touched
   `src/lib/content/releases.ts` and list everything after it:
   `git log --oneline $(git log -1 --format=%H -- src/lib/content/releases.ts)..HEAD`.
   Cross-check against the newest entry in `releases.ts` and skip anything its
   notes already describe.

3. **Write the release notes.** Add a new entry at the TOP of the `releases`
   array in `src/lib/content/releases.ts`:
   - `version`: the target version. `date`: today, yyyy-mm-dd.
   - `summary`: one sentence naming the headline themes.
   - `sections`: group by customer-visible theme (match the headings style of
     prior entries). Voice rules (BRAND.md + memory): plain factual copy,
     assistant-not-replacement, **no em dashes**, no internal jargon, write
     what a teacher sees, not commit subjects. Omit pure-internal work (CI,
     refactors, test scripts, docs); a "Fixes and polish" section may collect
     small visible fixes. Do not oversell or invent.

4. **Bump the version.** Set `"version"` in `package.json` to the target.
   It must equal the new top entry in `releases.ts` (`CURRENT_VERSION` derives
   from it).

5. **Verify.** `pnpm check` must pass. (Full `pnpm build` is not required for
   a notes+version change, but if other unpushed commits never saw a build,
   consider `source ~/.nvm/nvm.sh && nvm use 20 && pnpm build`, pushes are
   expensive to get wrong.)

6. **Commit.** Stage ONLY `src/lib/content/releases.ts` and `package.json`.
   Commit as `chore(release): v<version>` with a body listing the headline
   themes.
   - **GUARD: commit, tag, and push are SEPARATE steps, never chain them in
     one `;`-joined command.** The `.githooks/pre-commit` gate can reject the
     release commit (e.g. prettier wants single quotes around a string that
     contains `"..."`). If you chain `commit; tag; push`, a blocked commit does
     NOT stop the tag/push, so you publish the prior HEAD WITHOUT the version
     bump and tag the wrong commit, and the recovery push is a SECOND paid
     build. Run the commit alone, confirm it created a new HEAD
     (`git log --oneline -1` shows `chore(release): v<version>`), and only then
     tag: `git tag v<version>`. If the commit is blocked, `prettier --write` the
     flagged release file, re-stage, and re-commit before tagging.

7. **Push.** `git push origin main --tags`. Confirm the push succeeded
   (`git status` shows up to date with origin/main).

8. **Report.** If the project uses release flags, paste the flags report (which
   flags are dark, partial, on for everyone, and ready to remove): shipping code
   releases nothing behind a flag, so this is what tells the owner what users
   actually got, and which flags are owed a removal.
   Then tell the user the version shipped, the themes in the notes, how many
   commits were published, and that Vercel is now building. Link the Releases
   tab path (`/releases`) so they can eyeball the copy.

## Failure handling

- If `pnpm check` fails, fix or report, do not push a broken release.
- If the push is rejected (remote ahead), `git pull --rebase origin main`,
  re-verify, and push again. Never force-push.
