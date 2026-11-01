-- Add after 001_social.sql. Private server-side rate-limit state; no plaintext IPs.
CREATE TABLE IF NOT EXISTS looke_auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_auth_rate_limits_window ON looke_auth_rate_limits(window_started_at);
-- Operations: DELETE FROM looke_auth_rate_limits WHERE window_started_at < now() - interval '24 hours';
