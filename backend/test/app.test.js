// The app without a database: everything except /api/health stays locked.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { once } = require('node:events');
const { createApp, createInternalApp } = require('../src/app');

// Starts a server on a free port; makeApp receives the port (the internal API needs it).
const listen = async (makeApp, t) => {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  server.on('request', makeApp(port));
  return { base: `http://127.0.0.1:${port}`, port };
};

test('without a database the data API is locked and login is unavailable', async (t) => {
  const { base } = await listen(() => createApp({ pool: null, authService: null }), t);

  const health = await fetch(`${base}/api/health`);
  assert.strictEqual(health.status, 200);
  assert.match(health.headers.get('content-security-policy'), /default-src 'self'/);
  assert.strictEqual(health.headers.get('x-frame-options'), 'DENY');
  assert.strictEqual(health.headers.get('access-control-allow-origin'), null, 'no CORS: other sites cannot read the API');

  for (const path of ['/api/accounts', '/api/invoices', '/api/budgets', '/api/reports/summary', '/api/auth/me']) {
    assert.strictEqual((await fetch(`${base}${path}`)).status, 401, path);
  }
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ username: 'admin', password: 'whatever-123' })
  });
  assert.strictEqual(login.status, 503);
});

test('state-changing requests from another site are rejected before anything else', async (t) => {
  const { base } = await listen(() => createApp({ pool: null, authService: null }), t);
  const post = (headers) =>
    fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
  assert.strictEqual((await post({ origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await post({ origin: 'null' })).status, 403);
  assert.strictEqual((await post({})).status, 403, 'no Origin and no Referer');
  assert.strictEqual((await post({ referer: 'https://evil.example/page' })).status, 403);
  assert.strictEqual((await post({ origin: base })).status, 503, 'same origin passes the check');
});

test('the internal API is read-only and answers only to 127.0.0.1/localhost', async (t) => {
  const { base, port } = await listen((p) => createInternalApp({ pool: null, port: p }), t);

  const accounts = await fetch(`${base}/api/accounts`);
  assert.strictEqual(accounts.status, 200);
  assert.ok((await accounts.json()).length > 0);

  const post = await fetch(`${base}/api/accounts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.strictEqual(post.status, 404, 'no write routes');

  // fetch() will not send a custom Host header, so use a raw request.
  const statusFor = (host) =>
    new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/accounts', headers: { host } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });
  assert.strictEqual(await statusFor(`evil.example:${port}`), 421, 'DNS rebinding: a foreign Host header is refused');
  assert.strictEqual(await statusFor(`localhost:${port}`), 200);
});
