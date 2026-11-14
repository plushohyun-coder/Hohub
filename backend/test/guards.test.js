const test = require('node:test');
const assert = require('node:assert');
const { clientKey, rateLimit } = require('../src/security/guards');
const { parseLogin } = require('../src/auth/routes');
const { readCookie } = require('../src/auth/cookies');

test('rate-limit keys group IPv6 by /64 and unwrap IPv4-mapped addresses', () => {
  assert.strictEqual(clientKey('10.0.0.7'), '10.0.0.7');
  assert.strictEqual(clientKey('::ffff:10.0.0.7'), '10.0.0.7');
  assert.strictEqual(clientKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.strictEqual(clientKey('2001:db8:1:2:ffff:ffff:ffff:ffff'), '2001:db8:1:2::/64');
  assert.strictEqual(clientKey('2001:db8::1'), '2001:db8:0:0::/64');
});

test('rate limiter blocks after the limit and resets after the window', () => {
  let now = 0;
  const limiter = rateLimit({ limit: 2, windowMs: 1000, now: () => now });
  const run = () => {
    let status = 200;
    const res = { set() {}, status(code) { status = code; return this; }, json() { return this; } };
    limiter({ ip: '10.0.0.1' }, res, () => {});
    return status;
  };
  assert.deepStrictEqual([run(), run(), run()], [200, 200, 429]);
  now = 1000;
  assert.strictEqual(run(), 200);
});

test('login body must be exactly username and password with bounded lengths', () => {
  assert.deepStrictEqual(parseLogin({ username: 'kim', password: 'x' }), { username: 'kim', password: 'x' });
  assert.strictEqual(parseLogin({ username: 'kim', password: 'x', role: 'ADMIN' }), null);
  assert.strictEqual(parseLogin({ username: ['kim'], password: 'x' }), null);
  assert.strictEqual(parseLogin({ username: '', password: 'x' }), null);
  assert.strictEqual(parseLogin({ username: 'kim', password: 'x'.repeat(257) }), null);
  assert.strictEqual(parseLogin(null), null);
});

test('a duplicated session cookie is ignored', () => {
  assert.strictEqual(readCookie({ headers: { cookie: 'a=1; hohub_session=abc' } }, 'hohub_session'), 'abc');
  assert.strictEqual(readCookie({ headers: { cookie: 'hohub_session=evil; hohub_session=abc' } }, 'hohub_session'), null);
  assert.strictEqual(readCookie({ headers: {} }, 'hohub_session'), null);
});
