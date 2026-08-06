#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/apps/CLAYKEEPER}"
RESTORE_ROOT="${RESTORE_ROOT:-$HOME/CODEX/Restored}"
APPLY=false
ARCHIVE=""

usage() {
  cat <<'EOF'
Usage:
  ./restore.sh SNAPSHOT.tar.gz
  ./restore.sh --apply SNAPSHOT.tar.gz

Default behavior safely extracts the snapshot into:
  ~/CODEX/Restored/<snapshot-name>/

With --apply, the script replaces ~/apps/CLAYKEEPER after:
  1. confirming the archive is valid,
  2. requiring a clean Git working tree,
  3. creating a safety backup of the current project.

Environment overrides:
  PROJECT_ROOT=/custom/project/path
  RESTORE_ROOT=/custom/restore/path
EOF
}

fail() {
  printf '[restore] ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[restore] %s\n' "$*"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
  shift
fi

ARCHIVE="${1:-}"
[[ -n "$ARCHIVE" ]] || { usage; exit 1; }
[[ -f "$ARCHIVE" ]] || fail "Snapshot not found: $ARCHIVE"

if [[ -f "${ARCHIVE}.sha256" ]]; then
  log "Verifying SHA-256 checksum..."
  (
    cd "$(dirname "$ARCHIVE")"
    sha256sum -c "$(basename "${ARCHIVE}.sha256")"
  )
fi

log "Testing archive..."
tar -tzf "$ARCHIVE" >/dev/null

SNAPSHOT_BASENAME="$(basename "$ARCHIVE" .tar.gz)"
DESTINATION="${RESTORE_ROOT}/${SNAPSHOT_BASENAME}"

if [[ "$APPLY" != true ]]; then
  mkdir -p "$DESTINATION"
  tar -xzf "$ARCHIVE" -C "$DESTINATION"
  log "Snapshot extracted safely to:"
  printf '%s\n' "$DESTINATION"
  log "The active ClayKeeper project was not changed."
  exit 0
fi

[[ -d "$PROJECT_ROOT/.git" ]] || fail "Active project is not a Git repository: $PROJECT_ROOT"

if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]]; then
  fail "The active repository has local changes. Commit or remove them before applying a restore."
fi

CURRENT_BACKUP_DIR="${HOME}/CODEX/Backups"
mkdir -p "$CURRENT_BACKUP_DIR"
CURRENT_BACKUP="${CURRENT_BACKUP_DIR}/ClayKeeper_before_restore_$(date +%Y%m%d_%H%M%S).tar.gz"

log "Creating safety backup: $CURRENT_BACKUP"
tar \
  --exclude='.git' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  -czf "$CURRENT_BACKUP" \
  -C "$(dirname "$PROJECT_ROOT")" \
  "$(basename "$PROJECT_ROOT")"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
tar -xzf "$ARCHIVE" -C "$TEMP_DIR"

RESTORED_PROJECT="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -n "$RESTORED_PROJECT" ]] || fail "The archive did not contain a project directory."
[[ -f "$RESTORED_PROJECT/frontend/package.json" ]] || fail "The archive does not appear to contain ClayKeeper."

printf '\nThis will replace:\n  %s\nwith snapshot:\n  %s\n\n' "$PROJECT_ROOT" "$ARCHIVE"
read -r -p "Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || fail "Restore cancelled."

GIT_DIR_BACKUP="$(mktemp -d)"
cp -a "$PROJECT_ROOT/.git" "$GIT_DIR_BACKUP/.git"

rm -rf "$PROJECT_ROOT"
mkdir -p "$PROJECT_ROOT"
cp -a "$RESTORED_PROJECT/." "$PROJECT_ROOT/"
rm -rf "$PROJECT_ROOT/.git"
cp -a "$GIT_DIR_BACKUP/.git" "$PROJECT_ROOT/.git"
rm -rf "$GIT_DIR_BACKUP"

log "Restore applied."
log "Run these checks next:"
printf '  cd %q\n' "$PROJECT_ROOT"
printf '  git status\n'
printf '  cd frontend && npm ci && npm run build\n'
