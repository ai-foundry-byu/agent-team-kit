---
name: spec
description: Turn an exploration (a conversation, a mockup, a sketch of a feature) into a reviewable spec with user stories and acceptance criteria tagged by how each will be checked, plus a punch list, then STOP for approval. Use when the user says "spec this", "/spec", "write it up", "turn this into a plan I can approve", "PRD this", or after any design or mockup session that is about to become code. Not for a one-line fix. To execute an approved spec, use build-spec.
---

# spec, freeze the exploration before it evaporates

The decisions that make a feature high-fidelity are made while exploring: the
copy, the empty state, the option we rejected, the shape of the mockup. They
live in the conversation, and the conversation dies at compaction, does not
travel to a worktree agent, and cannot be edited by the user before code exists.

This skill turns that into a file. **The file is the deliverable. No code is
written in this skill.**

## What this is not

It is not a spec framework. No constitution, no design doc restating the
architecture, no requirements notation, no per-feature steering files. Those
move the review burden rather than shrinking it: people would rather review code
than eight markdown files, and the agent ignores the constraints anyway, because
**a markdown assertion has no teeth.**

So this writes exactly two things: a spec and a punch list. The teeth come from
tagging every criterion with the thing that will check it (Step 3).

## Step 1, read back, do not invent

Reconstruct from the conversation, the mockups in `.mockups/`, and the code.
Where the exploration was silent, say so in Open questions with a recommended
default. Do NOT quietly fill gaps with plausible product decisions: an invented
requirement is worse than a missing one, because it reads as agreed.

If the surface is visual and has no mockup, offer to make one first (`/mockup`).
A criterion written without a picture is the vague kind.

## Step 2, write `.specs/<slug>/spec.md`

`.specs/` is gitignored and disposable, like `.mockups/`. Do not promote a spec
to `docs/` unless it becomes a standing reference.

Use `TEMPLATE.md` next to this file. The sections that carry the weight:

- **Decisions already made.** The exploration residue: copy, states, empty and
  error behaviour, what happens with the feature flag off, what the thing is
  called. This is the section that stops the build from re-litigating what you
  settled at 11pm.
- **Access and release.** Required, never left blank. First, every way the
  feature differs by person or organisation, each with its lever (release
  flag, kill switch, role / relationship, entitlement or enablement on the
  tenant row, preference) and exactly where it lives, picked with the
  template's five questions; never a role or a paid tier expressed as a
  release flag. Then the release: the kind (release flag, permanent
  kill switch, rehearse on staging, or no flag) and why, the flag key, the one
  seam the check goes in, whose flags apply (viewer or resource owner), what the
  off path looks like, and the rollout order. Decide it here because the answer
  shapes the code (where the seam is, what off returns) and the criteria (a
  release flag brings three standard ones, see the template). If the
  exploration never said how this reaches people, put it in Open questions with
  a recommended answer rather than inventing one. The "which tool for which
  risk" note in the template is the test to apply.
- **Considered and rejected, with the reason.** Without it, the build proposes
  the rejected option back to the user within a day.
- **Acceptance criteria, each tagged `walk` / `unit` / `structure`.**
- **Constraints in this repo.** Where the code goes, the flag, the migration,
  the access rules, the architecture guards likely to fire. Fill these from the
  project's CLAUDE.md; they are the places a build most often goes wrong.

## Step 3, tag every criterion, and mean it

This is the part that makes the difference, and the part that gets skipped.

| Tag           | The criterion is about                            | Verified by                         |
| ------------- | -------------------------------------------------- | ----------------------------------- |
| **walk**      | what a user sees, does not see, or is told          | a browser check: a check-sheet entry, or a walk step if the project has a walk harness |
| **unit**      | a pure predicate, ranking, formatter, parser        | a test next to the source           |
| **structure** | "there is ONE path", "no caller does X any more"    | an architecture guard or a grep assertion |

Rules learned from getting this wrong:

- **A browser cannot observe a `structure` criterion.** Do not write a walk step
  for "the retired writers are deleted", and do not drop it either: it is the
  criterion most likely to rot silently.
- **Write the NEGATIVE for every criterion about visibility, permission or
  audience.** "A teaching assistant sees their section's papers" needs its twin,
  "a teaching assistant does NOT see the other section's papers", as its own
  numbered criterion. Defects in this area are almost always something appearing
  to someone who should not see it, and absences are exactly where reasoning is
  weakest.
- **Name the persona and the surface.** "A signed-in user can..." is not
  checkable. "As the org admin, on the Members page..." is.
- **One observable thing per criterion.** If it needs an "and", split it.
- **If a criterion cannot be tagged, it is too vague to build from.** Rewrite it
  now. That discovery is worth more than the tag.

## Step 4, give the `walk` criteria a tracked home

`.specs/` is gitignored, so when the build is done and the directory is deleted,
the wording of every `walk` criterion is gone. (`unit` and `structure` criteria
leave a committed test behind; `walk` criteria checked by hand leave nothing.)
Save them somewhere tracked, so "a TA cannot see the other section's papers"
outlives the spec:

- **If the project has a walk harness** (see the kit's
  `docs/WALKS-AND-SWEEPS-SPEC.md`), scaffold the walk and save it under a name
  the runner does not load (for example `<n>-<slug>.ts.todo`). Fill in the step
  labels and intent strings from the `walk` criteria, word for word, and leave
  the bodies as TODO. Selectors cannot exist yet, and that is fine: the frozen
  part is the expectation, not how you find the button. The unloaded extension is
  what makes this free: a body full of placeholders costs nothing and cannot
  train anyone to ignore a red run.
- **Otherwise**, append them to a tracked acceptance file (for example
  `docs/acceptance/<slug>.md`), one numbered line per criterion, persona and
  surface included.

Either way it is a RECORD, not a promise to run anything. Do not tell the user
the walk "will" be filled in, and do not make a green walk the definition of
done. `/build-spec` checks `walk` criteria with a hand-driven check sheet by
default and runs a walk only when asked.

Writing steps for a UI that does not exist is the speculative half of this
skill. It earns its place because a criterion you cannot imagine as a step is a
criterion that was too vague, and finding that out before code is the point.

## Step 5, write `punchlist.md`, then STOP

`.specs/<slug>/punchlist.md`: ordered, checkbox items. Each names the files it
will touch and the criterion ids it closes. Mark `[parallel]` only where items
genuinely share no files, so a worktree fan-out cannot collide.

```
- [ ] 1. Capability table gains `can.publishSchoolWide`   (src/access.ts)            closes 2.3
- [ ] 2. Picker hides School-wide without it               (Picker.tsx, picker.test)  closes 2.1, 2.2   [parallel]
```

Then **stop and hand over.** Do not start building. The approval gate is the
whole reason this is two skills: editing `spec.md` by hand is the cheapest
iteration in the loop, and it only exists before code does.

Say plainly:

- what you assumed, and what you left open;
- how it will be released (the Access and release section in one line), so a wrong
  call is caught while it is still a sentence;
- which criteria are `unit` or `structure`, and therefore can never be checked
  in a browser;
- the two ways `/build-spec` can verify the `walk` criteria: **tests plus a
  check sheet the user drives by hand (the default)**, or **walk mode** if they
  want the runner. Do not present walk mode as the default, or as already agreed
  because Step 4 scaffolded a skeleton.
