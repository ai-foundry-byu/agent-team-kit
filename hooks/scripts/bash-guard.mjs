#!/usr/bin/env node
/**
 * PreToolUse (Bash), guards for many-agents-on-one-`main`.
 *
 *  A. Git safety, block tree-wide staging / destructive commands that would
 *     sweep in OR destroy other agents' uncommitted work in the shared tree.
 *  B. Schema lock, serialize DB/schema/dependency-mutating commands behind a
 *     single repo-wide lease so two agents can't migrate or seed at once.
 *
 * One hook (not two) so each Bash call spawns one process. Exit 2 + stderr
 * blocks the command and tells Claude why; exit 0 allows. The lock is LOCAL:
 * it coordinates this machine's agents, not the remote collaborator.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  payload,
  coordDir,
  nowSec,
  unquote,
  isLinkedWorktree,
} from "./agent-coord.mjs";

const LEASE_SECONDS = 600; // a held schema lock becomes stealable after 10 min idle

// --- A. git-safety patterns (block on match). Flags must sit right after the
// subcommand, so quoted/parenthetical mentions don't false-trip.
// `sharedTreeOnly` blocks exist solely to protect a SHARED working tree; they
// auto-relax inside a linked worktree (worktree mode), where each agent's tree
// is its own. Force-push has no such flag, it's dangerous from anywhere. ---
const GIT_BLOCKS = [
  {
    sharedTreeOnly: true,
    re: /\bgit\s+add\s+(-A\b|--all\b|\.(?:\s|$))/,
    msg: "Blanket `git add` stages the WHOLE working tree, on shared `main` that sweeps in other agents' in-flight changes. Stage explicit paths: `git add <file> <file>`.",
  },
  {
    sharedTreeOnly: true,
    re: /\bgit\s+commit\s+-[a-zA-Z]*a[a-zA-Z]*\b/,
    msg: "`git commit -a/-am` stages every modified tracked file, including other agents' work. Stage your explicit paths first, then `git commit -m`.",
  },
  {
    sharedTreeOnly: true,
    re: /\bgit\s+reset\s+--hard\b/,
    msg: "`git reset --hard` discards the ENTIRE working tree, it would destroy other agents' uncommitted work. Revert only your own paths (`git checkout -- <file>`), or ask the human.",
  },
  {
    sharedTreeOnly: true,
    re: /\bgit\s+clean\s+-[a-zA-Z]*f/,
    msg: "`git clean -f` deletes untracked files across the whole tree, including other agents' new files. Don't run it on shared `main`.",
  },
  {
    sharedTreeOnly: true,
    re: /\bgit\s+stash\b(?!\s+(list|show|pop|apply|drop))/,
    msg: "`git stash` pockets EVERY agent's uncommitted changes, not just yours. Don't stash on shared `main`.",
  },
  {
    sharedTreeOnly: true,
    re: /\bgit\s+checkout\s+(?:--\s+)?\.(?:\s|$)/,
    msg: "`git checkout -- .` reverts the whole tree, destroying other agents' uncommitted work. Revert only your own explicit paths.",
  },
  {
    re: /\bgit\s+push\b[^|&;]*(--force\b|--force-with-lease\b|\s-f\b)/,
    msg: "Force-push rewrites history shared with your collaborator. Never force-push `main`. (Normal pushes go through the `/push` skill, run by the human.)",
  },
];

// --- B. schema/DB/deps matcher (serialize) ---
const SCHEMA_RE =
  /(supabase\s+(db\s+push|db\s+reset|migration\b)|\bdb:types\b|\bseed:dev\b|\bseed:comments\b|\bpnpm\s+(add|remove|up|update)\b)/;

function schemaLockBlock(cmd, p) {
  if (!SCHEMA_RE.test(cmd)) return null;
  const session = p.session_id || "unknown";
  const lock = join(coordDir(p.cwd), "schema.lock");
  const ownerFile = join(lock, "owner");
  const take = () =>
    writeFileSync(ownerFile, JSON.stringify({ session, ts: nowSec() }));

  // fresh acquire
  try {
    mkdirSync(lock);
    take();
    return null;
  } catch {
    /* lock dir exists */
  }

  let owner = null;
  try {
    owner = JSON.parse(readFileSync(ownerFile, "utf8"));
  } catch {
    /* missing/garbled owner */
  }

  if (
    !owner ||
    owner.session === session ||
    nowSec() - Number(owner.ts || 0) > LEASE_SECONDS
  ) {
    take(); // ours, stale, or orphaned → (re)acquire
    return null;
  }

  const idle = nowSec() - Number(owner.ts || 0);
  return (
    `Another agent session holds the schema/DB lock (last active ${idle}s ago). ` +
    `Migrations, db:types, seed, and dependency changes are serialized so two agents can't ` +
    `mutate the shared dev DB at once. Wait and retry; the lock auto-frees after ` +
    `${LEASE_SECONDS / 60} min of inactivity.`
  );
}

// Schema DDL typed straight into psql bypasses migrations entirely: no
// supabase_migrations.schema_migrations row, no tracked file. Matched on the
// RAW command (the DDL lives inside -c "..." quotes). Reads (SELECT) and
// `psql -f <file>` carry no inline DDL text, so they pass untouched.
const PSQL_DDL_RE =
  /\bpsql\b[^|;&]*\b((create|alter|drop)\s+(table|index|(materialized\s+)?view|function|trigger|policy|schema|type|sequence|extension|publication|role|database|domain)|truncate\b|grant\b|revoke\b|comment\s+on\b)/i;

function main() {
  const p = payload();
  if ((p.tool_name || "") !== "Bash") process.exit(0);
  const raw = p.tool_input?.command || "";
  if (!raw) process.exit(0);
  const cmd = unquote(raw);

  if (PSQL_DDL_RE.test(raw)) {
    process.stderr.write(
      "Schema DDL run directly through psql bypasses the migration system: it leaves no row in supabase_migrations.schema_migrations and no tracked file, so the schema silently drifts from the migrations. Put the DDL in a numbered file under supabase/migrations/ and apply it with `supabase db push`. (psql reads and `psql -f <file>` are unaffected.)\n",
    );
    process.exit(2);
  }

  // In a linked worktree each agent's tree is its own, so the shared-tree git
  // blocks (blanket-stage, reset --hard, clean, stash, checkout -- .) are safe
  // and auto-relax. Force-push (no sharedTreeOnly flag) stays blocked anywhere.
  const linked = isLinkedWorktree(p.cwd);
  for (const g of GIT_BLOCKS) {
    if (linked && g.sharedTreeOnly) continue;
    if (g.re.test(cmd)) {
      process.stderr.write(g.msg + "\n");
      process.exit(2);
    }
  }

  const schemaMsg = schemaLockBlock(cmd, p);
  if (schemaMsg) {
    process.stderr.write(schemaMsg + "\n");
    process.exit(2);
  }

  process.exit(0);
}

main();
