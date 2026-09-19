#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/CODEX/Backups/ClayKeeper}"
LOG_DIR="${LOG_DIR:-$HOME/CODEX/Logs/ClayKeeper}"
SCHEDULE="${CLAYKEEPER_BACKUP_SCHEDULE:-15 2 * * *}"
CRON_TAG="# ClayKeeper daily production backup"

if ! command -v crontab >/dev/null 2>&1; then
  echo "[backup-schedule] ERROR: crontab is not available on this server." >&2
  exit 1
fi

if [[ ! -x "$PROJECT_ROOT/backup-production.sh" ]]; then
  echo "[backup-schedule] ERROR: backup-production.sh is missing or not executable." >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT" "$LOG_DIR"
chmod 700 "$BACKUP_ROOT" "$LOG_DIR"

CRON_LINE="$SCHEDULE cd \"$PROJECT_ROOT\" && /usr/bin/env bash \"$PROJECT_ROOT/backup-production.sh\" --yes >> \"$LOG_DIR/daily-backup.log\" 2>&1 $CRON_TAG"
CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"

{
  printf '%s\n' "$CURRENT_CRONTAB" | grep -Fv "$CRON_TAG" || true
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "[backup-schedule] Daily ClayKeeper database backup installed."
echo "[backup-schedule] Schedule: $SCHEDULE"
echo "[backup-schedule] Backups:  $BACKUP_ROOT"
echo "[backup-schedule] Log:      $LOG_DIR/daily-backup.log"
echo "[backup-schedule] Run ./backup-production.sh --yes once now to verify the first backup."
