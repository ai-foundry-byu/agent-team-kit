# <Feature>, spec

**Status:** draft, awaiting approval
**Mockups:** <.mockups/... paths, or "none, not a visual change">
**Walk criteria recorded in:** <the tracked walk skeleton or acceptance file from Step 4>.
Checked by hand off `check.md` unless someone asks for walk mode.

## Intent

<One paragraph. What changes for the user, in their language. If you cannot say
it without listing implementation, the scope is not settled yet.>

## Access and release

<Required. Decide, before code exists, WHO gets this and HOW it reaches them: a
mockup is too early and build time is too late (the code's shape already
exists). See the kit's docs/RELEASE-FLAGS-SPEC.md, section "Who sees what".>

### Access: what differs by person, and which lever handles it

<One row per thing that differs by person or organisation. Write "n/a: the
same for everyone" if nothing does. Pick the lever with the first YES:
1. Does it go away when a rollout ends? -> release flag (below).
2. Is it for switching something off in an incident? -> kill switch (env).
3. Does it depend on the person's relationship to the data (their class,
   tenant, own records)? -> role / relationship: an access policy + helper.
4. Does it depend on what their organisation bought or turned on? ->
   entitlement (bought: plan, license) or enablement (switched on: tenant
   setting), stored on the tenant's row.
5. Does the user choose it? -> preference.
Tiebreak between 1 and 4: will some customer PERMANENTLY get "no", on purpose?
Then it is an entitlement and the check stays forever.>

| What differs | For whom | Lever | Exactly where (policy + helper, tenant field, flag key, setting) |
| ------------ | -------- | ----- | ---------------------------------------------------------------- |
| <...>        | <...>    | <...> | <...>                                                            |

<Every row is enforced on the server or by the database, not only in the UI.
UI reads one capability function (`can(viewer, "x")`) if the project has one.
Each row about visibility brings a NEGATIVE walk criterion.>

### Release

- **Kind:** <release flag | permanent kill switch | rehearse on staging | no
  flag>, because <reason>.
  <How to choose. A flag controls WHO the code runs for, not WHAT it does, and
  turning it off undoes nothing already written. Deploy-time changes
  (migrations, containers, workers, dependencies, shared code edited on the way
  in) reach everyone before any flag is checked: rehearse those. For
  per-request changes ask: at the FIRST audience, what is the worst case, whose
  data does it land on, can it be undone? Team data or reversible: a flag is
  enough. Irreversible and outside the team (a real inbox, a live gradebook, a
  payment): staging first. Pure refactors get tests, not flags.>
- **Flag key:** <`snake_case_key`, or n/a>
- **Seam:** <the ONE place the check goes (a load, an action, a component
  boundary). If none exists yet, the first punch-list item creates it.>
- **Whose flags apply:** <the viewer | the resource owner (shared pages,
  background jobs, anything with no viewer)>
- **Off path:** <what a user without the flag sees (should be: no change), and
  why any migration is safe for code running with the flag off>
- **Rollout:** <team, then <pilot>, then everyone. Who decides each step.>

## Stories and acceptance criteria

Tags: **walk** = a browser check, by hand or by a walk runner · **unit** = a
test next to the source · **structure** = an architecture guard or grep assertion.

<If Release kind is a release flag, include the three standard criteria (renumber
into the right story): a `walk` check that a user WITHOUT the flag does NOT see
the feature; a `unit` test that flag-off behaves exactly as before; a
`structure` check that every server action and load for the feature checks the
flag on the server, not only in the UI.>

| #   | Criterion | Tag | Notes |
| --- | --------- | --- | ----- |
| R.1 | NEGATIVE: a user without `<key>` does not see <feature> | walk | <surface, persona> |
| R.2 | With `<key>` off, <the affected path> behaves exactly as before | unit | <which module or snapshot> |
| R.3 | Every server action and load for <feature> checks `<key>` on the server | structure | <guard or grep> |

### S1, <as a ..., I ...>

| #   | Criterion | Tag | Notes |
| --- | --------- | --- | ----- |
| 1.1 | <what must be true, naming the persona and the surface> | walk | <the screen it is checked on> |
| 1.2 | <the NEGATIVE, if 1.1 is about visibility, permission or audience> | walk | |
| 1.3 | <a pure predicate> | unit | <which module> |
| 1.4 | <"there is one path for X"> | structure | <which guard or grep> |

### S2, ...

## Decisions already made

<The exploration residue, one bullet each. Copy. Empty state. Error state.
Loading. What happens with the flag off. What the thing is called. This section
is why the spec exists: without it the build re-litigates settled ground.>

## Considered and rejected

| Option | Why not |
| ------ | ------- |
| <...>  | <...>   |

## Open questions

| # | Question | Recommended default | Blocking? |
| - | -------- | ------------------- | --------- |
| 1 | <...>    | <...>               | no        |

<Blocking = proceeding under any assumption would be unsafe, or would make the
work useless if wrong. Almost nothing is blocking.>

## Constraints in this repo

<Fill from the project's CLAUDE.md. Delete lines that do not apply; do not
leave them blank.>

- **Where the logic lives:** <module / domain that owns it. Queries go behind
  it, not inline in a route or component.>
- **Flag:** <see Release above; name the registry file it is added to.>
- **Migration:** <number, what it adds, and its access policy. Or: none.>
- **Access:** <which client or permission check. If it bypasses row-level
  security or the normal auth path, the reason the normal path genuinely cannot
  do it.>
- **Architecture guards likely to fire:** <file-size ratchet on <file>, import
  boundary, model registry, ...>
- **Fence:** <walk mode only, and only if the walk writes to shared or
  multi-tenant state: name the sandbox it writes into. Otherwise: "n/a, checked
  by hand.">
