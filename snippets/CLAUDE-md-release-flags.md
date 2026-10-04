<!-- agent-team-kit snippet. Paste into CLAUDE.md once the project has release
flags (docs/RELEASE-FLAGS-SPEC.md). Replace the <...> placeholders. -->
## Release flags (feature by audience)

New features ship to production DARK and are released by audience on
`<admin flags route>` (super admins only): Off, Team, named people, tenants,
Everyone. No deploy; it reaches every request within the cache window.

- **Decide at spec time.** Every spec's Release section names the kind (release
  flag, permanent kill switch, rehearse on staging, no flag) and why, the key,
  the one seam the check goes in, whose flags apply (viewer or resource owner),
  the off path, and the rollout. A flag controls WHO the code runs for, not
  WHAT it does: deploy-time changes (migrations, containers, workers,
  dependencies) rehearse on staging; a per-request change rehearses only if its
  first audience could do irreversible harm outside the team.
- **Declare** the flag in `<registry path>` (the one list; no row = off). At
  most `<N>` at once, enforced by a test.
- **Gate on the server, at one seam**: `<requireFlag(locals, key)>` in a load or
  action, `<flagOnFor(key, ownerId)>` where the owner decides. Off is
  byte-identical to before; additive features return null when off. Never pass
  the flag's value around; data written with it on must read correctly off.
- **Build with it forced on** (`FLAG_<KEY>=1` on your own dev server), never by
  changing a shared environment's audience, and report a flagged build as
  "shipped dark" plus its release step.
- **Kill switch:** `FLAG_<KEY>=0` turns it off everywhere, whatever the page says.
- **Finish it:** reaching Everyone files a cleanup task; after 14 days it reads
  Ready to remove; `/remove-flag <key>` takes it out, after reading every
  environment's deployed value and every caller that leaves an optional flag
  parameter out.
- **Env vars are for what stays** (kill switches, test stubs, configuration).
  Rollouts are release flags; entitlements (plan or license) get their own list.
