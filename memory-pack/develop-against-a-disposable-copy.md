---
name: develop-against-a-disposable-copy
description: "Never point local dev at the production datastore once real users exist. Run an isolated local stack; keep prod credentials in a separate gitignored env file, opted into per command."
metadata:
  type: feedback
---

Pointing local dev straight at the production database is fine on day zero and dangerous the
moment there are real users. Local runs hold privileged credentials (service-role/admin keys)
and execute unfinished code, often across many admin paths that ignore per-tenant boundaries
— so a half-built feature or a fuzzer can corrupt or leak real user data.

**Why:** fidelity does not require prod. You get a realistic environment from a local stack
you can wipe; you get catastrophe from an agent driving unfinished code against live data.

**How to apply:**
- Run an **isolated local** copy of the datastore for dev (a local instance, a throwaway
  branch DB, or seeded fixtures). Default every dev command, seed script, and health check to
  LOCAL.
- Keep prod connection strings/keys in a SEPARATE gitignored env file, and require an explicit
  opt-in to use them (`set -a; source .env.prod.local; set +a`) — never the default.
- Commit what transfers between machines (migrations, config, the local-dev guide); never
  commit the secret-bearing env files. A new teammate sets up their own local.
- This is the discipline the kit's `docs/DISPOSABLE-ENVIRONMENT.md` spells out (turn stubs off
  for fidelity, keep a prod-refusal seatbelt). See [[sequential-ids-collide-in-parallel]].
