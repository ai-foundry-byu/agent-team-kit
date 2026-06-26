#!/usr/bin/env node
/**
 * Architecture-guard CLI — the gate behind the in-session nudge.
 *
 * Runs the file-size + import-boundary guards over the files passed as args
 * (pass the staged files from a pre-commit hook), or the whole `src/` tree if
 * none are given (use this form in CI). Exits 1 on any violation with a report;
 * exits 0 when clean. Wire it into .githooks/pre-commit and/or your CI.
 *
 *   node scripts/hooks/arch-check.mjs file1 file2 ...
 *   node scripts/hooks/arch-check.mjs            # whole src/ tree
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  isGoverned,
  ceilingFor,
  FROZEN,
  BUDGET,
  toRepoRelative,
} from "./file-size-budget.mjs";
import { importsRestrictedUnlisted } from "./import-boundaries.mjs";

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const cwd = process.cwd();
let files = process.argv.slice(2);
if (!files.length) files = walk(join(cwd, "src"));

const problems = [];
for (const f of files) {
  if (!existsSync(f)) continue;
  let s;
  try {
    s = statSync(f);
  } catch {
    continue;
  }
  if (s.isDirectory()) continue;

  const rel = toRepoRelative(f, cwd);
  if (!isGoverned(rel)) continue;

  let content;
  try {
    content = readFileSync(f, "utf8");
  } catch {
    continue;
  }

  const ceiling = ceilingFor(rel);
  if (ceiling !== Infinity) {
    const lines = content.split("\n").length;
    if (lines > ceiling) {
      problems.push(
        rel in FROZEN
          ? `file-size: ${rel} is ${lines} lines, past its frozen ceiling ${ceiling} (shrink-only).`
          : `file-size: ${rel} is ${lines} lines, over the ${BUDGET}-line budget — split it, or EXEMPT/FROZEN it in file-size-budget.mjs with a reason.`,
      );
    }
  }

  if (importsRestrictedUnlisted(rel, content)) {
    problems.push(
      `import-boundary: ${rel} imports the restricted module and isn't on the ALLOWLIST — use the safe path, or allowlist it in import-boundaries.mjs with a call-site reason.`,
    );
  }
}

if (problems.length === 0) process.exit(0);
process.stderr.write(
  "Architecture guard violations:\n" +
    problems.map((p) => "  - " + p).join("\n") +
    "\n",
);
process.exit(1);
