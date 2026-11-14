// Login against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set.
// Uses its own schema (dropped afterwards) holding database/schema.sql + migrations.
//   TEST_DATABASE_URL=postgres://... npm test
process.env.LOGIN_FAILURE_FLOOR_MS = '50';
process.env.LOGIN_RATE_PER_MINUTE = '1000';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { Pool } = require('pg');
const { createApp } = require('../src/app');
const { AuthRepository } = require('../src/auth/authRepository');
const { AuthService } = require('../src/auth/authService');
const { hashPassword } = require('../src/auth/passwords');

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const SCHEMA = 'hohub_login_it';
const DB_DIR = path.join(__dirname, '..', '..', 'database');
const PASSWORD = 'Correct-Horse-9';

test('login', { skip: !DATABASE_URL && 'TEST_DATABASE_URL not set' }, async (t) => {
  const pool = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${SCHEMA}` });
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};`);
  await pool.query(await fs.readFile(path.join(DB_DIR, 'schema.sql'), 'utf8'));
  const migrations = (await fs.readdir(path.join(DB_DIR, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await pool.query(await fs.readFile(path.join(DB_DIR, 'migrations', file), 'utf8'));
  // Running a migration twice must be harmless.
  for (const file of migrations) await pool.query(await fs.readFile(path.join(DB_DIR, 'migrations', file), 'utf8'));

  const repository = new AuthRepository(pool);
  const passwordHash = await hashPassword(PASSWORD);
  for (const [username, role] of [['admin', 'ADMIN'], ['accountant', 'ACCOUNTANT'], ['viewer', 'VIEWER']]) {
    await repository.upsertUser({ username, fullName: username, email: `${username}@hohub.local`, role, passwordHash });
  }

  const authService = new AuthService({ repository });
  const server = http.createServer(createApp({ pool, authService })).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.close();
    await pool.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
    await pool.end();
  });

  const call = (method, url, { cookie, body } = {}) =>
    fetch(`${base}${url}`, {
      method,
      headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  const login = (username, password = PASSWORD) => call('POST', '/api/auth/login', { body: { username, password } });
  const cookieOf = (res) => res.headers.get('set-cookie').split(';')[0];
  const failures = async (username) => (await pool.query('SELECT failed_login_count, locked_until FROM users WHERE username = $1', [username])).rows[0];

  await t.test('the sample users from schema.sql have no password and cannot sign in', async () => {
    assert.strictEqual((await login('approver', '')).status, 400);
    assert.strictEqual((await login('approver', PASSWORD)).status, 401);
  });

  await t.test('a correct login sets an HttpOnly, SameSite=Strict cookie and opens the API', async () => {
    const res = await login('viewer');
    assert.strictEqual(res.status, 200);
    const { id } = (await pool.query("SELECT id FROM users WHERE username = 'viewer'")).rows[0];
    assert.deepStrictEqual((await res.json()).user, { id, username: 'viewer', fullName: 'viewer', role: 'VIEWER', canWrite: false });
    const setCookie = res.headers.get('set-cookie');
    assert.match(setCookie, /^hohub_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict/);
    const cookie = cookieOf(res);
    assert.strictEqual((await call('GET', '/api/accounts', { cookie })).status, 200);
    assert.strictEqual((await (await call('GET', '/api/auth/me', { cookie })).json()).user.username, 'viewer');

    const token = cookie.split('=')[1];
    const stored = (await pool.query('SELECT token_hash FROM user_sessions')).rows.map((r) => r.token_hash);
    assert.ok(!stored.includes(token), 'only the hash of the token is stored');
  });

  await t.test('only ADMIN and ACCOUNTANT may create data', async () => {
    const body = { account_code: '9100', account_name: 'Test account', account_type: 'Expense' };
    const viewer = cookieOf(await login('viewer'));
    assert.strictEqual((await call('POST', '/api/accounts', { cookie: viewer, body })).status, 403);
    const accountant = cookieOf(await login('accountant'));
    assert.strictEqual((await call('POST', '/api/accounts', { cookie: accountant, body })).status, 201);
  });

  await t.test('created data is validated; duplicates and unknown references are client errors', async () => {
    const admin = cookieOf(await login('admin'));
    const bad = await call('POST', '/api/budgets', { cookie: admin, body: { budget_name: 'x', budget_code: 'B1', fiscal_year: '2027', start_date: '2027-05-01', end_date: '2027-01-01', is_active: true } });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((await bad.json()).code, 'VALIDATION_FAILED');

    const budget = { budget_name: 'Ops 2027', budget_code: 'OPS-2027', fiscal_year: '2027', start_date: '2027-01-01', end_date: '2027-12-31', total_budget: 1000.25 };
    assert.strictEqual((await call('POST', '/api/budgets', { cookie: admin, body: budget })).status, 201);
    const again = await call('POST', '/api/budgets', { cookie: admin, body: budget });
    assert.strictEqual(again.status, 409);
    assert.strictEqual((await again.json()).code, 'DUPLICATE');

    const invoice = { invoice_no: 'INV-X1', invoice_date: '2027-01-05', due_date: '2027-02-05', customer_id: 999999, total_amount: 10 };
    const missing = await call('POST', '/api/invoices', { cookie: admin, body: invoice });
    assert.strictEqual(missing.status, 400);
    assert.strictEqual((await missing.json()).code, 'UNKNOWN_REFERENCE');
    await pool.query("UPDATE users SET failed_login_count = 0 WHERE username = 'admin'");
  });

  await t.test('wrong password and unknown user get the same answer', async () => {
    const wrong = await login('viewer', 'Wrong-Password-1');
    const unknown = await login('nobody', 'Wrong-Password-1');
    assert.strictEqual(wrong.status, 401);
    assert.strictEqual(unknown.status, 401);
    assert.deepStrictEqual(await wrong.json(), await unknown.json());
    await pool.query("UPDATE users SET failed_login_count = 0 WHERE username = 'viewer'");
  });

  await t.test('five wrong passwords lock the account, even for the right password', async () => {
    for (let i = 0; i < 5; i += 1) await login('accountant', 'Wrong-Password-1');
    assert.ok((await failures('accountant')).locked_until > new Date());
    assert.strictEqual((await login('accountant')).status, 401);
  });

  await t.test('after a lock expires, one typo does not lock the account again', async () => {
    await pool.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE username = 'accountant'");
    assert.strictEqual((await login('accountant', 'Wrong-Password-1')).status, 401);
    const state = await failures('accountant');
    assert.strictEqual(state.failed_login_count, 1);
    assert.strictEqual(state.locked_until, null);
    assert.strictEqual((await login('accountant')).status, 200);
    assert.strictEqual((await failures('accountant')).failed_login_count, 0);
  });

  await t.test('a burst of parallel guesses cannot go past the lock', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => login('admin', 'Wrong-Password-1')));
    assert.ok(results.every((r) => r.status === 401));
    const state = await failures('admin');
    assert.ok(state.failed_login_count <= 5, `counted ${state.failed_login_count}`);
    assert.ok(state.locked_until > new Date());
    assert.strictEqual((await login('admin')).status, 401, 'still locked for the right password');
    await pool.query("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE username = 'admin'");
  });

  await t.test('logout, idle timeout and disabling a user end the session', async () => {
    const first = cookieOf(await login('viewer'));
    assert.strictEqual((await call('POST', '/api/auth/logout', { cookie: first })).status, 204);
    assert.strictEqual((await call('GET', '/api/accounts', { cookie: first })).status, 401);

    const second = cookieOf(await login('viewer'));
    await pool.query("UPDATE user_sessions SET last_seen_at = now() - interval '31 minutes'");
    assert.strictEqual((await call('GET', '/api/accounts', { cookie: second })).status, 401);

    const third = cookieOf(await login('viewer'));
    await repository.setActive('viewer', false);
    assert.strictEqual((await call('GET', '/api/accounts', { cookie: third })).status, 401);
    assert.strictEqual((await login('viewer')).status, 401);
    await repository.setActive('viewer', true);
  });

  await t.test('a password reset ends the old sessions', async () => {
    const cookie = cookieOf(await login('viewer'));
    await repository.upsertUser({ username: 'viewer', fullName: 'viewer', email: 'viewer@hohub.local', role: 'VIEWER', passwordHash: await hashPassword('Another-Pass-77') });
    assert.strictEqual((await call('GET', '/api/accounts', { cookie })).status, 401);
    assert.strictEqual((await login('viewer', 'Another-Pass-77')).status, 200);
  });

  await t.test('a logged-in POST from another site is still rejected', async () => {
    const cookie = cookieOf(await login('admin'));
    const res = await fetch(`${base}/api/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie },
      body: JSON.stringify({ account_code: '9200', account_name: 'x', account_type: 'Expense' })
    });
    assert.strictEqual(res.status, 403);
  });
});
