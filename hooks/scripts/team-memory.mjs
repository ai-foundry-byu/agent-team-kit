#!/usr/bin/env node
/**
 * SessionStart, load the project's TEAM memory into this session's memory dir.
 *
 * Claude Code memory is per-machine: it lives under
 * ~/.claude/projects/<encoded launch path>/memory/ and never travels. That is
 * right for personal notes and wrong for what a team learns about its own
 * project ("local dev points at the prod DB", "migrations go through X, never
 * Y"). So the project keeps a TRACKED folder, .claude/team-memory/, in the same
 * format (one memory per file + a MEMORY.md index), and this hook makes every
 * teammate's session recall it the normal way:
 *
 *   1. Each team memory file is SYMLINKED into the session's memory dir under
 *      the same name, so `[[name]]` links resolve and an edit lands in the
 *      tracked file (it shows up in `git diff`, which is the point).
 *      Where symlinks are not available (some Windows setups) it copies.
 *   2. The team index lines are written into the personal MEMORY.md between
 *      two marker comments, at the TOP, so a long personal index can never push
 *      them past the part that is loaded. Everything outside the markers is the
 *      person's own and is never touched.
 *   3. Links to team files that no longer exist are removed.
 *
 * A personal (non-symlink) file with the same name as a team memory wins and
 * is reported, never overwritten.
 *
 * New team memories arrive with `git pull` and load at the next session start.
 * Promote a personal memory into the team folder with the /share-memory skill.
 *
 * Never fails a session: any error exits 0 silently.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const START = "<!-- team-memory:start (managed by scripts/hooks/team-memory.mjs; edit .claude/team-memory/ instead) -->";
const END = "<!-- team-memory:end -->";
const SKIP = new Set(["MEMORY.md", "README.md"]);

function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Claude encodes the launch path by turning every non-alphanumeric into "-". */
const encode = (p) => p.replace(/[^A-Za-z0-9]/g, "-");

function memoryDir(input, projectDir) {
  // The transcript lives in the project's brain dir; memory/ sits beside it.
  // Preferred over re-deriving the encoding, which Claude Code owns.
  if (input.transcript_path) return path.join(path.dirname(input.transcript_path), "memory");
  return path.join(os.homedir(), ".claude", "projects", encode(input.cwd || projectDir), "memory");
}

function syncFiles(teamDir, memDir) {
  const notes = [];
  const teamFiles = fs.readdirSync(teamDir).filter((f) => f.endsWith(".md") && !SKIP.has(f));
  for (const f of teamFiles) {
    const src = path.join(teamDir, f);
    const dst = path.join(memDir, f);
    let st = null;
    try { st = fs.lstatSync(dst); } catch {}
    if (st && !st.isSymbolicLink()) {
      // Either a personal memory of the same name, or a copy from a no-symlink
      // platform. Refresh copies we made; leave personal files alone.
      const isOurCopy = fs.readFileSync(dst, "utf8").includes("<!-- team-memory copy -->");
      if (!isOurCopy) { notes.push(`personal "${f}" shadows the team memory of the same name`); continue; }
    }
    if (st?.isSymbolicLink() && fs.readlinkSync(dst) === src) continue;
    try { fs.rmSync(dst, { force: true }); } catch {}
    try {
      fs.symlinkSync(src, dst);
    } catch {
      fs.writeFileSync(dst, fs.readFileSync(src, "utf8") + "\n<!-- team-memory copy -->\n");
    }
  }
  // Remove links (or our copies) whose team file is gone.
  for (const f of fs.readdirSync(memDir)) {
    const p = path.join(memDir, f);
    try {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) {
        const target = fs.readlinkSync(p);
        if (target.startsWith(teamDir + path.sep) && !fs.existsSync(target)) fs.rmSync(p);
      } else if (f.endsWith(".md") && !teamFiles.includes(f) &&
                 fs.readFileSync(p, "utf8").includes("<!-- team-memory copy -->")) {
        fs.rmSync(p);
      }
    } catch {}
  }
  return notes;
}

function syncIndex(teamDir, memDir) {
  const teamIndex = path.join(teamDir, "MEMORY.md");
  const lines = fs.existsSync(teamIndex)
    ? fs.readFileSync(teamIndex, "utf8").split("\n").filter((l) => /^\s*- \[/.test(l))
    : [];
  const block = [START, "## Team memory (shared with the project, via git)", ...lines, END].join("\n");

  const idx = path.join(memDir, "MEMORY.md");
  const cur = fs.existsSync(idx) ? fs.readFileSync(idx, "utf8") : "# Memory index\n";
  const s = cur.indexOf(START);
  const e = cur.indexOf(END);
  let rest = s >= 0 && e > s ? cur.slice(0, s) + cur.slice(e + END.length) : cur;
  rest = rest.replace(/^\n+/, "");
  // Keep a leading H1 on top, team block right under it, personal entries after.
  const m = rest.match(/^# .*\n/);
  const next = m
    ? `${m[0]}\n${block}\n\n${rest.slice(m[0].length).replace(/^\n+/, "")}`
    : `${block}\n\n${rest}`;
  if (next !== cur) fs.writeFileSync(idx, next);
  return lines.length;
}

try {
  const input = readInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const teamDir = path.join(projectDir, ".claude", "team-memory");
  if (fs.existsSync(teamDir)) {
    const memDir = memoryDir(input, projectDir);
    fs.mkdirSync(memDir, { recursive: true });
    const notes = syncFiles(teamDir, memDir);
    const n = syncIndex(teamDir, memDir);
    const msg = [`Team memory: ${n} shared entries loaded from .claude/team-memory/ (edit there; promote personal memories with /share-memory).`];
    for (const note of notes) msg.push(`  - ${note}`);
    process.stdout.write(msg.join("\n") + "\n");
  }
} catch {
  // Never block a session over memory sync.
}
process.exit(0);
