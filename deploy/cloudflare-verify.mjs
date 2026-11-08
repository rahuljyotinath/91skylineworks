#!/usr/bin/env node
/**
 * Verify cutover checklist (DNS + optional Cloudflare API).
 * Reads deploy/.cloudflare.env for CLOUDFLARE_API_TOKEN and CF_ZONE_ID.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zone = '91skylineworks.com';

function dig(type, name, server = '1.1.1.1') {
  try {
    const out = execSync(`dig ${type} ${name} +short @${server}`, { encoding: 'utf8', timeout: 15000 }).trim();
    return out ? out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

function loadEnv() {
  const p = join(root, 'deploy/.cloudflare.env');
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const checks = [];
const fail = (name, detail) => checks.push({ name, ok: false, detail });
const pass = (name, detail) => checks.push({ name, ok: true, detail });

const ns = dig('NS', zone);
if (ns.some((n) => n.includes('cloudflare.com'))) {
  pass('nameservers', ns.join(', '));
} else {
  fail('nameservers', ns.length ? ns.join(', ') : 'no NS (dig failed or still MilesWeb)');
}

const www = dig('CNAME', `www.${zone}`);
const wwwA = dig('A', `www.${zone}`);
if (www.length || wwwA.length) {
  pass('www DNS', www[0] || wwwA[0]);
} else {
  fail('www DNS', 'add Proxied CNAME www → 91skylineworks.com');
}

const mx = dig('MX', zone);
if (mx.some((r) => r.includes('cloudflare.net') || r.includes('.mx.cloudflare'))) {
  pass('MX (Email Routing)', mx[0]);
} else if (mx.some((r) => r.includes('mail.91skylineworks.com'))) {
  fail('MX (Email Routing)', `still MilesWeb: ${mx[0]} — enable Email Routing when ready`);
} else {
  fail('MX', mx.join(' | ') || 'none');
}

const env = loadEnv();
if (env.CLOUDFLARE_API_TOKEN && env.CF_ZONE_ID) {
  pass('credentials file', 'deploy/.cloudflare.env has token + zone id');
} else if (env.CLOUDFLARE_API_TOKEN) {
  fail('CF_ZONE_ID', 'set CF_ZONE_ID in deploy/.cloudflare.env (zone Overview sidebar)');
} else {
  fail('credentials file', 'run deploy/cloudflare-setup-wizard.sh stages 6–8');
}

if (env.RESEND_API_KEY) pass('Resend', 'RESEND_API_KEY present');
else fail('Resend', 'missing RESEND_API_KEY');

console.log('\nCloudflare cutover verification\n');
for (const c of checks) {
  console.log(`${c.ok ? 'OK' : '!!'}  ${c.name}: ${c.detail}`);
}
const bad = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - bad}/${checks.length} passed\n`);
process.exit(bad ? 1 : 0);
