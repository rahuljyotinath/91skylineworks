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

**Worker secrets** (required for production forms; not stored in GitHub):

```bash
cd worker && npx wrangler secret put RESEND_API_KEY
cd worker && npx wrangler secret put TURNSTILE_SECRET_KEY
```

Resend key lives in `deploy/.cloudflare.env` locally — pipe into wrangler after cutover, or run `npm run cf:cutover` (see `deploy/cloudflare-cutover.sh`).

Deploy on push to `main` / `master` when frontend, worker, or seed changes.  
Manual run: Actions → Deploy Cloudflare Worker → optionally **sync R2 content**.

Local equivalent: `bash deploy/cloudflare-ci-build.sh`

### Troubleshooting CI

GitHub → **Actions** → **Deploy Cloudflare Worker** → failed run → **Build and deploy** log.

| Symptom / log | Cause | Fix |
|---------------|-------|-----|
| `set a CLOUDFLARE_API_TOKEN environment variable` | Repo secrets missing or empty | Settings → Secrets → set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (see table above) |
| `Hostname 'www.…' already has externally managed DNS records` (**code 100117**) | `www` has A/CNAME in DNS while `worker/wrangler.toml` adds Worker **custom_domain** for the same host | DNS → remove conflicting `www` record; let Worker custom domain own `www` (apex unchanged). Do **not** remove `www` from `wrangler.toml` without a redirect plan |
| Run ends `cancelled`, not `failure` | `concurrency: cancel-in-progress` — newer push on `main` aborted this deploy | Check the **newer** run; usually the latest push is the one that matters |
| Build succeeds, `wrangler deploy` fails on R2/D1 | API token missing **D1 Edit** or **R2** permissions | Recreate token with Workers Scripts Edit + D1 Edit + R2; update GitHub secret |

**DNS rule:** each `[[routes]]` with `custom_domain = true` in `wrangler.toml` must not compete with manual A/CNAME on that hostname. This repo’s CI token typically has **no Zone DNS Edit** — DNS fixes are manual in the dashboard.

**Verify green:** latest run log ends with `[ci] done`; spot-check `https://91skylineworks.com/` and `https://www.91skylineworks.com/`.

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

## Contact forms → Gmail

Flow: browser → Worker `/api/leads` → **D1** `leads` row → **Resend** → `contact@91skylineworks.com` → **Cloudflare Email Routing** → your Gmail.

| Check | Where |
|-------|--------|
| `RESEND_API_KEY` bound | `cd worker && npx wrangler secret list` — must include `RESEND_API_KEY` |
| Send domain | Resend → domain `91skylineworks.com` verified; From `website@91skylineworks.com` (`wrangler.toml` `MAIL_FROM`) |
| Inbox | Email Routing: `contact@` → destination Gmail (`MAIL_TO` in `wrangler.toml`) |
| Did mail send? | DevTools → form POST response JSON: `"emailSent": true` |

If the form succeeds but `emailSent` is **false**, the lead is still in D1 — fix Resend secret or domain, then resubmit.

Test Resend (local, from `deploy/.cloudflare.env`):

```bash
curl -sS -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"91SkylineWorks Website <website@91skylineworks.com>","to":["contact@91skylineworks.com"],"subject":"Resend test","text":"ping"}'
```

Check Gmail (and Spam). Resend dashboard → **Emails** if the key can list logs.

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
