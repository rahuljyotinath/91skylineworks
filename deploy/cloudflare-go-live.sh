#!/usr/bin/env bash
# Deploy Worker + remove MilesWeb origin A record. Requires deploy/.cloudflare.env with CLOUDFLARE_API_TOKEN.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -q '^CLOUDFLARE_API_TOKEN=.' deploy/.cloudflare.env 2>/dev/null; then
  echo "Add CLOUDFLARE_API_TOKEN to deploy/.cloudflare.env first."
  echo "Dashboard → My Profile → API Tokens → Edit Cloudflare Workers + D1 Edit + R2 Edit"
  exit 1
fi

bash deploy/cloudflare-cutover.sh

echo ""
echo "[go-live] Waiting 15s for custom domains..."
sleep 15

node deploy/cloudflare-dns-remove-origin.mjs

echo ""
npm run cf:verify
echo ""
echo "Test: curl -sI https://91skylineworks.com/ | rg -i 'server|litespeed|cf-ray'"
echo "Expect: server: cloudflare, NO x-turbo-charged-by: LiteSpeed"
