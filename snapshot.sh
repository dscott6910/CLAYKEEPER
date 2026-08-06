#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/apps/CLAYKEEPER}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-$HOME/CODEX/Snapshots}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
HOSTNAME_SHORT="$(hostname -s 2>/dev/null || hostname)"
ARCHIVE_NAME="ClayKeeper_${TIMESTAMP}_${HOSTNAME_SHORT}.tar.gz"
ARCHIVE_PATH="${SNAPSHOT_DIR}/${ARCHIVE_NAME}"

log() {
  printf '[snapshot] %s\n' "$*"
}

fail() {
  printf '[snapshot] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$PROJECT_ROOT" ]] || fail "Project directory not found: $PROJECT_ROOT"
[[ -f "$PROJECT_ROOT/frontend/package.json" ]] || fail "This does not look like the ClayKeeper project: $PROJECT_ROOT"

mkdir -p "$SNAPSHOT_DIR"

log "Creating snapshot from $PROJECT_ROOT"
log "Destination: $ARCHIVE_PATH"

tar \
  --exclude='.git' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='*.log' \
  --exclude='frontend/.env.backup' \
  -czf "$ARCHIVE_PATH" \
  -C "$(dirname "$PROJECT_ROOT")" \
  "$(basename "$PROJECT_ROOT")"

[[ -s "$ARCHIVE_PATH" ]] || fail "Snapshot was not created."

sha256sum "$ARCHIVE_PATH" > "${ARCHIVE_PATH}.sha256"

log "Snapshot created successfully."
ls -lh "$ARCHIVE_PATH" "${ARCHIVE_PATH}.sha256"
