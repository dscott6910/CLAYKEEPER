#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${CLAYKEEPER_REPO_DIR:-$HOME/apps/CLAYKEEPER}"
CONFIG_DIR="$HOME/.config/claykeeper"
CONFIG_FILE="$CONFIG_DIR/notifications.env"
LOG_DIR="$HOME/CODEX/Logs/ClayKeeper"
CRON_TAG="# ClayKeeper registration notifications"
SCHEDULE="${CLAYKEEPER_NOTIFICATION_SCHEDULE:-*/2 * * * *}"
DEFAULT_SUPABASE_URL="https://yoniacqfvueyvikisctn.supabase.co"
DEFAULT_FROM="ClayKeeper <notifications@claykeeper.live>"

if [[ ! -d "$REPO_DIR/frontend" ]]; then
  echo "ClayKeeper was not found at $REPO_DIR."
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "The server does not have cron available, so notification delivery cannot be scheduled." >&2
  exit 1
fi

echo "========================================"
echo " ClayKeeper Registration Email Setup"
echo "========================================"
echo
echo "This is a one-time server setup. Recipient choices will then be"
echo "managed inside ClayKeeper under Settings."
echo

read -rsp "Supabase backend Secret key (or legacy service-role key): " SUPABASE_SERVICE_ROLE_KEY
echo

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "A Supabase backend Secret key is required. No changes were made."
  exit 1
fi

read -rsp "Resend API key: " RESEND_API_KEY
echo

if [[ "$RESEND_API_KEY" != re_* ]]; then
  echo "That does not look like a Resend API key. No changes were made."
  exit 1
fi

read -rp "Sender address [$DEFAULT_FROM]: " REGISTRATION_EMAIL_FROM
REGISTRATION_EMAIL_FROM="${REGISTRATION_EMAIL_FROM:-$DEFAULT_FROM}"

mkdir -p "$CONFIG_DIR" "$LOG_DIR"
chmod 700 "$CONFIG_DIR" "$LOG_DIR"
umask 077

{
  printf 'SUPABASE_URL=%q\n' "$DEFAULT_SUPABASE_URL"
  printf 'SUPABASE_SERVICE_ROLE_KEY=%q\n' "$SUPABASE_SERVICE_ROLE_KEY"
  printf 'RESEND_API_KEY=%q\n' "$RESEND_API_KEY"
  printf 'REGISTRATION_EMAIL_FROM=%q\n' "$REGISTRATION_EMAIL_FROM"
  printf 'CLAYKEEPER_APP_URL=%q\n' "https://claykeeper.live"
} > "$CONFIG_FILE"

unset SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY
chmod 600 "$CONFIG_FILE"

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
CRON_LINE="$SCHEDULE /usr/bin/env bash \"$REPO_DIR/run-registration-notifications.sh\" >> \"$LOG_DIR/registration-notifications.log\" 2>&1 $CRON_TAG"

{
  printf '%s\n' "$CURRENT_CRONTAB" | grep -Fv "$CRON_TAG" || true
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo
echo "Checking the connection without sending email..."
"$REPO_DIR/run-registration-notifications.sh" --dry-run

echo
echo "Registration email delivery is configured."
echo "ClayKeeper will check for new registrations every two minutes."
echo "Recipients can now be selected under Settings in ClayKeeper."
