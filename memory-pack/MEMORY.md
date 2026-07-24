# Memory pack index

One line per entry; detail lives in the linked file. These are portable, project-agnostic
memories seeded from real parallel-agent software work. Append these lines into a project's
own `MEMORY.md` when adopting the pack (see README.md).

- [Never amend on shared main](never-amend-on-shared-main.md) — no --amend/rebase on a shared branch under parallel agents; a sibling may have moved HEAD.
- [Commit pathspec uses working tree](commit-pathspec-uses-working-tree.md) — `git commit -- <path>` commits the working tree, not your staged index.
- [Format only touched files](format-only-touched-files.md) — never whole-repo format; format explicit paths; stage explicit paths.
- [Sequential IDs collide in parallel](sequential-ids-collide-in-parallel.md) — parallel agents grab the same next number (migrations, fixtures); renumber the un-recorded one.
- [Run your own dev server](run-your-own-dev-server.md) — never trust the default port; run your own, read the real port, kill only your PID; flaky 503/404 = environmental.
- [Verify with the real build](verify-with-the-real-build.md) — the fast typecheck can pass while the real build/deploy fails; build before pushing import changes.
- [Verify proportional to risk](verify-proportional-to-risk.md) — typecheck trivial copy changes; reserve the browser pass for behavior/layout.
- [Keep a small green critical suite](keep-a-small-green-critical-suite.md) — test the existing behavior a change could break, not just the new code; gate a tiny @critical suite pre-push.
- [Develop against a disposable copy](develop-against-a-disposable-copy.md) — never point local dev at the prod datastore once real users exist; isolated local, prod creds opted in.
- [Subtraction audit on redesign](subtraction-audit-on-redesign.md) — when a redesign supersedes a surface, delete what it obsoletes in the same wave.
- [Throwaway mockups, gitignored](throwaway-mockups-gitignored.md) — hi-fi self-contained HTML mockups in a gitignored dir; throwaway; share a clickable file:// path.
- [AI surface full lifecycle](ai-surface-full-lifecycle.md) — every AI-working surface needs start + live progress + stop/start-over; wire cancel from day one.
- [AI status motion is one system](ai-status-motion-one-system.md) — standardize working indicators onto a few shared primitives; color encodes kind of work.
- [Every mutating button gives feedback](every-mutating-button-gives-feedback.md) — instant press + in-flight spinner (label replaced in place, fixed width, self-disabling).
- [Arch guards are alarms](arch-guards-as-alarms.md) — ratchet guards fight sprawl; a red guard is an alarm to check cohesion, not a number to game.
- [Design first, then verify](design-first-then-verify.md) — surface tradeoffs + a quick mockup before building; harden for robustness; verify honestly.
- [Communicate direct and plain](communicate-direct-and-plain.md) — answer first, short rationale, no throat-clearing; drafted copy stays plain and factual.
- [No em dashes](no-em-dashes.md) — never in copy, comments, commits, notes, or chat replies; grep before commit/send.
- [Commit freely, never push](commit-freely-never-push.md) — commit each unit of work without asking; the owner owns the push/deploy trigger; never rewrite pushed history.
- [Real icons, not emoji](real-icons-not-emoji.md) — use the project's real icon set for UI iconography; never emoji/unicode glyphs.
