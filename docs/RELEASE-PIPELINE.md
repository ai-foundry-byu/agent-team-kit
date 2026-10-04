# The release pipeline: deploy is not release

How code gets from `main` to people when several agents and a human collaborator
all commit to `main` all day. The short version: **pushing `main` deploys
nothing.** A tag on one exact commit is what deploys, and the kind of tag
decides where.

This is the release half of the kit's environment story.
[`DISPOSABLE-ENVIRONMENT.md`](./DISPOSABLE-ENVIRONMENT.md) says where agents
drive; this doc says how a build moves between environments. It pairs with
[`STAGING-TWIN-SPEC.md`](./STAGING-TWIN-SPEC.md) (what staging is),
[`RELEASE-FLAGS-SPEC.md`](./RELEASE-FLAGS-SPEC.md) (releasing a deployed feature
by audience), and the skills [`stage`](../skills/stage/SKILL.md),
[`promote`](../skills/promote/SKILL.md) and
[`remove-flag`](../skills/remove-flag/SKILL.md). It supersedes the older
[`push`](../skills/push/SKILL.md) model, where a push to `main` was a paid
production deploy.

Stack-agnostic. The reference is GitHub Actions + a container host (Railway,
Fly, Render) + Supabase; the equivalents are named where they matter.

---

## 1. Two words that must stay apart

- **Deploy**: code reaches a server.
- **Release**: people see it.

Most setups weld these together: push `main`, it builds, it is live. That is
fine with one developer. It breaks as soon as `main` is shared by agents and
collaborators, because `main` then always holds someone's half-finished work.
Separating them is the whole design:

- deploys become deliberate and per-commit (a tag),
- releases become per-audience (a flag, see the flags spec),
- and `main` becomes a place to save work, not a button that ships it.

## 2. Triggers are refs, not branches

| You push | CI does | Who sees it |
|---|---|---|
| `main` | check + test + build. **No deploy.** | nobody |
| tag `v<x.y.z>-rcN` | the same gate, then deploy **staging**, smoke staging | the team on the twin |
| tag `v<x.y.z>` | the same gate, then deploy **production**, smoke prod | everyone (subject to flags) |

```
          push main ──────────▶ CI only (nobody sees it)
                │
   your code ───┼── tag vX.Y.Z-rcN ──▶ CI ─▶ STAGING ─▶ smoke (asserts COMMIT)
                │
                └── tag vX.Y.Z ──────▶ CI ─▶ PRODUCTION ─▶ smoke ─▶ notify
```

Two guards in the workflow file itself:

- **The production job refuses any ref containing `-rc`.** In GitHub Actions:
  `if: startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, '-rc')`.
  A release candidate can never reach production by a typo.
- **The staging job runs only on `-rc` tags** (or a manual dispatch). Never on
  push. Staging that redeploys on every push changes under whoever is demoing,
  which is worse than no staging; one project killed its staging for exactly
  that reason before rebuilding it this way.

A CI `precheck` job that notices a SHA already passed the gate on another ref
lets the tag skip straight to deploy, so a commit is verified once, not twice.

## 3. Naming: an rc is a candidate for the NEXT version

`package.json` (or your version file) holds the version already in production.
A release candidate is named for the version it is a candidate FOR:
`CURRENT + 1 patch`, then `-rc1`, `-rc2`, ...

The lesson that set this rule: a team staged `v0.8.57-rc3` after `v0.8.57`
had already shipped. It read as "a candidate for 0.8.57", and semver sorts
`0.8.57-rc3` **before** `0.8.57`, so every tool that sorts tags put the newer
build in the past. Compute the name, do not type it:

```bash
CUR=$(node -p "require('./package.json').version")
VERSION=$(node -p "const [a,b,c]='$CUR'.split('.').map(Number); [a,b,c+1].join('.')")
N=$(( $(git tag -l "v$VERSION-rc*" | wc -l) + 1 ))
```

An rc gets no version bump and no release notes. A release candidate is not a
release.

