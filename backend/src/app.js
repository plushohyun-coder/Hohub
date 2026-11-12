const path = require('path');
const fs = require('fs');
const express = require('express');
const { config } = require('./config');
const { HttpStatus, ErrorCode } = require('./constants');
const { securityHeaders, requireSameOrigin, requireLocalHost } = require('./security/guards');
const { createAuthRouter, requireSession, requireWriteRole } = require('./auth/routes');
const { createDataRouter } = require('./routes/data');

const notFound = (req, res) => res.status(HttpStatus.NOT_FOUND).json({ code: 'NOT_FOUND', message: 'Not found' });

// Never send stack traces or request data back to the browser.
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
    return res.status(HttpStatus.BAD_REQUEST).json({ code: ErrorCode.BAD_REQUEST, message: 'Invalid request body' });
  }
  console.error('Request failed:', error.message);
  return res.status(HttpStatus.INTERNAL_ERROR).json({ code: 'INTERNAL_ERROR', message: 'Request failed' });
};

// The ERP for browsers: every /api route except /api/health and login needs a session.
const createApp = ({ pool, authService, aiRouter, staticDir }) => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.server.trustProxyHops);
  app.use(securityHeaders);
  app.use(express.json({ limit: config.server.jsonBodyLimit }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Hohub ERP Finance API', database: pool ? 'connected' : 'memory-mode' });
  });

  app.use('/api', requireSameOrigin);
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api', requireSession(authService));
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
  if (aiRouter) app.use('/api/ai', aiRouter);
  app.use('/api', requireWriteRole, createDataRouter({ pool }));
  app.use('/api', notFound);

  // Serve the built frontend (frontend/dist) when present, e.g. in the Docker image.
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
};

// Read-only data API for the AI assistant. It listens on 127.0.0.1 only, has no write routes,
// and answers only requests addressed to 127.0.0.1/localhost, so nothing outside this machine
// (and no web page via DNS rebinding) can use it.
const createInternalApp = ({ pool, port = config.internalApi.port }) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(requireLocalHost(port));
  app.use((req, res, next) => (req.method === 'GET' ? next() : notFound(req, res)));
  app.use('/api', createDataRouter({ pool, readOnly: true }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

module.exports = { createApp, createInternalApp };
