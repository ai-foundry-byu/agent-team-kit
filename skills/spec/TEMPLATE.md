# <Feature>, spec

**Status:** draft, awaiting approval
**Mockups:** <.mockups/... paths, or "none, not a visual change">
**Walk criteria recorded in:** <the tracked walk skeleton or acceptance file from Step 4>.
Checked by hand off `check.md` unless someone asks for walk mode.

## Intent

<One paragraph. What changes for the user, in their language. If you cannot say
it without listing implementation, the scope is not settled yet.>

## Stories and acceptance criteria

Tags: **walk** = a browser check, by hand or by a walk runner · **unit** = a
test next to the source · **structure** = an architecture guard or grep assertion.

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
- **Flag:** <NAME, and what "off" means (ideally: behaviour identical to before).
  Or: no flag, and why.>
- **Migration:** <number, what it adds, and its access policy. Or: none.>
- **Access:** <which client or permission check. If it bypasses row-level
  security or the normal auth path, the reason the normal path genuinely cannot
  do it.>
- **Architecture guards likely to fire:** <file-size ratchet on <file>, import
  boundary, model registry, ...>
- **Fence:** <walk mode only, and only if the walk writes to shared or
  multi-tenant state: name the sandbox it writes into. Otherwise: "n/a, checked
  by hand.">
