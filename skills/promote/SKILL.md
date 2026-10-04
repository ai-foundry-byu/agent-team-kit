---
name: promote
description: Ship to production exactly the build that staging is serving, not whatever main holds now. Finds staging's commit, checks it passed CI and that nothing destructive is pending, then releases THAT commit (version bump, notes, tag, deploy, smoke) and merges the release back into main. Use when the user says "promote", "/promote", "promote staging", "ship what's on staging", or "send the staged build to prod". For releasing the newest work on main use /ship.
---

# promote, ship the build you rehearsed

`/stage` puts a build on staging; people try it; `/promote` sends THAT build to
production. `/ship` releases HEAD, so anything that landed on `main` after the
rehearsal would ride along untested. `/promote` releases the staged commit and
nothing newer. See `docs/RELEASE-PIPELINE.md`.

When to use which:

- **`/ship`** (road A): the newest work on `main`, including anything a
  release flag keeps dark.
- **`/stage` then `/promote`** (road B): the BUILD needed rehearsing. A
  deploy-time change (migration, infrastructure, dependencies), or a change
  whose first audience could do irreversible harm outside the team.

**Invoking this skill is the authorization.** The one question it may ask is
in step 2, and only when `main` has moved past the staged commit.

## 1. Find the two commits and check them

```bash
git fetch origin --tags
status() { curl -s "$1/api/status" | node -pe "JSON.parse(require('fs').readFileSync(0)).commit"; }
STAGED=$(git rev-parse "$(status <staging-url>)")
PROD=$(git rev-parse "$(status <prod-url>)")
```

Read the staged commit from staging itself, never from the newest rc tag: a
failed rc deploy leaves a tag that never ran. Then check, and stop on any
failure:

- `git merge-base --is-ancestor "$STAGED" origin/main`: the staged commit is
  on `main`.
- `git merge-base --is-ancestor "$PROD" "$STAGED"`: otherwise prod already has
  work staging lacks and promoting moves prod BACKWARDS. Re-stage instead.
- `PROD != STAGED`, or there is nothing to promote.
- **CI was green on it.** Filter by SHA; `gh run list --commit` misses runs
  triggered by a tag push:

  ```bash
  gh run list --workflow <ci-workflow> --limit 50 --json headSha,conclusion,headBranch \
    --jq ".[] | select(.headSha==\"$STAGED\") | \"\(.headBranch) \(.conclusion)\""
  ```

- **No destructive migration** in `git diff --name-only "$PROD..$STAGED" -- <migrations-dir>`:
  read each; a drop, a rename, or not-null on a populated column is a stop.

## 2. Decide what is being released

```bash
git log --oneline "$PROD..$STAGED"          # goes out: the rehearsed build
git log --oneline "$STAGED..origin/main"    # stays behind
```

- **`main` has not moved**: the staged commit is the tip. Run `/ship` from its
  migrations step; it is the same release.
- **`main` has moved**: ask ONE question with the second list shown. Promote
  the staged build alone (recommended when that list holds a deploy-time
  change, or anything not behind a flag that could do irreversible harm
  outside the team), or ship all of `main` with
  `/ship`.

## 3. Build the release in a temporary worktree

Never in the shared tree.

```bash
WT="$(mktemp -d)/promote"
git worktree add --detach "$WT" "$STAGED"
```

Inside `$WT`, do `/ship`'s migrations, version bump, release notes and release
commit, with one difference: the notes range ends at the staged commit.

- Apply migrations FROM the worktree, so only the migrations the rehearsed
  build carries reach prod.
- The version is the patch after prod's: the version the rc was named for.

Call the release commit `REL`.

## 4. Put the release on main, then push both refs

The tag must name an ancestor of `main`. `REL`'s parent is on `main`, so a
merge brings exactly the version files across.

```bash
git pull --rebase origin main     # only from the integrating session, clean tree
git merge --no-ff "$REL" -m "chore(release): merge v<version> into main"
git tag v<version> "$REL"
git push --atomic origin main v<version>
git worktree remove "$WT"
```

**Tag `REL`, not the merge commit.** `REL` is what deploys. If the merge
conflicts, it is in a version file because someone shipped meanwhile:
`git merge --abort` and stop, step 1 is stale.

## 5. Watch, smoke, notify, report

Background the watch with a shell loop (never a subagent). Smoke asserts the
COMMIT:

```bash
EXPECT_COMMIT="$REL" <your smoke script> <prod-url>
```

Report the version, the rc it promoted, the commits released, the commits
deliberately LEFT on `main`, and any migration applied. Staging and prod now
run the same code, so no re-stage is needed.

## Stop conditions

- The staged commit is not on `main`, or prod is not its ancestor.
- No green CI run for the staged commit.
- A destructive migration in the range.
- The merge conflicts, or `main` cannot be rebased (a worker session, a dirty
  tree). Never force-push.
- Staging's status endpoint does not answer. Do not guess the commit from tags.

## Project-specific to swap

The staging and prod URLs and their status endpoint shape, the CI workflow
name, the migrations directory and migrate command, the smoke script, the
version files and release-notes file, and your `/ship` steps it reuses.
