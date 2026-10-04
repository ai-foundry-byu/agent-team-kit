---
name: stage
description: Put a build on staging, the private twin of production, where no customer can see it. Applies pending migrations to the staging database, checks parity with prod, pushes a release-candidate tag for the next version, watches the deploy and smokes the deployed commit. Use when the user says "stage it", "/stage", "put it on staging", "deploy to staging", "I want to demo this", or "let me look at it before it ships". For production use /ship or /promote.
---

# stage, the dress rehearsal

Staging is a twin of production on its own database (see
`docs/STAGING-TWIN-SPEC.md`): same build, same config, a copy of the team's
slice of prod data, and an egress fence so nothing it does reaches a real
person outside the team. It serves two jobs:

- **A demo surface**: show the product on real-shaped data without prod risk.
- **A rehearsal surface**: try a BUILD before customers get it. A migration,
  infrastructure, and anything that writes outward (LMS, email, payments),
  which is the one thing a release flag in prod cannot make safe. A feature
  that only needs people to look at it belongs behind a release flag in prod.

Every staging deploy is **deliberate**: nothing reaches staging except this
skill or a hand-pushed `-rc` tag, so a demo never changes under the presenter.
Do not add an automatic trigger.

**A staging deploy needs no confirmation.** Invoking the skill is the
authorization. It must never drift into production: only a final `v<version>`
tag deploys prod, and the production job refuses any ref containing `-rc`.

## 1. Establish what is being staged

Staging deploys a COMMIT.

- `git status --short`. Commit your own outstanding work with a real
  conventional message, explicit paths only.
- Leave sibling agents' files alone. This is not a cleanup pass. If someone
  else's uncommitted change would alter what is demoed, say so and stage HEAD.
- Never discard anything: no `checkout --`, no stash, no `reset --hard`.
- Sync: `git fetch origin && git log --oneline HEAD..origin/main`. If it is
  not empty and you are the integrating session with a clean tree,
  `git pull --rebase origin main`. From a worker session, or a dirty tree, do
  not rebase: say the staged commit is behind and stage it anyway, or stop.

## 2. Apply pending migrations to the STAGING database

Always before the deploy: code against a stale schema fails. Use your
**staging-only migrate wrapper**, which reads the staging connection string
from the host at call time and **refuses to run if it points at the prod
project**. A bare migration push from a developer machine usually targets
prod.

## 2b. Check parity, stop on drift

Run your parity checker (env names and hashed values, both migration ledgers,
database region and size, host region, auth hooks). Staging must match prod
except for a short, named list of deliberate differences. **On a difference,
stop and report each by name.** If the check cannot run (missing token), say
so rather than skipping it.

## 3. Tag a release candidate for the NEXT version

No version bump, no notes. The version file holds what prod runs; the rc is a
candidate for the next one (an rc named for the current version sorts before
it in semver).

```bash
CUR=$(node -p "require('./package.json').version")
VERSION=$(node -p "const [a,b,c]='$CUR'.split('.').map(Number); [a,b,c+1].join('.')")
git fetch --tags 2>/dev/null || true
N=$(( $(git tag -l "v$VERSION-rc*" | wc -l) + 1 ))
git tag "v$VERSION-rc$N" "$(git rev-parse HEAD)"
git push --atomic origin main "v$VERSION-rc$N"
```

`--atomic`: a rejected `main` must not let the rc tag land on a commit that is
not on `main`. Both fail together; sync and retry.

## 4. Background the watch

Background a shell loop that exits only on a terminal state (never a subagent;
they return "monitor armed" instead of an outcome):

```bash
for i in $(seq 1 22); do
  s=$(gh run view <id> --json status --jq .status)
  [ "$s" = "completed" ] && break
  sleep 60
done
gh run view <id> --json conclusion,jobs --jq '.jobs[] | "\(.name)\t\(.conclusion)\tsteps=\(.steps|length)"'
```

- The jobs that matter are the staging deploy, then the staging smoke. The
  production deploy must SKIP; if it did not, stop everything and report it.
- The staging smoke asserts the deployed COMMIT (from `<staging-url>/api/status`),
  not the version, because an rc bumps no version.
- On failure, read the failed log. A red staging deploy is not an outage; fix
  and stage again.
- Never report a status you did not observe.

## 5. Report

The rc tag, what is on it, any migration applied, the URL, and that
production is untouched.

## After a production ship

A road-A ship leaves staging on older code than prod. When staging's commit is
not a descendant of prod's, stage again before anyone uses it.

## Stop conditions

- A destructive migration is pending: say what it will do before applying it.
- The production deploy did not skip.
- A rebase conflicts: abort and report.
- Parity drift.

## Project-specific to swap

Your staging URL and status endpoint, your staging-only migrate wrapper, your
parity checker and its allowed-difference list, the CI job names, the version
file, and how the team signs in to staging.
