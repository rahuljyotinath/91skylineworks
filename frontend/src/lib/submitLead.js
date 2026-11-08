const LEADS_URL = '/api/leads';
const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;

function validateFiles(files) {
  if (files.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} files allowed`);
  }
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      throw new Error(`${file.name} exceeds 25 MB limit`);
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error(`${file.name} must be an image or video`);
    }
  }
}

export async function submitLead({
  name,
  phone,
  email,
  locality,
  source,
  metadata,
  files = [],
  turnstileToken = '',
}) {
  validateFiles(files);

  let response;

  if (files.length > 0) {
    const formData = new FormData();
    formData.append('name', name);
    if (phone) formData.append('phone', phone);
    if (email) formData.append('email', email);
    if (locality) formData.append('locality', locality);
    formData.append('source', source);
    if (metadata) formData.append('metadata', JSON.stringify(metadata));
    if (turnstileToken) formData.append('cf-turnstile-response', turnstileToken);
    files.forEach((file) => formData.append('attachments', file));

    response = await fetch(LEADS_URL, {
      method: 'POST',
      body: formData,
    });
  } else {
    response = await fetch(LEADS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email,
        locality,
        source,
        metadata,
        ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
      }),
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Submission failed');
  }

  return data;
}

export function successMessage(data, firstName) {
  if (data.emailSent === false) {
    return `Thanks, ${firstName} — we saved your message. If you don't hear back within a day, please call us.`;
  }
  return `Thanks, ${firstName} — we'll get back to you soon.`;
}
