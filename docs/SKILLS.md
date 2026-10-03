# Skills reference

The kit bundles ten skills (under `skills/`) as worked examples. Most come from the real project they were built in, so their *specifics* are project-bound (table names, file paths, the deploy host) while the *patterns* generalize; `merge-worktree` is kit-native (worktree-mode integration), and `spec`, `build-spec`, `mockup` and `share-memory` have been generalized to drop in as-is, taking project commands from your CLAUDE.md. They are here to show the kinds of skill an AI-native team should write for itself. Treat the project-specific paths inside them as placeholders to adapt.

## What a skill is, and why it matters for a team

A skill is a `SKILL.md` file with YAML frontmatter (a `name` and a `description`) and a body of instructions. Claude Code reads the description to decide when the skill is relevant, and when a user's phrasing matches ("fix bug 1234", "ship it", "did I break anything"), it loads the body and follows the procedure.

In other words, a skill is **an executable playbook.** For a single developer that is a convenience. For an AI-native *team* it is something more important: it is how you encode "the way we do things here" so that it executes **consistently across every person and every agent.** Three reasons that matters:

- **Institutional knowledge stops living in one person's head.** The safe way to cut a release, the discipline for catching regressions, the steps to triage a bug, written as skills, they are shared and version-controlled, not tribal.
- **The right way becomes the default way.** A skill bakes in the guardrails (verify before you fix, never chain commit-and-push, run the tests) so an agent doesn't have to be reminded each time and a teammate's agents behave the same as yours.
- **They are shared like any other tracked file.** Because the kit's `.gitignore` tracks `.claude/skills/`, a skill one of you writes is on the other's machine at the next pull, auto-discovered, no setup.

Below, each example, what it does, why the pattern is valuable, and what is project-specific you would swap.

---

## `push`, wrap a dangerous, irreversible action in a guarded procedure

**What it does.** Turns "ship it" into a full release procedure: it figures out what has shipped since the last release, writes customer-facing release notes, bumps the version, commits just those files, and *then* pushes. It encodes hard-won guardrails: stage only release files, never sweep in unrelated work, and never chain commit-tag-push in one command (because a blocked commit would still let the tag and push fire, publishing the wrong thing and costing a second paid build).

**Why the pattern matters.** Some actions are high-stakes and irreversible: a production deploy, a release, a data migration. Those are exactly the actions you do *not* want an agent improvising. A skill turns the risky action into a checklist with the failure modes pre-empted. The general lesson: **for any action that is expensive to get wrong, write the skill that makes the safe path the only path.**

**Project-specific to swap.** Vercel as the deploy trigger, `src/lib/content/releases.ts` as the notes file, the version-in-package.json convention.

---

## `regression-check`, encode your "did I break something else" discipline

**What it does.** Before finalizing a change to shared code, it runs a structured pass: map the blast radius (find every caller of what you changed, up to the user-facing features), judge whether each affected feature's behavior changed and whether that was intended, lock the intended behavior with a *behavior* test (not an implementation test), and run the test nets. It ends with an honest summary of blast radius, findings, and coverage added.

**Why the pattern matters.** The single most common regression is changing a shared function and only verifying the feature you were working on, while a different feature that funnels through the same code silently breaks. This skill is the disciplined pass that catches it. The general lesson: **encode your team's definition-of-done and verification rituals as skills**, so the careful pass happens by default instead of being the thing everyone skips under time pressure. This one generalizes almost unchanged to any codebase.

**Project-specific to swap.** The example paths (`src/lib/domains`, the rubric-save anecdote) and the test commands.

---

## `fix-bug`, load real external context and enforce a verify-first process

