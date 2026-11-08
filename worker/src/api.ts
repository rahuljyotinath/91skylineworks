import type { Context } from 'hono';
import { Hono } from 'hono';
import { fetchEarthquakes } from './lib/earthquakes';
import { sendLeadEmail } from './lib/mail';
import {
  allowedHostnamesFromEnv,
  expectedTurnstileActionForLeadSource,
  TURNSTILE_ACTION_DIAGNOSE,
  verifyTurnstile,
} from './lib/turnstile';
import { analyzeImage, clientIp, json, sanitizeString } from './lib/util';

export type Env = {
  DB: D1Database;
  UPLOADS?: R2Bucket;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAMES?: string;
  MAIL_TO: string;
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
};

const api = new Hono<{ Bindings: Env }>();

async function loadSiteContent(
  c: Context<{ Bindings: Env }>,
  slug: string,
): Promise<Record<string, unknown> | null> {
  try {
    const row = await c.env.DB.prepare('SELECT payload FROM site_content WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<{ payload: string }>();
    if (row?.payload) {
      const payload = JSON.parse(row.payload);
      if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
    }
  } catch {
    /* D1 miss or parse error */
  }
  if (c.env.UPLOADS) {
    try {
      const object = await c.env.UPLOADS.get(`seed/${slug}.json`);
      if (object) {
        const payload = await object.json();
        if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
      }
    } catch {
      /* R2 miss */
    }
  }
  return null;
}

api.get('/content', async (c) => {
  const lang = c.req.query('lang') === 'as' ? 'as' : 'en';
  const slug = lang === 'as' ? 'main-as' : 'main';
  const payload = await loadSiteContent(c, slug);
  if (payload) {
    return json(payload, 200, { 'Cache-Control': 'public, max-age=300, s-maxage=600' });
  }
  return json({ error: 'Content not available' }, 503);
});

api.get('/earthquakes', async (c) => {
  const scope = c.req.query('scope') ?? 'ne';
  if (!['ne', 'global', 'significant'].includes(scope)) {
    return json({ error: 'Invalid scope' }, 400);
  }
  try {
    const payload = await fetchEarthquakes(scope, caches.default);
    return json(payload);
  } catch {
    return json({ error: 'USGS feed unavailable' }, 502);
  }
});

api.post('/diagnose', async (c) => {
  const maxBytes = 12 * 1024 * 1024;
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  let imageKey: string | null = null;

  const contentType = c.req.header('content-type') ?? '';
  const isMultipart = contentType.includes('multipart/form-data');
  let form: FormData | null = null;
  let body: Record<string, unknown> = {};

  if (isMultipart) {
    form = await c.req.formData();
    body = Object.fromEntries(
      [...form.entries()].filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string]),
    );
  } else {
    body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  }

  const diagnoseToken = extractTurnstileToken(isMultipart, form, body);
  const diagnoseOk = await verifyTurnstile(
    c.env.TURNSTILE_SECRET_KEY ?? '',
    diagnoseToken,
    clientIp(c.req.raw),
    {
      expectedAction: TURNSTILE_ACTION_DIAGNOSE,
      allowedHostnames: allowedHostnamesFromEnv(c.env.TURNSTILE_HOSTNAMES),
    },
  );
  if (!diagnoseOk) {
    return json({ error: 'Please complete the security check and try again', isAmbiguous: true }, 403);
  }

  if (isMultipart && form) {
    const file = form.get('image');
    if (file instanceof File && file.size > 0) {
      if (file.size > maxBytes) return json({ error: 'File too large', isAmbiguous: true }, 400);
      if (!allowed.has(file.type)) {
        return json({ error: 'Only image uploads accepted', isAmbiguous: true }, 400);
      }
      const ext =
        file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : file.type === 'image/gif' ? '.gif' : '.jpg';
      const baseKey = `scan-${Date.now()}${ext}`;
      imageKey = baseKey;
      if (!c.env.UPLOADS) {
        return json({ error: 'Upload storage not configured (enable R2)', isAmbiguous: true }, 503);
      }
      await c.env.UPLOADS.put(baseKey, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
    }
  } else {
    if (body.image && typeof body.image === 'string') {
      const base64 = body.image.replace(/^data:image\/\w+;base64,/, '');
      const binary = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      if (binary.length > maxBytes) return json({ error: 'File too large', isAmbiguous: true }, 400);
      imageKey = `scan-${Date.now()}.jpg`;
      if (!c.env.UPLOADS) {
        return json({ error: 'Upload storage not configured (enable R2)', isAmbiguous: true }, 503);
      }
      await c.env.UPLOADS.put(imageKey, binary, { httpMetadata: { contentType: 'image/jpeg' } });
    }
  }

  if (!imageKey) return json({ error: 'No image provided', isAmbiguous: true }, 400);

  const evaluation = analyzeImage();
  const relativePath = `uploads/${imageKey}`;

  try {
    await c.env.DB.prepare(
      `INSERT INTO diagnostic_submissions
       (image_path, severity, issue_type, analysis, is_ambiguous, client_ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        relativePath,
        evaluation.severity,
        evaluation.issueType,
        evaluation.analysis,
        evaluation.isAmbiguous ? 1 : 0,
        clientIp(c.req.raw),
      )
      .run();
  } catch {
    /* still return analysis */
  }

  return json({
    issueType: evaluation.issueType,
    severity: evaluation.severity,
    analysis: evaluation.analysis,
    isAmbiguous: evaluation.isAmbiguous,
  });
});

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const decoded = JSON.parse(raw);
      return typeof decoded === 'object' && decoded !== null ? (decoded as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function saveAttachments(c: Context<{ Bindings: Env }>, form: FormData): Promise<string[]> {
  if (!c.env.UPLOADS) return [];
  const saved: string[] = [];
  const maxFiles = 5;
  const maxBytes = 25 * 1024 * 1024;
  for (const [key, value] of form.entries()) {
    if (key !== 'attachments' || !(value instanceof File)) continue;
    if (saved.length >= maxFiles) break;
    if (value.size > maxBytes) throw new Error('FILE_TOO_LARGE');
    if (!value.type.startsWith('image/') && !value.type.startsWith('video/')) {
      throw new Error('BAD_FILE_TYPE');
    }
    const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    await c.env.UPLOADS.put(objectKey, value.stream(), {
      httpMetadata: { contentType: value.type || 'application/octet-stream' },
    });
    saved.push(`/uploads/${objectKey}`);
  }
  return saved;
}

function extractTurnstileToken(
  isMultipart: boolean,
  form: FormData | null,
  body: Record<string, unknown>,
): string | null {
  if (isMultipart && form) {
    const v = form.get('cf-turnstile-response');
    return typeof v === 'string' ? v : null;
  }
  const direct = body['cf-turnstile-response'] ?? body.cfTurnstileResponse;
  return typeof direct === 'string' ? direct : null;
}

async function handleLeadPost(c: Context<{ Bindings: Env }>) {
  const contentType = c.req.header('content-type') ?? '';
  const isMultipart = contentType.includes('multipart/form-data');

  let body: Record<string, unknown> = {};
  let metadata: Record<string, unknown> | null = null;
  let attachments: string[] = [];
  let form: FormData | null = null;

  if (isMultipart) {
    form = await c.req.formData();
    body = Object.fromEntries(
      [...form.entries()].filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string]),
    );
    metadata = parseMetadata(body.metadata);
    try {
      attachments = await saveAttachments(c, form);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'FILE_TOO_LARGE') return json({ error: 'File exceeds 25 MB limit' }, 400);
      if (msg === 'BAD_FILE_TYPE') return json({ error: 'Only image and video uploads are allowed' }, 400);
    }
  } else {
    body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    metadata = parseMetadata(body.metadata);
  }

  const source = sanitizeString(body.source, 64) || 'contact';
  const expectedAction = expectedTurnstileActionForLeadSource(source);
  const turnstileToken = extractTurnstileToken(isMultipart, form, body);
  const turnstileOk = await verifyTurnstile(
    c.env.TURNSTILE_SECRET_KEY ?? '',
    turnstileToken,
    clientIp(c.req.raw),
    {
      ...(expectedAction ? { expectedAction } : {}),
      allowedHostnames: allowedHostnamesFromEnv(c.env.TURNSTILE_HOSTNAMES),
    },
  );
  if (!turnstileOk) {
    return json({ error: 'Please complete the security check and try again' }, 403);
  }

  const name = sanitizeString(body.name, 255);
  const phone = sanitizeString(body.phone, 64);
  const email = sanitizeString(body.email, 255);
  const locality = sanitizeString(body.locality, 255);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }
  if (!name) return json({ error: 'Name required' }, 400);
  if (!phone && !email) return json({ error: 'Phone or email required' }, 400);

  let message = '';
  if (metadata?.message) message = sanitizeString(metadata.message, 5000);
  else if (body.message) message = sanitizeString(body.message, 5000);

  const metadataPayload: Record<string, unknown> = {
    ...(metadata ?? {}),
    email: email || null,
    message: message || null,
  };
  if (attachments.length) metadataPayload.attachments = attachments;
  const metadataJson = JSON.stringify(metadataPayload);
  const dbPhone = phone || email || 'not-provided';

  try {
    await c.env.DB.prepare(
      'INSERT INTO leads (name, phone, locality, source, metadata) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(name, dbPhone, locality || null, source, metadataJson)
      .run();
  } catch {
    return json({ error: 'Lead submission failed' }, 500);
  }

  let emailSent = false;
  try {
    emailSent = await sendLeadEmail(c.env.RESEND_API_KEY, {
      from: c.env.MAIL_FROM,
      to: c.env.MAIL_TO,
      fromName: c.env.MAIL_FROM_NAME,
      lead: { name, phone, email, locality, source, message, attachments },
    });
  } catch {
    emailSent = false;
  }

  return json({
    ok: true,
    message: 'Thank you — we received your inquiry.',
    emailSent,
  });
}

api.post('/leads', handleLeadPost);
api.post('/leads.php', handleLeadPost);

export { api };
