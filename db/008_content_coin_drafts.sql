-- M10 offchain proposals, not any claim of issued tokens or creator ownership onchain.
-- Apply after db/001_social.sql and db/007_creator_coin_drafts.sql.
CREATE TABLE IF NOT EXISTS looke_content_coin_drafts (
  post_id UUID PRIMARY KEY REFERENCES looke_posts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  creator_address VARCHAR(42) NOT NULL,
  source_text_hash CHAR(66) NOT NULL CHECK(source_text_hash ~ '^0x[0-9a-f]{64}
  content_ref CHAR(66) NOT NULL CHECK(content_ref ~ '^0x[0-9a-f]{64}$'),
  ref_version VARCHAR(24) NOT NULL DEFAULT 'looke.content.v1',
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  symbol VARCHAR(12) NOT NULL CHECK(symbol ~ '^[A-Z0-9]{2,12}$'),
  supply_tokens BIGINT NOT NULL CHECK(supply_tokens BETWEEN 1 AND 1000000000),
  metadata_uri VARCHAR(256) NOT NULL CHECK(metadata_uri LIKE 'ipfs://%'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT looke_content_coin_drafts_unique_ref UNIQUE(content_ref),
  CONSTRAINT looke_content_coin_drafts_version CHECK(ref_version='looke.content.v1')
);
CREATE INDEX IF NOT EXISTS looke_content_coin_drafts_author
  ON looke_content_coin_drafts(profile_id,updated_at DESC);
-- Draft snapshots remain private; posts removed by the author cascade-delete drafts.
-- Edited/hidden posts must fail preflight in the application until revalidated.
),
  source_edited_at TIMESTAMPTZ,
  content_ref CHAR(66) NOT NULL CHECK(content_ref ~ '^0x[0-9a-f]{64}$'),
  ref_version VARCHAR(24) NOT NULL DEFAULT 'looke.content.v1',
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  symbol VARCHAR(12) NOT NULL CHECK(symbol ~ '^[A-Z0-9]{2,12}$'),
  supply_tokens BIGINT NOT NULL CHECK(supply_tokens BETWEEN 1 AND 1000000000),
  metadata_uri VARCHAR(256) NOT NULL CHECK(metadata_uri LIKE 'ipfs://%'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT looke_content_coin_drafts_unique_ref UNIQUE(content_ref),
  CONSTRAINT looke_content_coin_drafts_version CHECK(ref_version='looke.content.v1')
);
CREATE INDEX IF NOT EXISTS looke_content_coin_drafts_author
  ON looke_content_coin_drafts(profile_id,updated_at DESC);
-- Draft snapshots remain private; posts removed by the author cascade-delete drafts.
-- Edited/hidden posts must fail preflight in the application until revalidated.
