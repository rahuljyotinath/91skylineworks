# 91SkylineWorks Digital Terminal

React + Vite frontend with API backend. Seismic diagnostics terminal UI with mobile WebRTC camera upload.

## Structure

```
frontend/     Vite + React SPA (build locally)
backend/      Express API + MariaDB (local dev only)
deploy/       PHP API + release pack script (MilesWeb production)
docker-compose.yml   Local MariaDB
release/      Generated upload folder (gitignored)
```

---

## Cloudflare (target production)

MilesWeb PHP hosting is being replaced by **Workers + D1 + R2** + **Email Routing** + **Resend**.

1. Dashboard: `bash deploy/cloudflare-setup-wizard.sh`
2. Checklist: [deploy/CLOUDFLARE-CUTOVER.md](deploy/CLOUDFLARE-CUTOVER.md)
3. Deploy: `npm run cf:cutover`
4. Verify: `npm run cf:verify`

**Form mail while still on MilesWeb:** add `resend_api_key` to server `api/config.php` (see `npm run cf:resend-php` after wizard saves Resend key).

---

## MilesWeb Shared Hosting (Production)

Build on your Mac, upload static files + PHP to `public_html/`. No Node.js on server.

### 1. Build release package (Mac)

```bash
npm run release
```

This creates `release/` containing:
- `index.html`, `assets/` — built React app
- `api/*.php` — PHP API endpoints
- `.htaccess` — rewrites `/api/*` to PHP + SPA fallback for page routes
- `uploads/` — camera image storage (writable)

`deploy/seed.sql` is generated locally for phpMyAdmin import — **not** included in `release/` (do not upload to `public_html`).

### 2. Upload to MilesWeb (incremental FTP)

One-time: copy FTP credentials into `deploy/.deploy.env`:

```bash
cp deploy/.deploy.env.example deploy/.deploy.env
# edit deploy/.deploy.env — FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE
```

After each release, a changed-files list is written to `deploy/files-to-upload.txt`. Upload **only those files**:

```bash
npm run release                 # builds release/ + writes files-to-upload.txt
cat deploy/files-to-upload.txt  # inspect what will upload
npm run upload                  # upload listed files only
npm run upload -- --dry-run     # preview without FTP
npm run upload -- --full        # emergency: upload entire release/
```

Or: `./upload-ftp.sh` (same as `npm run upload`).

Typical deploy: a few JS/CSS files + `index.html` — not the full release folder.

### 3. cPanel setup (one-time)

1. **MySQL Database** → create database + user; note hostname (usually `localhost`), name, user, password
2. **phpMyAdmin** → Import `deploy/seed.sql` (from your Mac, after `npm run release`)
3. **Upload** — use `npm run upload` after `npm run release`, or upload `release/` via File Manager (first time only)
4. On server: copy `api/config.example.php` → `api/config.php` and fill in cPanel + SMTP credentials:

```php
return [
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_skylineworks',
    'db_user' => 'cpaneluser_skyline',
    'db_pass' => 'your_db_password',
    'uploads_dir' => dirname(__DIR__) . '/uploads',
    'max_upload_bytes' => 12 * 1024 * 1024,
    'mail_to' => 'contact@91skylineworks.com',
    'mail_from' => 'website@91skylineworks.com',
    'mail_from_name' => '91SkylineWorks Website',
    'smtp_host' => 'mail.91skylineworks.com',
    'smtp_port' => 587,
    'smtp_user' => 'website@91skylineworks.com',
    'smtp_pass' => 'your_smtp_password',
];
```

Contact form submissions are saved to the `leads` table **and** emailed to `mail_to` via SMTP.

5. Set `uploads/` folder permissions to **755** or **775**
6. Enable **SSL** (Let's Encrypt) — required for mobile camera

### 4. Verify

- `https://yourdomain.com/` — terminal UI loads
- `https://yourdomain.com/api/content` — returns JSON
- Mobile camera scan over HTTPS — image saved to `uploads/`, row in `diagnostic_submissions`
- Form submit — row in `leads` table

### Updating site copy

Edit `site_content.payload` JSON in phpMyAdmin, or re-run `npm run release` and re-import `deploy/seed.sql`.

### Subfolder deploy

If not at domain root, set `base: '/yourfolder/'` in `frontend/vite.config.js` before `npm run release`.

---

## Local Development

### Database (optional)

```bash
docker compose up -d
```

MariaDB: `127.0.0.1:3306`, db `skylineworks`, user `skyline` / `skylinepass`

### API server (Node)

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` — proxies `/api` to Node backend.

---

## Site routes (multi-page SPA)

| Path | Page |
|------|------|
| `/` | Home — marketing landing with section previews |
| `/capabilities` | Full services grid |
| `/portfolio` | Project showcase |
| `/process` | Four-step process |
| `/about` | Team / about |
| `/clients` | Institution clients |
| `/backing` | Incubation & support |
| `/telemetry` | Regional tectonic telemetry (full content) |
| `/earthquakes` | Live USGS earthquake feed — NE India map + event details |
| `/education` | Forensic engineering + buyer advisory |
| `/analyzer` | Structural camera scan |
| `/assessment` | Self-diagnostic quiz |
| `/contact` | Contact form |

Client-side routing via `react-router-dom`. MilesWeb `.htaccess` includes SPA fallback so direct URLs (e.g. `/analyzer`) work.

---

## API routes

| Method | Path | Local dev | Production |
|--------|------|-----------|------------|
| GET | `/api/content` | Node | PHP |
| POST | `/api/diagnose` | Node | PHP |
| POST | `/api/leads` | Node | PHP |

---

## Mobile camera

- Requires **HTTPS** in production
- Rear camera via `facingMode: environment`
- Images stored in `uploads/` (PHP) or `backend/uploads/` (Node dev)

---

## Legacy static site

Root `index.html` and `content.json` are superseded. Production uses React build + PHP API.
