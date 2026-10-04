<!-- agent-team-kit snippet. Paste into CLAUDE.md for any app where what people
see or may do depends on who they are or what their organisation has. Fill in
every <...> with this project's real names, so an agent never has to invent a
role check. Delete a line the project genuinely does not have.
See docs/RELEASE-FLAGS-SPEC.md, section "Who sees what". -->
## Access model (who sees what)

Something that differs per person or organisation uses exactly one of these
levers. Pick it with the first yes: goes away after a rollout (release flag);
incident off switch (kill switch); depends on the person's relationship to the
data (role); depends on what the organisation bought or turned on
(entitlement / enablement); the user chooses it (preference). Never keep a
role or a paid tier in a release flag.

- **Roles and relationships** live in `<relationship tables, e.g. memberships,
  class_members>`. They are enforced by row-level security policies built from
  the helpers in `<path or migration>`: `<is_class_teacher(class_id)>`,
  `<is_tenant_admin(tenant_id)>`, `<has_permission('x')>`. Add a helper
  rather than repeating a subquery in a policy. A server action that uses the
  service client re-checks with `<assert helper, e.g. assertTeachesClass>`.
- **Finer grants than a role** use `<permission catalog + grants tables>`.
- **Which areas a role may enter** is decided in `<route policy file>`, before
  any page code runs.
- **The role in the session token** (`<locals.appRole>`) is for routing and
  layout only, never the guard.
- **Entitlements and enablements** live on the tenant: `<plans.features,
  licenses table, tenants.settings>`, read by `<entitlementsFor(user)>`.
  Background work uses the resource OWNER's entitlements.
- **Preferences** live in `<per-user settings table>`.
- **UI asks one function**, `<can(viewer, "capability")>` in `<path>`, never a
  role name or a flag name directly. Personas get their own home and
  navigation from shared components: `<route groups per persona>`.
- **People with two roles**: `<switcher | union>`.