## 4. Four commands, and that is the whole arsenal

| Command | Moves | What it does |
|---|---|---|
| `/stage` | a commit to **staging** | commits your own outstanding work, syncs, applies migrations to the STAGING database, checks parity with prod, tags the next rc, pushes atomically, watches the deploy, smokes the commit |
| `/ship` | **HEAD** to **production** | lands outstanding work, syncs, applies prod migrations, bumps the version, writes release notes, tags, pushes atomically, watches, smokes, notifies bug reporters, reports what skipped staging and the flag report |
| `/promote` | **the staged commit** to production | the same release, built on the exact commit staging is serving instead of HEAD |
| `/rollback` | production back one | redeploys the previous container (no rebuild, no version bump), re-smokes; `git revert` gets the bad code off `main` afterwards |

Invoking any of them is the authorization. They do not ask "are you sure";
their stop conditions are genuine blockers only (a destructive migration, a
rebase conflict, CI red, a smoke failure).

## 5. Two roads to production

**Road A, straight to prod** (`/ship`). Small, safe or urgent: a copy fix, a
bug fix with a test, anything a flag keeps dark.

**Road B, staging first** (`/stage`, people try it, `/promote`). Use it for
two kinds of change:

- **Deploy-time changes**, which reach everyone the moment they deploy, before
  any flag is checked: a migration (especially one that changes data or
  constraints), infrastructure (the container, the worker, the entrypoint, the
  host config), dependency upgrades, and shared code edited on the way in.
- **Per-request changes whose first audience could do irreversible harm
  outside the team.** Ask three questions about the FIRST audience: what is
  the worst case, whose data does it land on, and can it be undone? Team data
  or reversible: a flag on road A is enough. Irreversible and outside the
  team (a real student's inbox, a live gradebook, a payment, someone else's
  system): rehearse on the fenced twin first. "It writes to an outside system"
  is not by itself the rule; whose data the first audience reaches is. A team
  member who is also a real teacher makes even "Team" reach real students.

Also good on road B: AI prompt changes where you want to read real output
first, and anything a pilot user should try before customers do.

The spec template asks this at spec time, in its Release section
([`../skills/spec/TEMPLATE.md`](../skills/spec/TEMPLATE.md)), so the road is
known before the code is written.

`/ship` carries an **advisory road check**. Before tagging, it reads the commit
prod is serving and the commit staging is serving (both from a status
endpoint), lists the commits going out that were never on staging, and greps
their changed paths for the road-B kinds (migrations, LMS and email code,
prompt files, the worker, the container). It does not stop: it names them in
the report so the owner knows, and points at `/promote` when the rehearsed
build alone was wanted.

## 6. The one rule: promote the exact commit you tested

`/ship` tags HEAD. If anything landed on `main` after you staged, HEAD is not
what was tested, and the untested commits ride along to production. On a
shared `main` that moves dozens of times a day, that is the expected case.

`/promote` closes the gap:

1. **Read the staged commit from staging itself**, from its status endpoint
   (`{ version, commit }`), never from the newest rc tag: a failed rc deploy
   leaves a tag that never ran.
2. **Check it is releasable.** The staged commit is an ancestor of `main`;
   prod's commit is an ancestor of the staged one (otherwise promoting moves
   prod backwards; re-stage instead); CI was green on it. Find the CI run by
   **SHA** (`gh run list --json headSha,...` filtered on the SHA):
   `gh run list --commit` misses runs triggered by a tag push.
3. **No destructive migration in the range** between prod and staged.
4. **Ask exactly one question, only if `main` moved past the staged commit:**
   promote the staged build alone, or ship all of `main` instead. With release
   flags in place, most of the newer commits are dark anyway.
5. **Build the release in a temporary worktree** detached at the staged
   commit, never in the shared tree. Apply migrations FROM that worktree, so
   only the migrations the rehearsed build carries reach prod. Bump the
   version and write notes there.
