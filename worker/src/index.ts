import { Hono } from 'hono';
import { api, type Env } from './api';
import { applySecurityHeaders, cacheControlForPath } from './lib/security';
import { REDIRECTS } from './lib/util';

export type Bindings = Env & { ASSETS: Fetcher };

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  await next();
  const res = c.res;
  const headers = new Headers(res.headers);
  applySecurityHeaders(headers);
  const cc = cacheControlForPath(new URL(c.req.url).pathname);
  if (cc && !headers.has('Cache-Control')) headers.set('Cache-Control', cc);
  c.res = new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

const PRIMARY_HOST = '91skylineworks.com';

const LEGACY_REDIRECT_HOSTS = new Set(['skylineconstructions.in', 'www.skylineconstructions.in']);

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const host = url.hostname.toLowerCase();

  if (LEGACY_REDIRECT_HOSTS.has(host)) {
    url.protocol = 'https:';
    url.hostname = PRIMARY_HOST;
    return c.redirect(url.toString(), 301);
  }

  if (host === 'www.91skylineworks.com') {
    url.hostname = PRIMARY_HOST;
    return c.redirect(url.toString(), 301);
  }
  await next();
});

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  for (const rule of REDIRECTS) {
    const m = url.pathname.match(rule.from);
    if (m) {
      const target = rule.to.replace('$1', m[1] ?? '');
      url.pathname = target;
      return c.redirect(url.toString(), 301);
    }
  }
  await next();
});

app.get('/uploads/:key{.+}', async (c) => {
  const key = c.req.param('key');
  if (!key || key.includes('..')) return c.text('Not found', 404);
  if (!c.env.UPLOADS) return c.text('Not found', 404);
  const object = await c.env.UPLOADS.get(key);
  if (!object) return c.text('Not found', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');
  return new Response(object.body, { headers });
});

app.route('/api', api);

app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  const pathname = new URL(c.req.url).pathname;
  const cc = cacheControlForPath(pathname);
  if (!cc || c.req.method !== 'GET') return res;
  const headers = new Headers(res.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', cc);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

export default app;
