export async function sendLeadEmail(
  apiKey: string,
  opts: { from: string; to: string; fromName: string; lead: Record<string, unknown> },
): Promise<boolean> {
  if (!apiKey) return false;

  const lines = [
    'New inquiry from 91skylineworks.com',
    '',
    `Name: ${opts.lead.name ?? ''}`,
    `Phone: ${opts.lead.phone ?? '—'}`,
    `Email: ${opts.lead.email ?? '—'}`,
    `Service / topic: ${opts.lead.locality ?? '—'}`,
    `Source: ${opts.lead.source ?? 'contact'}`,
    '',
    'Message:',
    String(opts.lead.message ?? '(none)'),
  ];

  const attachments = opts.lead.attachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    lines.push('', 'Attachments:');
    for (const url of attachments) {
      lines.push(`https://91skylineworks.com${url}`);
    }
  }
  lines.push('', `Submitted: ${new Date().toISOString()} UTC`);

  const replyTo = typeof opts.lead.email === 'string' && opts.lead.email.includes('@') ? opts.lead.email : undefined;

  const body: Record<string, unknown> = {
    from: `${opts.fromName} <${opts.from}>`,
    to: [opts.to],
    subject: `New website lead: ${opts.lead.name ?? 'Unknown'}`,
    text: lines.join('\n'),
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
  }
  return res.ok;
}