6. **Merge the release commit back into `main`** (`--no-ff`). The tag must name
   an ancestor of `main`; the merge brings exactly the version files across.
   **Tag the release commit, not the merge.** That is what deploys.
7. **Atomic push**, then watch and smoke asserting the release COMMIT.

## 7. Push main and the tag together, atomically

```bash
git push --atomic origin main v<version>
```

Without `--atomic`, git pushes each ref independently. A `main` rejected for
having moved still lets the TAG land, and the tag deploys production: you now
have a production tag naming a commit that is not on `main`, CI already
deploying it, and no good move left (move a published tag, or burn the
version). Observed in practice from one command:

```
 * [new tag]           v0.7.0 -> v0.7.0
 ! [rejected]          main -> main (fetch first)
```

`--atomic` rejects both together. For staging it matters too: a rejected `main`
must not burn an rc number on a commit that is not on `main`. Sync before the
push (fetch, and rebase only from the integrating session on a clean tree), so
the backstop rarely fires.

Commit and push are separate steps, never `;`-chained: a pre-commit gate that
rejects the release commit must stop the push, or you tag the wrong commit.

## 8. Watching the deploy

The build takes minutes and nothing downstream needs to wait. Background a
shell loop that exits only on a terminal state, and read the job table when it
returns:

```bash
for i in $(seq 1 22); do
  s=$(gh run view <id> --json status --jq .status)
  [ "$s" = "completed" ] && break
  sleep 60
done
gh run view <id> --json conclusion,jobs --jq '.jobs[] | "\(.name)\t\(.conclusion)\tsteps=\(.steps|length)"'
```

**Never delegate the wait to a subagent.** Told to "poll every 60s", agents
return at once with "monitor armed", an announcement instead of an outcome,
and the deploy sits unverified while looking watched. A shell loop cannot do
that.

Read the table before recommending anything. A job GitHub **refused to run**
(billing, quota) has zero steps and no log; it is not a failed deploy, and a
rollback would roll back a good release. Never report a status you did not see.

**Smoke asserts the commit, not the version.** An rc bumps no version, so a
version check passes against the PREVIOUS staging container. Expose
`{ version, commit }` on a status endpoint and have the smoke compare the
commit prefix.

## 9. Staging behind prod is not a twin

After a road-A `/ship`, staging runs older code than prod. A test there now
proves less than it seems. Re-stage before the next time anyone uses staging;
`/ship`'s report says staging is behind and offers it. `/promote` has the
opposite property: afterwards staging and prod run the same code (bar the
version files), so no re-stage is needed.

## 10. How release flags change the picture

With [release flags](./RELEASE-FLAGS-SPEC.md), every commit can go to
production dark and be released by audience from an admin page. That changes
which road a change needs:

- **A feature that only needs people to look at it** ships on road A, behind a
  flag set to the team. Nothing waits on staging, so staged work never blocks
  an urgent fix.
- **Staging keeps the jobs a flag cannot do.** A flag controls WHO the code
  runs for, not WHAT it does, and turning it off undoes nothing already
  written. So deploy-time changes (migrations, infrastructure, dependencies)
  and per-request changes that could do irreversible harm to people outside
  the team at the first audience still rehearse on the fenced twin (section 5).

Migrations are not flagged. A flagged feature's migration follows
expand-contract (add, dual-write, backfill, switch reads behind the flag, drop
the old shape after the flag is removed), so it is safe to apply on road A.

## 11. Keep the version files in sync

A release bumps every place the version lives, together: the package manifest,
any `CURRENT_VERSION` constant, and the top entry of the in-app release notes.
A unit test asserts they agree, and the release runs it (about a second)
before tagging. Release notes are bundled into the app, so wording fixed later
costs another deploy: get them right in one pass.

## The loop, in one line

Commit and push `main` freely (it deploys nothing), `/stage` when the build
needs rehearsing, `/promote` the exact commit that was rehearsed, `/ship` HEAD
when nothing needed rehearsal, release features by flag, and `/rollback` when
the smoke says so.
