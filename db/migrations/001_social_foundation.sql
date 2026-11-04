-- Looke M5 social schema — PostgreSQL 15+.
-- No financial assets, private keys, or wallet permissions are stored here.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS social_profiles (
  address text PRIMARY KEY CHECK(address ~ '^0x[0-9a-f]{40}$'),
  handle varchar(24) NOT NULL UNIQUE CHECK(handle ~ '^[a-z][a-z0-9_]{2,23}$'),
  display_name varchar(60) NOT NULL DEFAULT '',
  bio varchar(240) NOT NULL DEFAULT '',
  avatar_url text,
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL CHECK(address ~ '^0x[0-9a-f]{40}$'),
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_auth_expiry ON social_auth_challenges(expires_at);
CREATE TABLE IF NOT EXISTS social_sessions (
  token_hash char(64) PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  address text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_sessions_expiry ON social_sessions(expires_at);

CREATE TABLE IF NOT EXISTS social_follows (
  follower text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  followed text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower,followed),
  CHECK(follower <> followed)
);
CREATE INDEX IF NOT EXISTS social_followed_idx ON social_follows(followed);

CREATE TABLE IF NOT EXISTS social_blocks (
  blocker text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  blocked text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker,blocked),
  CHECK(blocker <> blocked)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  body varchar(1000) NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 1000),
  asset_chain text CHECK(asset_chain IN ('ultra-evm','ultra-native')),
  asset_type text CHECK(asset_type IN ('token','uniq')),
  asset_id text,
  hidden boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((asset_chain IS NULL AND asset_type IS NULL AND asset_id IS NULL) OR
         (asset_chain = 'ultra-evm' AND asset_type = 'token' AND asset_id ~ '^0x[0-9A-Fa-f]{40}$') OR
         (asset_chain = 'ultra-native' AND asset_type = 'uniq' AND asset_id ~ '^[1-9][0-9]{0,15}$'))
);
CREATE INDEX IF NOT EXISTS social_posts_feed_idx ON social_posts(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS social_posts_author_idx ON social_posts(author,created_at DESC);

CREATE TABLE IF NOT EXISTS social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  body varchar(500) NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 500),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_comments_post_idx ON social_comments(post_id,created_at ASC);

CREATE TABLE IF NOT EXISTS social_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES social_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(reason IN ('spam','scam','harassment','impersonation','other')),
  details varchar(500) NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS social_reports_post_once ON social_reports(reporter,post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS social_reports_comment_once ON social_reports(reporter,comment_id) WHERE comment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS social_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('hide_post','hide_comment','suspend_profile','restore_post','restore_comment','restore_profile')),
  target_id text NOT NULL,
  reason varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_rate_windows (
  actor text NOT NULL,
  category text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK(count > 0),
  PRIMARY KEY(actor,category,window_start)
);

-- Messaging foundation ONLY: no plaintext messages accepted by API.
-- Public encryption keys and audited client-side end-to-end encryption
-- must be implemented before this storage may be used.
CREATE TABLE IF NOT EXISTS social_dm_public_keys (
  owner text PRIMARY KEY REFERENCES social_profiles(address) ON DELETE CASCADE,
  algorithm text NOT NULL CHECK(algorithm IN ('x25519-xsalsa20-poly1305')),
  public_key text NOT NULL,
  key_version integer NOT NULL DEFAULT 1 CHECK(key_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_dm_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  recipient text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  encrypted_payload bytea NOT NULL CHECK(octet_length(encrypted_payload) BETWEEN 48 AND 8192),
  sender_key_version integer NOT NULL CHECK(sender_key_version > 0),
  recipient_key_version integer NOT NULL CHECK(recipient_key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(sender <> recipient)
);
CREATE INDEX IF NOT EXISTS social_dm_recipient_idx ON social_dm_envelopes(recipient,created_at DESC);
-- No UI/API message sending endpoints until key registration, recovery,
-- explicit block checks, rate controls and independent crypto review are complete.
