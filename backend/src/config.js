// Settings read from the environment, with safe defaults. Everything tunable lives here.
const intFromEnv = (name, fallback, { min = 0 } = {}) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
};

const listFromEnv = (name) =>
  (process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const port = intFromEnv('PORT', 5000, { min: 1 });

const config = Object.freeze({
  server: Object.freeze({
    port,
    // Number of reverse proxies in front of the app (0 = clients connect directly).
    trustProxyHops: intFromEnv('TRUST_PROXY_HOPS', 0),
    // Extra origins allowed to send state-changing requests (e.g. https://erp.example.com).
    allowedOrigins: listFromEnv('ALLOWED_ORIGINS'),
    jsonBodyLimit: '100kb'
  }),
  // Read-only copy of the data API for the AI assistant, reachable only from this machine.
  internalApi: Object.freeze({
    host: '127.0.0.1',
    port: intFromEnv('INTERNAL_API_PORT', port + 1, { min: 1 })
  }),
  auth: Object.freeze({
    cookieName: 'hohub_session',
    sessionIdleMinutes: intFromEnv('SESSION_IDLE_MINUTES', 30, { min: 1 }),
    sessionMaxHours: intFromEnv('SESSION_MAX_HOURS', 12, { min: 1 }),
    maxFailedLogins: intFromEnv('LOGIN_MAX_FAILURES', 5, { min: 1 }),
    lockMinutes: intFromEnv('LOGIN_LOCK_MINUTES', 15, { min: 1 }),
    // Every failed login takes at least this long, so timing does not reveal which part failed.
    failureFloorMs: intFromEnv('LOGIN_FAILURE_FLOOR_MS', 400),
    loginRatePerMinute: intFromEnv('LOGIN_RATE_PER_MINUTE', 10, { min: 1 }),
    minPasswordLength: 12,
    maxPasswordLength: 256,
    maxUsernameLength: 100,
    sessionTokenBytes: 32
  })
});

module.exports = { config };
