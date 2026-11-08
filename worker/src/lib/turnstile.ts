type TurnstileResult = {
  success?: boolean;
  'error-codes'?: string[];
  action?: string;
  hostname?: string;
};

export type TurnstileVerifyOptions = {
  expectedAction?: string;
  allowedHostnames?: string[];
};

function parseAllowedHostnames(raw: string | undefined): string[] {
  const fallback = ['91skylineworks.com', 'www.91skylineworks.com', 'localhost', '127.0.0.1'];
  if (!raw?.trim()) return fallback;
  const list = raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : fallback;
}

export function allowedHostnamesFromEnv(envValue: string | undefined): string[] {
  return parseAllowedHostnames(envValue);
}

export const TURNSTILE_ACTION_DIAGNOSE = 'diagnose';

const LEAD_ACTION_BY_SOURCE: Record<string, string> = {
  contact: 'contact',
  inspection: 'inspection',
  quiz: 'quiz',
  escalation: 'escalation',
};

export function expectedTurnstileActionForLeadSource(source: string): string | undefined {
  const key = source.trim().toLowerCase();
  return LEAD_ACTION_BY_SOURCE[key];
}

export async function verifyTurnstile(
  secret: string,
  token: string | null | undefined,
  remoteip: string | null,
  options: TurnstileVerifyOptions = {},
): Promise<boolean> {
  if (!secret) return true;
  const response = token?.trim();
  if (!response) return false;

  const body = new URLSearchParams({
    secret,
    response,
    ...(remoteip ? { remoteip } : {}),
  });

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as TurnstileResult;
  if (!data.success) return false;

  if (options.expectedAction) {
    const action = data.action?.trim();
    if (!action || action !== options.expectedAction) return false;
  }

  const allowed = options.allowedHostnames?.length
    ? options.allowedHostnames
    : undefined;
  if (allowed?.length) {
    const hostname = data.hostname?.trim().toLowerCase();
    if (!hostname || !allowed.includes(hostname)) return false;
  }

  return true;
}
