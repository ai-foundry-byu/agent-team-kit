# Repo conventions (transferable)

A small set of conventions that keep an agent-driven repo tidy. They are stack-agnostic; lift the ones that fit and put them in your `CLAUDE.md` so every agent follows them. (See [`WRITING-CLAUDE-MD.md`](./WRITING-CLAUDE-MD.md).)

## Scratch and mockups

- Throwaway scratch files and high-fidelity mockups go in a **gitignored** directory (e.g. `.mockups/`, `.scratch/`). Never commit them, and never promote them: once a mockup's design is built into the app, it's done.
- When an agent makes a temp file or a mockup, it should report a clickable `file://` path so you can open and review it in one click, not leave a committed artifact behind.

## Formatting

- **Format only the files you touched**, never the whole repo. A whole-repo format sweeps unrelated drift into your commit and muddies the diff (and, on a shared `main`, can collide with another agent's in-flight work). The pre-commit hook checks *staged* files only for the same reason.

## Secrets

- Never hardcode secrets or commit a real `.env`. Keep them in a secrets manager or a per-person `.env.local` (gitignored).
- A client-side guard (like the kit's psql-DDL block) is a nudge, not a boundary. If integrity genuinely matters, enforce it where the resource lives, e.g. a database role without the dangerous privilege.

## Commits

- Conventional prefixes (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`), **one concern per commit**.
- Stage **explicit paths**, never blanket-stage (`git add -A` / `git add .`), the git-safety hook blocks the blanket forms, because on a shared tree they sweep in other agents' work.
- **The editor GUI has no such guard.** Committing from VS Code (or similar) with *nothing staged* commits *every* changed file, the GUI form of `git commit -a`, and on a shared `main` that swallows siblings' in-flight work. Stage your one file first (the `+` on its row), *then* commit; or disable `git.enableSmartCommit` so the editor never offers "commit all". The manual keyboard path is covered in [`HANDS-ON-EDITS.md`](./HANDS-ON-EDITS.md).

## File size and boundaries

- A file crossing the size budget is an **alarm to check cohesion**, not a number to shrink under by deleting comments. Split along a real seam, or exempt a genuinely-single-concern file with a reason.
- Reach for the restricted/privileged capability (e.g. an RLS-bypassing client) only when the safe path genuinely cannot do the work, and leave a call-site comment saying why. The import-boundary guard makes that a deliberate, visible choice.

## Release flags

- **Decide how a feature reaches people in its spec**, not at build or ship time: release flag, permanent kill switch, rehearse on staging, or no flag, with the seam, whose flags apply, the off path and the rollout. See [`RELEASE-FLAGS-SPEC.md`](./RELEASE-FLAGS-SPEC.md) and the spec template's Release section.
- **A flag controls who the code runs for, not what it does.** Deploy-time changes rehearse on staging; per-request changes do only if their first audience could do irreversible harm outside the team ([`RELEASE-PIPELINE.md`](./RELEASE-PIPELINE.md), section 5).
- **Branch once, at a seam**, as a plain if/else on the flag; off is byte-identical to before; never pass the flag's value around.
- **Env vars are for what stays** (kill switches, stubs, config). Rollouts are release flags; entitlements get their own list.
- **Removing a flag is part of finishing the feature**, and starts by reading what every environment actually sets and who calls the code without passing the flag.

## Verification

- **Verify proportional to risk.** Behavior and layout changes earn a real run-through; a one-line copy change earns a check. Match the effort to the blast radius.
- **A passing typecheck is not a passing build.** When a change could couple server and client code, run a real build before you trust it.