**What it does.** Given a bug-report id, it pulls the full report from the database (the user's narrative, route, console and network telemetry, and a screenshot), materializes it locally, and starts diagnosis with the user's actual context loaded. Critically, it enforces a discipline: **verify the bug is real before touching code.** It separates what the user *observed* from their *theory* of the cause, makes you reproduce the behavior and read the actual code path, and classifies the result, only a reproduced real bug leads to a fix; "works as designed" gets closed with a kind note. Closing the loop is bound to the commit by a git hook.

**Why the pattern matters.** Two patterns in one. First, **skills can load external context** (here, from your own database and storage) so the agent starts a task fully informed instead of guessing. Second, and more broadly, it encodes **process discipline that resists a default failure mode**, the urge to implement the user's guessed cause without confirming the bug exists. The general lesson: when a task has a tempting wrong shortcut, the skill is where you put the "stop and verify first" gate.

**Project-specific to swap.** The `bug_reports` table shape, the feedback storage bucket, and the close-the-loop git hook.

---

## `userflow-map`, maintain a living, shared team artifact

**What it does.** Maintains a data-driven map of the app's screens and transitions (a state machine). The JSON is the source of truth; the visual graph and tables are generated. It also runs a feedback loop: flag an issue on any screen or element by address, and it becomes a tracked punch-list item that you later resolve.

**Why the pattern matters.** A two-person team needs a *shared mental model* of the product, and mental models drift when they live only in two separate heads. This skill keeps that model in a version-controlled, regenerable artifact both people's agents read and update. The general lesson: **skills can curate the shared knowledge artifacts a team relies on** (an architecture map, a glossary, a flow doc), keeping them current as a byproduct of work instead of a doc that rots.

**Project-specific to swap.** Essentially all of it (the `docs/userflow/` layout and schema); keep the *idea* of a tracked, generated, single-source-of-truth artifact with a feedback loop.

---

## `merge-worktree`, encode a guarded multi-step operation

**What it does.** From the cockpit (on `main`, clean tree), it integrates a finished worktree worker's branch: verify you are on main with a clean tree, merge, surface conflicts instead of guessing, prune the worktree, and stop short of pushing.

**Why the pattern matters.** Some operations have a strict safe sequence and a tempting unsafe shortcut. A skill encodes the guards (clean-tree check, never blind-resolve a conflict, never push) so the operation is reliable every time. It also illustrates the launchers-vs-operations rule: starting a session is a shell command, but an operation you run mid-session with judgment is a skill.

**Kit-native** (not from the origin project); it pairs with worktree mode, see [`WORKTREE-MODE.md`](./WORKTREE-MODE.md).

---

## `spec` and `build-spec`, put a human gate between exploring and building

**What they do.** `spec` turns an exploration (a conversation, a mockup) into `.specs/<slug>/spec.md` plus a punch list, and stops for approval. `build-spec` works that punch list item by item, committing each, and is done only when every acceptance criterion is closed by its verifier. Each criterion is tagged `walk` (checked in a browser: by default a hand-driven check sheet of clickable URLs), `unit` (a test) or `structure` (an architecture guard or grep).

**Why the pattern matters.** The decisions that make a feature good are made while exploring and die at compaction. Writing them down, with the rejected options and why, stops the build from re-litigating them. The tags give the spec teeth: a markdown assertion has none, but "closed by this test" or "Expect: X is NOT in the list" does. And the approval gate puts the cheapest iteration (editing a spec) before the expensive one (rewriting a diff). The general lesson: **for anything bigger than a one-line fix, make the agent show you the plan in a form you can edit, and define done as evidence, not as a diff that looks right.**

**Project-specific to swap.** Nothing in the skills; fill the template's "Constraints in this repo" from your CLAUDE.md, and name your typecheck and test commands there. Walk mode needs a walk harness ([`WALKS-AND-SWEEPS-SPEC.md`](./WALKS-AND-SWEEPS-SPEC.md)); without one, the check sheet covers it.

---

## `mockup`, make design iteration fast and faithful

**What it does.** Produces a throwaway, high-fidelity HTML mockup in `.mockups/` and hands back a clickable link. Its best path edits a frozen snapshot of the real page (see [`MOCKUP-SHELLS-SPEC.md`](./MOCKUP-SHELLS-SPEC.md)), so only the idea is new and the surrounding chrome is exactly the app. Without the freezer, it writes a standalone page in the app's own tokens and vocabulary.

**Why the pattern matters.** A user can judge a picture far faster than a paragraph, and a mockup that looks subtly unlike the app gets judged on the wrong things. The skill also carries the hard-won editing rules (never splice frozen HTML by line range, never loop a replace-first, look at the render before handing it over) because the worst mockup failures are invisible in the diff.

**Project-specific to swap.** Your surface list and recipes, once you build the freezer.

---

## `share-memory`, turn one person's lessons into the team's

**What it does.** Promotes a personal Claude Code memory into the project's tracked `.claude/team-memory/` folder, which the `team-memory` SessionStart hook loads into every teammate's session. It picks (or surveys and proposes), scrubs credentials, customer data and names, generalizes the memory while keeping its concrete reason, moves it, deletes the personal copy so the two cannot drift, and commits.

**Why the pattern matters.** Memory is the one piece of a Claude Code setup that stays on one machine, so in a team of two each person's agents keep re-learning what the other's already know. Promoting deliberately, one scrubbed memory at a time, shares the lesson without leaking the personal folder's names, accounts and production details.

**Project-specific to swap.** Nothing.

---

## Writing your own

A skill is just `skills/<name>/SKILL.md` with frontmatter:

```markdown
---
name: my-skill
description: One or two sentences on WHAT it does and WHEN to use it, including the trigger phrases a user would say. Claude reads this to decide relevance, so be concrete about the triggers.
---

# my-skill, one-line purpose

The procedure, written as you'd brief a careful colleague: the steps, the
guardrails, the failure handling, and what "done" looks like.
```

The description is load-bearing: it is the only thing Claude sees when deciding whether the skill applies, so name the trigger phrases explicitly. Put skills under your project's `.claude/skills/` (the kit's `.gitignore` tracks that directory, so they travel to the team automatically). For an AI-native team, treat your skills as a growing, shared library of "how we do things here", every time you find yourself explaining the same careful procedure to an agent twice, that is a skill waiting to be written.
