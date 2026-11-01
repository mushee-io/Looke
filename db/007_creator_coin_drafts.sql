-- M9 signed-in creator coin draft preparation. No issuance, balances, payments or txs.
-- Apply after db/001_social.sql. Draft ownership enforced by authenticated API session.
CREATE TABLE IF NOT EXISTS looke_creator_coin_drafts (
  profile_id UUID PRIMARY KEY REFERENCES looke_profiles(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  symbol VARCHAR(12) NOT NULL CHECK(symbol ~ '^[A-Z0-9]{2,12}$'),
  supply_tokens BIGINT NOT NULL CHECK(supply_tokens BETWEEN 1 AND 1000000000),
  metadata_uri VARCHAR(256) NOT NULL CHECK(metadata_uri LIKE 'ipfs://%'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- This table contains intentions only. It must NEVER be used as proof of token
-- deployment, liquidity, market cap, or an audited creator identity.
