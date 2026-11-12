-- Login for Hohub: password hashes and lockout on the existing users table, plus server-side sessions.
-- Safe to run more than once. Apply after database/schema.sql:
--   psql "$DATABASE_URL" -f database/migrations/001_login.sql
BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('ADMIN', 'ACCOUNTANT', 'APPROVER', 'VIEWER'));
    END IF;
END $$;

-- Only the SHA-256 of each session token is stored, so a database leak does not leak sessions.
CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash   CHAR(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

COMMIT;
