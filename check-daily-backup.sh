#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/CODEX/Backups/ClayKeeper}"
LATEST="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'production_*' -print 2>/dev/null | sort | tail -n 1)"

if [[ -z "$LATEST" ]]; then
  echo "[backup-check] No ClayKeeper production backup folders were found in $BACKUP_ROOT." >&2
  exit 1
fi

if [[ ! -f "$LATEST/data.sql" ]]; then
  echo "[backup-check] Latest backup is missing data.sql: $LATEST" >&2
  exit 1
fi

AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$LATEST/data.sql" 2>/dev/null || stat -f %m "$LATEST/data.sql") ))
MAX_AGE_SECONDS=$((26 * 60 * 60))

echo "[backup-check] Latest backup: $LATEST"
echo "[backup-check] Database export: $LATEST/data.sql"

if (( AGE_SECONDS > MAX_AGE_SECONDS )); then
  echo "[backup-check] WARNING: the latest database export is more than 26 hours old." >&2
  exit 2
fi

echo "[backup-check] Current: database export is less than 26 hours old."
