---
name: design-first-then-verify
description: "For UI/UX work, surface tradeoffs and a quick mockup before building, then iterate fast on details. Harden for robustness, not just looks. Prefer honest verification (run it, show it) over confident claims."
metadata:
  type: feedback
---

A working style that fits most product owners and pays off broadly:

- **Design-first.** Before building anything with UX surface area, surface the tradeoffs
  (short pros/cons), a quick mockup or two ([[throwaway-mockups-gitignored]]), and any
  clarifying questions. Confirm direction, then implement and iterate rapidly on the visual/UX
  details.
- **Harden, don't just decorate.** Care about robustness as much as looks: autosave/edit
  races, empty states, error paths, server-side enforcement of anything the client asks for.
  "Make the feature bulletproof" is the bar, not "make it render."
- **Reason from first principles about UX.** Notice dependency chains and make required
  sequence obvious in the interface rather than assuming the user will infer it.
- **Verify honestly.** Prefer running the app and showing it working over asserting it works;
  be explicit about what is verified versus assumed. Expect fast follow-up tweaks after each
  review pass.

**Why:** leading with a tradeoff sketch and a mockup catches direction errors before they cost
a build; hardening prevents the bugs that erode trust; honest verification keeps review loops
short. See [[verify-proportional-to-risk]], [[communicate-direct-and-plain]].
