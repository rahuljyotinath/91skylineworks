#!/usr/bin/env node
/**
 * Build deploy/cloudflare-d1-seed.sql from backend seed JSON and apply via wrangler.
 * Usage: node deploy/cloudflare-import-d1.mjs [--local] [--sql-only]
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlOnly = process.argv.includes('--sql-only');
const local = process.argv.includes('--local');

function escSql(s) {
  return String(s).replace(/'/g, "''");
}

function insertSlug(slug, jsonPath) {
  const payload = readFileSync(jsonPath, 'utf8');
  JSON.parse(payload);
  return `INSERT OR REPLACE INTO site_content (slug, payload, updated_at) VALUES ('${escSql(slug)}', '${escSql(payload)}', datetime('now'));`;
}

const parts = [
  readFileSync(join(root, 'worker/schema/d1.sql'), 'utf8').trim(),
  '',
  insertSlug('main', join(root, 'backend/src/seed/content.json')),
];

const asPath = join(root, 'backend/src/seed/content.as.json');
try {
  readFileSync(asPath, 'utf8');
  parts.push(insertSlug('main-as', asPath));
} catch {
  /* optional */
}

const outPath = join(root, 'deploy/cloudflare-d1-seed.sql');
writeFileSync(outPath, parts.join('\n') + '\n');
console.log('[d1] wrote', outPath);

if (sqlOnly) process.exit(0);

const flag = local ? '--local' : '--remote';
const workerCwd = join(root, 'worker');
execSync(`npx wrangler d1 execute skylineworks ${flag} --file=./schema/d1.sql`, {
  cwd: workerCwd,
  stdio: 'inherit',
});
// Large JSON exceeds D1 single-statement limit — store in R2, Worker reads seed/{slug}.json.
const seedPairs = [
  ['main', join(root, 'backend/src/seed/content.json')],
  ['main-as', asPath],
];
for (const [slug, jsonPath] of seedPairs) {
  try {
    readFileSync(jsonPath, 'utf8');
  } catch {
    continue;
  }
  execSync(
    `npx wrangler r2 object put skylineworks-uploads/seed/${slug}.json --remote --file="${jsonPath}" --content-type=application/json`,
    { cwd: workerCwd, stdio: 'inherit' },
  );
  console.log('[d1] uploaded R2 seed/', slug, '.json');
}

console.log('[d1] import complete');
