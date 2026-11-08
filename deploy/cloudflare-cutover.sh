#!/usr/bin/env bash
# One-time Cloudflare resources + deploy (after dashboard wizard + .cloudflare.env filled).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f deploy/.cloudflare.env ]]; then
  echo "Run: bash deploy/cloudflare-setup-wizard.sh"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source deploy/.cloudflare.env
set +a

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN
fi
if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID
fi

echo "[cf] building frontend..."
cd frontend && npm run build && cd "$ROOT"

echo "[cf] worker dependencies..."
cd worker && npm install && cd "$ROOT"

if grep -q 'REPLACE_WITH_D1_ID' worker/wrangler.toml; then
  echo "[cf] creating D1 database (first time)..."
  create_out=$(cd worker && npx wrangler d1 create skylineworks 2>&1) || true
  echo "$create_out"
  db_id=$(echo "$create_out" | sed -n 's/.*database_id = "\([^"]*\)".*/\1/p' | head -1)
  if [[ -z "$db_id" ]]; then
  db_id=$(echo "$create_out" | rg -o '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  fi
  if [[ -n "$db_id" ]]; then
    sed -i.bak "s/REPLACE_WITH_D1_ID/$db_id/" worker/wrangler.toml && rm -f worker/wrangler.toml.bak
    echo "[cf] wrangler.toml updated with D1 id $db_id"
  else
    echo "[cf] Could not parse D1 id — paste from wrangler d1 create into worker/wrangler.toml"
    exit 1
  fi
fi

echo "[cf] ensuring R2 bucket exists..."
(cd worker && npx wrangler r2 bucket create skylineworks-uploads 2>/dev/null) || true

echo "[cf] D1 schema + seed..."
if npx wrangler whoami >/dev/null 2>&1; then
  node deploy/cloudflare-import-d1.mjs --remote
else
  echo "[cf] WARN: wrangler not logged in — skip D1 remote import; run: npm run cf:seed"
fi

if [[ -n "${RESEND_API_KEY:-}" ]]; then
  printf '%s' "$RESEND_API_KEY" | (cd worker && npx wrangler secret put RESEND_API_KEY)
else
  echo "[cf] WARN: RESEND_API_KEY not in .cloudflare.env — run: (cd worker && wrangler secret put RESEND_API_KEY)"
fi

echo "[cf] deploy worker + assets..."
cd worker && npx wrangler deploy

echo ""
echo "[cf] After deploy: Cloudflare DNS → change apex A record:"
echo "  Remove 103.191.209.63 A (MilesWeb) OR set to grey once Worker custom domain is Active."
echo "  Worker custom domains: Workers → skylineworks → Settings → Domains"
echo ""
echo "Verify: node deploy/cloudflare-verify.mjs"
