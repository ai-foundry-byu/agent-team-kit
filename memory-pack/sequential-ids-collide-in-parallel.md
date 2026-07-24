---
name: sequential-ids-collide-in-parallel
description: Parallel agents both grab the same next number in any monotonic sequence (migration files, ordered fixtures, numbered docs); the second insert fails at a unique key. Renumber the un-recorded one.
metadata:
  type: feedback
---

Any workflow that assigns the **next number in a monotonic sequence** breaks when two agents
do it at once. The classic case is database migrations: two agents both write `0290_*.sql`,
and at apply time the second file's DDL runs but the ledger INSERT fails
(`duplicate key ... (version)=(0290) already exists`) and ABORTS — so every later migration
never applies. The same hazard hits any ordered, numbered artifact (fixtures, seed files,
sequentially named docs).

**Why:** the "next free number" is read-then-write with no lock; under parallel agents both
read the same current max and pick the same next value.

**How to apply:**
- Prevent it: derive order from something collision-free (timestamp, UUID, or a
  claim-a-number step), or serialize the numbering through one coordinator/agent.
- Fix a collision by renumbering the file that is NOT yet recorded in the ledger/target to
  the next free number, then re-apply. A dry-run of the promote tool tells you which file is
  still pending (that's the un-recorded one).
- Make the migration/DDL idempotent (`add column if not exists`, `drop ... if exists`,
  grants) so re-applying under a new number is safe even when the objects already exist.
- Promote through the sanctioned tool, never an ad-hoc raw apply (`psql -f`), so the ledger
  stays consistent. See [[never-amend-on-shared-main]], [[develop-against-a-disposable-copy]].
