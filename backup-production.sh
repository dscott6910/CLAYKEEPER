#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/CODEX/Backups/ClayKeeper}"
SNAPSHOT_SCRIPT="${PROJECT_ROOT}/snapshot.sh"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
HOSTNAME_SHORT="$(hostname -s 2>/dev/null || hostname)"
RUN_DIR="${BACKUP_ROOT}/production_${TIMESTAMP}_${HOSTNAME_SHORT}"
YES=false
SKIP_CODE_SNAPSHOT=false

usage() {
  cat <<'HELP'
Usage:
  ./backup-production.sh
  ./backup-production.sh --yes
  ./backup-production.sh --skip-code-snapshot

Creates a timestamped production backup folder containing:
  - Supabase schema dump
  - Supabase data dump
  - Supabase role dump when available
  - SHA-256 checksums
  - A small manifest describing the backup

By default, it also runs ./snapshot.sh to create a source-code snapshot.

Environment overrides:
  PROJECT_ROOT=/custom/project/path
  BACKUP_ROOT=/custom/backup/path

Important:
  Database backups contain real production data. Store them securely.
HELP
}

log() {
  printf '[backup] %s\n' "$*"
}

warn() {
  printf '[backup] WARNING: %s\n' "$*" >&2
}

fail() {
  printf '[backup] ERROR: %s\n' "$*" >&2
  exit 1
}

checksum_file() {
  local file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" > "${file_path}.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" > "${file_path}.sha256"
  else
    warn "No SHA-256 checksum tool was found. Skipping checksum for $file_path"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)
      YES=true
      shift
      ;;
    --skip-code-snapshot)
      SKIP_CODE_SNAPSHOT=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      fail "Unknown option: $1"
      ;;
  esac
done

[[ -d "$PROJECT_ROOT/.git" ]] || \
  fail "Git repository not found: $PROJECT_ROOT"

[[ -f "$PROJECT_ROOT/frontend/package.json" ]] || \
  fail "Frontend package.json was not found."

[[ -d "$PROJECT_ROOT/supabase/migrations" ]] || \
  fail "Supabase migrations folder was not found."

if [[ "$SKIP_CODE_SNAPSHOT" != true ]]; then
  [[ -x "$SNAPSHOT_SCRIPT" ]] || \
    fail "snapshot.sh was not found or is not executable. Run: chmod +x snapshot.sh"
fi

if ! command -v npx >/dev/null 2>&1; then
  fail "npx was not found. Run this on the ClayKeeper server where Supabase CLI is available."
fi

cd "$PROJECT_ROOT"

printf '\n============================================================\n'
printf ' ClayKeeper Production Backup\n'
printf '============================================================\n\n'
printf 'Project:\n  %s\n\n' "$PROJECT_ROOT"
printf 'Backup folder:\n  %s\n\n' "$RUN_DIR"
printf 'This exports live production database data.\n'
printf 'Treat the generated files like private records, not ordinary code.\n\n'

if [[ "$YES" != true ]]; then
  read -r -p "Type BACKUP to continue: " CONFIRM
  [[ "$CONFIRM" == "BACKUP" ]] || \
    fail "Backup cancelled."
fi

mkdir -p "$RUN_DIR"
chmod 700 "$RUN_DIR"

MANIFEST_PATH="${RUN_DIR}/manifest.txt"

{
  printf 'ClayKeeper production backup\n'
  printf 'Created: %s\n' "$(date -Is)"
  printf 'Host: %s\n' "$HOSTNAME_SHORT"
  printf 'Project root: %s\n' "$PROJECT_ROOT"
  printf 'Git commit: '
  git rev-parse --short HEAD
  printf 'Git status:\n'
  git status --short
} > "$MANIFEST_PATH"

chmod 600 "$MANIFEST_PATH"

if [[ "$SKIP_CODE_SNAPSHOT" != true ]]; then
  log "Creating source-code snapshot..."
  "$SNAPSHOT_SCRIPT" | tee "${RUN_DIR}/code-snapshot.log"
  chmod 600 "${RUN_DIR}/code-snapshot.log"
fi

log "Creating Supabase schema backup..."
npx supabase db dump --linked \
  --file "${RUN_DIR}/schema.sql"
chmod 600 "${RUN_DIR}/schema.sql"
checksum_file "${RUN_DIR}/schema.sql"

log "Creating Supabase data backup..."
npx supabase db dump --linked \
  --data-only \
  --use-copy \
  --file "${RUN_DIR}/data.sql"
chmod 600 "${RUN_DIR}/data.sql"
checksum_file "${RUN_DIR}/data.sql"

log "Creating Supabase role backup..."
if npx supabase db dump --linked \
  --role-only \
  --file "${RUN_DIR}/roles.sql"; then
  chmod 600 "${RUN_DIR}/roles.sql"
  checksum_file "${RUN_DIR}/roles.sql"
else
  warn "Role backup failed. Schema and data backups were still created."
  printf 'Role backup failed at %s\n' "$(date -Is)" > "${RUN_DIR}/roles-backup-failed.txt"
  chmod 600 "${RUN_DIR}/roles-backup-failed.txt"
fi

checksum_file "$MANIFEST_PATH"

printf '\n============================================================\n'
printf ' Backup completed\n'
printf '============================================================\n\n'
printf 'Backup folder:\n  %s\n\n' "$RUN_DIR"
printf 'Files:\n'
find "$RUN_DIR" -maxdepth 1 -type f -print | sort | sed 's/^/  /'
printf '\n\nStore a copy somewhere safe and private.\n'
