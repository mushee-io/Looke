-- M11: non-executable trend nominations and community endorsement signals only.
-- Apply after 001_social.sql and 008_content_coin_drafts.sql.
CREATE TABLE IF NOT EXISTS looke_trend_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_slug VARCHAR(48) UNIQUE NOT NULL CHECK(topic_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  topic_label VARCHAR(48) NOT NULL,
  trend_ref CHAR(66) UNIQUE NOT NULL CHECK(trend_ref ~ '^0x[0-9a-f]{64}$'),
  proposer_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE RESTRICT,
  proposer_address VARCHAR(42) NOT NULL,
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  symbol VARCHAR(12) NOT NULL CHECK(symbol ~ '^[A-Z0-9]{2,12}$'),
  supply_tokens BIGINT NOT NULL CHECK(supply_tokens BETWEEN 1 AND 1000000000),
  metadata_uri VARCHAR(256) NOT NULL CHECK(metadata_uri LIKE 'ipfs://%'),
  status VARCHAR(20) NOT NULL DEFAULT 'under_review'
    CHECK(status IN ('under_review','withdrawn','rejected','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_trend_proposals_recent
  ON looke_trend_proposals(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS looke_trend_proposals_author
  ON looke_trend_proposals(proposer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS looke_trend_endorsements (
  proposal_id UUID NOT NULL REFERENCES looke_trend_proposals(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(proposal_id,voter_id)
);
CREATE INDEX IF NOT EXISTS looke_trend_endorsements_voter_time
  ON looke_trend_endorsements(voter_id,created_at DESC);
-- Nomination and endorsement signals are mutable social database records,
-- not sybil-resistant votes, onchain governance authority or issuance approvals.
