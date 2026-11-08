#!/usr/bin/env node
/**
 * Remove MilesWeb origin A records (apex + ftp/mail/smtp if desired) so Worker custom domain can serve.
 * Reads deploy/.cloudflare.env: CLOUDFLARE_API_TOKEN, CF_ZONE_ID (or auto-fetch zone).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, 'deploy/.cloudflare.env');
const ORIGIN_IP = '103.191.209.63';

function loadEnv() {
  if (!existsSync(envPath)) throw new Error('Missing deploy/.cloudflare.env');
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function api(token, path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(JSON.stringify(data.errors || data));
  }
  return data;
}

async function resolveZoneId(token, env) {
  if (env.CF_ZONE_ID) return env.CF_ZONE_ID;
  const data = await api(token, '/zones?name=91skylineworks.com');
  const id = data.result?.[0]?.id;
  if (!id) throw new Error('Zone 91skylineworks.com not found for this token');
  return id;
}

const env = loadEnv();
const token = env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error('Set CLOUDFLARE_API_TOKEN in deploy/.cloudflare.env');
  process.exit(1);
}

const zoneId = await resolveZoneId(token, env);
const listed = await api(token, `/zones/${zoneId}/dns_records?per_page=100`);
const toDelete = listed.result.filter(
  (r) => r.type === 'A' && r.content === ORIGIN_IP && (r.name === '91skylineworks.com' || r.name === '91skylineworks.com.'),
);

if (toDelete.length === 0) {
  console.log('[dns] no MilesWeb apex A records found (may already be on Worker)');
  process.exit(0);
}

for (const rec of toDelete) {
  console.log(`[dns] delete ${rec.type} ${rec.name} → ${rec.content}`);
  await api(token, `/zones/${zoneId}/dns_records/${rec.id}`, { method: 'DELETE' });
}

console.log('[dns] origin A removed. Allow 1–2 min, then check https://91skylineworks.com (no LiteSpeed header).');
