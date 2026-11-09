#!/usr/bin/env node
/**
 * Verify skylineworks Worker custom domains and .in HTTP redirect.
 * Usage: node deploy/verify-skyline-in.mjs
 */
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function main() {
  if (!ACCOUNT_ID || !TOKEN) {
    console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (e.g. source deploy/.cloudflare.env)');
    process.exit(1);
  }

  const domRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/skylineworks/domains`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const domJson = await domRes.json();
  const hosts = (domJson.result ?? []).map((d) => `${d.hostname} (${d.enabled ? 'Active' : 'off'})`);
  console.log('[worker] skylineworks custom domains:', hosts.length ? hosts.join(', ') : '(none)');

  const need = ['skylineconstructions.in', 'www.skylineconstructions.in'];
  const attached = new Set((domJson.result ?? []).map((d) => d.hostname));
  for (const h of need) {
    console.log(h, attached.has(h) ? 'OK attached' : 'MISSING — fix DNS (error 100117) then wrangler deploy');
  }

  for (const url of ['https://skylineconstructions.in/', 'https://www.skylineconstructions.in/']) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      const loc = res.headers.get('location') ?? '';
      console.log('[http]', url, res.status, loc ? `→ ${loc}` : '');
    } catch (e) {
      console.log('[http]', url, 'error', e.message);
    }
  }
}

main();
