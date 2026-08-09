#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/apps/CLAYKEEPER}"
RESTORE_ROOT="${RESTORE_ROOT:-$HOME/CODEX/Restored}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/CODEX/Backups}"

APPLY=false
ARCHIVE=""

usage() {
  cat <<'HELP'
Usage:
  ./restore.sh SNAPSHOT.tar.gz
  ./restore.sh --apply SNAPSHOT.tar.gz

Default behavior:
  Safely extracts the snapshot into:
  ~/CODEX/Restored/<snapshot-name>/

  The active ClayKeeper installation is NOT changed.

Apply behavior:
  ./restore.sh --apply SNAPSHOT.tar.gz

  Before replacing the active project, the script:
  1. Verifies the snapshot archive.
  2. Requires a clean Git working tree.
  3. Creates a safety backup of the current project.
  4. Preserves the existing .git directory.
  5. Preserves frontend/.env and frontend/.env.* files.
  6. Restores the selected snapshot.
  7. Restores Git metadata.
  8. Restores the live environment files.

Environment overrides:
  PROJECT_ROOT=/custom/project/path
  RESTORE_ROOT=/custom/restore/path
  BACKUP_ROOT=/custom/backup/path
HELP
}

log() {
  printf '[restore] %s\n' "$*"
}

fail() {
  printf '[restore] ERROR: %s\n' "$*" >&2
  exit 1
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

[[ -n "$ARCHIVE" ]] || {
  usage
  exit 1
}

[[ -f "$ARCHIVE" ]] || \
  fail "Snapshot not found: $ARCHIVE"

# ---------------------------------------------------------
# Verify checksum when available.
# ---------------------------------------------------------

if [[ -f "${ARCHIVE}.sha256" ]]; then
  log "Verifying SHA-256 checksum..."

  (
    cd "$(dirname "$ARCHIVE")"
    sha256sum -c "$(basename "${ARCHIVE}.sha256")"
  )
else
  log "No checksum file found. Continuing with archive validation."
fi

# ---------------------------------------------------------
# Verify archive integrity.
# ---------------------------------------------------------

log "Testing snapshot archive..."

tar -tzf "$ARCHIVE" >/dev/null

SNAPSHOT_BASENAME="$(basename "$ARCHIVE" .tar.gz)"
DESTINATION="${RESTORE_ROOT}/${SNAPSHOT_BASENAME}"

# ---------------------------------------------------------
# Safe extraction mode.
# ---------------------------------------------------------

if [[ "$APPLY" != true ]]; then
  mkdir -p "$DESTINATION"

  tar -xzf "$ARCHIVE" \
    -C "$DESTINATION"

  log "Snapshot extracted safely to:"
  printf '%s\n' "$DESTINATION"

  log "The active ClayKeeper project was not changed."
  exit 0
fi

# ---------------------------------------------------------
# Validate the current active installation.
# ---------------------------------------------------------

[[ -d "$PROJECT_ROOT/.git" ]] || \
  fail "Active project is not a Git repository: $PROJECT_ROOT"

[[ -f "$PROJECT_ROOT/frontend/package.json" ]] || \
  fail "Active ClayKeeper frontend was not found."

if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]]; then
  git -C "$PROJECT_ROOT" status --short

  fail \
    "The active repository has local changes. Commit or remove them before restoring."
fi

mkdir -p "$BACKUP_ROOT"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

CURRENT_BACKUP="${BACKUP_ROOT}/ClayKeeper_before_restore_${TIMESTAMP}.tar.gz"

ENV_BACKUP_DIR="${BACKUP_ROOT}/.restore-env-${TIMESTAMP}"

WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

# ---------------------------------------------------------
# Create a safety backup.
#
# Environment files are intentionally excluded from the
# portable backup and preserved separately below.
# ---------------------------------------------------------

log "Creating safety backup:"
printf '  %s\n' "$CURRENT_BACKUP"

tar \
  --exclude='CLAYKEEPER/.git' \
  --exclude='CLAYKEEPER/frontend/node_modules' \
  --exclude='CLAYKEEPER/frontend/dist' \
  --exclude='CLAYKEEPER/frontend/.env' \
  --exclude='CLAYKEEPER/frontend/.env.*' \
  --exclude='.git' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='frontend/.env' \
  --exclude='frontend/.env.*' \
  -czf "$CURRENT_BACKUP" \
  -C "$(dirname "$PROJECT_ROOT")" \
  "$(basename "$PROJECT_ROOT")"

# ---------------------------------------------------------
# Preserve live frontend environment files.
# ---------------------------------------------------------

mkdir -p "$ENV_BACKUP_DIR"
chmod 700 "$ENV_BACKUP_DIR"

