-- M19 PROVISIONAL only: offchain social participation audit snapshots.
-- Not an airdrop, debt, issued token, reward balance or payout authorization.
-- Run after 001_social.sql and 005_social_interactions.sql in dedicated Looke Neon.
CREATE TABLE IF NOT EXISTS looke_participation_snapshots (
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  scoring_version INTEGER NOT NULL CHECK(scoring_version >= 1),
  provisional_points INTEGER NOT NULL CHECK(provisional_points BETWEEN 0 AND 518),
  active_days INTEGER NOT NULL CHECK(active_days BETWEEN 0 AND 14),
  counterpart_creators INTEGER NOT NULL CHECK(counterpart_creators >= 0),
  activity_digest CHAR(64) NOT NULL CHECK(activity_digest ~ '^[a-f0-9]{64}$'),
  evidence_summary JSONB NOT NULL,
  review_status VARCHAR(16) NOT NULL DEFAULT 'unverified'
    CHECK(review_status = 'unverified'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  first_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id,period_start,scoring_version),
  CHECK(period_end > period_start AND period_end <= period_start + 14),
  CHECK(jsonb_typeof(evidence_summary)='object')
);
CREATE INDEX IF NOT EXISTS looke_participation_snapshots_owner_recent
 ON looke_participation_snapshots(profile_id,period_end DESC);
-- Reconciliations increment revision if current moderation/source evidence differs.
-- A written snapshot does not convey eligibility or a distribution claim.
