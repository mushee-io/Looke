-- Looke M20: durable, repairable index of genuine PostgreSQL creator activity.
-- No fabricated engagement, automatic indexing schedule, synthetic rewards or token data.
CREATE TABLE IF NOT EXISTS social_activity_index (
  kind text NOT NULL CHECK(kind IN ('post','comment','like_received','repost_received')),
  source_id uuid NOT NULL,
  owner text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  source_actor text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,source_id)
);
CREATE INDEX IF NOT EXISTS social_activity_index_owner_recent_m20
  ON social_activity_index(owner,occurred_at DESC,source_id DESC);
CREATE INDEX IF NOT EXISTS social_activity_index_actor_recent_m20
  ON social_activity_index(source_actor,occurred_at DESC);
CREATE INDEX IF NOT EXISTS social_activity_index_occurred_m20
  ON social_activity_index(occurred_at,kind,source_id);

-- Exactly one transaction-locked checkpoint per supported stream.
-- Seeding the checkpoint is metadata only; it does not imply any activity.
CREATE TABLE IF NOT EXISTS social_index_checkpoints (
  stream text PRIMARY KEY CHECK(stream='creator_activity'),
  cursor_at timestamptz NOT NULL DEFAULT 'epoch',
  cursor_kind text NOT NULL DEFAULT '',
  cursor_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO social_index_checkpoints(stream) VALUES('creator_activity')
  ON CONFLICT(stream) DO NOTHING;

CREATE TABLE IF NOT EXISTS social_index_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('scan','rewind')),
  from_at timestamptz NOT NULL,
  to_at timestamptz NOT NULL,
  before_revision bigint NOT NULL CHECK(before_revision>=0),
  after_revision bigint NOT NULL CHECK(after_revision>=0),
  scanned integer NOT NULL CHECK(scanned BETWEEN 0 AND 100),
  inserted integer NOT NULL CHECK(inserted BETWEEN 0 AND 100),
  note varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(inserted<=scanned)
);
CREATE INDEX IF NOT EXISTS social_index_runs_recent_m20
  ON social_index_runs(created_at DESC,id DESC);

-- Append-only reviews of *evidence-backed signals*, not automatic sybil verdicts.
CREATE TABLE IF NOT EXISTS social_risk_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  signal text NOT NULL CHECK(signal IN ('repeated_counterparty','high_daily_activity')),
  counterparty text REFERENCES social_profiles(address) ON DELETE CASCADE,
  disposition text NOT NULL CHECK(disposition IN ('review','dismissed','escalated')),
  reviewer text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  note varchar(500) NOT NULL CHECK(char_length(btrim(note)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((signal='repeated_counterparty' AND counterparty IS NOT NULL AND counterparty<>owner)
    OR (signal='high_daily_activity' AND counterparty IS NULL))
);
CREATE INDEX IF NOT EXISTS social_risk_reviews_recent_m20
  ON social_risk_review_events(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS social_risk_reviews_owner_m20
  ON social_risk_review_events(owner,created_at DESC);
