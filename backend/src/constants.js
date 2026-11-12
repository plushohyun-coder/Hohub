// Fixed vocabulary shared by the server, tests and the user script.
const Role = Object.freeze({
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  APPROVER: 'APPROVER',
  VIEWER: 'VIEWER'
});

// Roles that may create accounts, invoices and budgets. Everyone signed in may read.
const WRITE_ROLES = Object.freeze([Role.ADMIN, Role.ACCOUNTANT]);

const HttpStatus = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  MISDIRECTED: 421,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
});

const ErrorCode = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  LOGIN_FAILED: 'LOGIN_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_REJECTED: 'CSRF_REJECTED',
  HOST_REJECTED: 'HOST_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  LOGIN_UNAVAILABLE: 'LOGIN_UNAVAILABLE'
});

module.exports = { Role, WRITE_ROLES, HttpStatus, ErrorCode };
