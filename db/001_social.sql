-- Run against a dedicated PostgreSQL database before enabling social publishing.
-- Postgres 14+. No public API should have permission to modify sessions directly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS looke_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evm_address VARCHAR(42) UNIQUE NOT NULL,
  handle VARCHAR(30) UNIQUE,
  display_name VARCHAR(80),
  bio VARCHAR(280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS looke_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evm_address VARCHAR(42) NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_challenges_active ON looke_challenges(evm_address, created_at DESC);
CREATE TABLE IF NOT EXISTS looke_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_sessions_profile_id ON looke_sessions(profile_id);
CREATE TABLE IF NOT EXISTS looke_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK(char_length(text) BETWEEN 1 AND 1200),
  moderation_status VARCHAR(16) NOT NULL DEFAULT 'visible'
    CHECK(moderation_status IN ('visible','hidden','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_posts_feed ON looke_posts(created_at DESC) WHERE moderation_status='visible';
CREATE TABLE IF NOT EXISTS looke_follows (
  follower_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE TABLE IF NOT EXISTS looke_likes (
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES looke_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, post_id)
);
