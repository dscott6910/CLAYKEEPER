#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/apps/CLAYKEEPER}"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
DEPLOY_SCRIPT="${PROJECT_ROOT}/deploy.sh"
SNAPSHOT_SCRIPT="${PROJECT_ROOT}/snapshot.sh"

MESSAGE="${*:-}"

log() {
  printf '[release] %s\n' "$*"
}

fail() {
  printf '[release] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$PROJECT_ROOT/.git" ]] || fail "Git repository not found: $PROJECT_ROOT"
[[ -f "$FRONTEND_DIR/package.json" ]] || fail "Frontend package.json not found."
[[ -x "$DEPLOY_SCRIPT" ]] || fail "deploy.sh is missing or not executable."
[[ -x "$SNAPSHOT_SCRIPT" ]] || fail "snapshot.sh is missing or not executable."

cd "$PROJECT_ROOT"

if [[ -z "$MESSAGE" ]]; then
  read -r -p "Release commit message: " MESSAGE
fi

[[ -n "${MESSAGE// }" ]] || fail "A commit message is required."

log "Checking repository state..."
git status --short

if [[ -z "$(git status --porcelain)" ]]; then
  fail "There are no local changes to release."
fi

if git status --porcelain | grep -E '(^| )(\.env($|\.)|.*\.env($|\.))' >/dev/null; then
  fail "An environment file appears in Git changes. Remove it before continuing."
fi

log "Building frontend..."
(
  cd "$FRONTEND_DIR"
  npm run build
)

log "Staging tracked and untracked project changes..."
git add -A

if git diff --cached --quiet; then
  fail "Nothing was staged after the build."
fi

printf '\nStaged changes:\n'
git --no-pager diff --cached --stat
printf '\n'

read -r -p "Type RELEASE to commit, push, deploy, and snapshot: " CONFIRM
[[ "$CONFIRM" == "RELEASE" ]] || fail "Release cancelled."

log "Committing..."
git commit -m "$MESSAGE"

log "Pushing..."
git push

log "Deploying..."
"$DEPLOY_SCRIPT"

log "Verifying repository is clean after deployment..."
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  fail "Deployment completed, but the repository is not clean. Snapshot was not created."
fi

log "Creating snapshot..."
"$SNAPSHOT_SCRIPT"

log "Release completed successfully."
git --no-pager log -1 --oneline
