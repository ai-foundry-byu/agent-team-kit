---
name: deploy-is-not-release
description: "Separate the three moments: a push runs CI and deploys nothing, a tag deploys (rc tag to staging, final tag to prod), a flag releases a feature to an audience. Never wire a deploy to a push on a branch many agents share."
metadata:
  type: feedback
---

Three different things used to happen at once on a push to main: the code was saved,
built, and shown to users. Split them and each becomes safe to do often.

- **Push = save + CI.** A push to the shared branch runs check, test and build, and stops.
  It reaches nobody, so agents can push every unit of work and get it off one laptop.
- **Tag = deploy.** `v<x.y.z>-rcN` deploys staging; a final `v<x.y.z>` deploys production.
  The prod job refuses anything containing `-rc`. Name an rc after the NEXT version: an rc
  named for the version already in prod reads as "a candidate for what shipped" and sorts
  before it in semver.
- **Flag = release.** New features ship dark and are turned on per audience (team, named
  users, a pilot tenant, everyone) without a deploy.

**Why:** with several agents and a collaborator committing to one branch all day, "push
deploys" means half-finished work goes live, and the owner keeps the push trigger to
themselves, so finished work sits unpushed on one machine. A tag is a deliberate act on one
exact commit.

**How to apply:**
- CI triggers on tags for deploys, on branches only for verification.
- Push both refs atomically when tagging (`git push --atomic origin main <tag>`), so a
  rejected main cannot let a production tag land on a commit that is not on main.
- Reach production only through one skill (push or promote) that bumps the version and
  writes the notes; undo by redeploying the previous release (the host's rollback, or
  re-running the previous tag's CI run), then revert and release.
- See the kit's `docs/RELEASE-PIPELINE.md`, `docs/RELEASE-FLAGS-SPEC.md` and
  [[promote-the-staged-commit]]. This supersedes the push-deploys premise of
  [[commit-freely-never-push]] wherever the pipeline deploys on tags.
