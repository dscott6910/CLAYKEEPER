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

cd "$REPO_DIR/frontend"
exec node scripts/send-staff-request-notifications.mjs "$@"
