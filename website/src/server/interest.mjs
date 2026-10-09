const MAX_BODY_BYTES = 2048;
const SUCCESS = 'Thanks for your interest. We’ll be in touch with ETHIndia Institutional updates.';
const UNAVAILABLE = 'We couldn’t save your email right now. Please try again in a moment.';

function reply(request, status, message, headers = {}) {
  const common = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers };
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json({ ok: status === 200, message }, { status, headers: common });
  }
  // All messages are fixed server strings, never submitted values or upstream errors.
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex"><title>Show interest | ETHIndia Institutional</title>
    <body style="margin:0;background:#f1eee6;color:#13202f;font:18px/1.6 system-ui">
    <main style="max-width:36rem;margin:12vh auto;padding:24px">
    <h1>${status === 200 ? 'Thank you for your interest' : 'Please try again'}</h1>
    <p>${message}</p><a href="/#interest">Back to ETHIndia Institutional</a></main></body></html>`, {
    status, headers: { ...common, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError('Body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

function validEmail(email) {
  if (email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && local.length <= 64 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    domain.includes('.') && domain.split('.').every((label) =>
      label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}

// Dependency injection keeps tests offline and prevents writes to the live signup list.
export async function handleInterest(request, env, fetcher = fetch) {
  if (request.method !== 'POST') {
    return reply(request, 405, 'Use the Show interest form to submit your email.', { Allow: 'POST' });
  }
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply(request, 403, 'Please submit the form from the ETHIndia Institutional website.');
  }
  const type = request.headers.get('content-type')?.split(';')[0].trim();
  if (type !== 'application/json' && type !== 'application/x-www-form-urlencoded') {
    return reply(request, 415, 'Please submit a valid email using the Show interest form.');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    return reply(request, 413, 'The submission is too large. Please enter only your email.');
  }
  let data;
  try {
    const body = await readBody(request);
    data = type === 'application/json' ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
  } catch (error) {
    return reply(request, error instanceof RangeError ? 413 : 400, 'Please enter a valid email address.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return reply(request, 400, 'Please enter a valid email address.');
  }
  // Bots filling the hidden field get the same response without a database write.
  if (data.website) return reply(request, 200, SUCCESS);
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!validEmail(email)) return reply(request, 400, 'Please enter a valid email address.');

  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_D1_DATABASE_ID: database, CLOUDFLARE_API_TOKEN: token } = env;
  if (!account || !database || !token) return reply(request, 503, UNAVAILABLE);

  try {
    const result = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: 'INSERT INTO interest_signups (email) VALUES (?) ON CONFLICT(email) DO NOTHING',
        params: [email],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) return reply(request, 503, UNAVAILABLE);
    const payload = await result.json();
    if (payload.success !== true || !Array.isArray(payload.result) ||
        payload.result.length !== 1 || payload.result[0]?.success !== true) {
      return reply(request, 503, UNAVAILABLE);
    }
    // Duplicates are successful too, without revealing whether an email was already saved.
    return reply(request, 200, SUCCESS);
  } catch {
    return reply(request, 503, UNAVAILABLE);
  }
}
