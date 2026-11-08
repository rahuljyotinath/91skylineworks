#!/usr/bin/env bash
# Prints resend_api_key line to add to server api/config.php (from deploy/.cloudflare.env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.cloudflare.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy/.cloudflare.env — run deploy/cloudflare-setup-wizard.sh first."
  exit 1
fi

# shellcheck disable=SC1091
source "$ENV_FILE"

if [[ -z "${RESEND_API_KEY:-}" ]]; then
  echo "RESEND_API_KEY empty in deploy/.cloudflare.env"
  exit 1
fi

echo "Add this line to public_html/api/config.php on MilesWeb (keep secrets out of git):"
echo ""
echo "    'resend_api_key' => '${RESEND_API_KEY}',"
echo ""
echo "Resend is tried before SMTP. Re-upload only api/config.php via npm run upload after editing locally."
