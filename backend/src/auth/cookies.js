const { config } = require('../config');

// Reads one cookie. Refuses a request that carries the session cookie more than once,
// since a duplicate can only come from a cookie planted by another site or subdomain.
const readCookie = (req, name) => {
  const values = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 ? values[0] : null;
};

const baseAttributes = (req) => {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Strict'];
  // Secure whenever the browser reached us over HTTPS (directly or via a trusted proxy).
  if (req.secure) attributes.push('Secure');
  return attributes;
};

const setSessionCookie = (req, res, token) => {
  const maxAgeSeconds = config.auth.sessionMaxHours * 60 * 60;
  res.append('Set-Cookie', [`${config.auth.cookieName}=${token}`, ...baseAttributes(req), `Max-Age=${maxAgeSeconds}`].join('; '));
};

const clearSessionCookie = (req, res) => {
  res.append('Set-Cookie', [`${config.auth.cookieName}=`, ...baseAttributes(req), 'Max-Age=0'].join('; '));
};

const readSessionToken = (req) => readCookie(req, config.auth.cookieName);

module.exports = { readCookie, readSessionToken, setSessionCookie, clearSessionCookie };
