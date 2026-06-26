<!--
Paste this into your project's CLAUDE.md. It tells agents what "done" means.
AI-native teams need this explicit, because agents declare victory early: the
code being written is not the same as the work being ready. Adapt the commands
(check / test / build) to your stack.
-->

## Working discipline (definition of done)

Before calling work ready:

- **Green checks.** Typecheck (`check`) and the unit suite (`test`) pass.
- **Regression pass on shared code.** If the change touches code many features depend on (a server/domain module, a widely-imported component, a form action, a migration or auth policy), map the callers, judge each affected feature, and add a *behavior* test that asserts the user-facing outcome. (See the `regression-check` skill.) A leaf change with no shared blast radius can skip this.
- **Review the diff.** A quick self-review of the change (e.g. `/code-review`), not just "it runs."
- **Build, don't just typecheck**, when the change could cross the server/client boundary. A typecheck can pass while a real build fails on an import that only breaks when bundled. Run a build before pushing if there's any chance of that coupling.
- **Verify proportional to risk.** Browser-verify behavior and layout changes; for a one-line copy or config tweak, a check is enough. Don't gold-plate the trivial, don't hand-wave the risky.
- **Format only the files you touched.** Never a whole-repo format, it sweeps in unrelated drift and muddies the diff. (The pre-commit hook checks staged files only for the same reason.)
- **Commit clean.** Conventional prefix (`feat:`/`fix:`/`chore:`/…), one concern per commit, explicit paths staged. Then stop, pushing is the human's deliberate (and often paid) act, not an agent's.

"Done" means *verified*, not "the code is written." These are the gates that make "ready" mean ready.
