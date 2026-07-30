#!/usr/bin/env bash

set -Eeuo pipefail

REPO_DIR="$HOME/apps/CLAYKEEPER"
FRONTEND_DIR="$REPO_DIR/frontend"
WEB_ROOT="/var/www/claykeeper"
BACKUP_DIR="$HOME/deployment-backups"
BRANCH="main"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOCK_FILE="/tmp/claykeeper-deploy.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
    echo "Another ClayKeeper deployment is already running."
    exit 1
fi

echo "========================================"
echo " ClayKeeper Production Deployment"
echo " $TIMESTAMP"
echo "========================================"

cd "$REPO_DIR"

echo
echo "1. Checking Git repository..."
git fetch origin

if [[ -n "$(git status --porcelain)" ]]; then
    echo "Deployment stopped: the repository contains local changes."
    git status --short
    exit 1
fi

echo
echo "2. Pulling the latest version from GitHub..."
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd "$FRONTEND_DIR"

if [[ ! -f ".env" ]]; then
    echo "Deployment stopped: $FRONTEND_DIR/.env is missing."
    echo "The production environment file must exist before building."
    exit 1
fi

echo
echo "3. Installing exact project dependencies..."
npm ci

echo
echo "4. Building ClayKeeper..."
npm run build

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
    echo "Deployment stopped: dist/index.html was not created."
    exit 1
fi

echo
echo "5. Testing Nginx configuration..."
sudo nginx -t

echo
echo "6. Backing up the currently deployed site..."
mkdir -p "$BACKUP_DIR"

if [[ -d "$WEB_ROOT" ]]; then
    sudo tar -czf "$BACKUP_DIR/claykeeper-$TIMESTAMP.tar.gz" \
        -C "$WEB_ROOT" .
fi

echo
echo "7. Publishing the new build..."
sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo
echo "8. Reloading Nginx..."
sudo systemctl reload nginx

echo
echo "9. Verifying the live website..."
HTTP_STATUS="$(curl -sS -o /dev/null -w "%{http_code}" https://claykeeper.live)"

if [[ "$HTTP_STATUS" != "200" ]]; then
    echo "Warning: the website returned HTTP status $HTTP_STATUS."
    echo "The build was deployed, but the website should be checked."
    exit 1
fi

echo
echo "10. Removing deployment backups older than 14 days..."
find "$BACKUP_DIR" -type f -name "claykeeper-*.tar.gz" -mtime +14 -delete

echo
echo "========================================"
echo " Deployment completed successfully"
echo " https://claykeeper.live"
echo " HTTP status: $HTTP_STATUS"
echo "========================================"
