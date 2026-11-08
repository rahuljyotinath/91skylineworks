type TurnstileResult = { success?: boolean; 'error-codes'?: string[] };

export async function verifyTurnstile(
  secret: string,
  token: string | null | undefined,
  remoteip: string | null,
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
  return Boolean(data.success);
}
