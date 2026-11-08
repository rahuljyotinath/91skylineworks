# Cloudflare cutover — 91skylineworks.com

## Phase A — Dashboard (human)

1. DNS imported (apex A proxied → MilesWeb until go-live).
2. Run `bash deploy/cloudflare-setup-wizard.sh` from stages 5–8 if not done (Active zone, Email Routing, API token, Resend).
3. Optional: `npm run cf:www-dns` once `CF_ZONE_ID` + token are in `deploy/.cloudflare.env`.
4. **Form email on MilesWeb today:** `npm run cf:resend-php` → paste `resend_api_key` into server `api/config.php`, upload `deploy/php/mail.php` + `config.example.php` pattern.


## Phase B — Deploy Worker (machine)

```bash
npm run cf:cutover
```

Creates D1/R2 if needed, seeds content, deploys `worker/` + `frontend/dist`.

## Phase C — Switch origin (human, last)

1. Workers & Pages → **skylineworks** → confirm custom domains **91skylineworks.com** and **www** are Active.
2. DNS → delete **A 103.191.209.63** (MilesWeb). Custom domain attachment serves the Worker on apex.
3. Test: `/`, `/api/content`, contact form, `/analyzer` camera upload.
4. Export MariaDB `leads` if needed before cancelling MilesWeb; re-import via D1 console if required.
5. Cancel MilesWeb only after 48h stable.

## Verify anytime

```bash
npm run cf:verify
```

## CI + ops (analytics, Turnstile, caching)

See [CLOUDFLARE-OPS.md](CLOUDFLARE-OPS.md).

## Files

| Path | Role |
|------|------|
| [deploy/.cloudflare.env.example](.cloudflare.env.example) | Credentials template |
| [worker/wrangler.toml](../worker/wrangler.toml) | Worker + D1 + R2 + domains |
| [deploy/cloudflare-import-d1.mjs](cloudflare-import-d1.mjs) | Seed `site_content` into D1 |
