/**
 * Single source of truth for the import-boundary guard (config + helper).
 *
 * Guards a RESTRICTED import behind an allowlist: any file importing the
 * restricted module must be on the allowlist, or the gate fails. Use it for a
 * dangerous capability you want kept rare and intentional. The canonical
 * example (and the default below) is a privilege-escalating server DB client
 * that BYPASSES row-level security — every import of it is a place the safety
 * net is off, so it should exist only where the caller's own RLS genuinely
 * cannot do the work, with a comment at the call site saying why.
 *
 * Ratchet model: grandfather the current importers, fail any NEW one. The list
 * may only SHRINK. To add a genuinely-needed importer, add it here WITH a
 * reason in the call-site comment — the friction is the point.
 *
 * ── CONFIG (edit for your project) ──────────────────────────────────────────
 */

/** The import to guard, matched by module path. Default: a server admin/service client. */
export const RESTRICTED_RE = /['"][^'"]*\bserver\/(supabase|admin|service)['"]/;

/** The module that DEFINES the restricted thing (allowed to reference itself). */
export const RESTRICTED_MODULE = "src/lib/server/supabase.ts";

/**
 * Grandfathered importers (repo-relative POSIX paths). SHRINK-ONLY. Seed by
 * running `arch-check.mjs` once and pasting the flagged files here.
 * @type {Set<string>}
 */
export const ALLOWLIST = new Set([
  // "src/lib/domains/foo/index.ts",
]);
// ────────────────────────────────────────────────────────────────────────────

/**
 * True if a governed file imports the restricted module without being allowlisted.
 * Tests and the defining module are never governed.
 * @param {string} relPath repo-relative POSIX path
 * @param {string} content file contents
 * @returns {boolean}
 */
export function importsRestrictedUnlisted(relPath, content) {
  if (/\.(test|spec)\./.test(relPath)) return false;
  if (relPath === RESTRICTED_MODULE) return false;
  if (ALLOWLIST.has(relPath)) return false;
  return RESTRICTED_RE.test(content);
}
