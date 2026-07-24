#!/usr/bin/env bash
#
# install-hub.sh — set up the hub-and-spokes tooling on this machine.
#
# Creates the container (~/hubs by default), installs the `hub` dispatcher and the
# _template cockpit into it, and adds a `hub` alias to your shell rc. Idempotent.
# See docs/HUB-AND-SPOKES.md for the why.
#
# Usage:
#   ./hub/install-hub.sh                 # container ~/hubs, alias into ~/.zshrc
#   HUBS_DIR=~/cockpits ./hub/install-hub.sh
#   ./hub/install-hub.sh ~/.bashrc       # write the alias to a different rc file
#
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUBS="${HUBS_DIR:-$HOME/hubs}"
RC="${1:-$HOME/.zshrc}"

mkdir -p "$HUBS"

install -m 0755 "$SRC/hub" "$HUBS/hub"

if [ -d "$HUBS/_template" ]; then
  echo "• _template already present at $HUBS/_template — left as-is"
else
  cp -R "$SRC/_template" "$HUBS/_template"
  chmod +x "$HUBS/_template/launch"
  echo "• installed template → $HUBS/_template"
fi

if grep -qs "alias hub=" "$RC"; then
  echo "• 'hub' alias already in $RC — left as-is"
else
  printf "alias hub='%s/hub'\n" "$HUBS" >> "$RC"
  echo "• added 'hub' alias to $RC"
fi

echo
echo "Done. Open a new shell (or: source \"$RC\"), then:"
echo "    hub new <name>        # scaffold a cockpit"
echo "    \$EDITOR $HUBS/<name>/launch   # set your spokes"
echo "    hub <name>            # launch"
