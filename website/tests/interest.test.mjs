import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInterest } from '../src/server/interest.mjs';

const env = { CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_D1_DATABASE_ID: 'test-db', CLOUDFLARE_API_TOKEN: 'test-secret' };
const success = () => Response.json({ success: true, result: [{ success: true, meta: { changes: 1 } }] });
function request(data = { email: 'person@example.com' }, headers = {}) {
  return new Request('https://institutions.ethindia.co/api/interest', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://institutions.ethindia.co', ...headers },
    body: JSON.stringify(data),
  });
}
const noFetch = () => { assert.fail('Invalid submissions must not reach D1'); };

test('normalizes email and sends a parameterized, authenticated D1 insert', async () => {
  let calls = 0;
  const result = await handleInterest(request({ email: ' Person+News@Example.COM ' }), env, async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/test-account/d1/database/test-db/query');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.params, ['person+news@example.com']);
    assert.match(body.sql, /VALUES \(\?\) ON CONFLICT\(email\) DO NOTHING/);
    assert.ok(options.signal instanceof AbortSignal);
    return success();
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ok, true);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('rejects invalid input without writing to D1', async () => {
  for (const email of ['', 'bad', 'a@@b.com', '.a@b.com', 'a..b@c.com', 'a@-b.com', 'a@b..com', 'a@b.c\nBcc: x@y.com', 'a'.repeat(65) + '@example.com', 123, null]) {
    assert.equal((await handleInterest(request({ email }), env, noFetch)).status, 400, String(email));
  }
  for (const input of [null, [], 'email@example.com']) {
    assert.equal((await handleInterest(request(input), env, noFetch)).status, 400);
  }
});

test('rejects cross-origin submissions and unsupported methods or formats', async () => {
  assert.equal((await handleInterest(request(undefined, { Origin: 'https://other.example' }), env, noFetch)).status, 403);
  assert.equal((await handleInterest(request(undefined, { 'Sec-Fetch-Site': 'cross-site' }), env, noFetch)).status, 403);
  assert.equal((await handleInterest(request(undefined, { 'Content-Type': 'text/plain' }), env, noFetch)).status, 415);
  const get = await handleInterest(new Request('https://institutions.ethindia.co/api/interest'), env, noFetch);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
});

test('rejects malformed and oversized bodies even without content-length', async () => {
  const make = (body) => new Request('https://institutions.ethindia.co/api/interest', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body,
  });
  assert.equal((await handleInterest(make('{'), env, noFetch)).status, 400);
  assert.equal((await handleInterest(make('x'.repeat(2049)), env, noFetch)).status, 413);
});

test('spam trap returns a generic success without storing an email', async () => {
  const response = await handleInterest(request({ email: 'bot@example.com', website: 'spam' }), env, noFetch);
  assert.equal(response.status, 200);
});

test('duplicates return the same success message as a new signup', async () => {
  const original = await handleInterest(request(), env, async () => success());
  const duplicate = await handleInterest(request(), env, async () => Response.json({ success: true, result: [{ success: true, meta: { changes: 0 } }] }));
  assert.deepEqual(await original.json(), await duplicate.json());
});

test('missing credentials, D1 failures and timeouts never report success or leak details', async () => {
  assert.equal((await handleInterest(request(), {}, noFetch)).status, 503);
  for (const fetcher of [
    async () => Response.json({ error: 'test-secret' }, { status: 401 }),
    async () => Response.json({ success: false, result: [] }),
    async () => Response.json({ success: true, result: [{ success: false }] }),
    async () => new Response('invalid JSON'),
    async () => { throw new DOMException('test-secret', 'TimeoutError'); },
  ]) {
    const response = await handleInterest(request(), env, fetcher);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /test-secret/);
  }
});

test('native HTML form submissions work without JavaScript', async () => {
  const req = new Request('https://institutions.ethindia.co/api/interest', {
    method: 'POST', body: new URLSearchParams({ email: 'reader@example.com', website: '' }),
  });
  const response = await handleInterest(req, env, async () => success());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /Thank you for your interest/);
});
