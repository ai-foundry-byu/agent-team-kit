/**
 * Single source of truth for the file-size guard (config + helpers).
 *
 * Consumed by:
 *   - arch-check.mjs        the CLI gate (pre-commit / CI), fails on violation
 *   - file-size-nudge.mjs   the in-session PostToolUse nudge, advisory
 *
 * The number is an ALARM that says "go look", not a law. A large file is a smell
 * of low cohesion (several unrelated jobs in one scope). The fix is never "get
 * under the number", it is "split along the real seam, or confirm this is one
 * cohesive concern and exempt it." Plain ESM so Node imports it from a hook
 * without a TS loader.
 *
 * ── CONFIG (edit for your project) ──────────────────────────────────────────
 */

/** New files may not exceed this. The tripwire, not a target. */
export const BUDGET = 800;

/** Generated / not-our-code, skipped entirely. @type {Set<string>} */
export const GENERATED = new Set([
  // "src/types/generated.ts",
]);

/**
 * Genuinely ONE cohesive concern → unlimited length. A reason is required.
 * @type {Record<string, string>}
 */
export const EXEMPT = {
  // "src/content/releases.ts": "append-only release data; one list, grows by design",
};

/**
 * Oversized files being paid down. Ceiling = current line count; SHRINK-ONLY.
 * Seed this by running `arch-check.mjs` once and pasting the over-budget files
 * here. Lower each number as you reclaim lines; delete the entry once under
 * BUDGET. New giants are NOT allowed, split them instead of freezing them.
 * @type {Record<string, number>}
 */
export const FROZEN = {
  // "src/components/Giant.tsx": 2196,
};

/**
 * True for the files this guard governs. Edit the extensions and root for your
 * stack. Tests are excluded (many cases in one file is cohesive); so is
 * anything generated.
 * @param {string} relPath repo-relative POSIX path
 * @returns {boolean}
 */
export function isGoverned(relPath) {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|svelte|vue)$/.test(relPath)) return false;
  if (/\.(test|spec)\./.test(relPath)) return false;
  if (!relPath.startsWith("src/")) return false;
  if (GENERATED.has(relPath)) return false;
  return true;
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an absolute or OS-specific path to a repo-relative POSIX path.
 * @param {string} path @param {string} [cwd] @returns {string}
 */
export function toRepoRelative(path, cwd) {
  let p = String(path).split("\\").join("/");
  const root = String(cwd ?? "")
    .split("\\")
    .join("/")
    .replace(/\/$/, "");
  if (root && p.startsWith(root + "/")) p = p.slice(root.length + 1);
  return p;
}

/**
 * Line ceiling for a governed file: exempt = Infinity, frozen = its count, else BUDGET.
 * @param {string} relPath @returns {number}
 */
export function ceilingFor(relPath) {
  if (EXEMPT[relPath]) return Infinity;
  return FROZEN[relPath] ?? BUDGET;
}
