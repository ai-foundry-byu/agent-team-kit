#!/usr/bin/env node
/**
 * SessionEnd — release the schema lock and dev-port claim this session owns.
 *
 * Best-effort cleanup so a tidy exit frees resources immediately. If a session
 * dies without SessionEnd firing, the staleness leases in bash-guard / dev-port
 * reclaim the lock (10 min) and the port (12 h) anyway.
 */
import { readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { payload, coordDir } from "./agent-coord.mjs";

function ownsThenRemove(dir, session) {
  try {
    const owner = JSON.parse(readFileSync(join(dir, "owner"), "utf8"));
    if (owner.session === session)
      rmSync(dir, { recursive: true, force: true });
  } catch {
    /* not ours / unreadable — leave it for the staleness lease */
  }
}

function main() {
  const p = payload();
  const session = p.session_id || "unknown";
  const dir = coordDir(p.cwd);

  ownsThenRemove(join(dir, "schema.lock"), session);

  const portsDir = join(dir, "ports");
  try {
    for (const name of readdirSync(portsDir)) {
      ownsThenRemove(join(portsDir, name), session);
    }
  } catch {
    /* no ports dir */
  }

  process.exit(0);
}

main();
