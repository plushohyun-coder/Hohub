const crypto = require('crypto');
const { config } = require('../config');
const { verifyPassword } = require('./passwords');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class LoginError extends Error {}

// Login, session lookup and logout. Session tokens are random and only their SHA-256 is stored.
class AuthService {
  constructor({ repository, settings = config.auth }) {
    this.repository = repository;
    this.settings = settings;
  }

  // Returns { token, user }. Every failure throws the same LoginError after the same minimum time,
  // so a caller cannot tell an unknown user from a wrong password or a locked account.
  async login({ username, password }) {
    const startedAt = Date.now();
    const user = await this.repository.findByUsername(username);
    const passwordOk = await verifyPassword(user?.password_hash ?? null, password);

    const usable = user && user.is_active && !user.is_locked && user.password_hash;
    if (usable && !passwordOk) {
      await this.repository.recordFailedLogin(user.id, {
        maxFailures: this.settings.maxFailedLogins,
        lockMinutes: this.settings.lockMinutes
      });
    }
    if (!usable || !passwordOk || !(await this.repository.recordSuccessfulLogin(user.id))) {
      const remaining = this.settings.failureFloorMs - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      throw new LoginError('Invalid username or password');
    }

    const token = crypto.randomBytes(this.settings.sessionTokenBytes).toString('base64url');
    await this.repository.createSession({ tokenHash: sha256(token), userId: user.id, maxHours: this.settings.sessionMaxHours });
    return { token, user: publicUser(user) };
  }

  async authenticate(token) {
    if (typeof token !== 'string' || token === '') return null;
    const user = await this.repository.touchSession(sha256(token), this.settings.sessionIdleMinutes);
    return user ? publicUser(user) : null;
  }

  async logout(token) {
    if (typeof token === 'string' && token !== '') await this.repository.deleteSession(sha256(token));
  }

  async purgeExpired() {
    await this.repository.deleteExpiredSessions(this.settings.sessionIdleMinutes);
  }
}

const publicUser = (user) => ({ id: user.id, username: user.username, fullName: user.full_name, role: user.role });

module.exports = { AuthService, LoginError, sha256 };
