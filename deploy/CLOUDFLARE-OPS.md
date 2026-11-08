# Cloudflare ops — analytics, security, CI

## GitHub Actions auto deploy

Workflow: [.github/workflows/deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml)

**Repository secrets** (Settings → Secrets → Actions):

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Workers Scripts Edit, D1, R2, Account read |
| `CLOUDFLARE_ACCOUNT_ID` | `87e27377534cc7db6d5abe025f36ba4b` |
| `VITE_GTM_ID` | Optional — baked into frontend build |
| `VITE_CF_BEACON_TOKEN` | Cloudflare Web Analytics beacon token |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key (public) |

**Worker secret** (not in GitHub unless you add a CI step):

```bash
cd worker && npx wrangler secret put TURNSTILE_SECRET_KEY
```

Deploy on push to `main` / `master` when frontend, worker, or seed changes.  
Manual run: Actions → Deploy Cloudflare Worker → optionally **sync R2 content**.

Local equivalent: `bash deploy/cloudflare-ci-build.sh`

---

## Web Analytics

1. Dashboard → **Analytics & logs** → **Web Analytics** → Add site `91skylineworks.com`.
2. Copy the **beacon token**.
3. Add to GitHub secret `VITE_CF_BEACON_TOKEN` (and optional `frontend/.env` for local dev).
4. Redeploy — script loads via `CfWebAnalytics.jsx`.

No cookie banner needed for CF Web Analytics alone (still run GA4 behind consent).

---

## Worker metrics (Overview)

Dashboard → **Workers & Pages** → **skylineworks** → **Overview**

- Invocations, errors, CPU (24h / 7d)
- **Metrics** tab for deeper charts
- `wrangler.toml` has `[observability] enabled = true` for Workers Logs where plan allows

---

## Security → Events

Dashboard → **Security** → **Events** (or **Analytics** → Security)

- Bot scores, challenged requests, WAF (if enabled)
- Optional free hardening: **Security** → **Settings** → **Bot Fight Mode** (test forms after enabling)

Response headers (CSP, HSTS, etc.) are applied in the Worker — see `worker/src/lib/security.ts`.

---

## Turnstile (forms)

1. Dashboard → **Turnstile** → Add widget → hostname `91skylineworks.com` (+ `www` if needed).
2. **Site key** → `VITE_TURNSTILE_SITE_KEY` (GitHub + frontend `.env`). Production: `0x4AAAAAAF5CPJ9XC44_wh_0`.
3. **Secret key** → `wrangler turnstile widget get <SITEKEY> --json` piped to `wrangler secret put TURNSTILE_SECRET_KEY` (bound on Worker `skylineworks`).
4. Redeploy frontend + worker.

If site key is unset, widgets hidden and API skips verification.

---

## Speed + caching

**In the Worker (already):**

- Long `Cache-Control` on hashed `/assets/*`, images, uploads
- `/api/content` — 5–10 min cache
- `/api/earthquakes` — edge cache in worker code

**Dashboard (optional):**

1. **Caching** → **Cache Rules** (free):
   - Rule: URI Path starts with `/assets/` → Cache eligibility: Eligible, Edge TTL 1 month
   - Rule: URI Path starts with `/api/` → Bypass cache
2. **Speed** → **Optimization** → Auto Minify off (Vite already minifies)
3. **Network** → HTTP/3 — on

---

## SEO

CI runs `deploy/generate-seo.mjs` after each build:

- `robots.txt`, `sitemap.xml`, `llms.txt` in `frontend/dist`
- Per-route HTML + JSON-LD where configured
- Submit sitemap in Google Search Console: `https://91skylineworks.com/sitemap.xml`

After deploy, spot-check: view-source on `/`, `/contact`, validate structured data in Rich Results Test.
