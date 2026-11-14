const express = require('express');
const { config } = require('../config');
const { HttpStatus, ErrorCode, WRITE_ROLES } = require('../constants');
const { rateLimit } = require('../security/guards');
const { LoginError } = require('./authService');
const { readSessionToken, setSessionCookie, clearSessionCookie } = require('./cookies');

const reject = (res, status, code, message) => res.status(status).json({ code, message });

const isBoundedString = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

// Accepts exactly { username, password } with sane lengths; never echoes what was sent.
const parseLogin = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes('username') || !keys.includes('password')) return null;
  const { username, password } = body;
  if (!isBoundedString(username, config.auth.maxUsernameLength) || !isBoundedString(password, config.auth.maxPasswordLength)) {
    return null;
  }
  return { username, password };
};

// /api/auth: login, logout, current user.
const createAuthRouter = (authService) => {
  const router = express.Router();
  const loginLimiter = rateLimit({ limit: config.auth.loginRatePerMinute });

  router.post('/login', loginLimiter, async (req, res, next) => {
    if (!authService) return reject(res, HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.LOGIN_UNAVAILABLE, 'Login needs DATABASE_URL');
    const credentials = parseLogin(req.body);
    if (!credentials) return reject(res, HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, 'username and password are required');
    try {
      const { token, user } = await authService.login(credentials);
      setSessionCookie(req, res, token);
      return res.json({ user: { ...user, canWrite: WRITE_ROLES.includes(user.role) } });
    } catch (error) {
      if (error instanceof LoginError) return reject(res, HttpStatus.UNAUTHORIZED, ErrorCode.LOGIN_FAILED, 'Invalid username or password');
      return next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      if (authService) await authService.logout(readSessionToken(req));
      clearSessionCookie(req, res);
      return res.status(HttpStatus.NO_CONTENT).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
};

// Puts the signed-in user on req.user, or answers 401.
const requireSession = (authService) => async (req, res, next) => {
  try {
    const user = authService ? await authService.authenticate(readSessionToken(req)) : null;
    if (!user) return reject(res, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, 'Sign in required');
    req.user = { ...user, canWrite: WRITE_ROLES.includes(user.role) };
    return next();
  } catch (error) {
    return next(error);
  }
};

// Only ADMIN and ACCOUNTANT may change data; reads are open to every signed-in user.
const requireWriteRole = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.user?.canWrite) return next();
  return reject(res, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'Your role cannot change data');
};

module.exports = { createAuthRouter, requireSession, requireWriteRole, parseLogin };
