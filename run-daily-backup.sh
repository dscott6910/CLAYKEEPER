#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

cd "$PROJECT_ROOT"
./backup-production.sh --yes
./sync-production-backups.sh
