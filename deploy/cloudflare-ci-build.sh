#!/usr/bin/env bash
# Build frontend + SEO + deploy Worker (local or GitHub Actions).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[ci] frontend build..."
export VITE_GTM_ID="${VITE_GTM_ID:-}"
export VITE_CF_BEACON_TOKEN="${VITE_CF_BEACON_TOKEN:-}"
export VITE_TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-}"
cd frontend
npm ci
npm run build
cd "$ROOT"

echo "[ci] SEO (sitemap, robots, prerender meta)..."
node deploy/generate-seo.mjs

echo "[ci] worker deploy..."
cd worker
npm ci
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN
fi
if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID
fi
npx wrangler deploy

if [[ "${CF_SYNC_R2_CONTENT:-}" == "1" ]]; then
  echo "[ci] syncing content seed to R2..."
  cd "$ROOT"
  node deploy/cloudflare-import-d1.mjs --remote
fi

echo "[ci] done"
