#!/usr/bin/env node
/**
 * PostToolUse arch nudge — an in-session preview of the architecture gates.
 *
 * Wired to Edit|Write in .claude/settings.json. After an edit it runs the same
 * judgements the commit gate (arch-check.mjs) enforces, delivered at the moment
 * of the edit instead of at commit time, and surfaces any to the agent. Silent
 * when clean; never blocks the edit (it already happened).
 *
 * Checks:
 *   1. file-size ratchet — file now over its ceiling (BUDGET / frozen count).
 *   2. import boundary    — file newly imports the restricted module without
 *      being on the allowlist.
 *
 * Reads the standard hook JSON from stdin. Exit 2 + stderr feeds the message
 * back to the model; exit 0 is silent.
 */
import { readFileSync, existsSync } from "node:fs";
import {
  isGoverned,
  ceilingFor,
  FROZEN,
  BUDGET,
  toRepoRelative,
} from "./file-size-budget.mjs";
import { importsRestrictedUnlisted } from "./import-boundaries.mjs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }

  const cwd = payload.cwd ?? process.cwd();
  const filePath = payload.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const rel = toRepoRelative(filePath, cwd);
  if (!isGoverned(rel)) process.exit(0);
  if (!existsSync(filePath)) process.exit(0);

  const content = readFileSync(filePath, "utf8");
  const messages = [];

  // 1. file-size ratchet
  const ceiling = ceilingFor(rel);
  if (ceiling !== Infinity) {
    const lines = content.split("\n").length;
    if (lines > ceiling) {
      messages.push(
        FROZEN[rel]
          ? `file-size guard: ${rel} is ${lines} lines, past its frozen ceiling of ${ceiling}.\n` +
              `This is a known oversized file being paid down — it may only SHRINK. ` +
              `If this edit grew it, extract the new logic into a cohesive module instead of appending.`
          : `file-size guard: ${rel} is ${lines} lines, over the ${BUDGET}-line tripwire. ` +
              `This is an ALARM, not a cap. Before moving on, ask:\n` +
              `  1. Cohesion — does everything here change for the same reason? If no, split along that seam.\n` +
              `  2. Reader — is this genuinely ONE concern best read whole? If so, add it to EXEMPT in\n` +
              `     scripts/hooks/file-size-budget.mjs with a one-line reason.\n` +
              `The arch-check gate will fail at commit until this is resolved.`,
      );
    }
  }

  // 2. import boundary — restricted module
  if (importsRestrictedUnlisted(rel, content)) {
    messages.push(
      `import-boundary guard: ${rel} imports the restricted module (see import-boundaries.mjs) ` +
        `and is not on the allowlist.\n` +
        `Default to the safe path. Only if this caller genuinely needs the restricted capability ` +
        `should you keep it — then add ${rel} to ALLOWLIST in scripts/hooks/import-boundaries.mjs ` +
        `and leave a comment at the call site saying why.\n` +
        `The arch-check gate will fail at commit until this is resolved.`,
    );
  }

  if (messages.length === 0) process.exit(0);
  process.stderr.write(messages.join("\n\n") + "\n");
  process.exit(2);
}

main();
