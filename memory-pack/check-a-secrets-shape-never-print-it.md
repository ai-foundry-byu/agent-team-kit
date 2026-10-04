---
name: check-a-secrets-shape-never-print-it
description: "When a credential does not work, check its shape (length, charset, prefix, a trailing character) and probe the provider with a harmless request, instead of printing it. Copied secrets are often a truncated display or carry a stray character."
metadata:
  type: feedback
---

An OAuth sign-in failed with "invalid client". The stored client secret was 8 characters:
five letters and "...", the LMS admin page's shortened display, saved when the key was read
back from a list view. The regenerated secret, pasted by hand, was 65 characters: the real 64
plus the period ending the sentence it was copied from.

**Why:** both failures were visible from shape alone, without exposing the value. Printing a
secret puts it in a transcript, a log or a screenshot for good (it happened once in the same
session, through a masking command whose pattern did not match a tab separator).

**How to apply:**
- Compare length and character classes (`len 64, alnum only`), the first and last character's
  CLASS, and whether two copies are equal. Never echo the value.
- Probe the provider with a request that cannot succeed but proves the credential: for an
  OAuth client, a token exchange with a bogus code returns `invalid_grant` when the client is
  accepted and `invalid_client` when it is not.
- Store secrets encrypted with the environment's own key, and verify the round trip
  (decrypt equals input) before writing.
- When masking output, test the mask on a fake line first, or do not print the file at all.
- When giving a secret to someone, put it alone on its own line, so sentence punctuation is
  not copied with it.
