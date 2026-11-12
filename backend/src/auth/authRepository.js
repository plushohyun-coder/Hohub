// Database access for login and sessions. Bind parameters only.
class AuthRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUsername(username) {
    const { rows } = await this.pool.query(
      `SELECT id, username, full_name, role, is_active, password_hash,
              (locked_until IS NOT NULL AND locked_until > now()) AS is_locked
         FROM users WHERE username = $1`,
      [username]
    );
    return rows[0] ?? null;
  }

  // Counts one failure and locks the account at maxFailures. A lock that has already
  // expired starts the count again from 1, so one typo after a past lock does not re-lock.
  // Does nothing while the account is locked, so parallel guesses cannot pass the cap.
  async recordFailedLogin(userId, { maxFailures, lockMinutes }) {
    await this.pool.query(
      `UPDATE users
          SET failed_login_count = next.count,
              locked_until = CASE WHEN next.count >= $2 THEN now() + make_interval(mins => $3) ELSE NULL END
         FROM (SELECT CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1
                           ELSE failed_login_count + 1 END AS count
                 FROM users WHERE id = $1) AS next
        WHERE users.id = $1 AND (users.locked_until IS NULL OR users.locked_until <= now())`,
      [userId, maxFailures, lockMinutes]
    );
  }

  // Clears the failure count, but only while the account is not locked. Returns false when a
  // lock was set in the meantime (e.g. by a parallel failed attempt), so the login must fail.
  async recordSuccessfulLogin(userId) {
    const { rowCount } = await this.pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
        WHERE id = $1 AND is_active AND (locked_until IS NULL OR locked_until <= now())`,
      [userId]
    );
    return rowCount === 1;
  }

  async createSession({ tokenHash, userId, maxHours }) {
    await this.pool.query(
      `INSERT INTO user_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [tokenHash, userId, maxHours]
    );
  }

  // Returns the signed-in user for a live session and refreshes its idle timer.
  async touchSession(tokenHash, idleMinutes) {
    const { rows } = await this.pool.query(
      `UPDATE user_sessions s SET last_seen_at = now()
         FROM users u
        WHERE s.token_hash = $1 AND u.id = s.user_id AND u.is_active
          AND s.expires_at > now() AND s.last_seen_at > now() - make_interval(mins => $2)
        RETURNING u.id, u.username, u.full_name, u.role`,
      [tokenHash, idleMinutes]
    );
    return rows[0] ?? null;
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpiredSessions(idleMinutes) {
    await this.pool.query(
      'DELETE FROM user_sessions WHERE expires_at <= now() OR last_seen_at <= now() - make_interval(mins => $1)',
      [idleMinutes]
    );
  }

  async upsertUser({ username, fullName, email, role, passwordHash }) {
    const { rows } = await this.pool.query(
      `INSERT INTO users (username, full_name, email, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (username) DO UPDATE
          SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = EXCLUDED.role,
              password_hash = EXCLUDED.password_hash, is_active = TRUE,
              failed_login_count = 0, locked_until = NULL, updated_at = now()
       RETURNING id, (xmax = 0) AS created`,
      [username, fullName, email, role, passwordHash]
    );
    // A new password ends every session the user had.
    await this.pool.query('DELETE FROM user_sessions WHERE user_id = $1', [rows[0].id]);
    return rows[0];
  }

  async setActive(username, isActive) {
    const { rows } = await this.pool.query(
      'UPDATE users SET is_active = $2, updated_at = now() WHERE username = $1 RETURNING id',
      [username, isActive]
    );
    if (rows[0] && !isActive) {
      await this.pool.query('DELETE FROM user_sessions WHERE user_id = $1', [rows[0].id]);
    }
    return Boolean(rows[0]);
  }
}

module.exports = { AuthRepository };
