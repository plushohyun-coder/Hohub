const { config } = require('../config');
const { HttpStatus, ErrorCode } = require('../constants');

const SAFE_METHODS = Object.freeze(['GET', 'HEAD', 'OPTIONS']);
const MINUTE_MS = 60 * 1000;

const reject = (res, status, code, message) => res.status(status).json({ code, message });

// Basic hardening headers. The built React app loads only its own files.
const securityHeaders = (req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
      "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
};

const originOf = (url) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

// CSRF defence on top of SameSite=Strict: a state-changing request must come from this site.
const requireSameOrigin = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) return next();
  // An Origin header wins when present ("null" or garbage is rejected); otherwise fall back to Referer.
  const source = req.get('origin') !== undefined ? originOf(req.get('origin')) : originOf(req.get('referer'));
  const allowed = source !== null && (config.server.allowedOrigins.includes(source) || new URL(source).host === req.get('host'));
  if (!allowed) return reject(res, HttpStatus.FORBIDDEN, ErrorCode.CSRF_REJECTED, 'Cross-site request rejected');
  return next();
};

// Rate-limit key: IPv4 as is, IPv6 by its /64 network (one customer usually owns a whole /64).
const clientKey = (ip = '') => {
  const address = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  if (!address.includes(':')) return address;
  const [head, tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).join(':')}::/64`;
};

// Fixed-window limiter kept in memory (single process).
const rateLimit = ({ limit, windowMs = MINUTE_MS, now = Date.now }) => {
  const hits = new Map();
  return (req, res, next) => {
    const key = clientKey(req.ip);
    const current = now();
    const entry = hits.get(key);
    if (!entry || current - entry.start >= windowMs) {
      if (hits.size > 10000) hits.clear();
      hits.set(key, { start: current, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - current) / 1000)));
      return reject(res, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'Too many attempts, try again later');
    }
    return next();
  };
};

// Only answer requests addressed to this machine by name (blocks DNS rebinding on the internal API).
const requireLocalHost = (port) => {
  const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
  return (req, res, next) => {
    if (!allowed.includes(req.get('host'))) return reject(res, HttpStatus.MISDIRECTED, ErrorCode.HOST_REJECTED, 'Unknown host');
    return next();
  };
};

module.exports = { securityHeaders, requireSameOrigin, rateLimit, clientKey, requireLocalHost };
