#!/usr/bin/env node
/**
 * Attach skylineworks Worker routes on skylineconstructions.in (301 lives in worker/src/index.ts).
 * Needs API token: Account Workers Scripts Edit + Zone Workers Routes Edit on skylineconstructions.in.
 * Usage: source deploy/.cloudflare.env && node deploy/skyline-in-attach-routes.mjs
 */
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN_SKYLINEIN;
const ZONE_ID = process.env.CF_ZONE_ID_SKYLINEIN || 'e34566879e328e16bb770510fe2affdf';
const SCRIPT = 'skylineworks';

const PATTERNS = ['skylineconstructions.in/*', 'www.skylineconstructions.in/*'];

async function api(path, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const json = await res.json();
  return json;
}

async function main() {
  if (!TOKEN) {
    console.error('Set CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_TOKEN_SKYLINEIN) with .in zone Workers Routes Edit.');
    process.exit(1);
  }

  const list = await api(`/zones/${ZONE_ID}/workers/routes`);
  if (!list.success) {
    console.error('List routes failed:', list.errors);
    console.error('Dashboard: Workers & Pages → skylineworks → Settings → Triggers → Add route');
    console.error(`  Zone: skylineconstructions.in — patterns: ${PATTERNS.join(', ')}`);
    process.exit(1);
  }

  const existing = new Set((list.result ?? []).map((r) => r.pattern));
  for (const pattern of PATTERNS) {
    if (existing.has(pattern)) {
      console.log('OK exists:', pattern);
      continue;
    }
    const created = await api(`/zones/${ZONE_ID}/workers/routes`, {
      method: 'POST',
      body: JSON.stringify({ pattern, script: SCRIPT }),
    });
    if (created.success) {
      console.log('Created:', pattern);
    } else {
      console.error('Failed:', pattern, created.errors);
      process.exit(1);
    }
  }
  console.log('Done. Verify: npm run cf:verify-skyline-in');
}

main();
