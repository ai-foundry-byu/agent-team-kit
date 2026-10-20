# hub/: the hub-and-spokes tooling

Runnable tooling for the pattern in [`../docs/HUB-AND-SPOKES.md`](../docs/HUB-AND-SPOKES.md):
one neutral **command center** per project, with all real content mounted as **spokes** via
`--add-dir`. Read the doc for the *why*; this is the *how*.

```
hub/
├── install-hub.sh   # one-time: create ~/hubs, install the dispatcher + template, add the `hub` alias
├── hub              # the dispatcher:  hub ls | hub new <name> | hub <name> [args]
└── _template/       # scaffold copied by `hub new`
    ├── launch       # cd to the hub, mount SPOKES, launch Claude (skip-permissions OFF by default)
    └── CLAUDE.md    # the routing map to fill in
```

## Quick start

```bash
./hub/install-hub.sh                    # then open a new shell (or source your rc)
hub new myproject                       # scaffold ~/hubs/myproject
$EDITOR ~/hubs/myproject/launch         # set SPOKES (one absolute path per content folder)
hub myproject                           # launch (add a fenced spoke for one run: hub myproject --add-dir /path)
```

## Design defaults (and how to change them)

- **Base path is auto-derived** in `launch` from the script's own location; you don't set
  it, and it can't drift out of sync with the folder. Just don't move a hub after first use.
- **`--dangerously-skip-permissions` is OFF.** Flip `SKIP_PERMISSIONS="yes"` in a hub's
  `launch` only if you fully trust every spoke: with it on, Bash can read outside the
  mounted folders (file tools stay fenced regardless). See the doc's "honest limits."
- **Container is `~/hubs`.** Override with `HUBS_DIR` at install and dispatch time.
