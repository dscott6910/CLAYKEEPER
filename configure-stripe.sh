#!/usr/bin/env bash

set -Eeuo pipefail

REPO_DIR="$HOME/apps/CLAYKEEPER"
PROJECT_REF="yoniacqfvueyvikisctn"
SITE_URL="https://claykeeper.live"
WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "ClayKeeper was not found at $REPO_DIR."
    exit 1
fi

if command -v supabase >/dev/null 2>&1; then
    SUPABASE_CLI=(supabase)
else
    SUPABASE_CLI=(npx --yes supabase)
fi

echo "========================================"
echo " ClayKeeper Stripe Setup"
echo "========================================"
echo
echo "Start with your Stripe TEST secret key (sk_test_...)."
echo "The key will be hidden while you type and will not be saved in Git."
read -rsp "Stripe secret key: " STRIPE_SECRET_KEY
echo

if [[ "$STRIPE_SECRET_KEY" != sk_test_* && "$STRIPE_SECRET_KEY" != sk_live_* ]]; then
    echo "That does not look like a Stripe secret key. No changes were made."
    exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
chmod 700 "$TEMP_DIR"

CURL_CONFIG="$TEMP_DIR/stripe-curl.conf"
ENDPOINTS_RESPONSE="$TEMP_DIR/endpoints.json"
CREATE_RESPONSE="$TEMP_DIR/created-endpoint.json"
SECRETS_FILE="$TEMP_DIR/supabase-secrets.env"

printf 'user = "%s:"\n' "$STRIPE_SECRET_KEY" > "$CURL_CONFIG"
chmod 600 "$CURL_CONFIG"

curl --silent --show-error --fail \
    --config "$CURL_CONFIG" \
    "https://api.stripe.com/v1/webhook_endpoints?limit=100" \
    > "$ENDPOINTS_RESPONSE"

EXISTING_ENDPOINT="$(node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const match = (payload.data || []).find((item) => item.url === process.argv[2]);
process.stdout.write(match?.id || "");
' "$ENDPOINTS_RESPONSE" "$WEBHOOK_URL")"

if [[ -n "$EXISTING_ENDPOINT" ]]; then
    echo
    echo "A Stripe webhook already exists for ClayKeeper: $EXISTING_ENDPOINT"
    echo "Open that endpoint in Stripe and reveal its signing secret (whsec_...)."
    read -rsp "Webhook signing secret: " WEBHOOK_SECRET
    echo

    if [[ "$WEBHOOK_SECRET" != whsec_* ]]; then
        echo "That does not look like a Stripe webhook signing secret. No Supabase secrets were changed."
        exit 1
    fi
else
    curl --silent --show-error --fail \
        --config "$CURL_CONFIG" \
        --request POST "https://api.stripe.com/v1/webhook_endpoints" \
        --data-urlencode "url=$WEBHOOK_URL" \
        --data-urlencode "description=ClayKeeper season registration payments" \
        --data-urlencode "enabled_events[]=checkout.session.completed" \
        --data-urlencode "enabled_events[]=checkout.session.async_payment_succeeded" \
        --data-urlencode "enabled_events[]=checkout.session.async_payment_failed" \
        --data-urlencode "enabled_events[]=checkout.session.expired" \
        --data-urlencode "enabled_events[]=charge.refunded" \
        > "$CREATE_RESPONSE"

    WEBHOOK_SECRET="$(node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!payload.secret) process.exit(1);
process.stdout.write(payload.secret);
' "$CREATE_RESPONSE")"
fi

printf 'STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\nCLAYKEEPER_SITE_URL=%s\n' \
    "$STRIPE_SECRET_KEY" "$WEBHOOK_SECRET" "$SITE_URL" > "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

cd "$REPO_DIR"
"${SUPABASE_CLI[@]}" secrets set \
    --project-ref "$PROJECT_REF" \
    --env-file "$SECRETS_FILE"

unset STRIPE_SECRET_KEY WEBHOOK_SECRET

echo
echo "Stripe is connected to ClayKeeper."
echo "Next: sign in as an administrator, open Settings, confirm the fee, and enable Require Stripe payment."
echo "Use Stripe test card 4242 4242 4242 4242 before switching to a live key."
