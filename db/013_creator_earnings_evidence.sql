-- M17: private user-submitted transaction REFERENCES for reconciliation,
-- NOT verified earnings, immutable transfers, onchain settlement, or payouts.
-- Apply after db/001_social.sql in Looke's dedicated Neon instance.
CREATE TABLE IF NOT EXISTS looke_creator_payout_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  native_account VARCHAR(12) NOT NULL,
  tx_id CHAR(64) NOT NULL CHECK (tx_id ~ '^[a-f0-9]{64}$'),
  factory_id VARCHAR(20),
  evidence_kind VARCHAR(28) NOT NULL CHECK(
    evidence_kind IN ('resale_royalty','resale_seller_proceeds','other_creator_transfer')
  ),
  verification_status VARCHAR(16) NOT NULL DEFAULT 'unverified'
    CHECK(verification_status = 'unverified'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id,tx_id)
);
CREATE INDEX IF NOT EXISTS looke_creator_payout_evidence_profile
 ON looke_creator_payout_evidence(profile_id,created_at DESC);
-- There is deliberately no amount, balance, payout eligibility, verified status
-- or user-accessible settlement mutation; all submissions stay UNVERIFIED.
