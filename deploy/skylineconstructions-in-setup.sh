#!/usr/bin/env bash
# skylineconstructions.in — DNS cleanup, Worker attach, Email Routing (dashboard).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.cloudflare.env"
ZONE_NAME="skylineconstructions.in"
TARGET="https://91skylineworks.com"
DEST_EMAIL="rahuljyotinath@gmail.com"

say() { printf '\n%s\n' "$*"; }
step() { printf '  → %s\n' "$*"; }

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

say "skylineconstructions.in — redirect to $TARGET + Email Routing"
say "Zone must be Active on Cloudflare (nameservers at registrar)."

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  ZONE_JSON=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" || true)
  ZONE_ID=$(printf '%s' "$ZONE_JSON" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(j.result?.[0]?.id||"")')
  STATUS=$(printf '%s' "$ZONE_JSON" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(j.result?.[0]?.status||"")')
  if [[ -n "$ZONE_ID" ]]; then
    say "API: zone $ZONE_NAME id=$ZONE_ID status=$STATUS"
  fi
fi

say "━━━ 1. DNS (dashboard) — stop proxying to old host ━━━"
step "Cloudflare → $ZONE_NAME → DNS"
step "Delete A/CNAME records pointing to MilesWeb / herosite / LiteSpeed (any record showing origin IP)."
step "Leave Email Routing MX/TXT that Cloudflare adds for routing (do not delete those)."
step "After Worker deploy below, custom domains may add apex/www records automatically."
step "If www CNAME to apex causes Worker error 100117, delete www CNAME (same fix as 91skylineworks.com)."

say "━━━ 2. Deploy Worker (301 on .in hostnames) ━━━"
step "From repo: bash deploy/cloudflare-ci-build.sh"
step "Or push to main — GitHub Actions deploys Worker with custom domains:"
step "  skylineconstructions.in, www.skylineconstructions.in → 301 → $TARGET (path preserved)"
step "Worker logic: worker/src/index.ts LEGACY_REDIRECT_HOSTS"

say "━━━ 3. Verify redirect ━━━"
step 'curl -sI "https://skylineconstructions.in/contact" | grep -i "^HTTP\\|^location"'
step "Expect: HTTP/2 301 and Location: $TARGET/contact"

say "━━━ 4. Email Routing (dashboard only) ━━━"
step "Email → Email Routing → select $ZONE_NAME (not .com)"
step "Enable / onboard — allow Cloudflare MX + SPF + DKIM; remove conflicting old MX"
step "Destination addresses → add $DEST_EMAIL → verify inbox link"
step "Custom addresses → Send to email:"
step "  contact@$ZONE_NAME → $DEST_EMAIL"
step "  website@$ZONE_NAME → $DEST_EMAIL"
step "  rahul@$ZONE_NAME → $DEST_EMAIL"

say "━━━ 5. Test inbound mail ━━━"
step "From another mailbox (not Gmail), send to contact@$ZONE_NAME"
step "Confirm delivery to $DEST_EMAIL (check Spam once)"

say "━━━ API token note ━━━"
step "GitHub/deploy token is scoped to 91skylineworks.com zone."
step "To automate .in DNS via API, create token with Zone DNS Edit for $ZONE_NAME"
step "Optional: add CF_ZONE_ID_SKYLINEIN to deploy/.cloudflare.env"

say "Done (manual steps 1 + 4 required in dashboard)."
