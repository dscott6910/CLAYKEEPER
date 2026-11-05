#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${CLAYKEEPER_REPO_DIR:-$HOME/apps/CLAYKEEPER}"
CONFIG_FILE="${CLAYKEEPER_NOTIFICATION_CONFIG:-$HOME/.config/claykeeper/notifications.env}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[registration-notifications] Configuration is missing: $CONFIG_FILE" >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR/frontend" ]]; then
  echo "[registration-notifications] ClayKeeper frontend was not found: $REPO_DIR/frontend" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

NODE_BIN="${CLAYKEEPER_NODE_BIN:-}"

if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi

if [[ -z "$NODE_BIN" ]]; then
  shopt -s nullglob
  NODE_CANDIDATES=(
    "$HOME"/.nvm/versions/node/*/bin/node
    "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node
    "$HOME"/.volta/bin/node
    "$HOME"/.asdf/shims/node
  )
  shopt -u nullglob

  for candidate in "${NODE_CANDIDATES[@]}"; do
    if [[ -x "$candidate" ]]; then
      NODE_BIN="$candidate"
    fi
  done
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "[registration-notifications] Node.js could not be found. Run configure-registration-notifications.sh again from an interactive shell." >&2
  exit 1
fi

cd "$REPO_DIR/frontend"
exec "$NODE_BIN" scripts/send-staff-request-notifications.mjs "$@"
