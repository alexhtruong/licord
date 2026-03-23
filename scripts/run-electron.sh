#!/usr/bin/env bash
set -euo pipefail

# Some environments set this, which makes Electron behave like plain Node.
unset ELECTRON_RUN_AS_NODE || true

ELECTRON_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/node_modules/.bin/electron"

if [[ "$(id -u)" == "0" ]]; then
  exec "$ELECTRON_BIN" . --no-sandbox "$@"
else
  exec "$ELECTRON_BIN" . "$@"
fi

