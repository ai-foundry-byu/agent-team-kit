/**
 * Shared helpers for the concurrent-agent coordination hooks
 * (dev-port, bash-guard, session-release).
 *
 * All cross-session state lives under a single directory anchored to the
 * COMMON git dir, so every git worktree AND the main checkout resolve to the
 * SAME absolute path. (A per-worktree `.git` would hand each agent its own
 * lock = no mutual exclusion.) It sits inside `.git`, so it is never tracked.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export function payload() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    /* no stdin */
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function coordDir(cwd) {
  const base = cwd || process.cwd();
  let gitDir;
  try {
    gitDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: base,
      encoding: "utf8",
    }).trim();
  } catch {
    gitDir = join(base, ".git");
  }
  const abs = gitDir.startsWith("/") ? gitDir : join(base, gitDir);
  const dir = join(abs, ".wg-agent");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* already there */
  }
  return dir;
}

export const nowSec = () => Math.floor(Date.now() / 1000);

// Drop quoted substrings so a commit message like `-m "ran git add ."` or
// `"pnpm add foo"` can't trip the command guards below.
export function unquote(cmd) {
  return cmd.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
}
