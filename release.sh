#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/apps/CLAYKEEPER}"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
DEPLOY_SCRIPT="${PROJECT_ROOT}/deploy.sh"
SNAPSHOT_SCRIPT="${PROJECT_ROOT}/snapshot.sh"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-$HOME/CODEX/Snapshots}"

COMMIT_MESSAGE="${*:-}"

log() {
  printf '\n[release] %s\n' "$*"
}

fail() {
  printf '\n[release] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '\n[release] Release stopped near line %s with exit code %s.\n' \
    "${BASH_LINENO[0]:-unknown}" \
    "$exit_code" >&2
  exit "$exit_code"
}

trap on_error ERR

# ---------------------------------------------------------
# Validate required project files.
# ---------------------------------------------------------

[[ -d "$PROJECT_ROOT/.git" ]] || \
  fail "Git repository not found: $PROJECT_ROOT"

[[ -f "$FRONTEND_DIR/package.json" ]] || \
  fail "Frontend package.json was not found."

[[ -f "$DEPLOY_SCRIPT" ]] || \
  fail "deploy.sh was not found."

[[ -x "$DEPLOY_SCRIPT" ]] || \
  fail "deploy.sh is not executable. Run: chmod +x deploy.sh"

[[ -f "$SNAPSHOT_SCRIPT" ]] || \
  fail "snapshot.sh was not found."

[[ -x "$SNAPSHOT_SCRIPT" ]] || \
  fail "snapshot.sh is not executable. Run: chmod +x snapshot.sh"

mkdir -p "$SNAPSHOT_DIR"

cd "$PROJECT_ROOT"

# ---------------------------------------------------------
# Get the release commit message.
# ---------------------------------------------------------

if [[ -z "$COMMIT_MESSAGE" ]]; then
  read -r -p "Release commit message: " COMMIT_MESSAGE
fi

[[ -n "${COMMIT_MESSAGE// }" ]] || \
  fail "A release commit message is required."

# ---------------------------------------------------------
# Inspect the repository before doing anything.
# ---------------------------------------------------------

log "Checking repository status..."

git status --short

if [[ -z "$(git status --porcelain)" ]]; then
  fail "There are no project changes to release."
fi

# Never allow environment secrets into a release.
if git status --porcelain | awk '{print $2}' | grep -E \
  '(^|/)\.env$|(^|/)\.env\.(local|production|development|test|backup)$' \
  >/dev/null; then
  fail "An environment file is present in Git changes. Remove or ignore it first."
fi

# ---------------------------------------------------------
# Build before staging or committing.
# ---------------------------------------------------------

log "Building the ClayKeeper frontend..."

(
  cd "$FRONTEND_DIR"
  npm run build
)

# ---------------------------------------------------------
# Stage and review.
# ---------------------------------------------------------

log "Staging project changes..."

git add -A

if git diff --cached --quiet; then
  fail "Nothing was staged after the build."
fi

printf '\n============================================================\n'
printf ' Staged Release Changes\n'
printf '============================================================\n\n'

git --no-pager diff --cached --stat

printf '\nCommit message:\n  %s\n\n' "$COMMIT_MESSAGE"

read -r -p "Type RELEASE to commit, push, deploy, and snapshot: " CONFIRM

[[ "$CONFIRM" == "RELEASE" ]] || \
  fail "Release cancelled. Your staged files were not changed."

# ---------------------------------------------------------
# Commit and push.
# ---------------------------------------------------------

log "Creating Git commit..."

git commit -m "$COMMIT_MESSAGE"

log "Pushing to GitHub..."

git push

# ---------------------------------------------------------
# Deploy.
# ---------------------------------------------------------

log "Deploying ClayKeeper..."

"$DEPLOY_SCRIPT"

# ---------------------------------------------------------
# Verify the deployment left the repository clean.
# ---------------------------------------------------------

log "Verifying repository state after deployment..."

if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  fail "Deployment completed, but the repository is not clean. Snapshot was not created."
fi

# ---------------------------------------------------------
# Create and identify the snapshot.
# ---------------------------------------------------------

log "Creating release snapshot..."

SNAPSHOT_OUTPUT="$("$SNAPSHOT_SCRIPT")"
printf '%s\n' "$SNAPSHOT_OUTPUT"

SNAPSHOT_PATH="$(
  printf '%s\n' "$SNAPSHOT_OUTPUT" |
    sed -n 's/^\[snapshot\] Destination: //p' |
    head -n 1
)"

if [[ -z "$SNAPSHOT_PATH" || ! -f "$SNAPSHOT_PATH" ]]; then
  SNAPSHOT_PATH="$(
    find "$SNAPSHOT_DIR" \
      -maxdepth 1 \
      -type f \
      -name 'ClayKeeper_*.tar.gz' \
      -printf '%T@ %p\n' 2>/dev/null |
      sort -nr |
      head -n 1 |
      cut -d' ' -f2-
  )"
fi

[[ -n "$SNAPSHOT_PATH" && -f "$SNAPSHOT_PATH" ]] || \
  fail "Release succeeded, but the new snapshot could not be identified."

CHECKSUM_PATH="${SNAPSHOT_PATH}.sha256"

# ---------------------------------------------------------
# Final release summary.
# ---------------------------------------------------------

printf '\n============================================================\n'
printf ' ClayKeeper Release Completed Successfully\n'
printf '============================================================\n\n'

printf 'Commit:\n'
git --no-pager log -1 --oneline

printf '\nSnapshot:\n  %s\n' "$SNAPSHOT_PATH"

if [[ -f "$CHECKSUM_PATH" ]]; then
  printf '\nChecksum:\n  %s\n' "$CHECKSUM_PATH"
fi

printf '\nDownload the snapshot from VS Code:\n'
printf '  CODEX -> Snapshots -> %s\n' "$(basename "$SNAPSHOT_PATH")"

printf '\nSave the downloaded copy on your Mac under:\n'
printf '  /Volumes/Media/CLAYKEEPER FILES/CODEX/Snapshots\n\n'
