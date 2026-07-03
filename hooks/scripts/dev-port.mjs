#!/usr/bin/env node
/**
 * SessionStart, assign this session its own dev-server port.
 *
 * Many agents share one repo on `main`; each needs its own dev server on a
 * distinct port, and one port is reserved for the human's own server. This
 * claims a free port from the pool (atomic mkdir marker + a real bind check),
 * records the owning session, and injects the port + the start command + the
 * shared-work rules as context. Abandoned claims (>12h) are reclaimable;
 * SessionEnd releases the claim.
 *
 * ── PER-PROJECT CONFIG ───────────────────────────────────────────────────
 * Edit the four constants below for YOUR stack. They are the only things that
 * change between projects:
 *   - POOL_LOW / POOL_HIGH : the agent dev-server port pool. The default
 *       (5180-5199, 20 slots) sits just above Vite's default and clears the
 *       privileged (<1024), ephemeral (49152+), macOS-AirPlay (5000/7000), and
 *       common-service (5432/3306/6379/8080) ports. If you run agents on TWO
 *       apps at once, give each app its OWN non-overlapping pool (their agents
 *       can't see each other's claims across repos), e.g. app A 5180-5199,
 *       app B 3010-3029.
 *   - RESERVED_PORT : your dev server's DEFAULT port, kept for the human. It's
 *       Vite's 5173 here; for Next it's 3000, for a custom server whatever you
 *       set. Agents never touch it.
 *   - START_HINT(port) : how THIS stack starts a dev server on a chosen port.
 *       Vite/SvelteKit: `pnpm dev --port ${port} --strictPort`
 *       Next.js:        `pnpm dev -p ${port}`
 *       Node/Express:   `PORT=${port} pnpm dev`
 * ─────────────────────────────────────────────────────────────────────────
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { payload, coordDir, nowSec } from "./agent-coord.mjs";

const POOL_LOW = 5180;
const POOL_HIGH = 5199;
const RESERVED_PORT = 5173;
const START_HINT = (port) => `pnpm dev --port ${port} --strictPort`;

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
  for (let port = POOL_LOW; port <= POOL_HIGH; port++) {
    if (port === RESERVED_PORT) continue; // never hand out the human's port
    const marker = join(portsDir, String(port));
    let claimable = false;
    try {
      mkdirSync(marker);
      claimable = true; // fresh claim
    } catch {
      // already claimed, reclaim only if stale or unreadable
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
      `Start it with:  ${START_HINT(chosen)}\n` +
      `Shared-work rules:\n` +
      `  - Port ${RESERVED_PORT} belongs to the human's own dev server. Never start, restart, or kill anything on it.\n` +
      `  - Use YOUR port ${chosen}. If the dev server reports a different bound port, trust that.\n` +
      `  - On cleanup, kill only your own dev-server PID, never a sibling's.`
    : `No free dev port in ${POOL_LOW}-${POOL_HIGH}. Pick one above ${POOL_HIGH}, verify it's free first, and never use ${RESERVED_PORT}.`;

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
