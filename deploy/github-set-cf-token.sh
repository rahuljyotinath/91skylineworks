#!/usr/bin/env bash
# One-time: store Cloudflare API token in GitHub Actions after creating it in the dashboard.
set -euo pipefail
if [[ -z "${1:-}" ]]; then
  echo "Usage: bash deploy/github-set-cf-token.sh <CLOUDFLARE_API_TOKEN>"
  echo "Create token: Profile → API Tokens → Edit Cloudflare Workers template + D1 Edit + R2 Edit"
  exit 1
fi
gh secret set CLOUDFLARE_API_TOKEN --body "$1"
echo "CLOUDFLARE_API_TOKEN set on GitHub. Push to main to trigger deploy."