ENV_FILES_FOUND=0

while IFS= read -r -d '' ENV_FILE; do
  ENV_FILES_FOUND=1

  cp -p "$ENV_FILE" \
    "$ENV_BACKUP_DIR/$(basename "$ENV_FILE")"

  chmod 600 \
    "$ENV_BACKUP_DIR/$(basename "$ENV_FILE")"
done < <(
  find "$PROJECT_ROOT/frontend" \
    -maxdepth 1 \
    -type f \
    -name '.env*' \
    -print0
)

if [[ "$ENV_FILES_FOUND" -eq 1 ]]; then
  log "Live frontend environment files preserved temporarily."
else
  log "No frontend environment files were found to preserve."
fi

# ---------------------------------------------------------
# Extract the requested snapshot to a temporary location.
# ---------------------------------------------------------

mkdir -p "$WORK_DIR/extracted"

tar -xzf "$ARCHIVE" \
  -C "$WORK_DIR/extracted"

RESTORED_PROJECT="$(
  find "$WORK_DIR/extracted" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    | head -n 1
)"

[[ -n "$RESTORED_PROJECT" ]] || \
  fail "The archive did not contain a project directory."

[[ -f "$RESTORED_PROJECT/frontend/package.json" ]] || \
  fail "The archive does not appear to contain ClayKeeper."

# ---------------------------------------------------------
# Preserve Git metadata separately.
# ---------------------------------------------------------

log "Preserving Git repository metadata..."

cp -a \
  "$PROJECT_ROOT/.git" \
  "$WORK_DIR/.git"

# ---------------------------------------------------------
# Require explicit destructive confirmation.
# ---------------------------------------------------------

printf '\n'
printf 'This will replace:\n'
printf '  %s\n' "$PROJECT_ROOT"
printf '\n'
printf 'With snapshot:\n'
printf '  %s\n' "$ARCHIVE"
printf '\n'
printf 'The existing frontend environment files will be preserved.\n'
printf '\n'

read -r -p "Type RESTORE to continue: " CONFIRM

[[ "$CONFIRM" == "RESTORE" ]] || \
  fail "Restore cancelled."

# ---------------------------------------------------------
# Replace active project.
# ---------------------------------------------------------

log "Replacing the active ClayKeeper project..."

rm -rf "$PROJECT_ROOT"

mkdir -p "$PROJECT_ROOT"

cp -a \
  "$RESTORED_PROJECT/." \
  "$PROJECT_ROOT/"

# ---------------------------------------------------------
# Restore Git metadata.
# ---------------------------------------------------------

rm -rf "$PROJECT_ROOT/.git"

cp -a \
  "$WORK_DIR/.git" \
  "$PROJECT_ROOT/.git"

# ---------------------------------------------------------
# Restore live environment files.
# ---------------------------------------------------------

mkdir -p "$PROJECT_ROOT/frontend"

if [[ -d "$ENV_BACKUP_DIR" ]]; then
  while IFS= read -r -d '' ENV_FILE; do
    cp -p \
      "$ENV_FILE" \
      "$PROJECT_ROOT/frontend/$(basename "$ENV_FILE")"

    chmod 600 \
      "$PROJECT_ROOT/frontend/$(basename "$ENV_FILE")"
  done < <(
    find "$ENV_BACKUP_DIR" \
      -maxdepth 1 \
      -type f \
      -name '.env*' \
      -print0
  )
fi

# ---------------------------------------------------------
# Verify environment preservation before deleting the
# temporary protected copy.
# ---------------------------------------------------------

if [[ "$ENV_FILES_FOUND" -eq 1 ]]; then
  [[ -f "$PROJECT_ROOT/frontend/.env" ]] || {
    printf '\n'
    printf '[restore] WARNING: frontend/.env was not restored.\n'
    printf '[restore] Protected copy remains here:\n'
    printf '  %s\n' "$ENV_BACKUP_DIR"
    exit 1
  }

  log "Live frontend environment configuration restored."
fi

rm -rf "$ENV_BACKUP_DIR"

# ---------------------------------------------------------
# Final verification.
# ---------------------------------------------------------

[[ -d "$PROJECT_ROOT/.git" ]] || \
  fail "Git metadata was not restored."

[[ -f "$PROJECT_ROOT/frontend/package.json" ]] || \
  fail "Frontend package.json is missing after restore."

log "Restore applied successfully."

printf '\n'
printf 'Recommended verification commands:\n'
printf '\n'
printf '  cd %q\n' "$PROJECT_ROOT"
printf '  git status\n'
printf '  test -f frontend/.env && echo "Environment OK"\n'
printf '  cd frontend\n'
printf '  npm ci\n'
printf '  npm run build\n'
printf '\n'
