#!/usr/bin/env node
/**
 * SessionStart — assign this session its own dev-server port.
 *
 * Many agents share one repo on `main`; each needs its own `pnpm dev` on a
 * distinct port, and 5173 is reserved for the human's own server. This claims
 * a free port in 5180-5199 (atomic mkdir marker + a real bind check), records
 * the owning session, and injects the port + the shared-work rules as context.
 * Abandoned claims (>12h) are reclaimable. SessionEnd releases the claim.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { payload, coordDir, nowSec } from "./agent-coord.mjs";

const LOW = 5180;
const HIGH = 5199;
const STALE_SECONDS = 12 * 3600;

function free(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function main() {
  const p = payload();
  const session = p.session_id || "unknown";
  const portsDir = join(coordDir(p.cwd), "ports");
  try {
    mkdirSync(portsDir, { recursive: true });
  } catch {
    /* exists */
  }

  let chosen = null;
  for (let port = LOW; port <= HIGH; port++) {
    const marker = join(portsDir, String(port));
    let claimable = false;
    try {
      mkdirSync(marker);
      claimable = true; // fresh claim
    } catch {
      // already claimed — reclaim only if stale or unreadable
      try {
        const owner = JSON.parse(readFileSync(join(marker, "owner"), "utf8"));
        if (nowSec() - Number(owner.ts || 0) > STALE_SECONDS) claimable = true;
      } catch {
        claimable = true;
      }
    }
    if (!claimable) continue;
    if (!(await free(port))) continue; // something non-agent is actually on it
    writeFileSync(
      join(marker, "owner"),
      JSON.stringify({ session, ts: nowSec() }),
    );
    chosen = port;
    break;
  }

  const ctx = chosen
    ? `Your dev-server port for THIS session is ${chosen}.\n` +
      `Start it with:  pnpm dev --port ${chosen} --strictPort\n` +
      `Shared-work rules:\n` +
      `  - Port 5173 belongs to the human's own dev server. Never start, restart, or kill anything on it.\n` +
      `  - Use YOUR port ${chosen}. If pnpm reports a different bound port, trust pnpm's output.\n` +
      `  - On cleanup, kill only your own dev-server PID, never a sibling's.`
    : `No free dev port in ${LOW}-${HIGH}. Pick one above ${HIGH}, verify it's free first, and never use 5173.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: ctx,
      },
    }),
  );
  process.exit(0);
}

main();
