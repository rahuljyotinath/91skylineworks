#!/usr/bin/env node
/**
 * Create or update www CNAME (proxied) via Cloudflare API.
 * Requires deploy/.cloudflare.env: CLOUDFLARE_API_TOKEN, CF_ZONE_ID
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, 'deploy/.cloudflare.env');

if (!existsSync(envPath)) {
  console.error('Missing deploy/.cloudflare.env — run cloudflare-setup-wizard.sh or copy .cloudflare.env.example');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const token = env.CLOUDFLARE_API_TOKEN;
const zoneId = env.CF_ZONE_ID;
if (!token || !zoneId) {
  console.error('Need CLOUDFLARE_API_TOKEN and CF_ZONE_ID in deploy/.cloudflare.env');
  console.error('Zone ID: Cloudflare → 91skylineworks.com → Overview → right column');
  process.exit(1);
}

const body = {
  type: 'CNAME',
  name: 'www',
  content: '91skylineworks.com',
  proxied: true,
  ttl: 1,
};

const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=www.91skylineworks.com`, {
  headers: { Authorization: `Bearer ${token}` },
});
const list = await listRes.json();
const existing = list.result?.[0];

const url = existing
  ? `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existing.id}`
  : `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;

const res = await fetch(url, {
  method: existing ? 'PATCH' : 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (!data.success) {
  console.error('API error:', JSON.stringify(data.errors ?? data, null, 2));
  process.exit(1);
}

console.log(existing ? 'Updated' : 'Created', 'www CNAME → 91skylineworks.com (proxied)');
