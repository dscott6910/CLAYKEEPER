#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/CODEX/Backups/ClayKeeper}"
CONFIG_FILE="${CLAYKEEPER_BACKUP_CONFIG:-$HOME/.config/claykeeper/backup.env}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[backup-sync] No offsite backup configuration found at $CONFIG_FILE. Local backup completed; cloud copy skipped."
  exit 0
fi

# The configuration is created by the Google Drive setup instructions and is
# stored outside the repository because it identifies the user's remote.
set -a
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

REMOTE="${CLAYKEEPER_RCLONE_REMOTE:-}"
if [[ -z "$REMOTE" ]]; then
  echo "[backup-sync] CLAYKEEPER_RCLONE_REMOTE is missing from $CONFIG_FILE." >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "[backup-sync] rclone is not installed. Install and configure it before enabling the Google Drive copy." >&2
  exit 1
fi

if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "[backup-sync] Local backup folder does not exist: $BACKUP_ROOT" >&2
  exit 1
fi

echo "[backup-sync] Copying ClayKeeper backups to encrypted offsite remote..."
rclone copy "$BACKUP_ROOT" "$REMOTE" \
  --checkers 8 \
  --transfers 4 \
  --immutable \
  --verbose
echo "[backup-sync] Offsite copy completed."
