# Hub-and-spokes: one command center, many mounted folders

A pattern for the other half of working with Claude Code: not *how agents avoid
colliding in one repo* (the rest of this kit), but **how you organize the folders a
project spans, and where you launch Claude from** so its memory and its file access land
where you want them. Small, transferable, and the thing to teach someone first.

> **The one-line version:** pick one neutral folder as your command center, launch every
> session from there, and reach all your real content — code, docs, drives — as *spokes*
> mounted with `--add-dir`. Never make a content folder the base.

---

## The problem

A real project's files are almost never in one folder, and you can't force them to be.
Ownership and audience scatter them on purpose:

- **Code** lives in a git repo (versioned, on GitHub).
- **Team docs** live in a shared drive someone else owns (so you can co-edit).
- **Institutional / official** docs live wherever your org governs them (OneDrive, Box…).
- **Private** material lives in an account nobody can revoke on you.

That scattering is not a mess to clean up — it's a constraint to design around. Meanwhile
Claude Code ties two things to **the directory you launch it in**:

1. **Memory.** Your file-based memory ("the brain") is keyed to the launch directory.
   One base → one brain. Launch from a different folder → a *different, empty* brain.
2. **File access.** Claude's file tools can touch the launch dir plus anything you pass
   with `--add-dir`, and nothing else.

So *where you launch* silently decides *which brain you get* and *what Claude can see*.
The hub-and-spokes pattern makes that decision on purpose, once.

## The axiom

> **The base directory is a command center, not a content location. Separate the brain
> from the content.**

The base (the **hub**) holds only configuration and anchors the memory. All content —
**including code** — is a **spoke**, living in its natural home and mounted with
`--add-dir`. Code is not special; it's just the spoke you happen to version.

```
~/hubs/<project>/          THE HUB — base, memory anchor, launch point. No content.
  ├── CLAUDE.md            the routing map (self-orients every session)
  └── launch               cd's here, then mounts the spokes
        │  one brain, always
        ├── --add-dir  <code repo>            (GitHub)
        ├── --add-dir  <team docs>            (shared drive)
        ├── --add-dir  <institutional docs>   (org drive)
        └── (private)                         mounted only when a task needs it
```

## Why the base must be neutral (and never move)

- **One brain by construction.** You never `cd` into the hub to *work* — only to launch —
  so you're never tempted to start a session from inside a content folder and fork off a
  second empty brain. Fragmentation becomes structurally impossible.
- **The memory key is a path.** Because the brain is keyed to the base's path, a base that
  is *also* a git repo exposes that key to clones, renames, and worktrees that can move it
  and orphan the brain. A neutral hub you never relocate keeps the key stable forever.
- **`--add-dir` grants files, not memory.** A mounted spoke contributes its *files*, never
  its memory. Only the base's brain is active. So choose the base for continuity (a folder
  that outlives every repo and drive) and reach everything else as spokes.

**Rule:** pick the hub's path once and never move it. Renaming or relocating a hub orphans
its brain (you can migrate it — copy `~/.claude/projects/<encoded-old-path>/` to the new
key — but avoid needing to).

## Organize spokes by privacy ring, not by tool

GitHub-vs-Drive-vs-OneDrive are *media*, not categories. The axis that matters is **who is
allowed to see a thing**. Sort spokes into rings — private → team → external → public — and
mount only the rings a given session should touch. In particular, **fence sensitive spokes
out of the default mount** and opt them in per-run:

```bash
hub myproject --add-dir "/path/to/the/private/folder"   # this run only
```

### What "fenced out" actually buys you (read this before trusting it)

Two layers of access behave differently:

| Tool | Scoped to hub + `--add-dir`? |
|---|---|
| File tools (Read/Edit/Grep/Glob) | **Yes** — they refuse paths outside the mounted dirs. |
| **Bash** (`cat`, `find`, …) | **No** — Bash can read anything your OS user can. |

Normally Bash **prompts** before running, so a stray reach-outside is caught. But
`--dangerously-skip-permissions` removes that prompt. So:

- **Default (prompts on):** file tools are fenced *and* any Bash reach-outside stops to ask
  you. This is the real "agents can't wander into my other files" guarantee, and it's why
  the bundled template ships with skip-permissions **off**.
- **skip-permissions on:** convenient, but file tools are fenced while Bash is not. Use it
  only for hubs whose spokes you fully trust.

Also worth knowing, because people assume the opposite: **nothing is ingested in the
background.** A mounted folder is not scanned or uploaded. A file's contents leave your
machine only when a tool actually reads it, on demand, for that turn. Mounting a spoke is
permission, not transmission.

The only *hard* wall beyond prompts is the OS: a separate user account, or a folder that
simply isn't synced to this machine, so the bytes aren't reachable at all.

## The container: `~/hubs/`

Once you have more than one project, put every hub under one container so the pattern has a
home — a place for a shared template and a single dispatcher.

**Name the container for what it holds — cockpits, not "projects."** Call it `~/hubs/`
(or `~/cockpits/`), *not* `~/projects/`. "Projects" quietly tells you the project lives
there, and you'll start dropping content into the hub — re-mixing brain and content, the
one thing this pattern exists to prevent. One level deep is enough: `~/hubs/<name>`.

The bundled `hub` dispatcher gives you:

```bash
hub                 # list your hubs
hub new <name>      # scaffold ~/hubs/<name> from the template
hub <name>          # launch that hub (cd + mount its spokes)
hub <name> --add-dir <path>   # add a fenced spoke for one run
```

## How this composes with the rest of the kit

The hub sets the **project frame** — the base (and thus the brain) and which folders are in
scope. The kit's session launchers (`cs`, `wt`, `cockpit`) set the **session frame** — its
name and whether it runs in a worktree. They stack: run `cs <name>` or `wt <name>` from
inside a hub and you get a named, worktree-isolated session *within* the hub's frame. Hubs
decide *where and over what*; the launchers decide *how many and how isolated*.

## Setup

From a clone of this kit:

```bash
./hub/install-hub.sh            # creates ~/hubs, installs the dispatcher + template, adds the `hub` alias
# open a new shell (or `source ~/.zshrc`), then:
hub new myproject               # scaffold a cockpit
$EDITOR ~/hubs/myproject/launch # set your spokes (one --add-dir each)
hub myproject                   # launch
```

The template's `launch` derives its own base path automatically (so the base can't drift
out of sync with its folder) and ships with skip-permissions **off**. Fill in `SPOKES`,
write the `CLAUDE.md` routing map, and you're working.

## Honest limits

- **Prompts-off is a convenience, not a boundary.** With `--dangerously-skip-permissions`,
  Bash can read outside the mounted spokes. If you need a guarantee, keep prompts on, or
  isolate at the OS level (separate account / unsynced folder).
- **The brain lives outside the hub.** Memory is under `~/.claude/projects/<encoded-path>/`,
  keyed to the base path — not inside the hub folder. Back up `~/.claude` if the brain
  matters, and don't move the hub.
- **This organizes access; it doesn't secure secrets.** A mounted spoke with credentials in
  it is readable like any other file. Ring discipline reduces *what's in scope*; it is not
  encryption or access control.
- **One base per project is a choice you must keep.** The whole guarantee rests on always
  launching through the dispatcher. Launch `claude` by hand from a content folder and you've
  started a second brain.
