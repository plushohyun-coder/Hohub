const path = require('path');
const dotenv = require('dotenv');

// Load .env before the config and ./config/db read it.
dotenv.config();

const { config } = require('./config');
const { pool } = require('./config/db');
const { createAiRouter } = require('./ai');
const { createApp, createInternalApp } = require('./app');
const { AuthRepository } = require('./auth/authRepository');
const { AuthService } = require('./auth/authService');

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

// Login needs the users table, so without a database nobody can sign in and the API stays closed.
const authService = pool ? new AuthService({ repository: new AuthRepository(pool) }) : null;
if (!authService) console.warn('DATABASE_URL is not set: login is unavailable and the API stays locked');

const { host: internalHost, port: internalPort } = config.internalApi;
const erpBaseUrl = process.env.ERP_API_BASE_URL || `http://${internalHost}:${internalPort}/api`;

const app = createApp({
  pool,
  authService,
  aiRouter: createAiRouter({ erpBaseUrl }),
  staticDir: process.env.STATIC_DIR || path.join(__dirname, '../../frontend/dist')
});

createInternalApp({ pool, port: internalPort }).listen(internalPort, internalHost, () => {
  console.log(`Read-only API for the AI assistant on http://${internalHost}:${internalPort}`);
});

app.listen(config.server.port, () => {
  console.log(`Hohub ERP API listening on http://localhost:${config.server.port}`);
});

if (authService) {
  setInterval(() => authService.purgeExpired().catch((error) => console.error('Session cleanup failed:', error.message)), PURGE_INTERVAL_MS).unref();
}
