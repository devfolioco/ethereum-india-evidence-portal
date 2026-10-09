import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

test('packaged Vercel function starts and handles signups without the build workspace', async () => {
  const source = new URL('../../.vercel/output/functions/_render.func/', import.meta.url);
  const config = JSON.parse(await readFile(new URL('.vc-config.json', source), 'utf8'));
  const isolated = await mkdtemp(join(tmpdir(), 'ethindia-vercel-'));
  try {
    // Importing in the checkout can hide missing deployment dependencies by resolving
    // packages from website/node_modules. Copy the artifact outside that directory.
    await cp(source, isolated, { recursive: true, dereference: true });
    const { stdout } = await run(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { pathToFileURL } from 'node:url';
      const { default: app } = await import(pathToFileURL(process.argv[1]).href);
      const request = (email) => new Request('https://institutions.ethindia.co/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal((await app.fetch(request('invalid'))).status, 400);
      assert.equal((await app.fetch(request('test@example.com'))).status, 503);
      assert.equal((await app.fetch(new Request('https://institutions.ethindia.co/api/interest'))).status, 405);
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      process.env.CLOUDFLARE_D1_DATABASE_ID = 'test-database';
      process.env.CLOUDFLARE_API_TOKEN = 'test-token';
      let writes = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/test-account/d1/database/test-database/query');
        assert.deepEqual(JSON.parse(options.body).params, ['test@example.com']);
        writes++;
        return Response.json({ success: true, result: [{ success: true }] });
      };
      const saved = await app.fetch(request('TEST@example.com'));
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).ok, true);
      assert.equal(writes, 1);
      console.log('Isolated Vercel artifact: startup and endpoint checks passed');
    `, join(isolated, config.handler)], {
      cwd: isolated,
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_PATH: '',
        NODE_OPTIONS: '',
        CLOUDFLARE_ACCOUNT_ID: '',
        CLOUDFLARE_D1_DATABASE_ID: '',
        CLOUDFLARE_API_TOKEN: '',
      },
    });
    assert.match(stdout, /startup and endpoint checks passed/);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
