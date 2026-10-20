# <PROJECT>: Hub

Neutral command center for this project. Owns no content: only config, routing rules, and
the memory anchor. Every session launches from here (via `hub <name>`) so there is exactly
one memory brain, keyed to this folder's path, never fragmented.

## Compartments: content lives in its natural home, mounted via `--add-dir`

| # | Compartment | Location | Who sees it / why it lives there |
|---|---|---|---|
| 1 | … | … | … |
| 2 | … | … | … |

## Routing: where does a file go?

- … → …
- … → …

## Rules of the hub

- **Always launch via `hub <name>`.** It `cd`s here, so memory is always this one brain.
- **Never make a content folder the base.** Don't `cd` into a spoke and run `claude` there;
  that spawns a separate, empty brain.
- **This path never moves.** Memory is keyed to this folder; renaming/relocating it orphans
  the brain.
- **Sensitive folders stay out of the default mount.** Add them per-run only:
  `hub <name> --add-dir "/path/to/private/folder"`.

## Files in this hub

- `launch`: the launch script (set `SPOKES` inside it)
- `CLAUDE.md`: this file
