<!--
Worktree-mode variant of the concurrent-agents section, and the sister of
CLAUDE-md-main.md. Use this INSTEAD of CLAUDE-md-main.md (the stay-on-main
version) when your team runs in worktree mode (each worker in its own git
worktree; a cockpit on main). See docs/WORKTREE-MODE.md.
-->

## Working in a worktree (worktree mode)

You are in your OWN git worktree on your own branch, an isolated working tree, not the shared `main`. The coordination hooks still run; what changes is the git hygiene:

- **Your working tree is yours alone.** Blanket-stage freely (`git add -A`), and use `git reset` / `git stash` / `git checkout -- .` normally, they only touch your tree, not other agents'. (The git-safety guard auto-relaxes inside a worktree; it stays strict only in the shared main checkout.)
- **Stay roughly in your assigned area anyway.** Overlapping work with another worker becomes a merge conflict when your branches integrate.
- **The database is still shared** across all worktrees. Migrations, type generation, seeding, and dependency changes are still serialized by the schema lock, and ad-hoc psql DDL is still blocked. Coordinate schema changes with the human.
- **Commit to your branch; do not integrate from here.** Never merge to `main` or push from a worker. Integration happens in the **cockpit** (the session on `main` in the main checkout). When your task is done, commit and tell the human; they integrate it from the cockpit (the `merge-worktree` skill).
- **Never force-push.** It rewrites history shared with everyone.
- **Dev server:** start your own on the port the SessionStart hook assigned you; never touch the human's reserved port.
